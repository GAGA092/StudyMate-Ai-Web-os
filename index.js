// index.js – ES module entry point
import { EventEmitter } from 'events';
EventEmitter.defaultMaxListeners = 500;

import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

// Import from our modules
import { EmpirePair, pairingCodes, activeSockets, autoResumeSessions } from './pair.js';
// No need to import startBot – we will call autoResumeSessions directly.

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const PORT = process.env.PORT || 3000;
const SESSIONS_DIR = './session';
const DATA_DIR = './data';
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

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

// Start the bot (resume sessions)
autoResumeSessions().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});

app.listen(PORT, () => {
  console.log(`\n✅ Server running on http://localhost:${PORT}`);
  console.log(`🔗 Pair: http://localhost:${PORT}/code?number=YOUR_NUMBER\n`);
});

export default app;
