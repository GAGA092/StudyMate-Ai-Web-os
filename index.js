// index.js – ES module entry point
import { EventEmitter } from 'events';
EventEmitter.defaultMaxListeners = 500;

import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

import { activeSockets, autoResumeSessions } from './pair.js';

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

// ─── Health & active sessions (kept for Render's health checks) ─
app.get('/', (req, res) => {
  res.json({ status: 'online', bot: 'StudyMate AI', school: "St Mary's High", pairing: 'via Telegram — message the bot with /start' });
});
app.get('/health', (req, res) => {
  res.json({ status: 'online', bot: 'StudyMate AI', school: "St Mary's High" });
});
app.get('/active', (req, res) => {
  res.json({ count: activeSockets.size, active: Array.from(activeSockets.keys()) });
});

// ─── Lab feature health check (unchanged) ────────────────────────
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

// ─── Start the bot (resume existing sessions + start Telegram) ──
autoResumeSessions().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception:', err);
});

app.listen(PORT, () => {
  console.log(`\n✅ Server running on port ${PORT}`);
  console.log(`📱 Pair WhatsApp by messaging your Telegram bot with /start\n`);
});

export default app;