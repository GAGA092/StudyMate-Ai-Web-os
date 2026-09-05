// pair.js – ES module – Telegram-based WhatsApp pairing
import path from 'path';
import fs from 'fs-extra';
import pino from 'pino';
import QRCode from 'qrcode';
import TelegramBot from 'node-telegram-bot-api';
import * as baileysNS from '@whiskeysockets/baileys';
import botModule from './bot.js';
import { BOT_NAME_PLAIN, CONTACT_LINK } from './bot.js';

// ─── Resolve Baileys exports safely across versions ──────────────
const makeWASocket = baileysNS.makeWASocket || baileysNS.default;
const useMultiFileAuthState = baileysNS.useMultiFileAuthState || baileysNS.default?.useMultiFileAuthState;
const DisconnectReason = baileysNS.DisconnectReason || baileysNS.default?.DisconnectReason;
const Browsers = baileysNS.Browsers || baileysNS.default?.Browsers;
const fetchLatestBaileysVersion = baileysNS.fetchLatestBaileysVersion || baileysNS.default?.fetchLatestBaileysVersion;
const makeCacheableSignalKeyStore = baileysNS.makeCacheableSignalKeyStore || baileysNS.default?.makeCacheableSignalKeyStore;

if (typeof makeWASocket !== 'function') {
  console.error('❌ FATAL: makeWASocket could not be resolved from @whiskeysockets/baileys.');
  console.error('Top-level exports:', Object.keys(baileysNS));
  if (baileysNS.default) {
    console.error('Default export type:', typeof baileysNS.default);
    if (typeof baileysNS.default === 'object') console.error('Default export keys:', Object.keys(baileysNS.default));
  }
}

// ─── Telegram bot init ────────────────────────────────────────
let telegram = null;
if (!TG_TOKEN) {
  console.error('❌ TG_TOKEN not set — Telegram pairing bot will not start. Set the TG_TOKEN environment variable.');
} else {
  try {
    telegram = new TelegramBot(TG_TOKEN, { polling: true });
    console.log('✅ Telegram pairing bot started');
  } catch (err) {
    console.error('❌ Telegram bot failed to start:', err.message);
    telegram = null;
  }
}

// ─── Cleanup helper: tears down a pending (not-yet-linked) session ─
async function expireSession(identifier, { removeFiles = true, notifyChatId = null } = {}) {
  console.log(`⏰ Expiring pending session: ${identifier}`);
  const timer = pairingTimers.get(identifier);
  if (timer) clearTimeout(timer);
  pairingTimers.delete(identifier);

  const sock = pendingSockets.get(identifier);
  pendingSockets.delete(identifier);

  if (sock && !activeSockets.has(identifier)) {
    try { sock.end(new Error('pairing_expired')); } catch {}
  }

  if (removeFiles) {
    const sp = path.join(SESSIONS_DIR, identifier);
    try {
      if (fs.existsSync(sp)) await fs.remove(sp);
    } catch (e) {
      console.error(`Failed to remove expired session dir ${identifier}:`, e.message);
    }
  }

  if (notifyChatId && telegram) {
    if (qrMessages.has(notifyChatId)) {
      telegram.deleteMessage(notifyChatId, qrMessages.get(notifyChatId)).catch(() => {});
      qrMessages.delete(notifyChatId);
    }
    telegram.sendMessage(notifyChatId, '⌛ That code/QR expired after 1 minute. Send /link to try again.').catch(() => {});
  }
}

// ─── Wait until the socket's underlying websocket is open ────────
function waitForSocketOpen(sock, timeoutMs) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const ws = sock?.ws;
      if (ws && ws.readyState === 1) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('Timed out waiting for socket to open'));
      setTimeout(check, 200);
    };
    check();
  });
}

