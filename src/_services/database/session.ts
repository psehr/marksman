import * as admin from "firebase-admin";
var serviceAccount = require("@/serviceAccountKey.json");

let app = admin.initializeApp(
  {
    credential: admin.credential.cert(serviceAccount),
  },
  Date.now().toString()
);

let db = admin.firestore(app);

export default db;
