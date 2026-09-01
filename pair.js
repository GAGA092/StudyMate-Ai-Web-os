// pair.js – ES module
import path from 'path';
import fs from 'fs-extra';
import pino from 'pino';
import QRCode from 'qrcode';
import crypto from 'crypto';
import {
  default as makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import botModule from './bot.js';

const SESSIONS_DIR = './session';
export const pairingCodes = new Map();   // phone -> { code, timestamp }
export const qrCodes = new Map();        // tempId -> { qr, timestamp }
export const activeSockets = new Map();  // identifier -> socket
let schedulersStarted = false;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Pairing via phone number (pairing code) ────────────────────
export async function EmpirePair(req, res) {
  const { number } = req.query;
  if (!number) {
    return res.status(400).json({ error: 'Number required' });
  }
  const cleanNum = number.replace(/[^0-9]/g, '');
  if (cleanNum.length < 10) {
    return res.status(400).json({ error: 'Invalid number format' });
  }

  if (activeSockets.has(cleanNum)) {
    return res.json({ code: 'already_connected' });
  }

  const sessionPath = path.join(SESSIONS_DIR, cleanNum);
  if (fs.existsSync(sessionPath)) fs.removeSync(sessionPath);

  pairingCodes.delete(cleanNum);
  startWhatsAppSession(cleanNum, { usePairing: true, isTemp: false });

  let pairingCode = null;
  for (let i = 0; i < 30; i++) {
    if (pairingCodes.has(cleanNum)) {
      pairingCode = pairingCodes.get(cleanNum).code;
      break;
    }
    await delay(500);
  }

  if (!pairingCode) {
    return res.status(504).json({ error: 'Timeout – no pairing code received' });
  }
  res.json({ code: pairingCode });
}

// ─── Pairing via QR code — NO phone number required ─────────────
// Baileys generates a QR for an anonymous session automatically;
// the real phone number is only known after the user scans it.
export async function EmpirePairQR(req, res) {
  const tempId = 'qr_' + crypto.randomBytes(8).toString('hex');

  startWhatsAppSession(tempId, { usePairing: false, isTemp: true });

  let qrString = null;
  for (let i = 0; i < 40; i++) {
    if (qrCodes.has(tempId)) {
      qrString = qrCodes.get(tempId).qr;
      break;
    }
    await delay(500);
  }

  if (!qrString) {
    return res.status(504).json({ error: 'Timeout – no QR code received' });
  }

  try {
    const qrImageBuffer = await QRCode.toBuffer(qrString, { type: 'png', width: 400, margin: 2 });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('X-Session-Temp-Id', tempId);
    res.send(qrImageBuffer);
  } catch (e) {
    res.status(500).json({ error: 'Failed to generate QR image' });
  }
}

// ─── Optional: poll a temp QR session's connection status ───────
export async function EmpirePairStatus(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });
  if (activeSockets.has(id)) {
    return res.json({ status: 'connected' });
  }
  if (!qrCodes.has(id) && !activeSockets.has(id)) {
    return res.json({ status: 'connected_or_expired' });
  }
  return res.json({ status: 'waiting' });
}

// ─── Start WhatsApp session ──────────────────────────────────────
// options: { usePairing: boolean, isTemp: boolean }
export async function startWhatsAppSession(identifier, options = {}) {
  const { usePairing = false, isTemp = false } = options;
  const sp = path.join(SESSIONS_DIR, identifier);
  try {
    const { state, saveCreds } = await useMultiFileAuthState(sp);
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }).child({ level: 'fatal' })) },
      browser: Browsers.macOS('Safari'),
      markOnlineOnConnect: true,
      connectTimeoutMs: 60000,
      syncFullHistory: false
    });
    activeSockets.set(identifier, sock);

    sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const m of messages) {
        try {
          await botModule.handleIncomingMessage(sock, m);
        } catch (e) {
          console.error(`[MSG ERROR] ${identifier}:`, e.message);
        }
      }
    });

    // Only request a pairing code if explicitly asked (phone-number flow)
    if (usePairing && !sock.authState.creds.registered) {
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(identifier);
          const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
          pairingCodes.set(identifier, { code: formatted, timestamp: Date.now() });
          console.log(`🔑 Pairing code for +${identifier}: ${formatted}`);
        } catch (e) {
          console.error(`Failed to get pairing code: ${e.message}`);
        }
      }, 6000);
    }
    // If usePairing is false and creds aren't registered yet, Baileys
    // emits a `qr` string via connection.update automatically.

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && !usePairing) {
        qrCodes.set(identifier, { qr, timestamp: Date.now() });
        console.log(`📱 QR code generated for ${identifier}`);
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code !== DisconnectReason.loggedOut && code !== 401) {
          setTimeout(() => startWhatsAppSession(identifier, options), 5000);
        } else {
          fs.removeSync(sp);
          activeSockets.delete(identifier);
          pairingCodes.delete(identifier);
          qrCodes.delete(identifier);
          console.log(`Session expired: ${identifier}`);
        }
      } else if (connection === 'open') {
        console.log(`✅ WhatsApp connected: ${identifier}`);
        const realNumber = sock.user.id.split(':')[0];
        const userJid = realNumber + '@s.whatsapp.net';

        try {
          await sock.sendMessage(userJid, {
            text: `✅ *StudyMate AI connected!*\n\nSend *start* to register and begin.\n\nDeveloper: +263716857999`
          });
        } catch (e) {
          console.error(`Welcome message failed: ${e.message}`);
        }

        qrCodes.delete(identifier);

        // ─── Migrate temp QR session → real phone-number session ───
        if (isTemp && realNumber && realNumber !== identifier) {
          console.log(`🔄 Migrating temp session ${identifier} → ${realNumber}`);
          try {
            const oldPath = sp;
            const newPath = path.join(SESSIONS_DIR, realNumber);

            activeSockets.delete(identifier);

            if (!fs.existsSync(newPath)) {
              await fs.copy(oldPath, newPath);
            }
            await fs.remove(oldPath);

            startWhatsAppSession(realNumber, { usePairing: false, isTemp: false });

            try { sock.end(undefined); } catch {}
            return;
          } catch (e) {
            console.error(`Migration error for ${identifier}:`, e.message);
          }
        }

        if (!schedulersStarted) {
          schedulersStarted = true;
          const { startReminderSchedulers, startBroadcastScheduler } = botModule;
          if (startReminderSchedulers) startReminderSchedulers(sock);
          if (startBroadcastScheduler) startBroadcastScheduler(sock);
        }
      }
    });

    sock.ev.on('creds.update', saveCreds);
    console.log(`✅ WhatsApp session started: ${identifier}`);
    return sock;
  } catch (e) {
    console.error(`❌ Session error [${identifier}]:`, e.message);
    return null;
  }
}

export async function autoResumeSessions() {
  if (!fs.existsSync(SESSIONS_DIR)) return;
  const items = fs.readdirSync(SESSIONS_DIR);
  let found = false;
  for (const name of items) {
    const fullPath = path.join(SESSIONS_DIR, name);
    if (!fs.lstatSync(fullPath).isDirectory()) continue;
    if (name === 'node_modules') continue;
    if (name.startsWith('qr_')) { fs.removeSync(fullPath); continue; } // drop orphaned temp sessions
    if (!fs.existsSync(path.join(fullPath, 'creds.json'))) continue;
    found = true;
    console.log(`🚀 Resuming session: ${name}`);
    startWhatsAppSession(name, { usePairing: false, isTemp: false });
  }
  if (!found) console.log('⚠️ No sessions found. Use /code or /pair-qr to pair.');
}