import express from 'express';
import path from 'path';
// 'fileURLToPath' sudah tidak diperlukan lagi
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fetch from 'node-fetch';

// Konfigurasi awal
dotenv.config();
const app = express();

// Langsung gunakan '__dirname' yang disediakan oleh environment Netlify
// Tidak perlu deklarasi 'const __filename' atau 'const __dirname' lagi

// Pengaturan View Engine ke EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware Keamanan
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
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate Limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Terlalu banyak permintaan dari IP ini, silakan coba lagi setelah 15 menit',
});

// Route untuk halaman utama
app.get('/', (req, res) => {
    res.render('index', {
        title: 'HarkovAI - Chatbot',
        modelName: 'HarkovAI-4.5 (Secure)'
    });
});

// Route API sebagai Proxy
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

// Ekspor app untuk digunakan oleh serverless function
export default app;