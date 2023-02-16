# pushCam
Firebase FCM for receiving push notification from camera detection via REST API

install node with npm
run npm i

to start project run node index.js

add config JSON file to /config/pushcam-firebase.json
>you can get this file from console.firebase.google.com/project/XXX/settings/serviceaccounts/adminsdk --> generate new private key

example:
```json
{
  "type": "service_account",
  "project_id": "",
  "private_key_id": "",
  "private_key": "-----BEGIN PRIVATE KEY-----\n\n-----END PRIVATE KEY-----\n",
  "client_email": ".iam.gserviceaccount.com",
  "client_id": "",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-.iam.gserviceaccount.com"
}
```


https://www.techotopia.com/index.php/Sending_Firebase_Cloud_Messages_from_a_Node.js_Server



1) Download nssm from http://nssm.cc/download/?page=download and extract nssm.exe, for example to %windir%\system32\

2) Install your service:

nssm.exe install my-node-service c:\programs\nodejes\node.exe c:\my\server.js

3) Start it using net start:

net start my-node-service

(From http://blog.tatham.oddie.com.au/2011/03/16/node-js-on-windows/)

## Firebase storage rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if
          request.time < timestamp.date(2023, 3, 9);
      allow write: if
      		request.auth.token.admin;
    }
  }
}

## iSpyCam action message & variables:
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