const crypto = require('crypto');
const admin = require('firebase-admin');

// 1. Konek ke Firebase secara "Jalur Dalam" (Admin)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            // Akali karakter newline agar terbaca benar oleh Vercel
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), 
        })
    });
}

const db = admin.firestore();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Jalur dilarang' });

    const data = req.body;

    // 2. Pengecekan Keamanan (Pastikan yang ngirim ini beneran Midtrans, bukan Hacker)
    const hash = crypto.createHash('sha512').update(`${data.order_id}${data.status_code}${data.gross_amount}${process.env.MIDTRANS_SERVER_KEY}`).digest('hex');
    
    if (data.signature_key !== hash) {
        return res.status(403).json({ message: 'Akses ditolak. Keamanan tidak valid.' });
    }

    // 3. Cek Status Pembayaran
    const transactionStatus = data.transaction_status;
    const fraudStatus = data.fraud_status;
    const uid = data.custom_field1; // Mengambil UID yang kita titipkan tadi

    if (!uid) return res.status(400).json({ message: 'UID tidak ditemukan' });

    if (transactionStatus == 'capture' || transactionStatus == 'settlement') {
        if (fraudStatus == 'accept' || !fraudStatus) {
            
            // 🔥 UANG MASUK! AKTIFKAN CENTANG BIRU SELAMA 30 HARI 🔥
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30); 

            await db.collection('users').doc(uid).update({
                isPremium: true,
                premiumStatus: "approved",
                premiumExpiresAt: admin.firestore.Timestamp.fromDate(expiryDate)
            });
        }
    } else if (transactionStatus == 'cancel' || transactionStatus == 'deny' || transactionStatus == 'expire') {
        // Kalau batal/kadaluarsa, kembalikan statusnya
        await db.collection('users').doc(uid).update({
            premiumStatus: "failed"
        });
    }

    // Wajib balas "OK" biar Midtrans berhenti ngirim notifikasi
    res.status(200).json({ message: 'OK' });
}
