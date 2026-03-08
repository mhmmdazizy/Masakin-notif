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

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).send("Hanya menerima POST");

  const { recipientId, title, body } = req.body;

  if (!recipientId) return res.status(400).send("ID Penerima Kosong");

  try {
    const messagePayload = {
      notification: { title: title, body: body }
    };

    // === JURUS SHOTGUN: BROADCAST KE SEMUA USER ===
    if (recipientId === "all") {
      const usersSnapshot = await admin.firestore().collection("users").get();
      const tokens = [];
      
      // Sedot semua token dari database
      usersSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.fcmToken) tokens.push(data.fcmToken);
      });

      if (tokens.length === 0) return res.status(404).send("Belum ada user yang punya token.");

      // Tembak serentak pakai fitur Multicast Firebase
      const multicastMessage = {
        notification: messagePayload.notification,
        tokens: tokens // Maksimal 500 token sekali tembak
      };

      const response = await admin.messaging().sendMulticast(multicastMessage);
      return res.status(200).send(`Broadcast sukses ke ${response.successCount} HP!`);
    } 
    
    // === JURUS SNIPER: KIRIM KE 1 USER (KOMENTAR) ===
    else {
      const userDoc = await admin.firestore().collection("users").doc(recipientId).get();
      const fcmToken = userDoc.exists ? userDoc.data().fcmToken : null;

      if (!fcmToken) return res.status(404).send("User belum izinkan notif.");

      const singleMessage = {
        notification: messagePayload.notification,
        token: fcmToken
      };

      await admin.messaging().send(singleMessage);
      return res.status(200).send("Berhasil nembak notif 1 HP!");
    }
  } catch (error) {
    console.error("Gagal kirim:", error);
    return res.status(500).send("Sistem error: " + error.message);
  }
}
