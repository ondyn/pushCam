import express from "express"
import { createLogger, format, transports } from "winston"
import admin from "firebase-admin"
import { getFirestore } from "firebase/firestore"
import os from "os"

const port = 3000;
const app = express();
const topic = "cam-event";

var hostname = os.hostname();
var startTime = Date.now();

app.use(express.json());
const logger = createLogger({
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console(), new transports.File({ filename: "srv.log" })],
});

const getTestPayload = () => {
  return {
    notification: {
      title: `Test Notification`,
      body: `From ${hostname} at /test endpoint`
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
  credential: admin.credential.cert("config/pushcam-firebase.json")
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
      var msg = `Successfully sent test resp: ${response}, msg: ${payload}`;
      logger.info(msg);
      res.send(msg);
    })
    .catch(function (error) {
      var msg = `Error sending test resp: ${error}, msg: ${payload}`;
      logger.info(msg);
      res.send(msg);
    });
})

app.post('/', (req, res) => {
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
  logger.info(req.body);
  res.send('Got a POST request');
})



app.listen(port, () => {
  logger.info(`pushCam listening on port ${port}`)
})




//const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
//const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
//
//const serviceAccount = require('config/pushcam-firebase.json');
//
//initializeApp({
//  credential: cert(serviceAccount)
//});
//
//const db = getFirestore();
//
//const aTuringRef = db.collection('tst').doc('aturing');
//
//aTuringRef.set({
//  'first': 'Alan',
//  'middle': 'Mathison',
//  'last': 'Turing',
//  'born': 1912
//});
