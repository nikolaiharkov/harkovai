import serverless from 'serverless-http';
import app from '../../server.js'; // Impor aplikasi Express dari server.js

// Bungkus aplikasi Express agar kompatibel dengan AWS Lambda (yang digunakan Netlify)
export const handler = serverless(app);