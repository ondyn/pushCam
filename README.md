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