// ─── Start a WhatsApp session, optionally reporting progress to Telegram ─
export async function startWhatsAppSession(tgChatId, identifier, usePairing) {
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

    pendingSockets.set(identifier, sock);

    sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const m of messages) {
        try {
          await botModule.handleIncomingMessage(sock, m);
        } catch (e) {
          console.error(`[MSG ERROR] ${identifier}:`, e.message);
        }
      }
    });

    // ─── Pairing code flow ───────────────────────────────────────
    if (usePairing && !sock.authState.creds.registered && tgChatId) {
      (async () => {
        try {
          await waitForSocketOpen(sock, 20000);
          await delay(1500); // Baileys needs a beat after ws opens
          const code = await sock.requestPairingCode(identifier);
          const formatted = code?.match(/.{1,4}/g)?.join('-') || code;

          if (telegram) {
            await telegram.sendMessage(
              tgChatId,
              `🔑 *Pairing Code:*\n\`${formatted}\`\n\n📱 In WhatsApp: Settings → Linked Devices → Link with phone number → enter this code.\n\n⏰ Expires in 60 seconds.`,
              { parse_mode: 'Markdown' }
            );
          }

          const timer = setTimeout(() => expireSession(identifier, { removeFiles: true, notifyChatId: tgChatId }), EXPIRY_MS);
          pairingTimers.set(identifier, timer);
        } catch (e) {
          console.error(`Failed to get pairing code for ${identifier}: ${e.message}`);
          if (telegram && tgChatId) {
            telegram.sendMessage(tgChatId, `❌ Failed to generate pairing code: ${e.message}\n\nTry /link for a QR code instead.`).catch(() => {});
          }
          pendingSockets.delete(identifier);
        }
      })();
    }

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && tgChatId && !usePairing && telegram) {
        try {
          const qrBuf = await QRCode.toBuffer(qr, { type: 'png', width: 400 });
          if (qrMessages.has(tgChatId)) {
            telegram.deleteMessage(tgChatId, qrMessages.get(tgChatId)).catch(() => {});
          }
          const sent = await telegram.sendPhoto(tgChatId, qrBuf, {
            caption: '📱 Scan with WhatsApp → Linked Devices → Link a Device\n\n⏰ Expires in 60 seconds.',
            reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'cancel' }]] }
          });
          qrMessages.set(tgChatId, sent.message_id);

          const existingTimer = pairingTimers.get(identifier);
          if (existingTimer) clearTimeout(existingTimer);
          const timer = setTimeout(() => expireSession(identifier, { removeFiles: true, notifyChatId: tgChatId }), EXPIRY_MS);
          pairingTimers.set(identifier, timer);
        } catch (e) {
          console.error(`Failed to send QR to Telegram: ${e.message}`);
        }
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        const wasNeverLinked = !activeSockets.has(identifier);

        if (code === DisconnectReason.loggedOut || code === 401) {
          try { fs.removeSync(sp); } catch {}
          activeSockets.delete(identifier);
          pendingSockets.delete(identifier);
          const timer = pairingTimers.get(identifier);
          if (timer) clearTimeout(timer);
          pairingTimers.delete(identifier);
          if (telegram && tgChatId) {
            telegram.sendMessage(tgChatId, '⚠️ Session logged out. Send /link to reconnect.').catch(() => {});
          }
          console.log(`Session logged out: ${identifier}`);
          return;
        }

        if (wasNeverLinked) {
          // Closed before ever linking — let the 60s expiry (or this
          // close event itself) clean it up; don't auto-reconnect a
          // session that was never actually established.
          console.log(`Session closed before linking: ${identifier}`);
          pendingSockets.delete(identifier);
          return;
        }

        // Was a real, previously-linked session — reconnect
        setTimeout(() => startWhatsAppSession(null, identifier, false), 5000);
      } else if (connection === 'open') {
        console.log(`✅ WhatsApp connected: ${identifier}`);
        activeSockets.set(identifier, sock);
        pendingSockets.delete(identifier);

        const timer = pairingTimers.get(identifier);
        if (timer) clearTimeout(timer);
        pairingTimers.delete(identifier);

        if (telegram && tgChatId) {
          if (qrMessages.has(tgChatId)) {
            telegram.deleteMessage(tgChatId, qrMessages.get(tgChatId)).catch(() => {});
            qrMessages.delete(tgChatId);
          }
          telegram.sendMessage(tgChatId, `✅ WhatsApp connected as +${identifier}!\n\nSend *start* on WhatsApp to begin.`, { parse_mode: 'Markdown' }).catch(() => {});
        }

        try {
          const userJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
          await sock.sendMessage(userJid, {
            text: `✅ *${BOT_NAME_PLAIN} connected!*\n\nSend *start* to register and begin.\n\nDeveloper: ${CONTACT_LINK}`
          });
        } catch (e) {
          console.error(`Welcome message failed: ${e.message}`);
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
    console.error(`❌ Session error [${identifier}]: ${e.message}`);
    pendingSockets.delete(identifier);
    if (telegram && tgChatId) {
      telegram.sendMessage(tgChatId, `❌ Session error: ${e.message}`).catch(() => {});
    }
    return null;
  }
}

