// ================================================================
// index.js – StudyMate AI Bot & Web Server
// ================================================================
require('events').EventEmitter.defaultMaxListeners = 500;

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs-extra');

// ─── Import modules ──────────────────────────────────────────────
const { makeid } = require('./id');
const { sms, downloadMediaMessage } = require('./msg');
const { EmpirePair, pairingCodes, activeSockets, startWhatsAppSession, autoResumeSessions } = require('./pair');

// ─── Constants ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const SESSIONS_DIR = './session';
const DATA_DIR = './data';
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ─── Express app ─────────────────────────────────────────────────
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve main HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'main.html'));
});

// Pairing route – uses EmpirePair from pair.js
app.get('/code', EmpirePair);

// Health & active sessions
app.get('/health', (req, res) => {
  res.json({ status: 'online', bot: 'StudyMate AI', school: "St Mary's High" });
});
app.get('/active', (req, res) => {
  res.json({ count: activeSockets.size, active: Array.from(activeSockets.keys()) });
});

// ─── Start the bot ───────────────────────────────────────────────
async function startBot() {
  console.log('🚀 Starting StudyMate AI v5.0...');
  await autoResumeSessions();
  // The WhatsApp message handlers are attached inside the session logic in pair.js
  // Schedulers are started inside the connection 'open' event.
}

startBot().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});

// ─── Server listen ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅ Server running on http://localhost:${PORT}`);
  console.log(`🔗 Pair: http://localhost:${PORT}/code?number=YOUR_NUMBER\n`);
});

module.exports = app;