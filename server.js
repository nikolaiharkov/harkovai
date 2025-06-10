import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fetch from 'node-fetch';

// Konfigurasi awal
dotenv.config();
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pengaturan View Engine ke EJS
app.set('view engine', 'ejs');
app.set('views', path.join(currentDirname, 'views'));

// Middleware Keamanan
// Middleware Keamanan
// ... (kode sebelumnya)
app.use(
    helmet.contentSecurityPolicy({
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "script-src": ["'self'", "https://cdn.tailwindcss.com", "https://cdn.jsdelivr.net"],
            "style-src": ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com", "'unsafe-inline'"],
            "font-src": ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"]
        },
    })
);
// ... (kode setelahnya)
app.use(express.json()); // Mem-parsing body JSON dari request
app.use(express.static(path.join(currentDirname, 'public')));

// Rate Limiter untuk mencegah serangan brute-force/spam
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 menit
    max: 100, // Batasi setiap IP hingga 100 permintaan per window
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Terlalu banyak permintaan dari IP ini, silakan coba lagi setelah 15 menit',
});

// Route untuk menyajikan halaman utama
app.get('/', (req, res) => {
    // Menggunakan res.render untuk menyajikan file EJS dari folder /views
    res.render('index', {
        title: 'HarkovAI - Chatbot',
        modelName: 'HarkovAI-4.5 (Secure)'
    });
});

// Route API sebagai Proxy ke Webhook (Lebih Aman)
app.post('/api/chat', apiLimiter, async (req, res) => {
    const { text, sessionId } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'Pesan tidak boleh kosong' });
    }

    try {
        const webhookUrl = process.env.N8N_WEBHOOK_URL;
        if (!webhookUrl) {
            throw new Error('URL Webhook tidak dikonfigurasi di server.');
        }

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, sessionId })
        });

        if (!response.ok) {
            throw new Error(`Error dari webhook: ${response.statusText}`);
        }

        const data = await response.json();
        res.json({ reply: data.reply });

    } catch (error) {
        console.error('Error saat menghubungi webhook:', error);
        res.status(500).json({ reply: `Maaf, terjadi masalah di sisi server: ${error.message}` });
    }
});


// Menjalankan server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server berjalan dengan aman di http://localhost:${PORT}`);
});

export default app;