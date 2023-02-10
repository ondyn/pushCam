import express from "express"
import { createLogger, format, transports } from "winston"
import admin from "firebase-admin"
import os from "os"
import file from "fs"
import { v4 as uuidv4 } from 'uuid';

import { readFile } from 'fs/promises';
const config = JSON.parse(
  await readFile(
    new URL('config/pushcam-firebase.json', import.meta.url)
  )
);

const port = 3000;
const app = express();
const topic = "cam-event";

var hostname = os.hostname();
var startTime = Date.now();

// fixing "413 Request Entity Too Large" errors
app.use(express.json({ limit: "10mb", extended: true }))
app.use(express.urlencoded({ limit: "10mb", extended: true, parameterLimit: 50000 }))
app.use(express.json());

const logger = createLogger({
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console(), new transports.File({ filename: "srv.log" })],
});

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
  credential: admin.credential.cert(config)
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
  admin.messaging().sendToTopic(topic, payload, options)
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

app.post('/', async (req, res) => {


  //{"image":"{BASE64IMAGE}", "id":"{ID}", "ot":"{OT}", "filename":"{FILENAME}","msg":"{MSG}", "name":"{NAME}", "groups":"{GROUPS}",
  // "location":"{LOCATION}", "ai_objects":"{AI}", "timestamp":"{0:MM-dd}"}

  //{ID}: The object ID. When you edit a camera or microphone in Agent this is displayed at top left of the editor.
  // {OT}: The object type ID. 1 = Microphone, 2 = Camera
  // {FILENAME}: The filename. This applies to events like Recording Started, Recording Finished and Snapshot Taken. It's the full local path to the file.
  // {MSG}: The event name that triggered the action, for example "Manual Alert"
  // {NAME}: The name of the device (on the General tab)
  // {GROUPS}: The groups the device belongs to (on the General tab)
  // {LOCATION}: The location the camera is in (on the General tab)
  // {AI}: Comma separated list of detected objects from DeepStack, plates from LPR or detected faces from Facial Recognition
  // {AIJSON}: JSON data returned from DeepStack or LPR
  // {BASE64IMAGE}: Live image data URL for example: "data:image/jpeg;base64,..." (available v4.3.6.0+)
  
  //logger.info(req.body);
  const time = Date.now();


  // store image to firestore
  var base64Data = req.body.image.replace(/^data:image\/jpeg;base64,/, "");

  const path = `img/${time}.png`;
  file.writeFile(path, base64Data, 'base64', function (err) {
    logger.info(err);
  });
  
  const bucket = admin.storage().bucket(`gs://${config.bucket}`);
  let uuid = uuidv4();
  var url = "";

  await bucket.upload(path, {
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
    url = "https://firebasestorage.googleapis.com/v0/b/" + config.bucket + "/o/" + encodeURIComponent(file.name) + "?alt=media&token=" + uuid;
  }).catch(err => {
    logger.info('ERROR:', err);
  });

  // push message
  var payload = {
    notification: {
      title: `Cam Notification`,
      body: `From ${hostname}`
    },
    data: {
      timestampUtc: (new Date).toUTCString(),
      runTime: (time - startTime).toString(),//in ms
      imagePath: url,
      location: req.body.location,
      group: req.body.groups,
      name:  req.body.name,
      msg: req.body.msg,
      objectType: req.body.ot,
      camId: req.body.id
    }
  };

  admin.messaging().sendToTopic(topic, payload)
    .then(function (response) {
      var msg = `Successfully sent resp: ${JSON.stringify(response)}, msg: ${JSON.stringify(payload)}`;
      logger.info(msg);
      res.send(msg);
    })
    .catch(function (error) {
      var msg = `Error sending resp: ${JSON.stringify(error)}, msg: ${JSON.stringify(payload)}`;
      logger.info(msg);
      res.send(msg);
    });

})

app.listen(port, () => {
  logger.info(`pushCam listening on port ${port}`)
})