// ─── QR link handler (used by /link command and the button) ──────
async function handleQRLink(chatId) {
  const sid = String(chatId);

  // Clear any existing pending/active attempt for this chat's session id first
  await expireSession(sid, { removeFiles: true });
  if (activeSockets.has(sid)) {
    try { activeSockets.get(sid).end(undefined); } catch {}
    activeSockets.delete(sid);
  }

  await telegram.sendMessage(chatId, '⏳ Generating QR code...');
  startWhatsAppSession(chatId, sid, false);
}

// ─── Telegram command wiring ──────────────────────────────────
if (telegram) {
  telegram.onText(/\/start/, (msg) => {
    telegram.sendMessage(
      msg.chat.id,
      `👋 *${BOT_NAME_PLAIN} Manager*\n\nTap below to link WhatsApp.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔗 Link WhatsApp (QR)', callback_data: 'link_qr' }],
            [{ text: '📱 Link with Phone Number', callback_data: 'link_pair' }],
            [{ text: '❓ Help', callback_data: 'help' }]
          ]
        }
      }
    );
  });

  telegram.onText(/\/link/, (msg) => handleQRLink(msg.chat.id));

  telegram.on('callback_query', async (q) => {
    const c = q.message.chat.id;
    await telegram.answerCallbackQuery(q.id).catch(() => {});

    if (q.data === 'link_qr') return handleQRLink(c);

    if (q.data === 'link_pair') {
      userTelegramState[c] = 'WAITING_NUM';
      return telegram.sendMessage(c, '📱 Send your WhatsApp number, with country code, digits only (e.g. 263712345678):');
    }

    if (q.data === 'help') {
      return telegram.sendMessage(c, `❓ After linking, send *start* on WhatsApp.\n\nCommands:\n/link — get a QR code\n/start — show the menu again\n\nContact: ${CONTACT_LINK}`, { parse_mode: 'Markdown' });
    }

    if (q.data === 'cancel') {
      const sid = String(c);
      await expireSession(sid, { removeFiles: true });
      if (activeSockets.has(sid)) {
        try { activeSockets.get(sid).end(undefined); } catch {}
        activeSockets.delete(sid);
      }
      if (qrMessages.has(c)) {
        telegram.deleteMessage(c, qrMessages.get(c)).catch(() => {});
        qrMessages.delete(c);
      }
      return telegram.sendMessage(c, '❌ Cancelled.');
    }
  });

  telegram.on('message', (msg) => {
    const chatId = msg.chat.id;
    if (userTelegramState[chatId] === 'WAITING_NUM' && msg.text && !msg.text.startsWith('/')) {
      const number = msg.text.replace(/[^0-9]/g, '');
      if (number.length < 10) {
        return telegram.sendMessage(chatId, '❌ Invalid number. Send digits only, with country code (e.g. 263712345678).');
      }
      delete userTelegramState[chatId];

      (async () => {
        await expireSession(number, { removeFiles: true });
        if (activeSockets.has(number)) {
          return telegram.sendMessage(chatId, `✅ +${number} is already connected.`);
        }
        telegram.sendMessage(chatId, `🔄 Pairing with +${number}...`);
        startWhatsAppSession(chatId, number, true);
      })();
    }
  });

  telegram.on('polling_error', (err) => {
    console.error('Telegram polling error:', err.message);
  });
}

// ─── Resume sessions that were already linked before restart ────
export async function autoResumeSessions() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    return;
  }
  const items = fs.readdirSync(SESSIONS_DIR);
  let found = false;
  for (const name of items) {
    const fullPath = path.join(SESSIONS_DIR, name);
    if (!fs.lstatSync(fullPath).isDirectory()) continue;
    if (name === 'node_modules') continue;
    if (!fs.existsSync(path.join(fullPath, 'creds.json'))) continue;
    found = true;
    console.log(`🚀 Resuming session: ${name}`);
    startWhatsAppSession(null, name, false);
  }
  if (!found) console.log('⚠️ No sessions found. Message the Telegram bot with /start to pair.');
}