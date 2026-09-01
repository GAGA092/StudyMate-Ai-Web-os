// index.js – ES module entry point
import { EventEmitter } from 'events';
EventEmitter.defaultMaxListeners = 500;

import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

import { EmpirePair, EmpirePairQR, EmpirePairStatus, activeSockets, autoResumeSessions } from './pair.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const SESSIONS_DIR = './session';
const DATA_DIR = './data';
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/public', express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'main.html'));
});

// ─── Pairing routes ────────────────────────────────────────────
app.get('/code', EmpirePair);              // needs ?number=
app.get('/pair-qr', EmpirePairQR);         // no params needed
app.get('/pair-status', EmpirePairStatus); // optional polling

// ─── Health & active sessions ──────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'online', bot: 'StudyMate AI', school: "St Mary's High" });
});
app.get('/active', (req, res) => {
  res.json({ count: activeSockets.size, active: Array.from(activeSockets.keys()) });
});

// ─── Lab feature health check ───────────────────────────────────
let labHealthCache = { checkedAt: 0, data: null };
const LAB_HEALTH_TTL_MS = 60000;

app.get('/lab-health', async (req, res) => {
  const now = Date.now();
  if (labHealthCache.data && (now - labHealthCache.checkedAt) < LAB_HEALTH_TTL_MS) {
    return res.json({ ...labHealthCache.data, cached: true });
  }

  const result = { ai: false, imageGen: false, checkedAt: new Date().toISOString() };

  try {
    const { askAI, generateImage } = await import('./bot.js');

    try {
      const aiTest = await Promise.race([
        askAI('Reply with only the word OK.', null, null, 'en'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 12000))
      ]);
      result.ai = typeof aiTest === 'string' && aiTest.trim().length > 0;
    } catch (e) {
      result.ai = false;
      result.aiError = e.message;
    }

    try {
      const imgTest = await Promise.race([
        generateImage('a small red circle on white background'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 20000))
      ]);
      result.imageGen = Buffer.isBuffer(imgTest) && imgTest.length > 500;
    } catch (e) {
      result.imageGen = false;
      result.imageGenError = e.message;
    }
  } catch (e) {
    result.error = `Could not load bot module: ${e.message}`;
  }

  result.labReady = result.ai && result.imageGen;
  labHealthCache = { checkedAt: now, data: result };
  res.json({ ...result, cached: false });
});

// ─── Start the bot (resume existing sessions) ──────────────────
autoResumeSessions().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});

// ─── Process-level safety nets (prevents silent crashes in prod) ─
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception:', err);
});

app.listen(PORT, () => {
  console.log(`\n✅ Server running on http://localhost:${PORT}`);
  console.log(`🔗 Pair (code): http://localhost:${PORT}/code?number=YOUR_NUMBER`);
  console.log(`🔗 Pair (QR):   http://localhost:${PORT}/pair-qr`);
  console.log(`🧪 Lab health:  http://localhost:${PORT}/lab-health\n`);
});

export default app;