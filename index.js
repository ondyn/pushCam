import express from "express"
import { createLogger, format, transports } from "winston"
import admin from "firebase-admin"
import os from "os"
import file from "fs"
import { v4 as uuidv4 } from 'uuid';
import axios from "axios";
import config from "config";

const iSpyAgentIP = config.get('iSpyAgent.ip');
const iSpyAgentPort = config.get('iSpyAgent.port');

const logger = createLogger({
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console(), new transports.File({ filename: "srv.log" })],
});

import { readFile } from 'fs/promises';
const configFB = JSON.parse(
  await readFile(
    new URL('config/pushcam-firebase.json', import.meta.url)
  )
);

const port = 3000;
const app = express();
const eventTopic = "cam-event";
const statusTopic = "cam-status";
const cmdTopic = "cam-cmd";

var hostname = os.hostname();
var startTime = Date.now();

// fixing "413 Request Entity Too Large" errors
app.use(express.json({ limit: "10mb", extended: true }))
app.use(express.urlencoded({ limit: "10mb", extended: true, parameterLimit: 50000 }))
app.use(express.json());

const getTestPayload = () => {
  return {
    notification: {
      title: `Test Notification`,
      body: `From ${hostname}`
    },
    data: {
      timestampUtc: (new Date).toUTCString(),
      runTime: (Date.now() - startTime).toString()
    }
  };
}

app.use(function (err, req, res, next) {
  // 'SyntaxError: Unexpected token n in JSON at position 0'
  logger.error(err.message);
  next(err);
});

admin.initializeApp({
  credential: admin.credential.cert(configFB),
  databaseURL: configFB.database
})

app.get('/', (req, res) => {
  res.send(getTestPayload())
});

app.get('/test', (req, res) => {

  //admin.messaging().sendToDevice(registrationToken, payload, options)

  var options = {
    priority: "normal", // normal/high
    timeToLive: 60 * 60 * 24 // up to four weeks (2419200 seconds). If no TTL is specified the default is four weeks.
  };
  var payload = getTestPayload();

  admin.messaging().sendToTopic(eventTopic, payload, options)
    .then(function (response) {
      var msg = `Successfully sent test resp: ${JSON.stringify(response)}, msg: ${JSON.stringify(payload)}`;
      logger.info(msg);
      res.send(msg);
    })
    .catch(function (error) {
      var msg = `Error sending test resp: ${JSON.stringify(error)}, msg: ${JSON.stringify(payload)}`;
      logger.info(msg);
      res.send(msg);
    });
})

const notifyImage=(async (imagePath, imageName, msg)=>{
  const bucket = admin.storage().bucket(`gs://${configFB.bucket}`);
  let uuid = uuidv4();
  var url = "";

  await bucket.upload(imagePath, {
    //destination: `tst`,
    //destination: 'foo/sub/bar.png',

    gzip: true,
    metadata: {
      cacheControl: 'public, max-age=31536000',
      metadata: {
        firebaseStorageDownloadTokens: uuid
      }
    }
  }).then((data) => {
    let file = data[0];
    logger.info('file uploaded.');
    url = "https://firebasestorage.googleapis.com/v0/b/" + configFB.bucket + "/o/" + encodeURIComponent(file.name) + "?alt=media&token=" + uuid;
  }).catch(err => {
    logger.info('ERROR:', err);
  });

  // push message
  var payload = {
    notification: {
      title: `Cam Notification`,
      body: msg
    },
    data: {
      timestampUtc: (new Date).toUTCString(),
      //runTime: (time - startTime).toString(),//in ms
      imagePath: url,
      //location: req.body.location,
      //group: req.body.groups,
      //name: req.body.name,
      //msg: req.body.msg,
      //objectType: req.body.ot,
      //camId: req.body.id
    }
  };

  admin.messaging().sendToTopic(eventTopic, payload)
    .then(function (response) {
      var msg = `Successfully sent resp: ${JSON.stringify(response)}, msg: ${JSON.stringify(payload)}`;
      logger.info(msg);      
    })
    .catch(function (error) {
      var msg = `Error sending resp: ${JSON.stringify(error)}, msg: ${JSON.stringify(payload)}`;
      logger.info(msg);      
    });
});

app.post('/', async (req, res) => {




  //logger.info(req.body);
  const time = Date.now();


  // store image to firestore
  var base64Data = req.body.image.replace(/^data:image\/jpeg;base64,/, "");

  const path = `img/${time}.png`;
  file.writeFile(path, base64Data, 'base64', function (err) {
    logger.info(err);
  });

  await notifyImage(path, time, 'Alarm')

})

// var inst = FirebaseMessaging.getInstance();
// inst.subscribeToTopic("cam-cmd");
// inst.on

var armed = true;
var timerID = setInterval(() => {
  axios.get(`http://${iSpyAgentIP}:${iSpyAgentPort}/command/getStatus`).then(resp => {
    var time = Date.now();
    var armedTmp = resp.data.armed;
    if (armedTmp != armed) {
      armed = armedTmp;

      var db = admin.database();
      const ref = db.ref('statuses/cameras/1/arm');
      ref.update({"armed": armed, "lastTimeStampUtc": time})

      var payload = {
        notification: {
          title: `Cam Status`,
          body: `Armed ${armed}`
        },
        data: {
          timestampUtc: time.toString(),
          armed: armed.toString()
        }
      }

      admin.messaging().sendToTopic(statusTopic, payload)
        .then(function (response) {
          var msg = `Successfully sent: ${JSON.stringify(response)}, msg: ${JSON.stringify(payload)}`;
          logger.info(msg);
        })
        .catch(function (error) {
          var msg = `Error sending: ${JSON.stringify(error)}, msg: ${JSON.stringify(payload)}`;
          logger.info(msg);
        });
    }
  })
}, 1000);

// Get a database reference to our posts
var db = admin.database();
const ref = db.ref('commands/cameras/1/arm');
const ref2 = db.ref('commands/cameras/1/image');

// Attach an asynchronous callback to read the data at our posts reference
ref.on('value', (snapshot) => {
  logger.info(`arm DB changed to:${snapshot.val()}`);
  const arm = snapshot.val()['armedCmd'];
  if (arm) {
    axios.get(`http://${iSpyAgentIP}:${iSpyAgentPort}/command/arm`);
  } else {
    axios.get(`http://${iSpyAgentIP}:${iSpyAgentPort}/command/disarm`);
  }
}, (errorObject) => {
  logger.info('The read failed: ' + errorObject.name);
});

const downloadImage = ( async (fileName) =>{
  const path = `img/req${fileName}.png`;
  const writer = file.createWriteStream(path)

  const res = await axios.get(`http://${iSpyAgentIP}:${iSpyAgentPort}/grab.jpg`, { params: { oid: 1, size: '640x1138' }, responseType: 'stream' });

  res.data.pipe(writer)

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve)
    writer.on('error', reject)
  })
});

ref2.on('value', async (snapshot) => {
  logger.info('image DB req');
  const time = Date.now();
  const path = `img/req${snapshot.val()['lastTimeStampUtc']}.png`;
  await downloadImage(snapshot.val()['lastTimeStampUtc']);
  await notifyImage(path, time, 'Requested image')

}, (errorObject) => {
  logger.info('The read failed: ' + errorObject.name);
});


app.listen(port, () => {
  logger.info(`pushCam listening on port ${port}`)
})
