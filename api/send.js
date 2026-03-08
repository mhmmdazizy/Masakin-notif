const admin = require("firebase-admin");

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).send("Hanya menerima POST");
  }

  const { recipientId, title, body } = req.body;

  if (!recipientId) return res.status(400).send("ID Penerima Kosong");

  try {
    const userDoc = await admin.firestore().collection("users").doc(recipientId).get();
    const fcmToken = userDoc.exists ? userDoc.data().fcmToken : null;

    if (!fcmToken) {
      return res.status(404).send("User belum izinkan notif di HP-nya.");
    }

    const message = {
      notification: { 
        title: title, 
        body: body 
      },
      token: fcmToken
    };

    await admin.messaging().send(message);
    return res.status(200).send("Berhasil nembak notif Android!");
  } catch (error) {
    console.error("Gagal kirim:", error);
    return res.status(500).send("Sistem error: " + error.message);
  }
}
