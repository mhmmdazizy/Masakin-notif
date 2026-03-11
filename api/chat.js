export default async function handler(req, res) {
  // Buka pintu biar web Masakin bisa ngirim data ke Vercel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).send("Hanya menerima POST");

  // Nerima pertanyaan (prompt) dan data resep Masakin (contextData) dari app.js
  const { prompt, contextData } = req.body;

  if (!prompt) return res.status(400).send("Pertanyaan kosong");

  // Ambil Kunci Rahasia dari brankas Vercel
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).send("API Key belum disetting di Vercel");

  // JURUS PROMPT INJECTION: Memaksa Gemini jadi Chef Masakin
  const systemInstruction = `Kamu adalah Chef AI asisten khusus untuk aplikasi Masakin. 
Tugasmu adalah menjawab pertanyaan user dengan ramah dan asik.
PENTING: Jawablah HANYA berdasarkan Data Resep Masakin berikut ini. Jika user bertanya resep yang tidak ada di data, bilang dengan sopan kalau resep itu belum ada di aplikasi Masakin.

Data Resep Masakin:
${contextData}`;

  try {
    // Tembak data ke server Google Gemini
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{ text: systemInstruction + "\n\nPertanyaan User: " + prompt }]
        }]
      })
    });

    const data = await response.json();
    
    if (data.error) throw new Error(data.error.message);

    const aiReply = data.candidates[0].content.parts[0].text;
    
    // Kembalikan jawaban AI ke web Masakin
    return res.status(200).json({ reply: aiReply });

  } catch (error) {
    console.error("Gagal nanya Gemini:", error);
    return res.status(500).json({ error: "Waduh, Chef AI lagi sibuk di dapur: " + error.message });
  }
}
