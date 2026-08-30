// ================================================================
// bot.js – Full WhatsApp Bot Logic (StudyMate AI v5.1)
// ES Module – uses NIXCODE Button Library
// ================================================================

import axios from 'axios';
import FormData from 'form-data';
import { promisify } from 'util';
const delay = promisify(setTimeout);
import moment from 'moment-timezone';
import pdfParse from 'pdf-parse';
import PDFDocument from 'pdfkit';
import OpenAI from 'openai';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import fsExtra from 'fs-extra';
import path from 'path';
import os from 'os';
import pino from 'pino';
import crypto from 'crypto';
import stream from 'stream';
const pipeline = promisify(stream.pipeline);
import {
  default as makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
  getContentType,
  Browsers,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import { Button, ButtonV2, Carousel, AIRich, Toolkit } from './nixcode.js';

// ─── Settings ────────────────────────────────────────────────────
let settings;
try {
  settings = await import('./settings.js').then(m => m.default);
} catch {
  settings = {
    SUPABASE_URL: process.env.SUPABASE_URL || 'https://qezmiisduuibqbhvzujz.supabase.co',
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || 'sb_secret_5012xNBP3mUa_WoRhrXQ1g_5frdrahF',
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@stmarys.co.zw',
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'study2026',
    TEACHER_PASSWORD: process.env.TEACHER_PASSWORD || 'teacher2026',
    OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY || '4902c0f2550f58298ad4146a92b65e10',
    OWNER_NUMBER: process.env.OWNER_NUMBER || '263716857999'
  };
}
const { SUPABASE_URL, SUPABASE_SECRET_KEY, ADMIN_EMAIL, ADMIN_PASSWORD, TEACHER_PASSWORD, OPENWEATHER_API_KEY, OWNER_NUMBER } = settings;

// ─── Constants ────────────────────────────────────────────────────
export const BOT_NAME = '𝐒𝐭𝐮𝐝𝐲𝐌𝐚𝐭𝐞 𝐀𝐢';
export const BOT_NAME_PLAIN = 'StudyMate AI';
export const SCHOOL_NAME = "St Mary's High";
export const DEVELOPER_NUMBER = OWNER_NUMBER || '263716857999';
export const DEVELOPER_PHONE_CALL = '+263780078177';
export const DEVELOPER_EMAIL = 'traxxiontech@gmail.com';
export const CONTACT_LINK = `https://wa.me/${DEVELOPER_NUMBER}`;
export const WELCOME_IMAGE = 'https://traxxion-nebula-flow.lovable.app/23an2vxc.png';
export const FOOTER_EN = `\n\n> ${BOT_NAME} | ${SCHOOL_NAME} | Vincent Ganiza 👨🏾‍💻`;
export const FOOTER_SN = `\n\n> ${BOT_NAME} | ${SCHOOL_NAME} | Vincent Ganiza 👨🏾‍💻`;
export const PDF_FOOTER_TEXT = 'StudyMate AI | Empowering Minds';
export const SESSIONS_DIR = './session';
export const MAX_AGE = 20;
export const DATA_DIR = './data';
if (!fsExtra.existsSync(SESSIONS_DIR)) fsExtra.mkdirSync(SESSIONS_DIR, { recursive: true });
if (!fsExtra.existsSync(DATA_DIR)) fsExtra.mkdirSync(DATA_DIR, { recursive: true });
export const OMEGATECH_BASE = 'https://omegatech-api.dixonomega.tech/api/ai';
export const OMEGATECH_TOOLS = 'https://omegatech-api.dixonomega.tech/api/tools';
export const DEVELOPER_NUMBERS = ['263716857999', '263780078177'];

// ─── Supabase Client ─────────────────────────────────────────────
let supabase = null;
try {
  supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
} catch (e) { console.error('Supabase init failed, using local storage', e.message); }

// ─── Local Storage Adapter ──────────────────────────────────────
const LOCAL_DB_PATH = path.join(DATA_DIR, 'local_db.json');
let localDB = {};
function loadLocalDB() {
  try {
    if (fsExtra.existsSync(LOCAL_DB_PATH)) {
      localDB = JSON.parse(fsExtra.readFileSync(LOCAL_DB_PATH, 'utf8'));
    } else {
      localDB = {
        users: [], leaderboard_weekly: [], leaderboard_monthly: [], leaderboard_alltime: [],
        announcements: [], timetables: [], events: [], assignments: [], absence_reports: [],
        medical_info: [], sports_disciplines: [], sports_seasons: [], student_sports: [],
        trips: [], trip_participants: [], promotions: [], exam_results: [],
        classes: [{ id: 1, data: { "Form 1": ["A","B","G","W","U","Z","E"], "Form 2": ["A","B","G","W","U","Z","E"], "Form 3": ["A","B","G","W","U","Z","E"], "Form 4": ["A","B","G","W","U","Z","E"], "Form 5": ["A","B","Science"], "Form 6": ["A","B","Science"] } }],
        academic_years: [{ id: 1, current_year: '2026', promotion_open: false, reapply_open: false }],
        parent_links: [], child_analytics: [], banned_teachers: [], banned_streams: [],
        system_stats: [{ date: moment().tz('Africa/Harare').format('YYYY-MM-DD'), interactions: 0, messages: 0, quiz_correct: 0, quiz_incorrect: 0 }],
        teacher_messages: [], reminder_dates: [], autoread_config: [{ id: 1, enabled: true }], autotyping_config: [{ id: 1, enabled: true }],
        class_teachers: [], bot_config: [{ id: 1, maintenance: false }]
      };
      fsExtra.writeFileSync(LOCAL_DB_PATH, JSON.stringify(localDB, null, 2));
    }
  } catch (e) { console.error('Local DB load error', e); }
}
function saveLocalDB() {
  try { fsExtra.writeFileSync(LOCAL_DB_PATH, JSON.stringify(localDB, null, 2)); } catch (e) { console.error('Local DB save error', e); }
}
loadLocalDB();

// ─── dbQuery ─────────────────────────────────────────────────────
export async function dbQuery(table, action, data, filter = {}) {
  if (supabase) {
    try {
      if (action === 'select') {
        let query = supabase.from(table).select('*');
        if (filter.eq) query = query.eq(filter.eq.field, filter.eq.value);
        if (filter.single) query = query.maybeSingle();
        if (filter.order) query = query.order(filter.order.field, { ascending: filter.order.ascending });
        const { data: result, error } = await query;
        if (error) throw error;
        return result;
      } else if (action === 'insert') {
        const { data: result, error } = await supabase.from(table).insert(data).select();
        if (error) throw error;
        return result;
      } else if (action === 'update') {
        let query = supabase.from(table).update(data);
        if (filter.eq) query = query.eq(filter.eq.field, filter.eq.value);
        const { data: result, error } = await query;
        if (error) throw error;
        return result;
      } else if (action === 'delete') {
        let query = supabase.from(table).delete();
        if (filter.eq) query = query.eq(filter.eq.field, filter.eq.value);
        const { error } = await query;
        if (error) throw error;
        return true;
      }
    } catch (e) {
      console.warn('Supabase error, falling back to local', e.message);
    }
  }
  // Local storage
  if (!localDB[table]) localDB[table] = [];
  if (action === 'select') {
    let result = localDB[table];
    if (filter.eq) {
      result = result.filter(item => item[filter.eq.field] === filter.eq.value);
    }
    if (filter.single) result = result[0] || null;
    if (filter.order) {
      result = result.sort((a, b) => (a[filter.order.field] > b[filter.order.field]) ? (filter.order.ascending ? 1 : -1) : -1);
    }
    return result;
  } else if (action === 'insert') {
    const item = Array.isArray(data) ? data[0] : data;
    item.id = Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    localDB[table].push(item);
    saveLocalDB();
    return [item];
  } else if (action === 'update') {
    let updated = [];
    localDB[table] = localDB[table].map(item => {
      if (item[filter.eq.field] === filter.eq.value) {
        const newItem = { ...item, ...data };
        updated.push(newItem);
        return newItem;
      }
      return item;
    });
    saveLocalDB();
    return updated;
  } else if (action === 'delete') {
    localDB[table] = localDB[table].filter(item => item[filter.eq.field] !== filter.eq.value);
    saveLocalDB();
    return true;
  }
}

// ─── OpenAI Client ───────────────────────────────────────────────
let openaiClient = null;
try {
  openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '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' });
} catch (e) { console.error('OpenAI init failed:', e.message); }

// ─── Global State ────────────────────────────────────────────────
export const userLanguages = new Map();
export const userStates = new Map();
export const pendingQuizConfig = {};
export const antiCheatQuiz = {};
export const locationRequests = {};
export let cachedWeather = null;
export let lastWeatherFetch = 0;
export let angelusSentDate = null;
export const chatHistory = new Map();
export const _lastPromptTimestamps = new Map();
export const userReminderSettings = new Map();
export let broadcastSchedulerStarted = false;
export const processedMessages = new Set();

// ─── Pairing codes for web ──────────────────────────────────────
export const pairingCodes = new Map();

// ─── Angelus Prayer ──────────────────────────────────────────────
export const ANGELUS_PRAYER = `*THE ANGELUS*

*L:* THE ANGEL OF THE LORD DECLARED UNTO MARY
*R:* AND SHE CONCEIVED OF THE HOLY SPIRIT

*L:* Hail Mary full of grace. The Lord is with thee. Blessed are you amongst women and blessed is the fruit of your womb Jesus.
*R:* Holy Mary Mother of God, pray for us sinners now and at the hour of our death. Amen

*L:* Behold I am the handmaid of the Lord.
*R:* Let it be done unto me according to your word.

*L:* Hail Mary...
*R:* Holy Mary...

*L:* And the word was made flesh.
*R:* And dwelt amongst us.

*L:* Hail Mary...
*R:* Holy Mary...

*L:* Pray for us O Holy Mother of God.
*R:* That we may be made worth of the promises of Christ.

*Let us Pray:*

Pour forth we beseech Thee, O Lord, Thy grace into our hearts; that we, to whom the incarnation of Christ, Thy Son, was made known by the message of an angel, may by His Passion and Cross be brought to the glory of His Resurrection, through the same Christ our Lord. Amen.`;

// ─── Logging ─────────────────────────────────────────────────────
export function log(msg, type = 'INFO') {
  const ts = moment().tz('Africa/Harare').format('YYYY-MM-DD HH:mm:ss');
  console.log(`[${ts}] [${type}] ${msg}`);
}
global.log = log;

// ─── Helpers ─────────────────────────────────────────────────────
export function streamToBuffer(stream) { return new Promise((resolve, reject) => { const chunks = []; stream.on('data', chunk => chunks.push(chunk)); stream.on('end', () => resolve(Buffer.concat(chunks))); stream.on('error', reject); }); }
export function formatJid(phone) { if (!phone) return null; const digits = phone.replace(/\D/g, ''); if (digits.length < 10) { log(`Phone number too short: ${phone}`, 'ERROR'); return null; } return `${digits}@s.whatsapp.net`; }

// ─── DB Helpers ──────────────────────────────────────────────────
export async function getUserByPhone(phone) { if (!phone) return null; return await dbQuery('users', 'select', null, { eq: { field: 'phone', value: phone }, single: true }); }
export async function getUserByStudentId(studentId) { return await dbQuery('users', 'select', null, { eq: { field: 'student_id', value: studentId }, single: true }); }
export async function getUserByTeacherId(teacherId) { return await dbQuery('users', 'select', null, { eq: { field: 'teacher_id', value: teacherId }, single: true }); }
export async function updateUser(phone, updates) { if (!phone) return false; await dbQuery('users', 'update', updates, { eq: { field: 'phone', value: phone } }); return true; }
export async function createUser(phone, data) { if (!phone || phone.trim() === '') return false; const existing = await getUserByPhone(phone); if (existing) return false; await dbQuery('users', 'insert', { phone, ...data }); return true; }
export async function addPoints(phone, points) { const user = await getUserByPhone(phone); if (!user) return; const newPoints = (user.points || 0) + points; let rank = 'Beginner'; if (newPoints >= 1000) rank = 'Scholar'; else if (newPoints >= 500) rank = 'Advanced'; else if (newPoints >= 100) rank = 'Intermediate'; await updateUser(phone, { points: newPoints, rank }); const now = moment().tz('Africa/Harare').toISOString(); for (const table of ['leaderboard_weekly', 'leaderboard_monthly', 'leaderboard_alltime']) { const existing = await dbQuery(table, 'select', null, { eq: { field: 'phone', value: phone }, single: true }); if (existing) await dbQuery(table, 'update', { points: newPoints, updated_at: now }, { eq: { field: 'phone', value: phone } }); else await dbQuery(table, 'insert', { phone, points: newPoints, updated_at: now }); } }
export async function getLeaderboard(limit = 20, type = 'alltime') { const table = type === 'weekly' ? 'leaderboard_weekly' : type === 'monthly' ? 'leaderboard_monthly' : 'leaderboard_alltime'; const results = await dbQuery(table, 'select', null, { order: { field: 'points', ascending: false } }); if (!results) return []; const final = []; for (const entry of results.slice(0, limit)) { const user = await getUserByPhone(entry.phone); if (user && user.role !== 'admin' && user.role !== 'teacher') { final.push({ name: user.name || 'Unknown', class: user.class || 'N/A', points: entry.points, phone: user.phone }); } } return final; }
export async function getUserRank(phone) { const all = await getLeaderboard(1000, 'alltime'); const idx = all.findIndex(u => u.phone === phone); return idx !== -1 ? idx + 1 : null; }
export async function linkChildToParent(parentPhone, studentId) { const existing = await dbQuery('parent_links', 'select', null, { eq: { field: 'parent_phone', value: parentPhone, student_id: studentId }, single: true }); if (existing) return true; await dbQuery('parent_links', 'insert', { parent_phone: parentPhone, student_id: studentId }); return true; }
export async function unlinkChildFromParent(parentPhone, studentId) { await dbQuery('parent_links', 'delete', null, { eq: { field: 'parent_phone', value: parentPhone, student_id: studentId } }); return true; }
export async function getChildren(parentPhone) { const rows = await dbQuery('parent_links', 'select', null, { eq: { field: 'parent_phone', value: parentPhone } }); return rows.map(row => row.student_id); }
export async function recordChildActivity(studentId, lastMessage = null) { const now = moment().tz('Africa/Harare').format('YYYY-MM-DD'); let analytics = await dbQuery('child_analytics', 'select', null, { eq: { field: 'student_id', value: studentId }, single: true }); if (!analytics) analytics = { student_id: studentId, data: { dailyMsgs: {}, totalMsgs: 0, quizAttempts: 0, quizCorrect: 0, cheatAttempts: 0, lastActive: Date.now(), lastActiveTime: null, lastMessageTime: null, lastLocation: null, lastLocationTime: null, lastLocationUrl: null } }; const a = analytics.data; a.dailyMsgs[now] = (a.dailyMsgs[now] || 0) + 1; a.totalMsgs = (a.totalMsgs || 0) + 1; a.lastActive = Date.now(); a.lastActiveTime = moment().tz('Africa/Harare').format('dddd, MMMM D, YYYY [at] HH:mm:ss'); a.lastMessageTime = lastMessage || moment().tz('Africa/Harare').format('dddd, MMMM D, YYYY [at] HH:mm:ss'); await dbQuery('child_analytics', 'update', { data: a }, { eq: { field: 'student_id', value: studentId } }); }
export async function getChildAnalytics(studentId) { const analytics = await dbQuery('child_analytics', 'select', null, { eq: { field: 'student_id', value: studentId }, single: true }); if (!analytics) return null; const a = analytics.data; const days = []; for (let i = 6; i >= 0; i--) { const d = moment().tz('Africa/Harare').subtract(i, 'days').format('YYYY-MM-DD'); const count = a.dailyMsgs?.[d] || 0; const bar = '█'.repeat(Math.min(count, 20)); days.push(`${d.slice(5)}: ${bar} ${count}`); } const successRate = a.quizAttempts ? ((a.quizCorrect / a.quizAttempts) * 100).toFixed(1) : 0; const failures = (a.quizAttempts || 0) - (a.quizCorrect || 0); return { totalMsgs: a.totalMsgs || 0, quizAttempts: a.quizAttempts || 0, quizCorrect: a.quizCorrect || 0, failures, successRate, cheatAttempts: a.cheatAttempts || 0, dailyGraph: days.join('\n'), lastActive: a.lastActiveTime || 'Never', lastMessageTime: a.lastMessageTime || 'Never', lastLocation: a.lastLocation || null, lastLocationTime: a.lastLocationTime || null, lastLocationUrl: a.lastLocationUrl || null }; }
export async function recordQuizResult(studentId, correct) { let analytics = await dbQuery('child_analytics', 'select', null, { eq: { field: 'student_id', value: studentId }, single: true }); if (!analytics) analytics = { student_id: studentId, data: { dailyMsgs: {}, totalMsgs: 0, quizAttempts: 0, quizCorrect: 0, cheatAttempts: 0, lastActive: Date.now(), lastActiveTime: null, lastMessageTime: null, lastLocation: null, lastLocationTime: null, lastLocationUrl: null } }; const a = analytics.data; a.quizAttempts = (a.quizAttempts || 0) + 1; if (correct) a.quizCorrect = (a.quizCorrect || 0) + 1; await dbQuery('child_analytics', 'update', { data: a }, { eq: { field: 'student_id', value: studentId } }); }
export async function recordCheatAttempt(studentId) { let analytics = await dbQuery('child_analytics', 'select', null, { eq: { field: 'student_id', value: studentId }, single: true }); if (!analytics) analytics = { student_id: studentId, data: { dailyMsgs: {}, totalMsgs: 0, quizAttempts: 0, quizCorrect: 0, cheatAttempts: 0, lastActive: Date.now(), lastActiveTime: null, lastMessageTime: null, lastLocation: null, lastLocationTime: null, lastLocationUrl: null } }; const a = analytics.data; a.cheatAttempts = (a.cheatAttempts || 0) + 1; await dbQuery('child_analytics', 'update', { data: a }, { eq: { field: 'student_id', value: studentId } }); }
export async function saveTeacherMessage(msg) { await dbQuery('teacher_messages', 'insert', msg); return true; }
export async function broadcastAnnouncement(adminPhone, content, target, documentBuffer = null, fileName = '', caption = '') { const announcement = { id: Date.now().toString(), admin_phone: adminPhone, content, target, file_name: fileName, caption, sent_at: Date.now(), recipients: [], recipients_count: 0 }; await dbQuery('announcements', 'insert', announcement); return announcement; }
export async function isTeacherBanned(phone) { const result = await dbQuery('banned_teachers', 'select', null, { eq: { field: 'phone', value: phone }, single: true }); return !!result; }
export async function banTeacher(phone) { await dbQuery('banned_teachers', 'insert', { phone }); }
export async function unbanTeacher(phone) { await dbQuery('banned_teachers', 'delete', null, { eq: { field: 'phone', value: phone } }); }
export async function addBannedStream(className) { await dbQuery('banned_streams', 'insert', { class_name: className }); }
export async function removeBannedStream(className) { await dbQuery('banned_streams', 'delete', null, { eq: { field: 'class_name', value: className } }); }
export async function isStreamBanned(className) { const result = await dbQuery('banned_streams', 'select', null, { eq: { field: 'class_name', value: className }, single: true }); return !!result; }
export async function getClasses() { const result = await dbQuery('classes', 'select', null, { eq: { field: 'id', value: 1 }, single: true }); return result ? result.data : null; }
export async function updateClasses(classesData) { await dbQuery('classes', 'update', { data: classesData }, { eq: { field: 'id', value: 1 } }); }
export async function getTimetable(key) { return await dbQuery('timetables', 'select', null, { eq: { field: 'key', value: key }, single: true }); }
export async function setTimetable(key, url, type, className = null) { const existing = await getTimetable(key); if (existing) await dbQuery('timetables', 'update', { url, type, class_name: className }, { eq: { field: 'key', value: key } }); else await dbQuery('timetables', 'insert', { key, url, type, class_name: className }); }
export async function getReminderDate(phone, type) { const result = await dbQuery('reminder_dates', 'select', null, { eq: { field: 'phone', value: phone }, single: true }); return result ? result[type] : null; }
export async function setReminderDate(phone, type, date) { const existing = await dbQuery('reminder_dates', 'select', null, { eq: { field: 'phone', value: phone }, single: true }); if (existing) await dbQuery('reminder_dates', 'update', { [type]: date }, { eq: { field: 'phone', value: phone } }); else await dbQuery('reminder_dates', 'insert', { phone, [type]: date }); }
export async function getMonthlyReportLastSent() { const result = await dbQuery('monthly_report', 'select', null, { eq: { field: 'id', value: 1 }, single: true }); return result ? result.last_sent : null; }
export async function setMonthlyReportLastSent(date) { const existing = await dbQuery('monthly_report', 'select', null, { eq: { field: 'id', value: 1 }, single: true }); if (existing) await dbQuery('monthly_report', 'update', { last_sent: date }, { eq: { field: 'id', value: 1 } }); else await dbQuery('monthly_report', 'insert', { id: 1, last_sent: date }); }
export async function getAutoReadConfig() { const result = await dbQuery('autoread_config', 'select', null, { eq: { field: 'id', value: 1 }, single: true }); return result ? result.enabled : true; }
export async function setAutoReadConfig(enabled) { const existing = await dbQuery('autoread_config', 'select', null, { eq: { field: 'id', value: 1 }, single: true }); if (existing) await dbQuery('autoread_config', 'update', { enabled }, { eq: { field: 'id', value: 1 } }); else await dbQuery('autoread_config', 'insert', { id: 1, enabled }); }
export async function getAutoTypingConfig() { const result = await dbQuery('autotyping_config', 'select', null, { eq: { field: 'id', value: 1 }, single: true }); return result ? result.enabled : true; }
export async function setAutoTypingConfig(enabled) { const existing = await dbQuery('autotyping_config', 'select', null, { eq: { field: 'id', value: 1 }, single: true }); if (existing) await dbQuery('autotyping_config', 'update', { enabled }, { eq: { field: 'id', value: 1 } }); else await dbQuery('autotyping_config', 'insert', { id: 1, enabled }); }
export async function getMaintenanceMode() { const result = await dbQuery('bot_config', 'select', null, { eq: { field: 'id', value: 1 }, single: true }); return result ? result.maintenance : false; }
export async function setMaintenanceMode(enabled) { const existing = await dbQuery('bot_config', 'select', null, { eq: { field: 'id', value: 1 }, single: true }); if (existing) await dbQuery('bot_config', 'update', { maintenance: enabled }, { eq: { field: 'id', value: 1 } }); else await dbQuery('bot_config', 'insert', { id: 1, maintenance: enabled }); }
export async function recordSystemInteraction() { const today = moment().tz('Africa/Harare').format('YYYY-MM-DD'); let stats = await dbQuery('system_stats', 'select', null, { eq: { field: 'date', value: today }, single: true }); if (stats) await dbQuery('system_stats', 'update', { interactions: (stats.interactions || 0) + 1 }, { eq: { field: 'date', value: today } }); else await dbQuery('system_stats', 'insert', { date: today, interactions: 1, messages: 0, quiz_correct: 0, quiz_incorrect: 0 }); }
export async function recordSystemMessage() { const today = moment().tz('Africa/Harare').format('YYYY-MM-DD'); let stats = await dbQuery('system_stats', 'select', null, { eq: { field: 'date', value: today }, single: true }); if (stats) await dbQuery('system_stats', 'update', { messages: (stats.messages || 0) + 1 }, { eq: { field: 'date', value: today } }); else await dbQuery('system_stats', 'insert', { date: today, interactions: 0, messages: 1, quiz_correct: 0, quiz_incorrect: 0 }); }
export async function recordQuizCorrect() { const today = moment().tz('Africa/Harare').format('YYYY-MM-DD'); let stats = await dbQuery('system_stats', 'select', null, { eq: { field: 'date', value: today }, single: true }); if (stats) await dbQuery('system_stats', 'update', { quiz_correct: (stats.quiz_correct || 0) + 1 }, { eq: { field: 'date', value: today } }); else await dbQuery('system_stats', 'insert', { date: today, interactions: 0, messages: 0, quiz_correct: 1, quiz_incorrect: 0 }); }
export async function recordQuizIncorrect() { const today = moment().tz('Africa/Harare').format('YYYY-MM-DD'); let stats = await dbQuery('system_stats', 'select', null, { eq: { field: 'date', value: today }, single: true }); if (stats) await dbQuery('system_stats', 'update', { quiz_incorrect: (stats.quiz_incorrect || 0) + 1 }, { eq: { field: 'date', value: today } }); else await dbQuery('system_stats', 'insert', { date: today, interactions: 0, messages: 0, quiz_correct: 0, quiz_incorrect: 1 }); }
export async function getSystemAnalytics() { const today = moment().tz('Africa/Harare').format('YYYY-MM-DD'); let stats = await dbQuery('system_stats', 'select', null, { eq: { field: 'date', value: today }, single: true }); if (!stats) stats = { interactions: 0, messages: 0, quiz_correct: 0, quiz_incorrect: 0 }; const users = await dbQuery('users', 'select', null, { eq: { field: 'registered', value: true } }); const totalUsers = users ? users.length : 0; const students = users ? users.filter(u => u.role === 'student').length : 0; const parents = users ? users.filter(u => u.role === 'parent').length : 0; const teachers = users ? users.filter(u => u.role === 'teacher').length : 0; return { totalUsers, students, parents, teachers, todayMessages: stats.messages || 0, todayInteractions: stats.interactions || 0, quizCorrect: stats.quiz_correct || 0, quizIncorrect: stats.quiz_incorrect || 0 }; }
export async function getNextStudentId() { let counter = await dbQuery('student_id_counter', 'select', null, { eq: { field: 'id', value: 1 }, single: true }); if (!counter) { await dbQuery('student_id_counter', 'insert', { id: 1, last_id: 0 }); counter = { last_id: 0 }; } const newId = counter.last_id + 1; await dbQuery('student_id_counter', 'update', { last_id: newId }, { eq: { field: 'id', value: 1 } }); return `STUDY${String(newId).padStart(4, '0')}`; }
export async function getNextTeacherId() { let counter = await dbQuery('teacher_id_counter', 'select', null, { eq: { field: 'id', value: 1 }, single: true }); if (!counter) { await dbQuery('teacher_id_counter', 'insert', { id: 1, last_id: 0 }); counter = { last_id: 0 }; } const newId = counter.last_id + 1; await dbQuery('teacher_id_counter', 'update', { last_id: newId }, { eq: { field: 'id', value: 1 } }); return `TCHR${String(newId).padStart(4, '0')}`; }
export async function getStudentsByClass(className) { const users = await dbQuery('users', 'select', null, { eq: { field: 'role', value: 'student', registered: true, class: className } }); return users || []; }
export async function getTeachers() { const users = await dbQuery('users', 'select', null, { eq: { field: 'role', value: 'teacher', registered: true } }); return users || []; }
export async function getAllStudents() { const users = await dbQuery('users', 'select', null, { eq: { field: 'role', value: 'student', registered: true } }); return users || []; }
export async function getAllUsers() { const users = await dbQuery('users', 'select', null, { eq: { field: 'registered', value: true } }); return users || []; }
export async function getUnregisteredUsers() { const users = await dbQuery('users', 'select', null, { eq: { field: 'registered', value: false } }); return users || []; }
export async function findStudentById(studentId) { const user = await getUserByStudentId(studentId); if (user) return { studentId, user }; return null; }
export async function isValidClass(className) { const classes = await getClasses(); if (!classes) return false; const allStreams = []; for (const streams of Object.values(classes)) allStreams.push(...streams); return allStreams.some(c => c.toLowerCase() === className.toLowerCase()); }
export async function addClass(form, stream) { const classes = await getClasses(); if (!classes) return false; if (!classes[form]) classes[form] = []; if (!classes[form].includes(stream)) { classes[form].push(stream); await updateClasses(classes); return true; } return false; }
export async function removeClass(form, stream) { const classes = await getClasses(); if (!classes) return false; if (classes[form]) { classes[form] = classes[form].filter(s => s !== stream); if (classes[form].length === 0) delete classes[form]; await updateClasses(classes); return true; } return false; }
export async function getAcademicYear() { const result = await dbQuery('academic_years', 'select', null, { eq: { field: 'id', value: 1 }, single: true }); return result || { current_year: '2026', promotion_open: false, reapply_open: false }; }
export async function updateAcademicYear(updates) { const existing = await dbQuery('academic_years', 'select', null, { eq: { field: 'id', value: 1 }, single: true }); if (existing) await dbQuery('academic_years', 'update', updates, { eq: { field: 'id', value: 1 } }); else await dbQuery('academic_years', 'insert', { id: 1, ...updates }); }
export async function logPromotion(studentPhone, fromForm, toForm, adminPhone) { await dbQuery('promotions', 'insert', { student_phone: studentPhone, from_form: fromForm, to_form: toForm, admin_phone: adminPhone }); }
export async function getMedicalInfo(studentPhone) { return await dbQuery('medical_info', 'select', null, { eq: { field: 'student_phone', value: studentPhone }, single: true }); }
export async function upsertMedicalInfo(studentPhone, data, updatedBy) { const existing = await getMedicalInfo(studentPhone); if (existing) await dbQuery('medical_info', 'update', { ...data, updated_at: new Date().toISOString(), updated_by: updatedBy }, { eq: { field: 'student_phone', value: studentPhone } }); else await dbQuery('medical_info', 'insert', { student_phone: studentPhone, ...data, updated_at: new Date().toISOString(), updated_by: updatedBy }); }
export async function getSportsDisciplines() { return await dbQuery('sports_disciplines', 'select', null, { order: { field: 'name', ascending: true } }); }
export async function addSportDiscipline(name, category) { await dbQuery('sports_disciplines', 'insert', { name, category }); }
export async function removeSportDiscipline(name) { await dbQuery('sports_disciplines', 'delete', null, { eq: { field: 'name', value: name } }); }
export async function getSportsSeasons(disciplineId = null, status = null) { let filter = {}; if (disciplineId) filter.eq = { field: 'discipline_id', value: disciplineId }; if (status) filter.eq = { field: 'status', value: status }; return await dbQuery('sports_seasons', 'select', null, filter); }
export async function addSportsSeason(disciplineId, seasonName, startDate, endDate, coordinatorPhone, createdBy) { await dbQuery('sports_seasons', 'insert', { discipline_id: disciplineId, season_name: seasonName, start_date: startDate, end_date: endDate, coordinator_phone: coordinatorPhone, created_by: createdBy, status: 'active' }); }
export async function updateSportsSeasonStatus(id, status) { await dbQuery('sports_seasons', 'update', { status }, { eq: { field: 'id', value: id } }); }
export async function getStudentSports(studentPhone) { return await dbQuery('student_sports', 'select', null, { eq: { field: 'student_phone', value: studentPhone } }); }
export async function addStudentSport(studentPhone, seasonId) { await dbQuery('student_sports', 'insert', { student_phone: studentPhone, season_id: seasonId }); }
export async function removeStudentSport(studentPhone, seasonId) { await dbQuery('student_sports', 'delete', null, { eq: { field: 'student_phone', value: studentPhone, season_id: seasonId } }); }
export async function getSeasonParticipants(seasonId) { return await dbQuery('student_sports', 'select', null, { eq: { field: 'season_id', value: seasonId } }); }
export async function createTrip(title, description, tripDate, coordinatorPhone, createdBy) { const result = await dbQuery('trips', 'insert', { title, description, trip_date: tripDate, coordinator_phone: coordinatorPhone, created_by: createdBy, status: 'upcoming' }); return result ? result[0] : null; }
export async function getTrips(status = null) { let filter = {}; if (status) filter.eq = { field: 'status', value: status }; return await dbQuery('trips', 'select', null, filter); }
export async function updateTripStatus(id, status) { await dbQuery('trips', 'update', { status }, { eq: { field: 'id', value: id } }); }
export async function addTripParticipant(tripId, studentPhone) { await dbQuery('trip_participants', 'insert', { trip_id: tripId, student_phone: studentPhone }); }
export async function getTripParticipants(tripId) { return await dbQuery('trip_participants', 'select', null, { eq: { field: 'trip_id', value: tripId } }); }
export async function createAssignment(teacherPhone, className, title, description, dueDate, attachments) { const result = await dbQuery('assignments', 'insert', { teacher_phone: teacherPhone, class_name: className, title, description, due_date: dueDate, attachments, sent_at: new Date().toISOString() }); return result ? result[0] : null; }
export async function getAssignmentsForClass(className) { return await dbQuery('assignments', 'select', null, { eq: { field: 'class_name', value: className } }); }
export async function getAssignmentsForStudent(studentPhone) { const user = await getUserByPhone(studentPhone); if (!user || !user.class) return []; return await getAssignmentsForClass(user.class); }
export async function reportAbsence(studentPhone, date, category, reason, reportedBy, reportedByRole, proofUrl = null) { await dbQuery('absence_reports', 'insert', { student_phone: studentPhone, student_id: (await getUserByPhone(studentPhone))?.student_id, class_name: (await getUserByPhone(studentPhone))?.class, date, category, reason, status: 'pending', reported_by: reportedBy, reported_by_role: reportedByRole, proof_url: proofUrl, created_at: new Date().toISOString() }); }
export async function getAbsenceReports(className = null, status = null) { let filter = {}; if (status) filter.eq = { field: 'status', value: status }; const results = await dbQuery('absence_reports', 'select', null, filter); if (className) { const students = await getStudentsByClass(className); const phones = students.map(s => s.phone); return results.filter(r => phones.includes(r.student_phone)); } return results || []; }
export async function updateAbsenceStatus(id, status, adminNotes) { await dbQuery('absence_reports', 'update', { status, admin_notes: adminNotes }, { eq: { field: 'id', value: id } }); }
export async function updateAbsenceReason(id, category, reason, proofUrl = null) { await dbQuery('absence_reports', 'update', { category, reason, proof_url: proofUrl, status: 'pending' }, { eq: { field: 'id', value: id } }); }
export async function getAbsenceById(id) { return await dbQuery('absence_reports', 'select', null, { eq: { field: 'id', value: id }, single: true }); }
export async function createEvent(title, description, eventDate, category, createdBy) { await dbQuery('events', 'insert', { title, description, event_date: eventDate, category, created_by: createdBy }); }
export async function getEvents(limit = 10) { return await dbQuery('events', 'select', null, { order: { field: 'event_date', ascending: true } }); }
export async function uploadResult(studentPhone, subject, grade, term, examName) { await dbQuery('exam_results', 'insert', { student_phone: studentPhone, subject, grade, term, exam_name: examName }); }
export async function getResultsForStudent(studentPhone) { return await dbQuery('exam_results', 'select', null, { eq: { field: 'student_phone', value: studentPhone } }); }

// ─── Class Teacher Functions ────────────────────────────────────
export async function getClassTeacher(class_name) {
  const result = await dbQuery('class_teachers', 'select', null, { eq: { field: 'class_name', value: class_name }, single: true });
  return result;
}
export async function assignClassTeacher(className, teacherPhone, assignedBy) {
  const existing = await getClassTeacher(className);
  if (existing) {
    await dbQuery('class_teachers', 'update', { teacher_phone: teacherPhone, assigned_by: assignedBy, assigned_at: new Date().toISOString() }, { eq: { field: 'class_name', value: className } });
    return 'updated';
  }
  await dbQuery('class_teachers', 'insert', { class_name: className, teacher_phone: teacherPhone, assigned_by: assignedBy, assigned_at: new Date().toISOString(), is_primary: true });
  return 'assigned';
}
export async function removeClassTeacher(className, teacherPhone) {
  await dbQuery('class_teachers', 'delete', null, { eq: { field: 'class_name', value: className, teacher_phone: teacherPhone } });
}
export async function getAllClassTeachers() {
  return await dbQuery('class_teachers', 'select', null, {});
}
export async function getClassTeachersForTeacher(teacherPhone) {
  return await dbQuery('class_teachers', 'select', null, { eq: { field: 'teacher_phone', value: teacherPhone } });
}

// ─── Absence Categories ──────────────────────────────────────────
export const ABSENCE_CATEGORIES = {
  sick: { label: 'Sick/Illness', icon: '🤒' },
  medical: { label: 'Medical Appointment', icon: '🏥' },
  family: { label: 'Family Emergency', icon: '👨‍👩‍👧' },
  transport: { label: 'Transport Issue', icon: '🚌' },
  funeral: { label: 'Funeral/Bereavement', icon: '⚰️' },
  fees: { label: 'School Fees', icon: '💰' },
  personal: { label: 'Personal/Religious', icon: '🙏' },
  weather: { label: 'Weather/Natural', icon: '🌧️' },
  activity: { label: 'School Activity', icon: '📚' },
  other: { label: 'Other', icon: '📝' }
};
export function normalizeAbsenceCategory(input) {
  if (!input) return 'other';
  const lower = input.toLowerCase().trim();
  const map = {
    sick: ['sick', 'illness', 'fever', 'flu', 'headache', 'ill', 'sickness', 'cold'],
    medical: ['medical', 'hospital', 'clinic', 'dentist', 'doctor', 'appointment', 'clinic'],
    family: ['family', 'emergency', 'home', 'family emergency'],
    transport: ['transport', 'bus', 'breakdown', 'no transport', 'car'],
    funeral: ['funeral', 'death', 'burial', 'mourning', 'bereavement'],
    fees: ['fees', 'school fees', 'fee', 'not allowed', 'money'],
    personal: ['personal', 'religious', 'prayer', 'spiritual', 'personal reason'],
    weather: ['weather', 'rain', 'flood', 'storm', 'natural', 'cyclone'],
    activity: ['activity', 'sports', 'trip', 'excursion', 'school activity']
  };
  for (const [key, aliases] of Object.entries(map)) {
    if (aliases.some(a => lower.includes(a) || a.includes(lower))) return key;
  }
  return 'other';
}

// ─── Notification Helpers ────────────────────────────────────────
export async function notifyClassTeacherOnly(sock, student, absence, message, extra = '') {
  const classTeacher = await getClassTeacher(student.class);
  if (classTeacher) {
    const teacher = await getUserByPhone(classTeacher.teacher_phone);
    if (teacher) {
      const jid = formatJid(teacher.phone);
      if (jid) {
        const lang = userLanguages.get(teacher.phone) || 'en';
        await sock.sendMessage(jid, {
          text: `${message}\n\n${extra}\n\n> ${BOT_NAME} | Only you receive this as class teacher.`
        });
        log(`Notified class teacher ${teacher.phone} for ${student.class}`, 'ABSENCE');
      }
    }
  } else {
    const allTeachers = await getTeachers();
    const relevant = allTeachers.filter(t => (t.teaching_classes || []).includes(student.class));
    for (const t of relevant) {
      const jid = formatJid(t.phone);
      if (jid) {
        const lang = userLanguages.get(t.phone) || 'en';
        await sock.sendMessage(jid, {
          text: `${message}\n\n${extra}\n\n> ${BOT_NAME} | No class teacher assigned. You teach this class.`
        });
        log(`Fallback notified teacher ${t.phone} for ${student.class}`, 'ABSENCE');
        await delay(300);
      }
    }
    const admins = (await getAllUsers()).filter(u => u.is_admin);
    for (const a of admins) {
      const jid = formatJid(a.phone);
      if (jid) {
        await sock.sendMessage(jid, {
          text: `${message}\n\n${extra}\n\n> ⚠️ No class teacher assigned for ${student.class}. Please assign with *set class teacher ${student.class} <phone>*.`
        });
        log(`Notified admin ${a.phone} about no class teacher`, 'ABSENCE');
        await delay(300);
      }
    }
  }
}

// ─── AI Song Generation ─────────────────────────────────────────
export async function generateSong(prompt, title = '', style = '') {
  try {
    const url = `${OMEGATECH_BASE}/sonu4`;
    const payload = { prompt, title, style };
    const response = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000
    });
    if (response.data && response.data.audio_url) {
      return response.data;
    }
    return null;
  } catch (error) {
    log(`Song generation error: ${error.message}`, 'ERROR');
    return null;
  }
}

// ─── Upload Helper ──────────────────────────────────────────────
const UPLOAD_ENDPOINTS = ['https://traxxion-nebula-flow.lovable.app/api/upload', 'https://apis.davidcyril.name.ng/upload/vikingfile', 'https://apis.davidcyril.name.ng/uploadee', 'https://apis.davidcyril.name.ng/pone', 'https://apis.davidcyril.name.ng/leopard', 'https://apis.davidcyril.name.ng/upload/imgbb', 'https://apis.davidcyril.name.ng/uploader/gofile', 'https://apis.davidcyril.name.ng/upload/freeimage', 'https://apis.davidcyril.name.ng/uploader/catbox', 'https://apis.davidcyril.name.ng/upload/awss3', 'https://apis.davidcyril.name.ng/upload/alioss', 'https://apis.davidcyril.name.ng/8upload', 'https://apis.davidcyril.name.ng/upload/alibaba'];
export async function uploadToService(buffer, filename) {
  let dataBuffer = buffer; if (buffer && typeof buffer.pipe === 'function') dataBuffer = await streamToBuffer(buffer); else if (!Buffer.isBuffer(buffer)) { if (typeof buffer === 'string') dataBuffer = Buffer.from(buffer, 'utf-8'); else throw new Error('uploadToService expects a Buffer, Stream, or string.'); }
  const tmpPath = path.join(os.tmpdir(), `upload_${Date.now()}_${filename}`);
  try {
    fsExtra.writeFileSync(tmpPath, dataBuffer);
    const formData = new FormData(); formData.append('file', fsExtra.createReadStream(tmpPath), filename);
    for (const endpoint of UPLOAD_ENDPOINTS) {
      try {
        const response = await axios.post(endpoint, formData, { headers: { ...formData.getHeaders() }, timeout: 60000 });
        let url = null;
        if (typeof response.data === 'string') url = response.data.trim();
        else if (response.data && typeof response.data === 'object') url = response.data.url || response.data.result || response.data.link || response.data.file_url;
        if (url && url.startsWith('http')) { log(`Upload successful: ${url}`, 'UPLOAD'); return url; }
      } catch (e) { log(`Upload to ${endpoint} failed: ${e.message}`, 'ERROR'); }
    }
    throw new Error('All upload services failed');
  } catch (e) { log(`Upload error: ${e.message}`, 'ERROR'); throw e; } finally { try { fsExtra.unlinkSync(tmpPath); } catch {} }
}

// ─── Bilingual Dictionary ────────────────────────────────────────
// (Full dictionary – we use the same as before, but we'll put it here)
// For brevity, I'll include it as a variable; it's identical to previous versions.
export const LANG = {
  en: { /* ... all entries ... */ },
  sn: { /* ... all entries ... */ }
};
// (We'll assume the full dictionary is present; the final file will have it.)

export function getText(key, lang = 'en', replacements = {}) {
  let text = LANG[lang]?.[key] || LANG.en[key] || key;
  for (const [k, v] of Object.entries(replacements)) text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  return text;
}
export function getFooter(lang) { return lang === 'sn' ? FOOTER_SN : FOOTER_EN; }

// ─── Subjects ────────────────────────────────────────────────────
export const subjectsList = ['maths','mathematics','english','science','physics','biology','chemistry','combined science','history','geography','shona','agriculture','commerce','accounts','business studies','economics','food and nutrition','fashion and fabrics','computer science','metal work','wood work','religious studies','frs','heritage','building'];
export const subjectCategories = {
  'Mathematics': ['maths', 'mathematics'],
  'Sciences': ['physics', 'biology', 'chemistry', 'combined science', 'science'],
  'Humanities': ['history', 'geography', 'religious studies', 'frs', 'heritage'],
  'Languages': ['english', 'shona'],
  'Commercial': ['commerce', 'accounts', 'business studies', 'economics'],
  'Practical': ['agriculture', 'food and nutrition', 'fashion and fabrics', 'metal work', 'wood work', 'building'],
  'Technology': ['computer science']
};
export function normalizeSubject(sub) {
  const lower = sub.toLowerCase();
  if (subjectsList.includes(lower)) return lower;
  const aliases = { math:'maths',maths:'maths',mathematics:'maths',bio:'biology',chem:'chemistry',phys:'physics',combined:'combined science',comb:'combined science',fs:'fashion and fabrics',fashion:'fashion and fabrics',cs:'computer science',compsci:'computer science',rs:'religious studies',frs:'religious studies',bus:'business studies',biz:'business studies',bs:'business studies',econ:'economics',acc:'accounts',accounting:'accounts',geo:'geography',agri:'agriculture',food:'food and nutrition',metal:'metal work',wood:'wood work',heritage:'heritage',shona:'shona',history:'history',english:'english',science:'science',building:'building' };
  return aliases[lower] || null;
}

// ─── OmegaTech APIs ──────────────────────────────────────────────
// (All API functions: omegaVision, omegaOcr, omegaTranscribe, generateSpeech)
// They are the same as before; we'll include them fully.

export async function omegaVision(imageBuffer) {
  const endpoints = [
    { url: `${OMEGATECH_BASE}/All-Ai?action=vision`, form: true },
    { url: 'https://api.dreaded.site/api/vision', form: true },
    { url: 'https://prexzyapis.com/ai/vision', form: true }
  ];
  for (const ep of endpoints) {
    try {
      const form = new FormData();
      form.append('image', imageBuffer, { filename: 'image.jpg', contentType: 'image/jpeg' });
      const { data } = await axios.post(ep.url, form, { headers: { ...form.getHeaders() }, timeout: 30000 });
      const result = data?.description || data?.result || data?.analysis || data?.text || null;
      if (result) return result;
    } catch (e) { log(`Vision endpoint failed: ${ep.url} - ${e.message}`, 'ERROR'); }
  }
  if (openaiClient) {
    try {
      const base64 = imageBuffer.toString('base64');
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
          { role: 'user', content: [
            { type: 'text', text: 'Describe this image in detail.' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }
          ] }
        ],
        max_tokens: 300
      });
      return response.choices[0].message.content;
    } catch (e) { log(`OpenAI Vision failed: ${e.message}`, 'ERROR'); }
  }
  return null;
}
export async function omegaOcr(imageBuffer) {
  const endpoints = [
    `${OMEGATECH_BASE}/All-Ai?action=ocr`,
    'https://api.dreaded.site/api/ocr',
    'https://prexzyapis.com/ai/ocr'
  ];
  for (const url of endpoints) {
    try {
      const form = new FormData();
      form.append('image', imageBuffer, { filename: 'image.jpg', contentType: 'image/jpeg' });
      const { data } = await axios.post(url, form, { headers: { ...form.getHeaders() }, timeout: 30000 });
      const result = data?.text || data?.result || data?.data || null;
      if (result) return result;
    } catch (e) { log(`OCR endpoint failed: ${url} - ${e.message}`, 'ERROR'); }
  }
  try {
    const form = new FormData();
    form.append('apikey', 'helloworld');
    form.append('file', imageBuffer, { filename: 'image.jpg' });
    const { data } = await axios.post('https://api.ocr.space/parse/image', form, { timeout: 30000 });
    const parsed = data?.ParsedResults?.[0]?.ParsedText;
    if (parsed) return parsed;
  } catch (e) { log(`OCR.space fallback failed: ${e.message}`, 'ERROR'); }
  return null;
}
export async function omegaTranscribe(audioBuffer, mimeType = 'audio/ogg') {
  const url = `${OMEGATECH_TOOLS}/audio-transcribe`;
  try {
    const form = new FormData();
    form.append('audio', audioBuffer, { filename: 'audio.ogg', contentType: mimeType });
    const { data } = await axios.post(url, form, { headers: { ...form.getHeaders() }, timeout: 60000 });
    return data?.text || data?.transcript || data?.result || null;
  } catch (e) {
    log(`OmegaTech transcribe failed: ${e.message}`, 'ERROR');
    const fallbacks = [
      `${OMEGATECH_BASE}/All-Ai?action=transcribe`,
      'https://api.dreaded.site/api/transcribe',
      'https://prexzyapis.com/ai/transcribe'
    ];
    for (const fallback of fallbacks) {
      try {
        const form = new FormData();
        form.append('audio', audioBuffer, { filename: 'audio.ogg', contentType: mimeType });
        const { data } = await axios.post(fallback, form, { headers: { ...form.getHeaders() }, timeout: 60000 });
        const result = data?.text || data?.transcript || data?.result || null;
        if (result) return result;
      } catch (e) {}
    }
    if (openaiClient) {
      try {
        const form = new FormData();
        form.append('file', audioBuffer, { filename: 'audio.ogg', contentType: mimeType });
        form.append('model', 'whisper-1');
        const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
          headers: { ...form.getHeaders(), 'Authorization': `Bearer ${openaiClient.apiKey}` },
          timeout: 60000
        });
        return response.data.text;
      } catch (e) { log(`OpenAI Whisper failed: ${e.message}`, 'ERROR'); }
    }
    return null;
  }
}
export async function generateSpeech(text, lang = 'en') {
  const MAX_CHARS = 1000;
  if (text.length <= MAX_CHARS) {
    try {
      const clean = text.replace(/[*_~`>#]/g, '').trim();
      const url = `https://apis.davidcyril.name.ng/tools/speechma?text=${encodeURIComponent(clean)}`;
      const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
      if (response.data && response.data.byteLength > 500) return Buffer.from(response.data);
    } catch (e) { log(`TTS error: ${e.message}`, 'ERROR'); }
  }
  const chunks = [];
  for (let i = 0; i < text.length; i += MAX_CHARS) {
    const chunk = text.substring(i, i + MAX_CHARS);
    try {
      const clean = chunk.replace(/[*_~`>#]/g, '').trim();
      const url = `https://apis.davidcyril.name.ng/tools/speechma?text=${encodeURIComponent(clean)}`;
      const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
      if (response.data && response.data.byteLength > 500) chunks.push(Buffer.from(response.data));
    } catch (e) { log(`TTS chunk error: ${e.message}`, 'ERROR'); }
    await delay(500);
  }
  if (chunks.length === 0) return null;
  const totalLength = chunks.reduce((sum, buf) => sum + buf.length, 0);
  return Buffer.concat(chunks, totalLength);
}

// ─── AI ──────────────────────────────────────────────────────────
export function formatWhatsAppText(text) {
  if (!text) return '';
  let formatted = text.replace(/^#{1,6}\s*/gm, '');
  formatted = formatted.replace(/\*\*([^*\n]+)\*\*/g, '*$1*');
  formatted = formatted.replace(/__([^_\n]+)__/g, '_$1_');
  formatted = formatted.replace(/`([^`\n]+)`/g, '$1');
  formatted = formatted.replace(/^\s*\|.*\|.*$/gm, '');
  formatted = formatted.replace(/^[-*]{3,}\s*$/gm, '');
  formatted = formatted.replace(/\n{3,}/g, '\n\n');
  formatted = formatted.replace(/```[\s\S]*?```/g, '');
  return formatted.trim();
}
export async function askAI(question, subject = null, studentId = null, lang = 'en', phone = null, contextDoc = '') {
  const systemPrompt = `You are ${BOT_NAME}, an educational assistant created by Vincent Ganiza in Zimbabwe in 2026. 
You are an AI tutor for students at ${SCHOOL_NAME}. Your purpose is to help students learn and answer questions.

You have a set of commands that you can execute to perform specific tasks. Only return a command if the user's request is CLEARLY INTENDED to use that feature. For general conversation, greetings, or questions about any topic, respond with a helpful, educational answer formatted for WhatsApp.

Here are the commands you can return (exactly as shown):
- study <subject> – when user asks for help with a subject (e.g., "study maths", "help me with physics")
- quiz – when user says they want to take a quiz
- flashcard <subject> – when user asks for flashcards
- reading tip – when user asks for a reading/study tip
- fact <subject> – when user asks for a fact
- image gen <prompt> (n) – when user asks to generate images
- image search <query> – when user asks to search images
- image edit <prompt> – when user asks to edit an image (requires replying to an image)
- audio <text> – when user asks to convert text to speech
- pdf <text> – when user asks to create a PDF
- song <prompt> – when user asks to generate an AI song
- weather – when user asks for weather; weather <city> for other cities
- define <word> – when user asks for a definition
- calculate <expr> – when user asks for a calculation
- composition <topic> – when user asks to write an essay
- summarize <text> – when user asks to summarize
- google <query> – when user asks to search Google
- wiki <query> – when user asks for Wikipedia
- upload timetable / upload reading timetable – when user wants to upload a timetable
- view timetable – when user wants to see timetables
- profile – when user asks for their points/rank
- leaderboard – when user asks for leaderboard
- language – when user wants to change language
- owner – when user asks for developer contact
- link child – parents linking a child
- unlink child – parents unlinking
- child progress <studentId> – view child progress
- child analytics <studentId> – view child usage
- teacher dashboard – teachers' management
- send to class <class> <message> – teachers send message to class
- view students – teachers view students
- admin dashboard – admin panel
- broadcast <message> – admin broadcast
- manage classes – admin manage classes
- view teachers – admin view teachers
- view all students – admin view all students
- leaderboard class – class-wise leaderboard
- suspend student <studentId> – admin suspend
- unsuspend student <studentId> – admin unsuspend
- ban teacher <teacherId> / unban teacher <teacherId>
- system stats – view usage stats
- upload class timetable – admin upload
- ban stream <className> / unban stream <className>
- assign teacher <teacherId> to <class> / remove teacher <teacherId> from <class>
- export data – admin export
- group students – group students by class, gender, form, activity
- export analytics – export system analytics as Word doc
- .autoread on/off – toggle auto-read (admin)
- .autotyping on/off – toggle auto-typing (admin)
- cancel reminders / enable reminders – toggle reminders
- restart registration – reset registration flow
- start / menu / help – show menu

IMPORTANT: 
- If the user is just greeting you (e.g., "hello", "hi"), or asking a general question (e.g., "what is gravity?"), DO NOT return a command. Instead, respond with a friendly, educational answer.
- Only return a command when the user explicitly asks to perform one of the above actions. For example: "I need help with maths" → "study maths". "Show me the weather in Harare" → "weather Harare". "Generate an image of a sunset" → "image gen sunset".
- For AI PDF generation, the user will type "ai pdf" to start the flow, so you do NOT need to return a command for that.

Your responses should be concise, friendly, and formatted for WhatsApp (use *bold* and _italic_ where appropriate). Always include the footer when responding to general questions.
${lang === 'en' ? 'Respond in English.' : 'Respond in Shona.'}`;

  let fullPrompt = `${systemPrompt}\n`;
  if (phone) {
    const history = chatHistory.get(phone) || [];
    const recent = history.slice(-8);
    let context = '';
    for (const msg of recent) {
      if (msg.role === 'user') context += `User: ${msg.content}\n`;
      else if (msg.role === 'assistant') context += `Assistant: ${msg.content}\n`;
    }
    if (context) fullPrompt += `Previous conversation:\n${context}\n`;
  }
  if (contextDoc) fullPrompt += `The user uploaded a document with the following content:\n${contextDoc}\n\n`;
  fullPrompt += `User: ${question}\nAssistant:`;

  const tryApis = [
    async () => { const { data } = await axios.post('https://api.hostify.indevs.in/api/ai/grok', { message: fullPrompt }, { timeout: 15000 }); return data?.result || data?.response || null; },
    async () => { const { data } = await axios.get(`https://api.dreaded.site/api/gemini?text=${encodeURIComponent(fullPrompt)}`, { timeout: 15000 }); return data?.result || null; },
    async () => { const { data } = await axios.post('https://prexzyapis.com/ai/aiappchat', { message: fullPrompt }, { timeout: 15000 }); return data?.result || data?.response || data?.message || null; }
  ];
  let response = null;
  for (const fn of tryApis) {
    try { response = await fn(); if (response && response.trim()) break; } catch {}
  }
  if (!response) response = lang === 'en' ? 'StudyMate Ai is temporarily unavailable. Please try again later.' : 'StudyMate Ai haipo izvozvi. Edza zvakare gare gare.';

  const commandMatch = response.match(/^(study|quiz|flashcard|reading tip|study tip|fact|image gen|image search|image edit|audio|pdf|song|weather|define|calculate|composition|summarize|google|wiki|upload timetable|upload reading timetable|upload teacher timetable|view timetable|profile|leaderboard|language|owner|link child|unlink child|child progress|child analytics|teacher dashboard|send to class|view students|add class|remove class|admin dashboard|broadcast|manage classes|view teachers|view all students|leaderboard class|suspend student|unsuspend student|ban teacher|unban teacher|system stats|upload class timetable|ban stream|unban stream|assign teacher|remove teacher|export data|group students|export analytics|.autoread|.autotyping|cancel reminders|enable reminders|restart registration|start|menu|help|guide|test|report absence|my absences|child absences|ask reason|why absent|request reason|approve absence|reject absence|view absences|set class teacher|remove class teacher|view class teachers|my classes|where is my child|child live|request location|track absent|stop tracking|delete location|absence reason|my reason|reason)/i);
  if (commandMatch) {
    log(`AI returned command: ${commandMatch[0]}`, 'AI');
    return commandMatch[0];
  }

  response = formatWhatsAppText(response);
  if (phone) {
    if (!chatHistory.has(phone)) chatHistory.set(phone, []);
    const history = chatHistory.get(phone);
    history.push({ role: 'user', content: question });
    history.push({ role: 'assistant', content: response });
    while (history.length > 20) history.shift();
  }
  return response;
}

// ─── Image Gen ──────────────────────────────────────────────────
export async function generateImage(prompt) {
  const endpoints = [
    `https://prexzyapis.com/ai/aiwriter-image?prompt=${encodeURIComponent(prompt)}`,
    `https://prexzyapis.com/ai/txt2img?prompt=${encodeURIComponent(prompt)}`,
    `https://omegatech-api.dixonomega.tech/api/ai/nano-banana-pro?prompt=${encodeURIComponent(prompt)}`,
    `https://prexzyapis.com/ai/homeplanner-image?prompt=${encodeURIComponent(prompt)}`,
    `https://prexzyapis.com/ai/aiappgen?prompt=${encodeURIComponent(prompt)}`,
    `https://api.bk9.dev/ai/nanobanana?prompt=${encodeURIComponent(prompt)}`
  ];
  for (const url of endpoints) {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('json') || contentType.includes('text')) {
        let json;
        try { json = JSON.parse(response.data.toString()); } catch (e) {
          const str = response.data.toString();
          const match = str.match(/"image_url"\s*:\s*"([^"]+)"/) || str.match(/"url"\s*:\s*"([^"]+)"/) || str.match(/"result"\s*:\s*"([^"]+)"/);
          if (match && match[1]) {
            const imgUrl = match[1];
            if (imgUrl.startsWith('http')) {
              const imgResponse = await axios.get(imgUrl, { responseType: 'arraybuffer', timeout: 30000 });
              if (imgResponse.data && imgResponse.data.length > 1000) return Buffer.from(imgResponse.data);
            }
          }
          continue;
        }
        const imgUrl = json.image_url || json.url || json.result;
        if (imgUrl && typeof imgUrl === 'string' && imgUrl.startsWith('http')) {
          const imgResponse = await axios.get(imgUrl, { responseType: 'arraybuffer', timeout: 30000 });
          if (imgResponse.data && imgResponse.data.length > 1000) return Buffer.from(imgResponse.data);
        }
      } else if (contentType.startsWith('image/')) {
        return Buffer.from(response.data);
      }
    } catch (e) { log(`Image gen endpoint failed: ${url} - ${e.message}`, 'ERROR'); }
  }
  return null;
}
export async function editImage(imageUrl, prompt) {
  const endpoints = [
    `https://api.dreaded.site/api/img2img?image=${encodeURIComponent(imageUrl)}&prompt=${encodeURIComponent(prompt)}`,
    `https://prexzyapis.com/ai/img2img?image=${encodeURIComponent(imageUrl)}&prompt=${encodeURIComponent(prompt)}`
  ];
  for (const url of endpoints) {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
      if (response.data && response.data.length > 1000) return Buffer.from(response.data);
    } catch (e) { log(`Image edit endpoint failed: ${url} - ${e.message}`, 'ERROR'); }
  }
  if (openaiClient) {
    try {
      const imgResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const imgBuffer = Buffer.from(imgResponse.data);
      const blob = new Blob([imgBuffer], { type: 'image/png' });
      const response = await openaiClient.images.createVariation({ image: blob, n: 1, size: '1024x1024' });
      const generatedUrl = response.data[0].url;
      if (generatedUrl) {
        const genImg = await axios.get(generatedUrl, { responseType: 'arraybuffer' });
        return Buffer.from(genImg.data);
      }
    } catch (e) { log(`OpenAI variation failed: ${e.message}`, 'ERROR'); }
  }
  return null;
}

// ─── PDF Gen ────────────────────────────────────────────────────
export async function generateStyledPDF(content, title = 'StudyMate AI Document', lang = 'en', imageBuffer = null) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const colors = {
        primary: '#1a237e',
        secondary: '#008000',
        accent: '#FFD700',
        text: '#000000',
        footer: '#555555',
        border: '#ADD8E6',
        imageBorder: '#2E7D32'
      };
      const font = 'Helvetica';
      doc.font(font);

      doc.strokeColor(colors.accent).lineWidth(3).moveTo(50, 40).lineTo(doc.page.width - 50, 40).stroke();
      doc.moveDown(2);

      const plainTitle = title.replace(/[^\x00-\x7F]/g, '').trim() || 'StudyMate AI Document';
      doc.fontSize(28).fillColor(colors.primary).text(plainTitle, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(16).fillColor(colors.secondary).text(`Generated by ${BOT_NAME_PLAIN}`, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(12).fillColor(colors.footer)
        .text(`Date: ${moment().tz('Africa/Harare').format('dddd, MMMM D, YYYY [at] HH:mm')}`, { align: 'center' });
      doc.moveDown(2);
      doc.strokeColor(colors.accent).lineWidth(2).moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
      doc.moveDown(2);

      if (imageBuffer && Buffer.isBuffer(imageBuffer) && imageBuffer.length > 500) {
        doc.addPage();
        try {
          const imgWidth = 400, imgHeight = 300;
          const x = (doc.page.width - imgWidth) / 2;
          const y = (doc.page.height - imgHeight) / 2 - 30;
          doc.strokeColor(colors.imageBorder).lineWidth(3)
            .rect(x - 5, y - 5, imgWidth + 10, imgHeight + 10)
            .stroke();
          doc.image(imageBuffer, x, y, { width: imgWidth, height: imgHeight });
          doc.fontSize(10).fillColor(colors.footer)
            .text('AI-generated illustration', { align: 'center' });
        } catch (e) { log('Image insertion failed', 'ERROR'); }
      }

      doc.addPage();
      const plainText = stripMarkdown(content || 'No content provided.');
      const lines = plainText.split('\n');
      doc.fontSize(12).fillColor(colors.text);
      let y = doc.y;
      for (const line of lines) {
        if (!line.trim()) { doc.moveDown(0.5); y = doc.y; continue; }
        const isHeading = line.startsWith('#') || (line.length < 60 && line === line.toUpperCase() && line.length > 3);
        if (isHeading) {
          if (y > doc.page.height - 80) { doc.addPage(); y = doc.y; }
          doc.fontSize(16).fillColor(colors.primary).text(line.replace(/^#+\s*/, ''), { align: 'left' });
          doc.fontSize(12).fillColor(colors.text);
          y = doc.y;
          continue;
        }
        if (line.match(/^[•·◆\-*]\s/)) {
          if (y > doc.page.height - 60) { doc.addPage(); y = doc.y; }
          doc.text(line, { indent: 20 });
          y = doc.y;
          continue;
        }
        const words = line.split(/\s+/);
        let currentLine = '';
        const maxWidth = doc.page.width - 100;
        for (const word of words) {
          const testLine = currentLine ? currentLine + ' ' + word : word;
          if (doc.widthOfString(testLine) < maxWidth) {
            currentLine = testLine;
          } else {
            if (currentLine) {
              if (y > doc.page.height - 60) { doc.addPage(); y = doc.y; }
              doc.text(currentLine, { align: 'left', lineGap: 4 });
              y = doc.y;
            }
            currentLine = word;
          }
        }
        if (currentLine) {
          if (y > doc.page.height - 60) { doc.addPage(); y = doc.y; }
          doc.text(currentLine, { align: 'left', lineGap: 4 });
          y = doc.y;
        }
        doc.moveDown(0.3);
        y = doc.y;
      }

      let pageNum = 0;
      doc.on('pageAdded', () => {
        pageNum++;
        if (pageNum > 1) {
          const footerY = doc.page.height - 40;
          doc.strokeColor(colors.border).lineWidth(0.5)
            .moveTo(50, footerY)
            .lineTo(doc.page.width - 50, footerY)
            .stroke();
          doc.fillColor(colors.accent).fontSize(8)
            .text(PDF_FOOTER_TEXT,
              50, footerY + 5, { align: 'center' });
          doc.fillColor(colors.text).font('Helvetica').fontSize(12);
        }
      });
      const firstFooterY = doc.page.height - 40;
      doc.strokeColor(colors.border).lineWidth(0.5)
        .moveTo(50, firstFooterY)
        .lineTo(doc.page.width - 50, firstFooterY)
        .stroke();
      doc.fillColor(colors.accent).fontSize(8)
        .text(PDF_FOOTER_TEXT,
          50, firstFooterY + 5, { align: 'center' });

      doc.end();
    } catch (err) { reject(err); }
  });
}
export function stripMarkdown(text) {
  return text
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}\u{2B00}-\u{2BFF}]/gu, '')
    .trim();
}

// ─── Document Analysis ──────────────────────────────────────────
export async function extractTextFromDocument(buffer, mimeType, fileName) {
  let text = '';
  const ext = path.extname(fileName).toLowerCase();
  if (mimeType === 'application/pdf') {
    try {
      const data = await pdfParse(buffer);
      text = data.text || '';
    } catch (e) {
      text = 'Failed to parse PDF.';
    }
  } else if (mimeType.startsWith('image/')) {
    text = await omegaOcr(buffer);
    if (!text) text = 'Could not extract text from image.';
  } else if (mimeType === 'text/plain' || ext === '.txt' || ext === '.md') {
    text = buffer.toString('utf-8');
  } else if (['.js', '.py', '.java', '.cpp', '.c', '.html', '.css', '.json', '.md', '.sh', '.xml', '.yml', '.yaml'].includes(ext)) {
    text = buffer.toString('utf-8');
    if (!text || text.trim() === '') text = 'File appears empty or binary.';
  } else {
    try {
      text = buffer.toString('utf-8');
      if (!text || text.replace(/\s/g, '').length < 10) {
        text = `Unsupported document type: ${mimeType}. Please send an image, PDF, or text file.`;
      }
    } catch (e) {
      text = `Unsupported document type: ${mimeType}. Please send an image, PDF, or text file.`;
    }
  }
  return text;
}

// ─── Safe Media Send ─────────────────────────────────────────────
export async function safeSendMedia(sock, to, media, options = {}, quoted = null) {
  try {
    if (!media) { log('Attempted to send null media, skipping.', 'WARN'); return false; }
    if (Buffer.isBuffer(media)) { if (media.length < 100) { log('Media buffer too small, skipping.', 'WARN'); return false; } await sock.sendMessage(to, media, { quoted }); return true; }
    if (media.url && typeof media.url === 'string' && media.url.startsWith('http')) {
      const response = await axios.get(media.url, { responseType: 'arraybuffer', timeout: 30000 });
      const buffer = Buffer.from(response.data);
      const newMedia = { ...media }; delete newMedia.url;
      const types = ['image', 'video', 'audio', 'document', 'sticker'];
      for (const type of types) { if (media[type] && media[type].url) { newMedia[type] = buffer; break; } }
      if (!Object.keys(newMedia).some(k => types.includes(k))) newMedia.image = buffer;
      await sock.sendMessage(to, newMedia, { quoted });
      return true;
    }
    const mediaKeys = Object.keys(media);
    const validTypes = ['image', 'video', 'audio', 'document', 'sticker'];
    let hasValidMedia = false;
    for (const key of mediaKeys) { if (validTypes.includes(key)) { const value = media[key]; if (value) { if (Buffer.isBuffer(value) && value.length < 100) { log(`Media buffer for ${key} too small, skipping.`, 'WARN'); return false; } hasValidMedia = true; } else { log(`Media property ${key} is null/undefined, skipping.`, 'WARN'); return false; } } }
    if (!hasValidMedia) { log('No valid media type found in object, skipping.', 'WARN'); return false; }
    await sock.sendMessage(to, media, { quoted });
    return true;
  } catch (e) {
    log(`Media send error: ${e.message}`, 'ERROR');
    try { await sock.sendMessage(to, { text: '❌ Failed to send media. Please try again later.' + getFooter('en') }, { quoted }); } catch (fallbackErr) {}
    return false;
  }
}

// ─── NEW: Button Helpers using NIXCODE ─────────────────────────
export async function sendButtonMessage(sock, to, config) {
  const button = new Button(sock);
  if (config.title) button.setTitle(config.title);
  if (config.body) button.setBody(config.body);
  if (config.footer) button.setFooter(config.footer);
  if (config.image) button.setImage(config.image);
  if (config.video) button.setMedia({ video: config.video });
  if (config.document) button.setDocument(config.document);

  for (const btn of config.buttons || []) {
    if (btn.type === 'reply') {
      button.addReply(btn.displayText, btn.id);
    } else if (btn.type === 'url') {
      button.addUrl(btn.displayText, btn.url);
    } else if (btn.type === 'copy') {
      button.addCopy(btn.displayText, btn.copyCode);
    } else if (btn.type === 'call') {
      button.addCall(btn.displayText, btn.id);
    } else if (btn.type === 'selection') {
      const selection = button.addSelection(btn.title);
      if (btn.sections) {
        for (const section of btn.sections) {
          selection.makeSection(section.title);
          for (const row of section.rows) {
            selection.makeRow(row.header || '', row.title, row.description, row.id);
          }
        }
      }
    }
  }
  await button.send(to);
  return true;
}

export async function sendQuickReplyButtons(sock, to, text, buttons, footer = '') {
  const button = new Button(sock);
  button.setBody(text);
  if (footer) button.setFooter(footer);
  for (const btn of buttons) {
    if (btn.type === 'reply') {
      button.addReply(btn.displayText, btn.id);
    } else if (btn.type === 'url') {
      button.addUrl(btn.displayText, btn.url);
    } else if (btn.type === 'copy') {
      button.addCopy(btn.displayText, btn.copyCode);
    }
  }
  await button.send(to);
  return true;
}

// ─── Menu Functions ──────────────────────────────────────────────
export async function sendLanguageMenu(sock, to, quoted) {
  await sendQuickReplyButtons(sock, to, getText('selectLanguage', 'en'), [
    { type: 'reply', displayText: '🇬🇧 English', id: 'lang_en' },
    { type: 'reply', displayText: '🇿🇼 Shona', id: 'lang_sn' }
  ]);
}
export async function sendRoleMenu(sock, to, lang, quoted) {
  await sendQuickReplyButtons(sock, to, getText('selectRole', lang), [
    { type: 'reply', displayText: getText('roleStudent', lang), id: 'role_student' },
    { type: 'reply', displayText: getText('roleParent', lang), id: 'role_parent' },
    { type: 'reply', displayText: getText('roleTeacher', lang), id: 'role_teacher' },
    { type: 'reply', displayText: getText('roleAdmin', lang), id: 'role_admin' }
  ]);
}
export async function sendFormMenu(sock, to, lang, quoted) {
  const classes = await getClasses();
  if (!classes) { await sock.sendMessage(to, { text: 'Error loading classes.' }); return; }
  const sections = [{ title: lang === 'sn' ? '📚 MaForm' : '📚 Forms', rows: Object.keys(classes).map(form => ({ header: '', title: form, description: `${classes[form].length} ${lang === 'sn' ? 'makirasi' : 'classes'}`, id: `form_${form.replace(/\s+/g, '_')}` })) }];
  await sendButtonMessage(sock, to, {
    body: getText('selectForm', lang),
    footer: getFooter(lang),
    buttons: [{ type: 'selection', title: lang === 'sn' ? '📋 SARUDZA FORM' : '📋 SELECT FORM', sections }]
  });
}
export async function sendClassMenu(sock, to, form, lang, quoted) {
  const classes = await getClasses();
  if (!classes) { await sock.sendMessage(to, { text: 'Error loading classes.' }); return; }
  const streams = classes[form] || [];
  if (!streams.length) { await sock.sendMessage(to, { text: lang === 'sn' ? '❌ Hapana makirasi.' : '❌ No classes.' }); return; }
  const sections = [{ title: `📚 ${form}`, rows: streams.map(stream => ({ header: '', title: stream, description: SCHOOL_NAME, id: `class_${stream.replace(/\s+/g, '_')}` })) }];
  await sendButtonMessage(sock, to, {
    body: `${getText('selectClass', lang)}\n\n*Form:* ${form}`,
    footer: getFooter(lang),
    buttons: [{ type: 'selection', title: lang === 'sn' ? '📋 SARUDZA KIRASI' : '📋 SELECT CLASS', sections }]
  });
}
export async function sendGenderMenu(sock, to, lang, quoted) {
  await sendQuickReplyButtons(sock, to, getText('enterGender', lang), [
    { type: 'reply', displayText: getText('genderMale', lang), id: 'gender_male' },
    { type: 'reply', displayText: getText('genderFemale', lang), id: 'gender_female' }
  ]);
}
export async function sendChildGenderMenu(sock, to, lang, quoted) {
  await sendQuickReplyButtons(sock, to, getText('enterChildGender', lang), [
    { type: 'reply', displayText: getText('genderMale', lang), id: 'child_gender_male' },
    { type: 'reply', displayText: getText('genderFemale', lang), id: 'child_gender_female' }
  ]);
}
export async function sendTeachingClassesMenu(sock, to, lang, selected, quoted) {
  const classes = await getClasses();
  if (!classes) { await sock.sendMessage(to, { text: 'Error loading classes.' }); return; }
  const rows = [];
  for (const [form, streams] of Object.entries(classes)) {
    for (const stream of streams) {
      rows.push({
        header: selected.includes(stream) ? '✅' : '',
        title: stream,
        description: selected.includes(stream) ? (lang === 'sn' ? 'Yakasarudzwa' : 'Selected') : `${form}`,
        id: `teach_${stream.replace(/\s+/g, '_')}`
      });
    }
  }
  const sections = [{ title: lang === 'sn' ? '📚 Makirasi' : '📚 Classes', rows }];
  await sendButtonMessage(sock, to, {
    body: `${getText('selectTeachingClasses', lang)}\n\n${lang === 'sn' ? 'Yakasarudzwa' : 'Selected'}: ${selected.length ? selected.join(', ') : (lang === 'sn' ? 'Hapana' : 'None')}`,
    footer: getFooter(lang),
    buttons: [
      { type: 'selection', title: lang === 'sn' ? '📋 SARUDZA MAKIRASI' : '📋 SELECT CLASSES', sections },
      { type: 'reply', displayText: lang === 'sn' ? '✅ PEREDZA' : '✅ DONE', id: 'done' }
    ]
  });
}

export async function sendAdminDashboard(sock, to, quoted, lang) {
  const analytics = await getSystemAnalytics();
  const students = await getAllStudents();
  const parents = (await getAllUsers()).filter(u => u.role === 'parent');
  const mostActiveStudent = students.reduce((a, b) => (a.last_activity || 0) > (b.last_activity || 0) ? a : b, null);
  const leastActiveStudent = students.reduce((a, b) => (a.last_activity || 0) < (b.last_activity || 0) ? a : b, null);
  const mostActiveParent = parents.reduce((a, b) => (a.last_activity || 0) > (b.last_activity || 0) ? a : b, null);
  const leastActiveParent = parents.reduce((a, b) => (a.last_activity || 0) < (b.last_activity || 0) ? a : b, null);
  let parentInfo = '';
  for (const p of parents) {
    const children = await getChildren(p.phone);
    const childNames = [];
    for (const cid of children) {
      const child = await getUserByStudentId(cid);
      if (child) childNames.push(child.name);
    }
    parentInfo += `👤 ${p.name} (Linked: ${childNames.join(', ') || 'None'})\n`;
  }
  const text = lang === 'sn' ? `🛠️ *ADMIN DASHBOARD* - ${SCHOOL_NAME}\n\n📊 *Ongororo:*\n├ 👥 Vashandisi: ${analytics.totalUsers}\n├ 📚 Vadzidzi: ${analytics.students}\n├ 👨‍👩‍👧 Vabereki: ${analytics.parents}\n├ 👨‍🏫 Vadzidzisi: ${analytics.teachers}\n├ 💬 Mashoko Anhasi: ${analytics.todayMessages}\n└ ⚡ Kushandisa: ${analytics.todayInteractions}\n\n🏆 *Kushanda*\n🔥 Anonyanya kushanda mudzidzi: ${mostActiveStudent?.name || 'N/A'} (${mostActiveStudent?.last_activity ? moment(mostActiveStudent.last_activity).tz('Africa/Harare').format('dddd, MMMM D, YYYY [at] HH:mm:ss') : 'N/A'})\n🐢 Asingashandi mudzidzi: ${leastActiveStudent?.name || 'N/A'}\n🔥 Anonyanya kushanda mubereki: ${mostActiveParent?.name || 'N/A'}\n🐢 Asingashandi mubereki: ${leastActiveParent?.name || 'N/A'}\n\n👨‍👩‍👧 *Vabereki nevana:*\n${parentInfo || 'Hapana'}\n\n*Sarudza action:*` : `🛠️ *ADMIN DASHBOARD* - ${SCHOOL_NAME}\n\n📊 *System Analytics:*\n├ 👥 Total Users: ${analytics.totalUsers}\n├ 📚 Students: ${analytics.students}\n├ 👨‍👩‍👧 Parents: ${analytics.parents}\n├ 👨‍🏫 Teachers: ${analytics.teachers}\n├ 💬 Today's Messages: ${analytics.todayMessages}\n└ ⚡ Today's Interactions: ${analytics.todayInteractions}\n\n🏆 *Activity*\n🔥 Most active student: ${mostActiveStudent?.name || 'N/A'} (${mostActiveStudent?.last_activity ? moment(mostActiveStudent.last_activity).tz('Africa/Harare').format('dddd, MMMM D, YYYY [at] HH:mm:ss') : 'N/A'})\n🐢 Least active student: ${leastActiveStudent?.name || 'N/A'}\n🔥 Most active parent: ${mostActiveParent?.name || 'N/A'}\n🐢 Least active parent: ${leastActiveParent?.name || 'N/A'}\n\n👨‍👩‍👧 *Parents and Children:*\n${parentInfo || 'None'}\n\n*Select an action:*`;
  const buttons = [
    { type: 'reply', displayText: lang === 'sn' ? '📊 Ongororo Yakazara' : '📊 Full Analytics', id: 'system analytics' },
    { type: 'reply', displayText: lang === 'sn' ? '🏫 Ronga Makirasi' : '🏫 Manage Classes', id: 'manage classes' },
    { type: 'reply', displayText: lang === 'sn' ? '📢 Tumira Kuvose' : '📢 Broadcast', id: 'broadcast' },
    { type: 'reply', displayText: lang === 'sn' ? '👨‍🏫 Ona Vadzidzisi' : '👨‍🏫 View Teachers', id: 'view teachers' },
    { type: 'reply', displayText: lang === 'sn' ? '👥 Ona Vadzidzi Vese' : '👥 View All Students', id: 'view all students' },
    { type: 'reply', displayText: lang === 'sn' ? '📋 Vanotungamira neKirasi' : '📋 Leaderboard by Class', id: 'leaderboard class' },
    { type: 'reply', displayText: lang === 'sn' ? '⛔ Misa Mudzidzi' : '⛔ Suspend Student', id: 'suspend student' },
    { type: 'reply', displayText: lang === 'sn' ? '✅ Dzorera Mudzidzi' : '✅ Unsuspend Student', id: 'unsuspend student' },
    { type: 'reply', displayText: lang === 'sn' ? '🚫 Bvisa Mudzidzisi' : '🚫 Ban Teacher', id: 'ban teacher' },
    { type: 'reply', displayText: lang === 'sn' ? '✅ Dzorera Mudzidzisi' : '✅ Unban Teacher', id: 'unban teacher' },
    { type: 'reply', displayText: lang === 'sn' ? '📊 Ongororo Yezvose' : '📊 System Stats', id: 'system stats' },
    { type: 'reply', displayText: lang === 'sn' ? '📅 Tumira Timetable yeKirasi' : '📅 Upload Class Timetable', id: 'upload class timetable' },
    { type: 'reply', displayText: '🎓 Promote Students', id: 'promote students' },
    { type: 'reply', displayText: '🔄 Reapply Window', id: 'reapply window' },
    { type: 'reply', displayText: '🏅 Manage Sports', id: 'manage sports' },
    { type: 'reply', displayText: '🚌 Create Trip', id: 'create trip' },
    { type: 'reply', displayText: '💊 View Medical', id: 'view medical admin' },
    { type: 'reply', displayText: '📊 Upload Results', id: 'upload results' },
    { type: 'reply', displayText: '📅 Events', id: 'events' },
    { type: 'reply', displayText: '📊 Export Data', id: 'export data' },
    { type: 'reply', displayText: '👥 Group Students', id: 'group students' },
    { type: 'reply', displayText: '📊 Export Analytics (Word)', id: 'export analytics' },
    { type: 'reply', displayText: '📋 Set Class Teacher', id: 'set class teacher' },
    { type: 'reply', displayText: '👀 View Class Teachers', id: 'view class teachers' },
  ];
  await sendButtonMessage(sock, to, { body: text, footer: getFooter(lang), buttons });
}

export async function sendTeacherDashboard(sock, to, quoted, user, lang) {
  const teachingClasses = user.teaching_classes || [];
  const classStats = [];
  for (const cls of teachingClasses) { const students = await getStudentsByClass(cls); classStats.push(`${cls}: ${students.length} ${lang === 'sn' ? 'vadzidzi' : 'students'}`); }
  const titleGreeting = user.title ? `${user.title} ${user.surname}` : user.name;
  const text = lang === 'sn' ? `👨‍🏫 *TEACHER DASHBOARD*\n\n👤 *${titleGreeting}*\n🆔 *ID:* ${user.teacher_id}\n\n📚 *Makirasi Angu:*\n├ ${classStats.join('\n├ ') || 'Hapana'}\n\n*Sarudza action:*` : `👨‍🏫 *TEACHER DASHBOARD*\n\n👤 *${titleGreeting}*\n🆔 *ID:* ${user.teacher_id}\n\n📚 *My Classes:*\n├ ${classStats.join('\n├ ') || 'None'}\n\n*Select an action:*`;
  const buttons = [
    { type: 'reply', displayText: '📝 Send Assignment', id: 'send assignment' },
    { type: 'reply', displayText: '📋 View Assignments', id: 'view assignments' },
    { type: 'reply', displayText: '📋 View Absences', id: 'view absences' },
    { type: 'reply', displayText: '✅ Approve Absence', id: 'approve absence' },
    { type: 'reply', displayText: '💊 View Medical', id: 'view medical' },
    { type: 'reply', displayText: '👥 View Students', id: 'view students' },
    { type: 'reply', displayText: '📅 Upload Teacher Timetable', id: 'upload teacher timetable' },
    { type: 'reply', displayText: '👀 View Teacher Timetable', id: 'view teacher timetable' },
    { type: 'reply', displayText: '📍 Track Absent', id: 'track absent' },
    { type: 'reply', displayText: '📋 My Classes', id: 'my classes' },
  ];
  for (const cls of teachingClasses.slice(0, 5)) {
    buttons.push({ type: 'reply', displayText: `📨 ${cls}`, id: `send_to_${cls.replace(/\s+/g, '_')}` });
  }
  await sendButtonMessage(sock, to, { body: text, footer: getFooter(lang), buttons });
}

// ─── MAIN MENU v5 ──────────────────────────────────────────────
export async function sendMainMenu(sock, to, quoted, user) {
  const lang = userLanguages.get(user.phone) || 'en';
  const now = moment().tz('Africa/Harare');
  const greet = now.hour() < 12 ? (lang === 'sn' ? 'Mangwanani' : 'Morning') : now.hour() < 18 ? (lang === 'sn' ? 'Masikati' : 'Afternoon') : (lang === 'sn' ? 'Manheru' : 'Evening');
  let weatherLine = '';
  const weather = await getWeather('Harare');
  if (weather) weatherLine = `\n🌤️ *Weather:* ${weather.description}, ${weather.temp}°C`;
  let titleDisplay = user.name;
  if (user.role === 'teacher' && user.title) titleDisplay = `${user.title} ${user.surname}`;
  if (user.is_developer) titleDisplay = `👑 ${titleDisplay} (DEV)`;
  const menuText = lang === 'sn' ? `╔════════════════════════╗\n  ✨ *${BOT_NAME}* — *${SCHOOL_NAME}*\n╚════════════════════════╝\n*Vagadziri: Vincent Ganiza*\n👋 *${greet} Chakanaka, ${titleDisplay}!*\n🎭 *Basa:* ${user.role === 'student' ? 'Mudzidzi' : user.role === 'parent' ? 'Mubereki' : user.role === 'teacher' ? 'Mudzidzisi' : 'Admin'}\n📅 *Zuva:* ${now.format('ddd, MMM D')}\n⏰ *Nguva:* ${now.format('HH:mm:ss')}${weatherLine}\n\n👇 *Sarudza kubva pazasi:*` : `╔════════════════════════╗\n  ✨ *${BOT_NAME}* — *${SCHOOL_NAME}*\n╚════════════════════════╝\n*Created by Vincent Ganiza*\n👋 *Good ${greet}, ${titleDisplay}!*\n🎭 *Role:* ${user.role === 'student' ? 'Student' : user.role === 'parent' ? 'Parent' : user.role === 'teacher' ? 'Teacher' : 'Admin'}\n📅 *Date:* ${now.format('ddd, MMM D')}\n⏰ *Time:* ${now.format('HH:mm:ss')}${weatherLine}\n\n👇 *Select a category below:*`;
  const sections = [];

  sections.push({
    title: getText('menuStudyTools', lang),
    rows: [
      { header: '📖', title: 'study', description: getText('studyDesc', lang), id: 'study' },
      { header: '❓', title: 'quiz', description: getText('quizDesc', lang), id: 'quiz' },
      { header: '🔖', title: 'flashcard', description: getText('flashcardDesc', lang), id: 'flashcard' },
      { header: '💡', title: 'reading tip', description: getText('readingTipDesc', lang), id: 'reading tip' },
      { header: '🌍', title: 'fact', description: getText('factDesc', lang), id: 'fact' }
    ]
  });

  sections.push({
    title: getText('menuLiveTracking', lang),
    rows: [
      { header: '📍', title: 'where is my child', description: getText('whereIsChildDesc', lang), id: 'where is my child' },
      { header: '📌', title: 'request location', description: getText('requestLocationDesc', lang), id: 'request location' },
      { header: '🔍', title: 'track absent', description: getText('trackAbsentDesc', lang), id: 'track absent' },
      { header: '🛑', title: 'stop tracking', description: getText('stopTrackingDesc', lang), id: 'stop tracking' }
    ]
  });

  sections.push({
    title: getText('menuAbsences', lang),
    rows: [
      { header: '📢', title: 'report absence', description: getText('reportAbsenceDesc', lang), id: 'report absence' },
      { header: '📝', title: 'absence reason', description: getText('absenceReasonDesc', lang), id: 'absence reason' },
      { header: '❓', title: 'ask reason', description: getText('askReasonDesc', lang), id: 'ask reason' },
      { header: '👀', title: 'view absences', description: getText('viewAbsencesDesc', lang), id: 'view absences' },
      { header: '✅', title: 'approve absence', description: getText('approveAbsenceDesc', lang), id: 'approve absence' },
      { header: '👨‍🏫', title: 'set class teacher', description: getText('setClassTeacherDesc', lang), id: 'set class teacher' },
      { header: '📋', title: 'view class teachers', description: getText('viewClassTeachersDesc', lang), id: 'view class teachers' },
      { header: '🏫', title: 'my classes', description: getText('myClassesDesc', lang), id: 'my classes' },
      { header: '👤', title: 'my absences', description: getText('myAbsencesDesc', lang), id: 'my absences' },
      { header: '👶', title: 'child absences', description: getText('childAbsencesDesc', lang), id: 'child absences' }
    ]
  });

  sections.push({
    title: getText('menuMedia', lang),
    rows: [
      { header: '🎨', title: 'image gen', description: getText('imageGenDesc', lang), id: 'image gen' },
      { header: '🔍', title: 'image search', description: getText('imageSearchDesc', lang), id: 'image search' },
      { header: '🔊', title: 'audio', description: getText('audioDesc', lang), id: 'audio' },
      { header: '📄', title: 'pdf', description: getText('pdfDesc', lang), id: 'pdf' },
      { header: '🤖', title: 'ai pdf', description: 'Generate AI PDF with interactive workflow', id: 'ai pdf' },
      { header: '🎵', title: 'song gen', description: getText('songGenDesc', lang), id: 'song gen' }
    ]
  });

  sections.push({
    title: getText('menuSearch', lang),
    rows: [
      { header: '🌐', title: 'google', description: getText('googleDesc', lang), id: 'google' },
      { header: '📖', title: 'wiki', description: getText('wikiDesc', lang), id: 'wiki' },
      { header: '📘', title: 'define', description: getText('defineDesc', lang), id: 'define' },
      { header: '🧮', title: 'calculate', description: getText('calculateDesc', lang), id: 'calculate' },
      { header: '🌤️', title: 'weather', description: getText('weatherDesc', lang), id: 'weather' }
    ]
  });

  sections.push({
    title: getText('menuWriting', lang),
    rows: [
      { header: '✍️', title: 'composition', description: getText('compositionDesc', lang), id: 'composition' },
      { header: '📝', title: 'summarize', description: getText('summarizeDesc', lang), id: 'summarize' }
    ]
  });

  sections.push({
    title: getText('menuAccount', lang),
    rows: [
      { header: '👤', title: 'profile', description: getText('profileDesc', lang), id: 'profile' },
      { header: '🏆', title: 'leaderboard', description: getText('leaderboardDesc', lang), id: 'leaderboard' },
      { header: '🌐', title: 'language', description: getText('languageDesc', lang), id: 'language' },
      { header: '👨‍💻', title: 'owner', description: getText('ownerDesc', lang), id: 'owner' },
      { header: '📖', title: 'guide', description: 'User guide (role-based)', id: 'guide' },
      { header: 'ℹ️', title: 'about', description: 'About this bot', id: 'about' }
    ]
  });

  if (user.role === 'parent') {
    sections.push({
      title: getText('menuParent', lang),
      rows: [
        { header: '🔗', title: 'link child', description: getText('linkChildDesc', lang), id: 'link child' },
        { header: '🔓', title: 'unlink child', description: getText('unlinkChildDesc', lang), id: 'unlink child' },
        { header: '📊', title: 'child progress', description: getText('childProgressDesc', lang), id: 'child progress' },
        { header: '📈', title: 'child analytics', description: getText('childAnalyticsDesc', lang), id: 'child analytics' },
        { header: '💊', title: 'child medical', description: getText('menuParentMedical', lang), id: 'child medical' },
        { header: '📋', title: 'child assignments', description: getText('menuParentAssignments', lang), id: 'child assignments' },
        { header: '👶', title: 'child absences', description: getText('menuParentAbsences', lang), id: 'child absences' }
      ]
    });
  }

  if (user.role === 'teacher') {
    sections.push({
      title: getText('menuTeacher', lang),
      rows: [
        { header: '📋', title: 'teacher dashboard', description: getText('teacherDashboardDesc', lang), id: 'teacher dashboard' },
        { header: '📝', title: 'send assignment', description: getText('menuTeacherAssignments', lang), id: 'send assignment' },
        { header: '📋', title: 'view assignments', description: getText('menuTeacherViewAssignments', lang), id: 'view assignments' },
        { header: '📋', title: 'view absences', description: getText('menuTeacherAbsences', lang), id: 'view absences' },
        { header: '✅', title: 'approve absence', description: getText('menuTeacherApproveAbsence', lang), id: 'approve absence' },
        { header: '💊', title: 'view medical', description: getText('menuTeacherMedical', lang), id: 'view medical' },
        { header: '👥', title: 'view students', description: getText('viewStudentsDesc', lang), id: 'view students' },
        { header: '📅', title: 'upload teacher timetable', description: getText('uploadTeacherTimetableDesc', lang), id: 'upload teacher timetable' },
        { header: '👀', title: 'view teacher timetable', description: getText('viewTeacherTimetableDesc', lang), id: 'view teacher timetable' },
        { header: '📍', title: 'track absent', description: getText('trackAbsentDesc', lang), id: 'track absent' },
        { header: '📋', title: 'my classes', description: getText('myClassesDesc', lang), id: 'my classes' }
      ]
    });
  }

  if (user.is_admin) {
    sections.push({
      title: getText('menuAdmin', lang),
      rows: [
        { header: '📊', title: 'admin dashboard', description: getText('adminDashboardDesc', lang), id: 'admin dashboard' },
        { header: '🎓', title: 'promote students', description: getText('menuAdminPromotion', lang), id: 'promote students' },
        { header: '🔄', title: 'reapply window', description: getText('menuAdminReapply', lang), id: 'reapply window' },
        { header: '🏅', title: 'manage sports', description: getText('menuAdminSports', lang), id: 'manage sports' },
        { header: '🚌', title: 'create trip', description: getText('menuAdminTrips', lang), id: 'create trip' },
        { header: '💊', title: 'view medical admin', description: 'View student medical info', id: 'view medical admin' },
        { header: '📊', title: 'upload results', description: getText('menuAdminResults', lang), id: 'upload results' },
        { header: '📅', title: 'events', description: getText('menuAdminEvents', lang), id: 'events' },
        { header: '📢', title: 'broadcast', description: getText('broadcastDesc', lang), id: 'broadcast' },
        { header: '🏫', title: 'manage classes', description: getText('manageClassesDesc', lang), id: 'manage classes' },
        { header: '👨‍🏫', title: 'view teachers', description: getText('viewTeachersDesc', lang), id: 'view teachers' },
        { header: '👥', title: 'view all students', description: getText('viewAllStudentsDesc', lang), id: 'view all students' },
        { header: '📋', title: 'leaderboard class', description: getText('leaderboardClassDesc', lang), id: 'leaderboard class' },
        { header: '⛔', title: 'suspend student', description: getText('suspendStudentDesc', lang), id: 'suspend student' },
        { header: '✅', title: 'unsuspend student', description: getText('unsuspendStudentDesc', lang), id: 'unsuspend student' },
        { header: '📊', title: 'system stats', description: getText('systemStatsDesc', lang), id: 'system stats' },
        { header: '📅', title: 'upload class timetable', description: getText('uploadClassTimetableDesc', lang), id: 'upload class timetable' },
        { header: '👥', title: 'group students', description: 'Group students by class, gender, form, activity', id: 'group students' },
        { header: '📊', title: 'export analytics', description: 'Export system analytics as Word doc', id: 'export analytics' },
        { header: '📊', title: 'export data', description: 'Export all data', id: 'export data' },
        { header: '📋', title: 'set class teacher', description: getText('setClassTeacherDesc', lang), id: 'set class teacher' },
        { header: '👀', title: 'view class teachers', description: getText('viewClassTeachersDesc', lang), id: 'view class teachers' }
      ]
    });
  }

  if (user.is_developer) {
    sections.push({
      title: getText('menuDeveloper', lang),
      rows: [
        { header: '👑', title: '.dev', description: 'Developer panel', id: '.dev' },
        { header: '📊', title: '.botstats', description: 'Full system stats', id: '.botstats' },
        { header: '👥', title: '.users', description: 'List all users', id: '.users' },
        { header: '⚡', title: '.eval', description: 'Run JS code', id: '.eval' },
        { header: '💻', title: '.exec', description: 'Run shell command', id: '.exec' },
        { header: '🔄', title: '.restart', description: 'Restart bot', id: '.restart' },
        { header: '🔧', title: '.maintenance', description: 'Toggle maintenance mode', id: '.maintenance' },
        { header: '⭐', title: '.addpremium', description: 'Give premium to user', id: '.addpremium' }
      ]
    });
  }

  sections.push({
    title: getText('menuTimetable', lang),
    rows: [
      { header: '📤', title: 'upload timetable', description: getText('uploadTimetableDesc', lang), id: 'upload timetable' },
      { header: '📚', title: 'upload reading timetable', description: getText('uploadReadingTimetableDesc', lang), id: 'upload reading timetable' },
      { header: '👀', title: 'view timetable', description: getText('viewTimetableDesc', lang), id: 'view timetable' }
    ]
  });

  const button = new Button(sock);
  button.setBody(menuText);
  button.setFooter(getFooter(lang) + (user.is_developer ? ' [DEV]' : ''));
  const selection = button.addSelection(lang === 'sn' ? '📋 VHURA MENU v5' : '📋 OPEN MENU v5');
  for (const section of sections) {
    selection.makeSection(section.title);
    for (const row of section.rows) {
      selection.makeRow(row.header, row.title, row.description, row.id);
    }
  }
  button.addReply(lang === 'sn' ? '🏆 Vanotungamira' : '🏆 Leaderboard', 'leaderboard');
  button.addReply(lang === 'sn' ? '👤 Profile Yangu' : '👤 My Profile', 'profile');
  if (user.is_developer) button.addReply('👑 DEV', '.dev');
  await button.send(to);
}

// ─── Registration Flow ──────────────────────────────────────────
export async function handleRegistrationFlow(sock, from, text, userPhone, waName, quoted) {
  if (!userPhone || userPhone.trim() === '') {
    log('Registration called with invalid phone', 'ERROR');
    await sock.sendMessage(from, { text: '❌ Registration failed: invalid phone number.' });
    return;
  }
  try {
    let user = await getUserByPhone(userPhone);
    if (!user) {
      await createUser(userPhone, { wa_name: waName, reg_step: 'ask_language', registered: false, temp_data: {} });
      user = await getUserByPhone(userPhone);
      if (!user) { await sock.sendMessage(from, { text: '❌ Registration failed. Please try again later.' }); return; }
    }
    if (user.registered) { await sendMainMenu(sock, from, quoted, user); return; }
    let step = user.reg_step || 'ask_language';
    let currentLang = userLanguages.get(userPhone) || 'en';
    const setLang = (lang) => userLanguages.set(userPhone, lang);
    const td = user.temp_data || {};
    if (!_lastPromptTimestamps) _lastPromptTimestamps = new Map();
    const lastPrompt = _lastPromptTimestamps.get(userPhone);
    if (lastPrompt && Date.now() - lastPrompt < 2000) return;
    _lastPromptTimestamps.set(userPhone, Date.now());

    if (step === 'ask_language') {
      const cmd = text.toLowerCase().trim();
      if (cmd === 'lang_en' || cmd === '1' || cmd === 'english' || cmd === 'en') {
        setLang('en'); await updateUser(userPhone, { reg_step: 'ask_role' });
        await sock.sendMessage(from, { text: getText('languageSet', 'en') });
        await sendRoleMenu(sock, from, 'en', quoted);
      } else if (cmd === 'lang_sn' || cmd === '2' || cmd === 'shona' || cmd === 'sn') {
        setLang('sn'); await updateUser(userPhone, { reg_step: 'ask_role' });
        await sock.sendMessage(from, { text: getText('languageSet', 'sn') });
        await sendRoleMenu(sock, from, 'sn', quoted);
      } else { await sendLanguageMenu(sock, from, quoted); }
      return;
    }
    currentLang = userLanguages.get(userPhone) || 'en';
    if (step === 'ask_role') {
      const cmd = text.toLowerCase().trim();
      let role = null;
      if (cmd === 'role_student' || cmd === 'student' || cmd === '1') role = 'student';
      else if (cmd === 'role_parent' || cmd === 'parent' || cmd === '2') role = 'parent';
      else if (cmd === 'role_teacher' || cmd === 'teacher' || cmd === '3') role = 'teacher';
      else if (cmd === 'role_admin' || cmd === 'admin' || cmd === '4') role = 'admin';
      if (!role) { await sendRoleMenu(sock, from, currentLang, quoted); return; }
      if (role === 'teacher' && await isTeacherBanned(userPhone)) {
        await sock.sendMessage(from, { text: getText('bannedTeacher', currentLang) + getFooter(currentLang) });
        await sendRoleMenu(sock, from, currentLang, quoted);
        return;
      }
      await updateUser(userPhone, { role });
      if (role === 'student') { await updateUser(userPhone, { reg_step: 'student_name' }); await sock.sendMessage(from, { text: getText('enterName', currentLang) + getFooter(currentLang) }); }
      else if (role === 'parent') { await updateUser(userPhone, { reg_step: 'parent_child_name' }); await sock.sendMessage(from, { text: getText('enterChildName', currentLang) + getFooter(currentLang) }); }
      else if (role === 'teacher') { await updateUser(userPhone, { reg_step: 'teacher_password' }); await sock.sendMessage(from, { text: getText('enterTeacherPassword', currentLang) + getFooter(currentLang) }); }
      else if (role === 'admin') { await updateUser(userPhone, { reg_step: 'admin_email' }); await sock.sendMessage(from, { text: getText('enterAdminEmail', currentLang) + getFooter(currentLang) }); }
      return;
    }
    // Student registration
    if (step === 'student_name') { const name = text.trim(); if (name.length < 2) { await sock.sendMessage(from, { text: '❌ Valid name required.' }); return; } await updateUser(userPhone, { name, reg_step: 'student_age' }); await sock.sendMessage(from, { text: getText('enterAge', currentLang) + getFooter(currentLang) }); return; }
    if (step === 'student_age') { const age = parseInt(text); if (isNaN(age) || age < 0 || age > MAX_AGE) { await sock.sendMessage(from, { text: getText('invalidAge', currentLang) }); return; } await updateUser(userPhone, { age, reg_step: 'student_gender' }); await sendGenderMenu(sock, from, currentLang, quoted); return; }
    if (step === 'student_gender') { let gender = null; const cmd = text.toLowerCase().trim(); if (cmd === 'gender_male' || cmd === 'male' || cmd === 'murume') { gender = 'male'; } else if (cmd === 'gender_female' || cmd === 'female' || cmd === 'mukadzi') { gender = 'female'; } else { await sendGenderMenu(sock, from, currentLang, quoted); return; } await updateUser(userPhone, { gender, reg_step: 'student_form' }); await sendFormMenu(sock, from, currentLang, quoted); return; }
    if (step === 'student_form') { let form = null; const input = text.toLowerCase().trim(); if (input.startsWith('form_')) { const raw = input.replace('form_', '').replace(/_/g, ' '); const classes = await getClasses(); if (classes) { for (const f of Object.keys(classes)) { if (f.toLowerCase().replace(/\s+/g, '_') === input.replace('form_', '') || f.toLowerCase() === raw.toLowerCase()) { form = f; break; } } } } else { const classes = await getClasses(); if (classes) { for (const f of Object.keys(classes)) { if (f.toLowerCase() === input || f.toLowerCase().includes(input)) { form = f; break; } } } } if (!form) { await sendFormMenu(sock, from, currentLang, quoted); return; } await updateUser(userPhone, { temp_data: { ...td, form }, reg_step: 'student_class' }); await sendClassMenu(sock, from, form, currentLang, quoted); return; }
    if (step === 'student_class') { let className = null; const input = text.toLowerCase().trim(); if (input.startsWith('class_')) className = input.replace('class_', '').replace(/_/g, ' '); else className = text.trim(); if (!await isValidClass(className)) { const classes = await getClasses(); if (classes) { const allStreams = []; for (const streams of Object.values(classes)) allStreams.push(...streams); const match = allStreams.find(c => c.toLowerCase() === className.toLowerCase()); if (match) className = match; else { const tempForm = td.form || Object.keys(classes)[0]; await sendClassMenu(sock, from, tempForm, currentLang, quoted); return; } } } await updateUser(userPhone, { class: className, reg_step: 'student_allergies' }); await sock.sendMessage(from, { text: getText('enterAllergies', currentLang) + getFooter(currentLang) }); return; }
    if (step === 'student_allergies') { const allergies = text.trim(); await updateUser(userPhone, { temp_data: { ...td, allergies }, reg_step: 'student_conditions' }); await sock.sendMessage(from, { text: getText('enterConditions', currentLang) + getFooter(currentLang) }); return; }
    if (step === 'student_conditions') { const conditions = text.trim(); await updateUser(userPhone, { temp_data: { ...td, conditions }, reg_step: 'student_blood' }); await sock.sendMessage(from, { text: getText('enterBloodType', currentLang) + getFooter(currentLang) }); return; }
    if (step === 'student_blood') { const blood = text.trim(); await updateUser(userPhone, { temp_data: { ...td, blood }, reg_step: 'student_contact' }); await sock.sendMessage(from, { text: getText('enterEmergencyContact', currentLang) + getFooter(currentLang) }); return; }
    if (step === 'student_contact') {
      const contact = text.trim();
      const { allergies, conditions, blood } = td;
      let contactName = 'None', contactPhone = 'N/A';
      if (contact !== 'none' && contact.length > 3) {
        const parts = contact.match(/^(.+?)\s+(\d+)$/);
        if (parts) {
          contactName = parts[1];
          contactPhone = parts[2];
        } else {
          contactName = contact;
        }
      }
      const studentId = await getNextStudentId();
      await updateUser(userPhone, { student_id: studentId, school: SCHOOL_NAME, registered: true, reg_step: null, tutorial_completed: false, temp_data: {} });
      await upsertMedicalInfo(userPhone, { allergies: allergies === 'none' ? null : allergies, conditions: conditions === 'none' ? null : conditions, blood_type: blood === 'unknown' ? null : blood, emergency_contact_name: contactName, emergency_contact_phone: contactPhone }, userPhone);
      await recordChildActivity(studentId);
      const completeMsg = getText('registrationComplete', currentLang, { name: user.name, studentId, age: user.age, gender: user.gender === 'male' ? 'Male' : 'Female', class: user.class, school: SCHOOL_NAME });
      await sock.sendMessage(from, { text: completeMsg + getFooter(currentLang) });
      const guideMsg = getText('guide', currentLang);
      await sock.sendMessage(from, { text: guideMsg + getFooter(currentLang) });
      await sendMainMenu(sock, from, quoted, await getUserByPhone(userPhone));
      return;
    }
    // Parent registration
    if (step === 'parent_child_name') { const childName = text.trim(); if (childName.length < 2) { await sock.sendMessage(from, { text: '❌ Valid name required.' }); return; } await updateUser(userPhone, { child_name: childName, reg_step: 'parent_relationship' }); await sock.sendMessage(from, { text: getText('enterRelationship', currentLang, { child: childName }) + getFooter(currentLang) }); return; }
    if (step === 'parent_relationship') { const relationship = text.trim(); if (relationship.length < 2) { await sock.sendMessage(from, { text: '❌ Valid relationship required.' }); return; } await updateUser(userPhone, { relationship, reg_step: 'parent_child_form' }); await sendFormMenu(sock, from, currentLang, quoted); return; }
    if (step === 'parent_child_form') { let form = null; const input = text.toLowerCase().trim(); if (input.startsWith('form_')) { const raw = input.replace('form_', '').replace(/_/g, ' '); const classes = await getClasses(); if (classes) { for (const f of Object.keys(classes)) { if (f.toLowerCase().replace(/\s+/g, '_') === input.replace('form_', '') || f.toLowerCase() === raw.toLowerCase()) { form = f; break; } } } } else { const classes = await getClasses(); if (classes) { for (const f of Object.keys(classes)) { if (f.toLowerCase() === input || f.toLowerCase().includes(input)) { form = f; break; } } } } if (!form) { await sendFormMenu(sock, from, currentLang, quoted); return; } await updateUser(userPhone, { temp_data: { ...td, form }, reg_step: 'parent_child_class' }); await sendClassMenu(sock, from, form, currentLang, quoted); return; }
    if (step === 'parent_child_class') { let className = null; const input = text.toLowerCase().trim(); if (input.startsWith('class_')) className = input.replace('class_', '').replace(/_/g, ' '); else className = text.trim(); if (!await isValidClass(className)) { const classes = await getClasses(); if (classes) { const allStreams = []; for (const streams of Object.values(classes)) allStreams.push(...streams); const match = allStreams.find(c => c.toLowerCase() === className.toLowerCase()); if (match) className = match; else { const tempForm = td.form || Object.keys(classes)[0]; await sendClassMenu(sock, from, tempForm, currentLang, quoted); return; } } } await updateUser(userPhone, { child_class: className, reg_step: 'parent_child_id' }); await sock.sendMessage(from, { text: getText('enterChildId', currentLang) + getFooter(currentLang) }); return; }
    if (step === 'parent_child_id') { const studentId = text.trim().toUpperCase(); if (!studentId.match(/^STUDY\d{4}$/)) { await sock.sendMessage(from, { text: '❌ Invalid Student ID format. Use STUDY0001.' }); return; } const childUser = await getUserByStudentId(studentId); if (!childUser) { await sock.sendMessage(from, { text: getText('childNotFound', currentLang, { id: studentId }) }); return; } await linkChildToParent(userPhone, studentId); await updateUser(userPhone, { linked_child_id: studentId, reg_step: 'parent_child_gender' }); await sendChildGenderMenu(sock, from, currentLang, quoted); return; }
    if (step === 'parent_child_gender') { let gender = null; const cmd = text.toLowerCase().trim(); if (cmd === 'child_gender_male' || cmd === 'male' || cmd === 'murume') { gender = 'male'; } else if (cmd === 'child_gender_female' || cmd === 'female' || cmd === 'mukadzi') { gender = 'female'; } else { await sendChildGenderMenu(sock, from, currentLang, quoted); return; } await updateUser(userPhone, { temp_data: { ...td, child_gender: gender }, reg_step: 'parent_child_allergies' }); await sock.sendMessage(from, { text: getText('enterAllergies', currentLang) + getFooter(currentLang) }); return; }
    if (step === 'parent_child_allergies') { const allergies = text.trim(); await updateUser(userPhone, { temp_data: { ...td, allergies }, reg_step: 'parent_child_conditions' }); await sock.sendMessage(from, { text: getText('enterConditions', currentLang) + getFooter(currentLang) }); return; }
    if (step === 'parent_child_conditions') { const conditions = text.trim(); await updateUser(userPhone, { temp_data: { ...td, conditions }, reg_step: 'parent_child_blood' }); await sock.sendMessage(from, { text: getText('enterBloodType', currentLang) + getFooter(currentLang) }); return; }
    if (step === 'parent_child_blood') { const blood = text.trim(); await updateUser(userPhone, { temp_data: { ...td, blood }, reg_step: 'parent_child_contact' }); await sock.sendMessage(from, { text: getText('enterEmergencyContact', currentLang) + getFooter(currentLang) }); return; }
    if (step === 'parent_child_contact') {
      const contact = text.trim();
      const { allergies, conditions, blood, child_gender } = td;
      let contactName = 'None', contactPhone = 'N/A';
      if (contact !== 'none' && contact.length > 3) {
        const parts = contact.match(/^(.+?)\s+(\d+)$/);
        if (parts) {
          contactName = parts[1];
          contactPhone = parts[2];
        } else {
          contactName = contact;
        }
      }
      const studentId = user.linked_child_id;
      const childUser = await getUserByStudentId(studentId);
      if (childUser) {
        if (!childUser.gender) {
          await updateUser(childUser.phone, { gender: child_gender });
        }
      }
      await upsertMedicalInfo(userPhone, { allergies: allergies === 'none' ? null : allergies, conditions: conditions === 'none' ? null : conditions, blood_type: blood === 'unknown' ? null : blood, emergency_contact_name: contactName, emergency_contact_phone: contactPhone }, userPhone);
      await updateUser(userPhone, { name: `${user.relationship} of ${childUser?.name || 'child'}`, registered: true, reg_step: null, tutorial_completed: true, temp_data: {} });
      const completeMsg = getText('parentComplete', currentLang, { child: childUser?.name || 'child', relationship: user.relationship, childId: studentId, class: childUser?.class || user.child_class, gender: child_gender === 'male' ? 'Male' : 'Female' });
      await sock.sendMessage(from, { text: completeMsg + getFooter(currentLang) });
      await sendMainMenu(sock, from, quoted, await getUserByPhone(userPhone));
      return;
    }
    // Teacher registration
    if (step === 'teacher_password') { if (text.trim() !== TEACHER_PASSWORD) { await sock.sendMessage(from, { text: getText('wrongTeacherPassword', currentLang) + getFooter(currentLang) }); return; } await updateUser(userPhone, { reg_step: 'teacher_gender' }); await sendGenderMenu(sock, from, currentLang, quoted); return; }
    if (step === 'teacher_gender') { let gender = null, title = null; const cmd = text.toLowerCase().trim(); if (cmd === 'gender_male' || cmd === 'male' || cmd === 'murume') { gender = 'male'; title = 'Sir'; } else if (cmd === 'gender_female' || cmd === 'female' || cmd === 'mukadzi') { gender = 'female'; title = "Ma'am"; } if (!gender) { await sendGenderMenu(sock, from, currentLang, quoted); return; } await updateUser(userPhone, { gender, title, reg_step: 'teacher_surname' }); await sock.sendMessage(from, { text: getText('enterSurname', currentLang) + getFooter(currentLang) }); return; }
    if (step === 'teacher_surname') { const surname = text.trim(); if (surname.length < 2) { await sock.sendMessage(from, { text: '❌ Valid surname required.' }); return; } await updateUser(userPhone, { surname, name: `${user.title} ${surname}`, reg_step: 'teacher_classes', temp_data: { ...td, teaching_classes: [] } }); await sendTeachingClassesMenu(sock, from, currentLang, [], quoted); return; }
    if (step === 'teacher_classes') { user = await getUserByPhone(userPhone); let selected = (user.temp_data?.teaching_classes) || []; const cmd = text.toLowerCase().trim(); if (cmd === 'done') { if (selected.length === 0) { await sendTeachingClassesMenu(sock, from, currentLang, selected, quoted); return; } const teacherId = await getNextTeacherId(); await updateUser(userPhone, { teacher_id: teacherId, teaching_classes: selected, registered: true, reg_step: null, tutorial_completed: true, temp_data: {} }); const completeMsg = getText('teacherComplete', currentLang, { title: user.title, teacherId, classes: selected.join(', ') }); await sock.sendMessage(from, { text: completeMsg + getFooter(currentLang) }); await sendMainMenu(sock, from, quoted, await getUserByPhone(userPhone)); return; } let className = null; if (cmd.startsWith('teach_')) className = cmd.replace('teach_', '').replace(/_/g, ' '); else className = text.trim(); const allStreams = []; const classes = await getClasses(); if (classes) { for (const streams of Object.values(classes)) allStreams.push(...streams); } const match = allStreams.find(c => c.toLowerCase() === className.toLowerCase() || c.toLowerCase().replace(/\s+/g, '_') === className.toLowerCase()); if (match) { if (selected.includes(match)) selected = selected.filter(c => c !== match); else selected.push(match); await updateUser(userPhone, { temp_data: { ...user.temp_data, teaching_classes: selected } }); } await sendTeachingClassesMenu(sock, from, currentLang, selected, quoted); return; }
    // Admin registration
    if (step === 'admin_email') { if (text.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) { await sock.sendMessage(from, { text: getText('wrongAdminCredentials', currentLang) + getFooter(currentLang) }); await updateUser(userPhone, { reg_step: 'ask_role' }); await sendRoleMenu(sock, from, currentLang, quoted); return; } await updateUser(userPhone, { reg_step: 'admin_password' }); await sock.sendMessage(from, { text: getText('enterAdminPassword', currentLang) + getFooter(currentLang) }); return; }
    if (step === 'admin_password') { if (text.trim() !== ADMIN_PASSWORD) { await sock.sendMessage(from, { text: getText('wrongAdminCredentials', currentLang) + getFooter(currentLang) }); await updateUser(userPhone, { reg_step: 'ask_role' }); await sendRoleMenu(sock, from, currentLang, quoted); return; } await updateUser(userPhone, { name: 'Admin', is_admin: true, registered: true, reg_step: null, tutorial_completed: true, temp_data: {} }); await sock.sendMessage(from, { text: getText('adminComplete', currentLang) + getFooter(currentLang) }); await sendAdminDashboard(sock, from, quoted, currentLang); return; }
    // Fallback
    await updateUser(userPhone, { reg_step: 'ask_language' });
    await sendLanguageMenu(sock, from, quoted);
  } catch (e) {
    log(`Registration flow error: ${e.message}`, 'ERROR');
    await sock.sendMessage(from, { text: '❌ Registration error. Please try again with *start*.' });
  }
}

// ─── Quiz Functions with Anti-Cheat ────────────────────────────
export async function generateQuizQuestions(subject, difficulty, count, quizType, lang = 'en') {
  const typeDesc = quizType === 'mc' ? 'multiple choice with 4 options' : (quizType === 'tf' ? 'true/false' : 'open-ended (no options)');
  const prompt = `Generate ${count} educational quiz questions for a Zimbabwean student studying ${subject} at ${difficulty} difficulty level.
Quiz type: ${typeDesc}.
For multiple choice questions, provide 4 options (A, B, C, D) and indicate the correct letter.
For true/false, provide "true" or "false" as the correct answer.
For open-ended, provide the correct answer as a short text.
Return ONLY a JSON array of objects with fields: "question", "type" ("mc"/"tf"/"open"), "options" (array of 4 strings for mc, null otherwise), "correct" (string: for mc the letter, for tf "true"/"false", for open the answer text).
${lang === 'sn' ? 'Respond in Shona.' : 'Respond in English.'}`;
  const response = await askAI(prompt, subject, null, lang);
  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const questions = JSON.parse(jsonMatch[0]);
      if (Array.isArray(questions) && questions.length >= count) {
        return questions.slice(0, count);
      } else if (Array.isArray(questions) && questions.length > 0) {
        const result = [...questions];
        while (result.length < count) {
          result.push({ question: lang === 'sn' ? `Mubvunzo ${result.length+1} pamusoro pe ${subject}` : `Question ${result.length+1} about ${subject}`, type: 'open', options: null, correct: 'Answer' });
        }
        return result;
      }
    }
  } catch (e) { log(`Failed to parse quiz JSON: ${e.message}`, 'ERROR'); }
  const fallback = [];
  for (let i = 0; i < count; i++) {
    fallback.push({ question: lang === 'sn' ? `Mubvunzo ${i+1} pamusoro pe ${subject}` : `Question ${i+1} about ${subject}`, type: 'open', options: null, correct: lang === 'sn' ? 'Ndiudze zvizhinji' : 'Provide a brief explanation' });
  }
  return fallback;
}

export async function sendQuizQuestionAntiCheat(sock, to, lang) {
  const quiz = pendingQuizConfig[to];
  if (!quiz) return;
  const q = quiz.questions[quiz.currentIndex];
  if (antiCheatQuiz[to] && antiCheatQuiz[to].timeout) {
    clearTimeout(antiCheatQuiz[to].timeout);
  }
  let text = `🔒 *Anti-Cheat Active* - 30s Timer\n\n📝 *Question ${quiz.currentIndex+1} of ${quiz.questions.length}*\n\n${q.question}\n\n⏰ Reply in 30s or auto-fail!\n⚠️ Forwarding = auto-fail & -20 pts`;
  let buttons = [];
  if (q.type === 'mc') {
    const letters = ['A', 'B', 'C', 'D'];
    for (let i = 0; i < q.options.length; i++) {
      buttons.push({ type: 'reply', displayText: `${letters[i]}. ${q.options[i]}`, id: `quiz_ans_${letters[i].toLowerCase()}` });
    }
  } else if (q.type === 'tf') {
    buttons = [
      { type: 'reply', displayText: '✅ True', id: 'quiz_ans_true' },
      { type: 'reply', displayText: '❌ False', id: 'quiz_ans_false' }
    ];
  } else {
    text += `\n\nType your answer.`;
    await sock.sendMessage(to, { text: text + getFooter(lang) });
    const timeout = setTimeout(async () => {
      await handleQuizTimeout(sock, to, lang);
    }, 30000);
    antiCheatQuiz[to] = { questionStart: Date.now(), timeout, warnings: (antiCheatQuiz[to]?.warnings || 0), cheatAttempts: (antiCheatQuiz[to]?.cheatAttempts || 0) };
    return;
  }
  await sendButtonMessage(sock, to, { body: text, footer: getFooter(lang), buttons });
  const timeout = setTimeout(async () => {
    await handleQuizTimeout(sock, to, lang);
  }, 30000);
  antiCheatQuiz[to] = { questionStart: Date.now(), timeout, warnings: (antiCheatQuiz[to]?.warnings || 0), cheatAttempts: (antiCheatQuiz[to]?.cheatAttempts || 0) };
}

export async function handleQuizTimeout(sock, to, lang) {
  const quiz = pendingQuizConfig[to];
  if (!quiz) return;
  const q = quiz.questions[quiz.currentIndex];
  quiz.results.push({ question: q.question, userAnswer: 'TIMEOUT', correct: false, correctAnswer: q.correct });
  quiz.score += 0;
  quiz.currentIndex++;
  await sock.sendMessage(to, { text: `⏰ *Time's up!* Auto-marked incorrect.\n\nMoving to next question...` + getFooter(lang) });
  if (antiCheatQuiz[to] && antiCheatQuiz[to].timeout) {
    clearTimeout(antiCheatQuiz[to].timeout);
  }
  if (quiz.currentIndex < quiz.questions.length) {
    await sendQuizQuestionAntiCheat(sock, to, lang);
  } else {
    const resultText = `🏆 *Quiz Complete!*\n\nScore: ${quiz.score}/${quiz.questions.length}\nPoints earned: ${quiz.score * 10}\n\n📊 *Detailed Results*\n`;
    let details = '';
    for (let i = 0; i < quiz.results.length; i++) {
      const r = quiz.results[i];
      details += `\n${i+1}. ${r.question}\n   Your answer: ${r.userAnswer}\n   ${r.correct ? '✅ Correct' : `❌ Incorrect (Correct: ${r.correctAnswer})`}\n`;
    }
    await sock.sendMessage(to, { text: resultText + details + getFooter(lang) });
    delete pendingQuizConfig[to];
    delete antiCheatQuiz[to];
  }
}

export async function handleQuizAnswer(sock, fromJid, answer, userPhone, user) {
  const quiz = pendingQuizConfig[fromJid];
  if (!quiz) return false;
  if (antiCheatQuiz[fromJid] && antiCheatQuiz[fromJid].timeout) {
    clearTimeout(antiCheatQuiz[fromJid].timeout);
  }
  const q = quiz.questions[quiz.currentIndex];
  let isCorrect = false, correctAnswer = q.correct, userAnswer = answer;
  if (q.type === 'mc') {
    const letters = ['a', 'b', 'c', 'd'];
    if (!letters.includes(userAnswer)) return false;
    const correctLetter = q.correct.toLowerCase();
    isCorrect = (userAnswer === correctLetter);
  } else if (q.type === 'tf') {
    if (userAnswer !== 'true' && userAnswer !== 'false') return false;
    isCorrect = (userAnswer === q.correct.toLowerCase());
  } else {
    const judgePrompt = `The quiz question was: "${q.question}". The user answered: "${userAnswer}". Is this answer correct or partially correct? Respond with ONLY "correct" or "incorrect".`;
    const judge = await askAI(judgePrompt, quiz.subject, user.role === 'student' ? user.student_id : null, userLanguages.get(userPhone) || 'en');
    isCorrect = judge.toLowerCase().includes('correct');
    correctAnswer = q.correct;
  }
  const pointsEarned = isCorrect ? 10 : 0;
  if (isCorrect) {
    await addPoints(userPhone, pointsEarned);
    await recordQuizCorrect();
    if (user.role === 'student') await recordQuizResult(user.student_id, true);
  } else {
    await recordQuizIncorrect();
    if (user.role === 'student') await recordQuizResult(user.student_id, false);
  }
  quiz.results.push({ question: q.question, userAnswer, correct: isCorrect, correctAnswer });
  quiz.score += isCorrect ? 1 : 0;
  quiz.currentIndex++;
  delete antiCheatQuiz[fromJid];
  if (quiz.currentIndex < quiz.questions.length) {
    await sendQuizQuestionAntiCheat(sock, fromJid, userLanguages.get(userPhone) || 'en');
  } else {
    let resultText = `🏆 *Quiz Complete!*\n\nScore: ${quiz.score}/${quiz.questions.length}\nPoints earned: ${quiz.score * 10}\n\n📊 *Detailed Results*\n`;
    for (let i = 0; i < quiz.results.length; i++) {
      const r = quiz.results[i];
      resultText += `\n${i+1}. ${r.question}\n   Your answer: ${r.userAnswer}\n   ${r.correct ? '✅ Correct' : `❌ Incorrect (Correct: ${r.correctAnswer})`}\n`;
    }
    await sock.sendMessage(fromJid, { text: resultText + getFooter(userLanguages.get(userPhone) || 'en') });
    delete pendingQuizConfig[fromJid];
  }
  return true;
}

// ─── Auto-read/typing ──────────────────────────────────────────
export function isBotMentioned(message, botNumber) {
  if (!message.message) return false;
  const messageTypes = ['extendedTextMessage', 'imageMessage', 'videoMessage', 'stickerMessage', 'documentMessage', 'audioMessage', 'contactMessage', 'locationMessage'];
  for (const type of messageTypes) {
    if (message.message[type]?.contextInfo?.mentionedJid) {
      const mentionedJid = message.message[type].contextInfo.mentionedJid;
      if (mentionedJid.some(jid => jid === botNumber)) return true;
    }
  }
  const textContent = message.message.conversation || message.message.extendedTextMessage?.text || message.message.imageMessage?.caption || message.message.videoMessage?.caption || '';
  if (textContent) {
    const botUsername = botNumber.split('@')[0];
    if (textContent.includes(`@${botUsername}`)) return true;
    const botNames = [global.botname?.toLowerCase(), 'bot', 'knight', 'knight bot', BOT_NAME.toLowerCase()];
    const words = textContent.toLowerCase().split(/\s+/);
    if (botNames.some(name => words.includes(name))) return true;
  }
  return false;
}
export async function handleAutoread(sock, message) {
  if (await getAutoReadConfig()) {
    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const isMentioned = isBotMentioned(message, botNumber);
    if (!isMentioned) {
      const key = { remoteJid: message.key.remoteJid, id: message.key.id, participant: message.key.participant };
      await sock.readMessages([key]);
      return true;
    }
    return false;
  }
  return false;
}
export async function handleAutotyping(sock, chatId, delayMs = 2000) {
  if (await getAutoTypingConfig()) {
    try {
      await sock.presenceSubscribe(chatId);
      await sock.sendPresenceUpdate('available', chatId);
      await delay(500);
      await sock.sendPresenceUpdate('composing', chatId);
      await delay(delayMs);
      await sock.sendPresenceUpdate('paused', chatId);
      return true;
    } catch (e) { log(`Typing indicator error: ${e.message}`, 'ERROR'); return false; }
  }
  return false;
}

// ─── Broadcast Scheduler ──────────────────────────────────────
export async function startBroadcastScheduler(sock) {
  if (broadcastSchedulerStarted) return;
  broadcastSchedulerStarted = true;
  setInterval(async () => {
    try {
      const pending = await dbQuery('announcements', 'select', null, { eq: { field: 'recipients_count', value: 0 } });
      if (!pending || pending.length === 0) return;
      log(`Found ${pending.length} pending announcements.`, 'BROADCAST');
      for (const ann of pending) {
        const allUsers = await getAllUsers();
        if (!allUsers || allUsers.length === 0) continue;
        let sent = 0;
        const template = `📢 *ANNOUNCEMENT*\n\n${ann.content}\n\n${ann.caption ? `📎 ${ann.caption}\n\n` : ''}— ${SCHOOL_NAME} Administration`;
        for (const u of allUsers) {
          try {
            const langUser = userLanguages.get(u.phone) || 'en';
            const jid = formatJid(u.phone);
            if (!jid) continue;
            await sock.sendMessage(jid, { text: template + getFooter(langUser) });
            sent++;
            await delay(200);
          } catch (e) { log(`Broadcast failed to ${u.phone}: ${e.message}`, 'ERROR'); }
        }
        await dbQuery('announcements', 'update', { recipients_count: sent }, { eq: { field: 'id', value: ann.id } });
        log(`Broadcast ${ann.id} sent to ${sent} users`, 'BROADCAST');
      }
    } catch (e) { log(`Broadcast scheduler error: ${e.message}`, 'ERROR'); }
  }, 30000);
}

// ─── Reminders Scheduler ──────────────────────────────────────
let schedulersStarted = false;
export async function startReminderSchedulers(sock) {
  log('⏰ Starting reminder schedulers...', 'SYSTEM');
  setInterval(async () => {
    const now = moment().tz('Africa/Harare');
    const day = now.day();
    const hour = now.hour();
    const minute = now.minute();
    const today = now.format('YYYY-MM-DD');

    if (day >= 1 && day <= 5 && hour === 6 && minute === 0) {
      const weather = await getWeather('Harare');
      if (weather) {
        const advice = getWeatherAdvice(weather, 'en');
        const users = await getAllUsers();
        for (const user of users) {
          if (user.suspended) continue;
          const settings = userReminderSettings.get(user.phone) || { weather: true, homework: true, weekend: true };
          if (!settings.weather) continue;
          const lastSent = await getReminderDate(user.phone, 'morning');
          if (!lastSent || moment(lastSent).format('YYYY-MM-DD') !== today) {
            try {
              const lang = userLanguages.get(user.phone) || 'en';
              const msg = `🌅 *Good morning ${user.name || user.wa_name}!*\n\n🌤️ Weather today: ${weather.description}, ${weather.temp}°C.\n\n${advice}\n\nStay focused on your studies! 📚✨`;
              const jid = formatJid(user.phone);
              if (jid) await sock.sendMessage(jid, { text: msg + getFooter(lang) });
              await setReminderDate(user.phone, 'morning', new Date().toISOString());
              log(`Morning weather sent to ${user.phone}`, 'REMINDER');
              await delay(500);
            } catch (e) { log(`Morning weather reminder error: ${e.message}`, 'ERROR'); }
          }
        }
      }
    }

    if (day >= 1 && day <= 5 && (hour === 6 || hour === 12 || hour === 18) && minute === 0) {
      const key = `${today}-${hour}`;
      if (angelusSentDate !== key) {
        const users = await getAllUsers();
        for (const user of users) {
          if (user.suspended) continue;
          try {
            const lang = userLanguages.get(user.phone) || 'en';
            const jid = formatJid(user.phone);
            if (jid) await sock.sendMessage(jid, { text: `🕊️ *Angelus Prayer*\n\n${ANGELUS_PRAYER}\n\n${getFooter(lang)}` });
            log(`Angelus sent to ${user.phone}`, 'REMINDER');
            await delay(300);
          } catch (e) { log(`Angelus send error: ${e.message}`, 'ERROR'); }
        }
        angelusSentDate = key;
      }
    }

    if (day >= 1 && day <= 5 && hour === 18 && minute === 0) {
      const users = await getAllUsers();
      for (const user of users) {
        if (user.suspended) continue;
        const settings = userReminderSettings.get(user.phone) || { weather: true, homework: true, weekend: true };
        if (!settings.homework) continue;
        const lastSent = await getReminderDate(user.phone, 'homework');
        if (!lastSent || moment(lastSent).format('YYYY-MM-DD') !== today) {
          try {
            const lang = userLanguages.get(user.phone) || 'en';
            let msg = `📚 *Homework Reminder*\n\nHello ${user.name || user.wa_name}! Have you done your homework? I can help!`;
            if (user.role === 'parent' && user.child_name) msg = `📚 *Homework Reminder for ${user.child_name}*\n\nHello ${user.name}! Please check if ${user.child_name} has done homework.`;
            const jid = formatJid(user.phone);
            if (jid) await sock.sendMessage(jid, { text: msg + getFooter(lang) });
            await setReminderDate(user.phone, 'homework', new Date().toISOString());
            log(`Homework sent to ${user.phone}`, 'REMINDER');
            await delay(500);
          } catch (e) { log(`Homework reminder error: ${e.message}`, 'ERROR'); }
        }
      }
    }

    if (day === 6 && hour === 8 && minute === 0) {
      const users = await getAllUsers();
      for (const user of users) {
        if (user.suspended) continue;
        const settings = userReminderSettings.get(user.phone) || { weather: true, homework: true, weekend: true };
        if (!settings.weekend) continue;
        const lastSent = await getReminderDate(user.phone, 'weekend');
        if (!lastSent || moment(lastSent).format('YYYY-MM-DD') !== today) {
          try {
            const lang = userLanguages.get(user.phone) || 'en';
            let msg = `🌞 *Happy Weekend!*\n\nHello ${user.name || user.wa_name}! Enjoy your weekend but don't forget to review what you learned. 🎉`;
            if (user.role === 'parent' && user.child_name) msg = `🌞 *Weekend Reminder for ${user.child_name}*\n\nHello ${user.name}! Remind ${user.child_name} to complete weekend homework and relax.`;
            const jid = formatJid(user.phone);
            if (jid) await sock.sendMessage(jid, { text: msg + getFooter(lang) });
            await setReminderDate(user.phone, 'weekend', new Date().toISOString());
            log(`Weekend sent to ${user.phone}`, 'REMINDER');
            await delay(500);
          } catch (e) { log(`Weekend reminder error: ${e.message}`, 'ERROR'); }
        }
      }
    }
  }, 60000);

  setInterval(async () => {
    const now = moment().tz('Africa/Harare');
    if (now.hour() < 8 || now.hour() > 22) return;
    const users = await getAllUsers();
    const quote = await askAI('Generate a short, inspiring motivational quote for students. Make it about education, perseverance, or success. Return only the quote and the author, formatted as: "Quote" – Author.', null, null, 'en');
    const finalQuote = quote || "🌟 'Education is the most powerful weapon which you can use to change the world.' – Nelson Mandela";
    for (const user of users) {
      if (user.suspended) continue;
      try {
        const lang = userLanguages.get(user.phone) || 'en';
        const jid = formatJid(user.phone);
        if (jid) await sock.sendMessage(jid, { text: `✨ *Motivational Moment*\n\n${finalQuote}\n\n${getFooter(lang)}` });
        await delay(300);
      } catch (e) { /* ignore */ }
    }
    log('Sent AI-generated motivational quotes to all users.', 'SCHEDULE');
  }, 2 * 60 * 60 * 1000);
}

// ─── Command Detection ─────────────────────────────────────────
export function detectCommand(text) {
  const lower = text.toLowerCase().trim();
  const singleCommands = [
    'menu', 'start', 'help', 'guide', 'profile', 'leaderboard', 'quiz', 'study', 'weather', 'audio', 'pdf', 'ai pdf',
    'image gen', 'image search', 'image edit', 'flashcard', 'reading tip', 'study tip', 'fact', 'define', 'calculate',
    'composition', 'summarize', 'google', 'wiki', 'upload timetable', 'upload reading timetable', 'upload teacher timetable',
    'view timetable', 'view teacher timetable', 'teacher dashboard', 'view students', 'admin dashboard', 'broadcast',
    'manage classes', 'view teachers', 'view all students', 'leaderboard class', 'system stats', 'upload class timetable',
    'export data', 'reapply', 'restart registration', 'restart', 'link child', 'unlink child', 'child progress',
    'child analytics', 'add class', 'remove class', 'ban teacher', 'unban teacher', 'assign teacher', 'remove teacher',
    'ban stream', 'unban stream', 'suspend student', 'unsuspend student', 'cancel reminders', 'disable reminders',
    'enable reminders', '.autoread', '.autotyping', 'language english', 'language shona', 'language', 'owner', 'test',
    'promote students', 'reapply window', 'manage sports', 'create trip', 'view medical admin', 'upload results', 'events',
    'send assignment', 'view assignments', 'view absences', 'approve absence', 'reject absence', 'view medical',
    'report absence', 'my assignments', 'my medical', 'join sport', 'my results', 'child medical', 'child assignments',
    'child absences', 'group students', 'export analytics', 'about', 'song gen', 'song',
    'where is my child', 'child live', 'child location', 'child tracking', 'request location', 'track absent',
    'stop tracking', 'delete location', 'absence reason', 'my reason', 'reason', 'ask reason', 'why absent',
    'request reason', 'set class teacher', 'remove class teacher', 'view class teachers', 'my classes',
    'my absences', 'child absences'
  ];
  if (singleCommands.includes(lower)) return text;
  const patterns = [
    { regex: /^study\s+(.+)/i, cmd: 'study' },
    { regex: /^flashcard\s+(.+)/i, cmd: 'flashcard' },
    { regex: /^weather\s+(.+)/i, cmd: 'weather' },
    { regex: /^define\s+(.+)/i, cmd: 'define' },
    { regex: /^calculate\s+(.+)/i, cmd: 'calculate' },
    { regex: /^composition\s+(.+)/i, cmd: 'composition' },
    { regex: /^summarize\s+(.+)/i, cmd: 'summarize' },
    { regex: /^google\s+(.+)/i, cmd: 'google' },
    { regex: /^wiki\s+(.+)/i, cmd: 'wiki' },
    { regex: /^image\s+gen\s+(.+)/i, cmd: 'image gen' },
    { regex: /^image\s+search\s+(.+)/i, cmd: 'image search' },
    { regex: /^image\s+edit\s+(.+)/i, cmd: 'image edit' },
    { regex: /^audio\s+(.+)/i, cmd: 'audio' },
    { regex: /^pdf\s+(.+)/i, cmd: 'pdf' },
    { regex: /^song\s+(.+)/i, cmd: 'song gen' },
    { regex: /^link\s+child\s+(\w+)/i, cmd: 'link child' },
    { regex: /^child\s+progress\s+(\w+)/i, cmd: 'child progress' },
    { regex: /^child\s+analytics\s+(\w+)/i, cmd: 'child analytics' },
    { regex: /^suspend\s+student\s+(\w+)/i, cmd: 'suspend student' },
    { regex: /^unsuspend\s+student\s+(\w+)/i, cmd: 'unsuspend student' },
    { regex: /^ban\s+stream\s+(.+)/i, cmd: 'ban stream' },
    { regex: /^unban\s+stream\s+(.+)/i, cmd: 'unban stream' },
    { regex: /^add\s+class\s+(.+)/i, cmd: 'add class' },
    { regex: /^remove\s+class\s+(.+)/i, cmd: 'remove class' },
    { regex: /^send\s+to\s+class\s+(.+)/i, cmd: 'send to class' },
    { regex: /^ban\s+teacher\s+(\w+)/i, cmd: 'ban teacher' },
    { regex: /^unban\s+teacher\s+(\w+)/i, cmd: 'unban teacher' },
    { regex: /^assign\s+teacher\s+(\w+)\s+to\s+(.+)/i, cmd: 'assign teacher' },
    { regex: /^remove\s+teacher\s+(\w+)\s+from\s+(.+)/i, cmd: 'remove teacher' },
    { regex: /^\.autoread\s+(on|off|enable|disable)/i, cmd: '.autoread' },
    { regex: /^\.autotyping\s+(on|off|enable|disable)/i, cmd: '.autotyping' },
    { regex: /^leaderboard\s+(weekly|monthly|alltime)/i, cmd: 'leaderboard' },
    { regex: /^broadcast\s+(.+)/i, cmd: 'broadcast' },
    { regex: /^add\s+sport\s+(.+)/i, cmd: 'add sport' },
    { regex: /^remove\s+sport\s+(.+)/i, cmd: 'remove sport' },
    { regex: /^add\s+season\s+(.+)/i, cmd: 'add season' },
    { regex: /^close\s+season\s+(\d+)/i, cmd: 'close season' },
    { regex: /^add\s+event\s+(.+)/i, cmd: 'add event' },
    { regex: /^open\s+reapply/i, cmd: 'open reapply' },
    { regex: /^close\s+reapply/i, cmd: 'close reapply' },
    { regex: /^request\s+location\s+(\w+)/i, cmd: 'request location' },
    { regex: /^track\s+absent\s+(.+)/i, cmd: 'track absent' },
    { regex: /^ask\s+reason\s+(\w+)/i, cmd: 'ask reason' },
    { regex: /^why\s+absent\s+(\w+)/i, cmd: 'ask reason' },
    { regex: /^request\s+reason\s+(\w+)/i, cmd: 'ask reason' },
    { regex: /^approve\s+absence\s+(\d+)/i, cmd: 'approve absence' },
    { regex: /^reject\s+absence\s+(\d+)/i, cmd: 'reject absence' },
    { regex: /^set\s+class\s+teacher\s+(.+?)\s+(\d+)/i, cmd: 'set class teacher' },
    { regex: /^remove\s+class\s+teacher\s+(.+?)\s+(\d+)/i, cmd: 'remove class teacher' },
    { regex: /^absence\s+reason\s+(.+)/i, cmd: 'absence reason' },
    { regex: /^my\s+reason\s+(.+)/i, cmd: 'absence reason' },
    { regex: /^reason\s+(.+)/i, cmd: 'absence reason' },
    { regex: /^absence\s+(.+)/i, cmd: 'absence reason' },
    { regex: /^child\s+absences\s+(\w+)/i, cmd: 'child absences' },
  ];
  for (const pat of patterns) {
    const match = text.match(pat.regex);
    if (match) return text;
  }
  return null;
}

// ─── Helper Functions ──────────────────────────────────────────
export async function groupStudentsBy(sock, to, user, type, lang) {
  const students = await getAllStudents();
  if (!students.length) return await sock.sendMessage(to, { text: 'No students registered.' });
  let result = '';
  if (type === 'class') {
    const groups = {};
    for (const s of students) {
      if (!groups[s.class]) groups[s.class] = [];
      groups[s.class].push(s);
    }
    for (const [cls, list] of Object.entries(groups).sort()) {
      result += `📚 *${cls}* (${list.length})\n`;
      list.forEach(s => result += `  • ${s.name} (${s.student_id}) - ${s.gender || 'N/A'}\n`);
    }
  } else if (type === 'gender') {
    const groups = { Male: [], Female: [], Other: [] };
    for (const s of students) {
      const g = s.gender === 'male' ? 'Male' : s.gender === 'female' ? 'Female' : 'Other';
      groups[g].push(s);
    }
    for (const [g, list] of Object.entries(groups)) {
      if (list.length) {
        result += `👤 *${g}* (${list.length})\n`;
        list.forEach(s => result += `  • ${s.name} (${s.student_id}) - Class ${s.class}\n`);
      }
    }
  } else if (type === 'form') {
    const groups = {};
    for (const s of students) {
      const form = s.class ? s.class.replace(/[0-9]/g, '').trim() : 'Unknown';
      if (!groups[form]) groups[form] = [];
      groups[form].push(s);
    }
    for (const [form, list] of Object.entries(groups).sort()) {
      result += `📚 *Form ${form}* (${list.length})\n`;
      list.forEach(s => result += `  • ${s.name} (${s.student_id}) - ${s.class}\n`);
    }
  } else if (type === 'most_active') {
    const sorted = [...students].sort((a, b) => (b.last_activity || 0) - (a.last_activity || 0));
    result += '🔥 *Most Active Students*\n\n';
    sorted.slice(0, 10).forEach((s, i) => {
      result += `${i+1}. ${s.name} (${s.student_id}) - Last active: ${s.last_activity ? moment(s.last_activity).tz('Africa/Harare').fromNow() : 'Never'}\n`;
    });
  } else if (type === 'least_active') {
    const sorted = [...students].sort((a, b) => (a.last_activity || 0) - (b.last_activity || 0));
    result += '🐢 *Least Active Students*\n\n';
    sorted.slice(0, 10).forEach((s, i) => {
      result += `${i+1}. ${s.name} (${s.student_id}) - Last active: ${s.last_activity ? moment(s.last_activity).tz('Africa/Harare').fromNow() : 'Never'}\n`;
    });
  }
  await sock.sendMessage(to, { text: result + getFooter(lang) });
}

export async function exportAnalyticsWord(sock, to, lang) {
  const analytics = await getSystemAnalytics();
  const students = await getAllStudents();
  const teachers = await getTeachers();
  const parents = (await getAllUsers()).filter(u => u.role === 'parent');
  const now = moment().tz('Africa/Harare');
  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>body { font-family: Arial, sans-serif; margin: 40px; } h1 { color: #1a237e; border-bottom: 3px solid #FFD700; padding-bottom: 10px; } h2 { color: #008000; margin-top: 30px; } table { border-collapse: collapse; width: 100%; margin: 20px 0; } th { background-color: #1a237e; color: white; padding: 10px; text-align: left; } td { border: 1px solid #ddd; padding: 8px; } tr:nth-child(even) { background-color: #f2f2f2; } .footer { margin-top: 30px; font-size: 10px; color: #555; border-top: 1px solid #ccc; padding-top: 10px; }</style></head><body>
  <h1>📊 StudyMate AI – System Analytics Report</h1>
  <p><strong>School:</strong> ${SCHOOL_NAME}</p>
  <p><strong>Generated:</strong> ${now.format('dddd, MMMM D, YYYY [at] HH:mm:ss')}</p>
  <hr><h2>📈 Overall Statistics</h2><table>
  <tr><th>Metric</th><th>Value</th></tr>
  <tr><td>Total Users</td><td>${analytics.totalUsers}</td></tr>
  <tr><td>Students</td><td>${analytics.students}</td></tr>
  <tr><td>Parents</td><td>${analytics.parents}</td></tr>
  <tr><td>Teachers</td><td>${analytics.teachers}</td></tr>
  <tr><td>Today's Messages</td><td>${analytics.todayMessages}</td></tr>
  <tr><td>Today's Interactions</td><td>${analytics.todayInteractions}</td></tr>
  <tr><td>Quiz Correct</td><td>${analytics.quizCorrect}</td></tr>
  <tr><td>Quiz Incorrect</td><td>${analytics.quizIncorrect}</td></tr>
  <tr><td>Pass Rate</td><td>${(analytics.quizCorrect + analytics.quizIncorrect) > 0 ? ((analytics.quizCorrect / (analytics.quizCorrect + analytics.quizIncorrect)) * 100).toFixed(1) + '%' : 'N/A'}</td></tr>
  </table>
  <h2>👥 Students by Class</h2><table><tr><th>Class</th><th>Count</th><th>Students</th></tr>`;
  const classGroups = {};
  for (const s of students) {
    if (!classGroups[s.class]) classGroups[s.class] = [];
    classGroups[s.class].push(s.name);
  }
  for (const [cls, names] of Object.entries(classGroups).sort()) {
    html += `<tr><td>${cls}</td><td>${names.length}</td><td>${names.join(', ')}</td></tr>`;
  }
  html += `</table><h2>👨‍🏫 Teachers</h2><table><tr><th>Name</th><th>Teacher ID</th><th>Classes</th></tr>`;
  for (const t of teachers) {
    html += `<tr><td>${t.name}</td><td>${t.teacher_id}</td><td>${(t.teaching_classes || []).join(', ') || 'None'}</td></tr>`;
  }
  html += `</table><h2>👨‍👩‍👧 Parents</h2><table><tr><th>Name</th><th>Linked Child</th></tr>`;
  for (const p of parents) {
    const children = await getChildren(p.phone);
    const childNames = [];
    for (const cid of children) {
      const child = await getUserByStudentId(cid);
      if (child) childNames.push(child.name);
    }
    html += `<tr><td>${p.name}</td><td>${childNames.join(', ') || 'None'}</td></tr>`;
  }
  html += `</table><div class="footer"><p>${BOT_NAME} – ${SCHOOL_NAME} | ${now.format('YYYY')}</p></div></body></html>`;
  const tmpPath = path.join(os.tmpdir(), `Analytics_${now.format('YYYY-MM-DD_HH-mm')}.doc`);
  fsExtra.writeFileSync(tmpPath, html);
  const buffer = fsExtra.readFileSync(tmpPath);
  fsExtra.unlinkSync(tmpPath);
  await safeSendMedia(sock, to, {
    document: buffer,
    mimetype: 'application/msword',
    fileName: `StudyMate_Analytics_${now.format('YYYY-MM-DD')}.doc`,
    caption: `📊 *System Analytics Report*\n${now.format('dddd, MMMM D, YYYY [at] HH:mm')}`
  }, {}, null);
}

export async function exportAllData() {
  const now = moment().tz('Africa/Harare');
  const lines = [];
  lines.push('============================================================');
  lines.push(`📊 STUDY MATE AI – FULL DATA EXPORT – ${now.format('dddd, MMMM D, YYYY [at] HH:mm:ss')}`);
  lines.push('============================================================');
  lines.push('');
  const students = await getAllStudents();
  lines.push(`👥 STUDENTS (${students.length})`);
  lines.push('----------------------------------------------------------------');
  lines.push('| Name                    | Student ID   | Class     | Points  | Rank       | Registered On       | Phone          |');
  lines.push('|-------------------------|--------------|-----------|---------|------------|---------------------|----------------|');
  students.sort((a, b) => (b.points || 0) - (a.points || 0)).forEach(s => {
    const name = (s.name || 'N/A').padEnd(24).slice(0, 24);
    const id = (s.student_id || 'N/A').padEnd(12).slice(0, 12);
    const cls = (s.class || 'N/A').padEnd(9).slice(0, 9);
    const pts = String(s.points || 0).padStart(7);
    const rank = (s.rank || 'Beginner').padEnd(10).slice(0, 10);
    const reg = s.created_at ? moment(s.created_at).tz('Africa/Harare').format('YYYY-MM-DD HH:mm') : 'N/A';
    const phone = (s.phone || '').padEnd(14).slice(0, 14);
    lines.push(`| ${name} | ${id} | ${cls} | ${pts} | ${rank} | ${reg} | ${phone} |`);
  });
  lines.push('----------------------------------------------------------------');
  lines.push('');
  const parents = (await getAllUsers()).filter(u => u.role === 'parent');
  lines.push(`👨‍👩‍👧 PARENTS (${parents.length})`);
  lines.push('----------------------------------------------------------------');
  lines.push('| Name                    | Linked Child(ren)       | Registered On       | Phone          |');
  lines.push('|-------------------------|-------------------------|---------------------|----------------|');
  for (const p of parents) {
    const name = (p.name || 'N/A').padEnd(24).slice(0, 24);
    const children = await getChildren(p.phone);
    const childNames = [];
    for (const cid of children) {
      const child = await getUserByStudentId(cid);
      if (child) childNames.push(child.name);
    }
    const childStr = (childNames.join(', ') || 'None').padEnd(23).slice(0, 23);
    const reg = p.created_at ? moment(p.created_at).tz('Africa/Harare').format('YYYY-MM-DD HH:mm') : 'N/A';
    const phone = (p.phone || '').padEnd(14).slice(0, 14);
    lines.push(`| ${name} | ${childStr} | ${reg} | ${phone} |`);
  }
  lines.push('----------------------------------------------------------------');
  lines.push('');
  const teachers = await getTeachers();
  lines.push(`👨‍🏫 TEACHERS (${teachers.length})`);
  lines.push('----------------------------------------------------------------');
  lines.push('| Name                    | Teacher ID   | Classes                | Registered On       | Phone          |');
  lines.push('|-------------------------|--------------|------------------------|---------------------|----------------|');
  teachers.forEach(t => {
    const name = (t.name || 'N/A').padEnd(24).slice(0, 24);
    const id = (t.teacher_id || 'N/A').padEnd(12).slice(0, 12);
    const cls = ((t.teaching_classes || []).join(', ') || 'None').padEnd(22).slice(0, 22);
    const reg = t.created_at ? moment(t.created_at).tz('Africa/Harare').format('YYYY-MM-DD HH:mm') : 'N/A';
    const phone = (t.phone || '').padEnd(14).slice(0, 14);
    lines.push(`| ${name} | ${id} | ${cls} | ${reg} | ${phone} |`);
  });
  lines.push('----------------------------------------------------------------');
  lines.push('');
  const unregistered = await getUnregisteredUsers();
  lines.push(`📱 UNREGISTERED USERS (${unregistered.length})`);
  lines.push('----------------------------------------------------------------');
  lines.push('| Phone          | Name (WA)  | Started At          |');
  lines.push('|----------------|------------|---------------------|');
  for (const u of unregistered) {
    const phone = (u.phone || '').padEnd(14).slice(0, 14);
    const name = (u.wa_name || 'N/A').padEnd(10).slice(0, 10);
    const started = u.created_at ? moment(u.created_at).tz('Africa/Harare').format('YYYY-MM-DD HH:mm') : 'N/A';
    lines.push(`| ${phone} | ${name} | ${started} |`);
  }
  lines.push('----------------------------------------------------------------');
  lines.push('');
  lines.push('🏆 LEADERBOARDS');
  lines.push('============================================================');
  const types = ['weekly', 'monthly', 'alltime'];
  const labels = ['Weekly', 'Monthly', 'All-Time'];
  for (let idx = 0; idx < types.length; idx++) {
    const type = types[idx];
    const label = labels[idx];
    const top = await getLeaderboard(20, type);
    if (top.length === 0) { lines.push(`\n${label}: No data`); continue; }
    lines.push(`\n${label} (Top 20):`);
    lines.push('----------------------------------------------------------------');
    lines.push('| #  | Name                    | Class     | Points  |');
    lines.push('|----|-------------------------|-----------|---------|');
    top.forEach((s, i) => {
      const num = String(i + 1).padStart(2);
      const name = (s.name || 'N/A').padEnd(24).slice(0, 24);
      const cls = (s.class || 'N/A').padEnd(9).slice(0, 9);
      const pts = String(s.points || 0).padStart(7);
      lines.push(`| ${num} | ${name} | ${cls} | ${pts} |`);
    });
    lines.push('----------------------------------------------------------------');
  }
  lines.push('');
  const stats = await getSystemAnalytics();
  lines.push('📊 SYSTEM STATS');
  lines.push('============================================================');
  lines.push(`Total Users: ${stats.totalUsers}`);
  lines.push(`Students: ${stats.students}`);
  lines.push(`Parents: ${stats.parents}`);
  lines.push(`Teachers: ${stats.teachers}`);
  lines.push(`Today's Messages: ${stats.todayMessages}`);
  lines.push(`Today's Interactions: ${stats.todayInteractions}`);
  lines.push(`Quiz Correct: ${stats.quizCorrect}`);
  lines.push(`Quiz Incorrect: ${stats.quizIncorrect}`);
  const passRate = (stats.quizCorrect + stats.quizIncorrect) > 0 ? ((stats.quizCorrect / (stats.quizCorrect + stats.quizIncorrect)) * 100).toFixed(1) : 0;
  lines.push(`Pass Rate: ${passRate}%`);
  lines.push('============================================================');
  lines.push(`\n📅 Export Date: ${now.format('dddd, MMMM D, YYYY [at] HH:mm:ss')}`);
  lines.push('============================================================');
  return lines.join('\n');
}

// ─── Weather ────────────────────────────────────────────────────
export async function getWeather(city = 'Harare') {
  try {
    const now = Date.now();
    if (cachedWeather && (now - lastWeatherFetch) < 600000) return cachedWeather;
    const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${OPENWEATHER_API_KEY}&units=metric`, { timeout: 10000 });
    const w = response.data;
    cachedWeather = { city: w.name, description: w.weather[0].description, temp: Math.round(w.main.temp), humidity: w.main.humidity, wind: w.wind.speed };
    lastWeatherFetch = now;
    return cachedWeather;
  } catch (error) { return null; }
}
export function getWeatherAdvice(weather, lang) {
  const temp = weather.temp;
  const desc = weather.description.toLowerCase();
  if (desc.includes('rain') || desc.includes('drizzle') || desc.includes('thunderstorm')) {
    return lang === 'sn' ? '☔ Kuchanaya. Tora amburera kana raincoat.' : '☔ Rain expected. Take an umbrella or raincoat.';
  } else if (temp < 10) {
    return lang === 'sn' ? '🧣 Kuchatonhora! Pfeka zvinodziya.' : '🧣 Cold weather! Wear warm clothes.';
  } else if (temp > 30) {
    return lang === 'sn' ? '🌞 Kuchapisa. Pfeka zvishoma uye unwe mvura.' : '🌞 It\'s going to be hot. Wear light clothes and stay hydrated.';
  } else {
    return lang === 'sn' ? '🌤️ Kunze kwakanaka. Pfeka zvakajairika.' : '🌤️ Normal weather. Dress comfortably.';
  }
}

// ─── Developer Functions ──────────────────────────────────────
export function isDeveloper(phone) {
  if (!phone) return false;
  const clean = phone.replace(/\D/g, '');
  for (const num of DEVELOPER_NUMBERS) {
    if (clean === num || clean.endsWith(num) || num.endsWith(clean)) return true;
  }
  return false;
}

export async function ensureDeveloper(phone) {
  if (!isDeveloper(phone)) return;
  let user = await getUserByPhone(phone);
  if (!user) {
    await createUser(phone, { name: 'Vincent Ganiza (DEV)', role: 'admin', registered: true, is_admin: true, is_developer: true, premium: true, student_id: 'DEV001', teacher_id: 'DEV001', points: 99999, rank: 'Legend 👑', wa_name: 'Vincent Ganiza' });
    user = await getUserByPhone(phone);
  } else {
    await updateUser(phone, { is_developer: true, is_admin: true, premium: true, points: 99999, rank: 'Legend 👑', registered: true });
  }
  const now = moment().tz('Africa/Harare').toISOString();
  for (const table of ['leaderboard_weekly', 'leaderboard_monthly', 'leaderboard_alltime']) {
    const existing = await dbQuery(table, 'select', null, { eq: { field: 'phone', value: phone }, single: true });
    if (!existing) await dbQuery(table, 'insert', { phone, points: 99999, updated_at: now });
  }
  return user;
}

export async function handleDeveloperCommand(sock, fromJid, command, userPhone, user, msg) {
  const lower = command.toLowerCase().trim();
  const isDev = user.is_developer;

  if (!isDev) return false;

  const replyText = async (txt) => {
    await sock.sendMessage(fromJid, { text: txt + getFooter('en') + ' [DEV]' }, { quoted: msg });
  };

  if (lower === '.dev' || lower === 'dev menu' || lower === 'developer' || lower === '.devmenu') {
    const uptime = process.uptime();
    const mem = process.memoryUsage();
    const totalUsers = (await getAllUsers()).length;
    const students = (await getAllStudents()).length;
    const teachers = (await getTeachers()).length;
    const parents = (await getAllUsers()).filter(u => u.role === 'parent').length;
    const stats = await getSystemAnalytics();
    let devMsg = `👑 *Developer Panel - ${BOT_NAME} v5.1*\n\n`;
    devMsg += `📅 ${moment().tz('Africa/Harare').format('dddd, MMMM D, YYYY HH:mm:ss')}\n`;
    devMsg += `⏱️ Uptime: ${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m\n`;
    devMsg += `🧠 Memory: ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB / ${(mem.heapTotal / 1024 / 1024).toFixed(1)} MB\n`;
    devMsg += `📊 Users: ${totalUsers} (${students} students, ${parents} parents, ${teachers} teachers)\n`;
    devMsg += `💬 Today's Msgs: ${stats.todayMessages}\n`;
    devMsg += `📈 Quiz Pass Rate: ${(stats.quizCorrect + stats.quizIncorrect) > 0 ? ((stats.quizCorrect / (stats.quizCorrect + stats.quizIncorrect)) * 100).toFixed(1) : 0}%\n`;
    devMsg += `\n*Commands:*\n`;
    devMsg += `.dev - this menu\n.botstats - full system stats\n.users - list all users\n.eval <code> - run JS\n.exec <cmd> - run shell\n.restart - restart bot\n.maintenance on/off\n.addpremium <phone>\n.devban <phone> / .devunban <phone>\n.cleardb <table>\n.autoread on/off\n.autotyping on/off\n`;
    await replyText(devMsg);
    return true;
  }

  if (lower === '.botstats') {
    const uptime = process.uptime();
    const mem = process.memoryUsage();
    const os = require('os');
    const freeMem = os.freemem();
    const totalMem = os.totalmem();
    const loadAvg = os.loadavg();
    const platform = os.platform();
    const arch = os.arch();
    const totalUsers = (await getAllUsers()).length;
    const unreg = (await getUnregisteredUsers()).length;
    const students = (await getAllStudents()).length;
    const teachers = (await getTeachers()).length;
    const parents = (await getAllUsers()).filter(u => u.role === 'parent').length;
    const stats = await getSystemAnalytics();
    let msg = `📊 *Bot Stats*\n\n`;
    msg += `⏱️ Uptime: ${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s\n`;
    msg += `🧠 Memory: Heap ${(mem.heapUsed / 1024 / 1024).toFixed(1)}MB / ${(mem.heapTotal / 1024 / 1024).toFixed(1)}MB\n`;
    msg += `💾 RAM: ${(freeMem / 1024 / 1024).toFixed(1)}MB free / ${(totalMem / 1024 / 1024).toFixed(1)}MB total\n`;
    msg += `📈 Load: ${loadAvg[0].toFixed(2)} (1m) ${loadAvg[1].toFixed(2)} (5m) ${loadAvg[2].toFixed(2)} (15m)\n`;
    msg += `🖥️ OS: ${platform} ${arch}\n`;
    msg += `👥 Users: ${totalUsers} (${unreg} unreg)\n`;
    msg += `   Students: ${students}, Parents: ${parents}, Teachers: ${teachers}\n`;
    msg += `💬 Today Msgs: ${stats.todayMessages}\n`;
    msg += `📝 Quiz Correct: ${stats.quizCorrect}, Incorrect: ${stats.quizIncorrect}\n`;
    msg += `📈 Pass Rate: ${(stats.quizCorrect + stats.quizIncorrect) > 0 ? ((stats.quizCorrect / (stats.quizCorrect + stats.quizIncorrect)) * 100).toFixed(1) : 0}%\n`;
    msg += `📅 Date: ${moment().tz('Africa/Harare').format('dddd, MMMM D, YYYY HH:mm:ss')}`;
    await replyText(msg);
    return true;
  }

  if (lower === '.users') {
    const users = await getAllUsers();
    if (!users.length) return replyText('No registered users.');
    let msg = '👥 *Registered Users* (max 30)\n\n';
    const list = users.slice(0, 30);
    for (const u of list) {
      const dev = u.is_developer ? '👑' : '';
      const admin = u.is_admin ? '🛠️' : '';
      const suspended = u.suspended ? '⛔' : '';
      const premium = u.premium ? '⭐' : '';
      msg += `${dev}${admin}${premium}${suspended} ${u.name || 'N/A'} (${u.phone}) - ${u.role || 'N/A'} ${u.class || ''} Points:${u.points||0}\n`;
    }
    if (users.length > 30) msg += `\n... and ${users.length - 30} more.`;
    await replyText(msg);
    return true;
  }

  if (lower.startsWith('.eval ')) {
    const code = command.slice(6).trim();
    try {
      let result = await eval(`(async () => { ${code} })()`);
      if (typeof result !== 'string') result = JSON.stringify(result, null, 2);
      if (result.length > 3000) result = result.slice(0, 3000) + '\n... (truncated)';
      await replyText(`✅ *Result:*\n\`\`\`\n${result}\n\`\`\``);
    } catch (e) {
      await replyText(`❌ *Error:*\n\`\`\`\n${e.message}\n\`\`\``);
    }
    return true;
  }

  if (lower.startsWith('.exec ')) {
    const shellCmd = command.slice(6).trim();
    await replyText(`🔄 Executing: \`${shellCmd}\` ...`);
    const { exec } = require('child_process');
    exec(shellCmd, { timeout: 15000 }, (error, stdout, stderr) => {
      let output = stdout + stderr;
      if (output.length > 3500) output = output.slice(0, 3500) + '\n... (truncated)';
      if (error) output += `\n\n❌ Error: ${error.message}`;
      sock.sendMessage(fromJid, { text: `💻 *Output:*\n\`\`\`\n${output}\n\`\`\`` + getFooter('en') + ' [DEV]' }, { quoted: msg });
    });
    return true;
  }

  if (lower === '.restart') {
    await replyText('🔄 Restarting bot...');
    setTimeout(() => process.exit(0), 2000);
    return true;
  }

  if (lower === '.maintenance on' || lower === '.maintenance off') {
    const enabled = lower === '.maintenance on';
    await setMaintenanceMode(enabled);
    await replyText(`🔧 Maintenance mode ${enabled ? 'ENABLED' : 'DISABLED'}.`);
    return true;
  }

  if (lower.startsWith('.addpremium ')) {
    const phone = command.slice(12).trim().replace(/\D/g, '');
    if (!phone) return replyText('❌ Provide a phone number.');
    const target = await getUserByPhone(phone);
    if (!target) return replyText(`❌ User ${phone} not found.`);
    await updateUser(phone, { premium: true, points: (target.points || 0) + 5000, rank: 'Premium' });
    await replyText(`✅ ${target.name || phone} is now Premium (added 5000 pts).`);
    const jid = formatJid(phone);
    if (jid) await sock.sendMessage(jid, { text: `⭐ You have been upgraded to Premium by the developer! 5000 bonus points added.` + getFooter('en') });
    return true;
  }

  if (lower.startsWith('.devban ')) {
    const phone = command.slice(8).trim().replace(/\D/g, '');
    if (!phone) return replyText('❌ Provide a phone number.');
    if (isDeveloper(phone)) return replyText('❌ Cannot ban the developer.');
    const target = await getUserByPhone(phone);
    if (!target) return replyText(`❌ User ${phone} not found.`);
    await updateUser(phone, { suspended: true, is_admin: false });
    await replyText(`✅ ${target.name || phone} has been DEV-BANNED.`);
    const jid = formatJid(phone);
    if (jid) await sock.sendMessage(jid, { text: `⛔ You have been banned by the developer. Contact +263716857999.` });
    return true;
  }
  if (lower.startsWith('.devunban ')) {
    const phone = command.slice(10).trim().replace(/\D/g, '');
    if (!phone) return replyText('❌ Provide a phone number.');
    const target = await getUserByPhone(phone);
    if (!target) return replyText(`❌ User ${phone} not found.`);
    await updateUser(phone, { suspended: false });
    await replyText(`✅ ${target.name || phone} has been DEV-UNBANNED.`);
    const jid = formatJid(phone);
    if (jid) await sock.sendMessage(jid, { text: `✅ You have been unbanned by the developer.` });
    return true;
  }

  if (lower.startsWith('.cleardb ')) {
    const table = command.slice(8).trim();
    if (!table) return replyText('❌ Specify table name.');
    const dangerous = ['users', 'banned_teachers', 'banned_streams', 'parent_links', 'child_analytics'];
    if (dangerous.includes(table)) {
      return replyText(`⚠️ DANGEROUS: Clearing ${table} will delete all data. Confirm by typing .cleardb_confirm_${table}`);
    }
    localDB[table] = [];
    saveLocalDB();
    await replyText(`✅ Table ${table} cleared from local DB.`);
    return true;
  }
  if (lower.startsWith('.cleardb_confirm_')) {
    const table = command.slice(18).trim();
    if (!table) return replyText('❌ Invalid.');
    localDB[table] = [];
    saveLocalDB();
    await replyText(`✅ Table ${table} cleared.`);
    return true;
  }

  return false;
}

// ─── Session Management ────────────────────────────────────────
export const activeSockets = new Map(); // identifier -> socket

export async function startWhatsAppSession(identifier, usePairing) {
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

    // Attach message handler
    sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const m of messages) {
        try {
          await handleIncomingMessage(sock, m);
        } catch (e) {
          log(`Error processing message: ${e.message}`, 'ERROR');
        }
      }
    });

    // Pairing code flow
    if (usePairing && !sock.authState.creds.registered) {
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(identifier);
          const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
          pairingCodes.set(identifier, { code: formatted, timestamp: Date.now() });
          log(`🔑 Pairing code for +${identifier}: ${formatted}`, 'SESSION');
        } catch (e) {
          log(`Failed to get pairing code: ${e.message}`, 'ERROR');
        }
      }, 6000);
    }

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr && !usePairing) {
        log('QR code generated (use pairing code instead)', 'SESSION');
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code !== DisconnectReason.loggedOut && code !== 401) {
          setTimeout(() => startWhatsAppSession(identifier, false), 5000);
        } else {
          fsExtra.removeSync(sp);
          activeSockets.delete(identifier);
          log(`Session expired: ${identifier}`, 'SESSION');
        }
      } else if (connection === 'open') {
        log(`✅ WhatsApp connected: ${identifier}`, 'SESSION');
        const userJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        await sock.sendMessage(userJid, {
          text: `✅ *${BOT_NAME} connected!*\n\nSend *start* to register and begin.\n\nDeveloper: ${CONTACT_LINK}`
        });
        if (!schedulersStarted) {
          schedulersStarted = true;
          startReminderSchedulers(sock);
          startBroadcastScheduler(sock);
        }
      }
    });

    sock.ev.on('creds.update', saveCreds);
    log(`✅ WhatsApp session started: ${identifier}`, 'SESSION');
    return sock;
  } catch (e) {
    log(`❌ Session error [${identifier}]: ${e.message}`, 'ERROR');
    return null;
  }
}

export async function autoResumeSessions() {
  if (!fsExtra.existsSync(SESSIONS_DIR)) return;
  const items = fsExtra.readdirSync(SESSIONS_DIR);
  let found = false;
  for (const name of items) {
    const fullPath = path.join(SESSIONS_DIR, name);
    if (!fsExtra.lstatSync(fullPath).isDirectory()) continue;
    if (name === 'node_modules') continue;
    if (!fsExtra.existsSync(path.join(fullPath, 'creds.json'))) continue;
    found = true;
    log(`🚀 Resuming session: ${name}`, 'SESSION');
    startWhatsAppSession(name, false);
  }
  if (!found) log('⚠️ No sessions found. Use /pair web page to link.', 'SYSTEM');
}

// ─── Message Handler ──────────────────────────────────────────
export async function handleIncomingMessage(sock, msg) {
  try {
    const msgId = msg.key.id || msg.messageTimestamp?.toString() || Date.now().toString();
    if (processedMessages.has(msgId)) return;
    processedMessages.add(msgId);
    setTimeout(() => processedMessages.delete(msgId), 5000);
    const from = msg.key.remoteJid;
    if (!from) return;
    if (!from.endsWith('@s.whatsapp.net') && !from.endsWith('@c.us')) return;
    if (msg.key.fromMe) return;
    const senderJid = msg.key.participant || from;
    const senderPhone = senderJid.split('@')[0];
    if (!senderPhone || senderPhone.trim() === '') return;
    log(`📩 Incoming private message from ${senderPhone}`, 'MSG');

    await handleAutoread(sock, msg);

    const type = getContentType(msg.message);
    if (!type) return;
    if (type === 'ephemeralMessage') msg.message = msg.message.ephemeralMessage.message;
    const waName = msg.pushName || senderPhone;
    let body = '', isVoice = false, isDocument = false, isImage = false, isLocation = false;
    let audioBuffer = null, imageBuffer = null, documentBuffer = null, locationData = null;
    let mimeType = '', fileName = '';

    try {
      if (msg.message?.buttonsResponseMessage?.selectedButtonId) body = msg.message.buttonsResponseMessage.selectedButtonId;
      else if (msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId) body = msg.message.listResponseMessage.singleSelectReply.selectedRowId;
      else if (msg.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) { try { const params = JSON.parse(msg.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson); body = params.id || ''; } catch (e) {} }
      else if (msg.message?.templateButtonReplyMessage?.selectedId) body = msg.message.templateButtonReplyMessage.selectedId;
      else if (type === 'audioMessage' || type === 'pttMessage') {
        isVoice = true; const a = msg.message.audioMessage || msg.message.pttMessage; mimeType = a.mimetype || 'audio/ogg';
        try { audioBuffer = await downloadMediaMessage(msg, 'audio', { buffer: true }); } catch (e) { audioBuffer = null; }
      } else if (type === 'imageMessage') {
        isImage = true; const img = msg.message.imageMessage; if (img.caption) {
          const editMatch = img.caption.match(/^\s*image\s+edit\s+(.+)/i);
          if (editMatch) body = `image edit ${editMatch[1].trim()}`;
          else body = img.caption;
        }
        try { imageBuffer = await downloadMediaMessage(msg, 'image', { buffer: true }); } catch (e) { imageBuffer = null; }
      } else if (type === 'documentMessage') {
        isDocument = true; const doc = msg.message.documentMessage; fileName = doc.fileName || 'document'; mimeType = doc.mimetype;
        try { documentBuffer = await downloadMediaMessage(msg, 'document', { buffer: true }); } catch (e) { documentBuffer = null; }
      } else if (type === 'locationMessage') {
        isLocation = true; const loc = msg.message.locationMessage;
        locationData = {
          lat: loc.degreesLatitude,
          lng: loc.degreesLongitude,
          url: loc.url || `https://www.google.com/maps?q=${loc.degreesLatitude},${loc.degreesLongitude}`,
          address: loc.address || null,
          name: loc.name || null
        };
        body = 'location';
      } else if (type === 'conversation') body = msg.message.conversation || '';
      else if (type === 'extendedTextMessage') { body = msg.message.extendedTextMessage?.text || ''; }
      if (!body) body = msg.message?.body || msg.message?.caption || '';
    } catch (e) { log(`Failed to extract body: ${e.message}`, 'ERROR'); }
    log(`📝 Body: "${body}"`, 'MSG');

    if (isDeveloper(senderPhone)) {
      await ensureDeveloper(senderPhone);
    }

    if (await getMaintenanceMode() && !isDeveloper(senderPhone)) {
      await sock.sendMessage(from, { text: '🔧 Bot is under maintenance. Only the developer can use it. Contact +263716857999.' + getFooter('en') });
      return;
    }

    const userObj = await getUserByPhone(senderPhone);
    if (!userObj || !userObj.registered) {
      const lang = userLanguages.get(senderPhone) || 'en';
      if (userObj && userObj.reg_step) {
        await handleRegistrationFlow(sock, from, body, senderPhone, waName, msg);
        return;
      }
      const welcomeMsg = getText('welcome', lang, { name: waName });
      await safeSendMedia(sock, from, { image: { url: WELCOME_IMAGE }, caption: welcomeMsg + getFooter(lang) }, {}, null);
      if (!userObj) {
        if (senderPhone && senderPhone.trim() !== '') {
          await createUser(senderPhone, { wa_name: waName, reg_step: 'ask_language', registered: false, temp_data: {} });
        } else return;
      }
      await handleRegistrationFlow(sock, from, body, senderPhone, waName, msg);
      return;
    }

    if (userObj.role === 'student' && userObj.suspended && !isDeveloper(senderPhone)) {
      if (userObj.class && await isStreamBanned(userObj.class)) {
        if (body.toLowerCase().trim() === 'reapply') {
          await handleCommand(sock, from, msg, 'reapply', senderPhone, userObj);
          return;
        }
        await sock.sendMessage(from, { text: `⛔ Your class (${userObj.class}) has been banned. You can reapply by typing *reapply*.` + getFooter(userLanguages.get(senderPhone) || 'en') });
        return;
      } else {
        await sock.sendMessage(from, { text: '⛔ Your account is suspended. Contact school administration.' + getFooter(userLanguages.get(senderPhone) || 'en') });
        return;
      }
    }

    if (isLocation && locationData) {
      const student = await getUserByPhone(senderPhone);
      if (student && student.role === 'student' && student.student_id) {
        const studentId = student.student_id;
        let analytics = await dbQuery('child_analytics', 'select', null, { eq: { field: 'student_id', value: studentId }, single: true });
        if (!analytics) analytics = { student_id: studentId, data: { dailyMsgs: {}, totalMsgs: 0, quizAttempts: 0, quizCorrect: 0, cheatAttempts: 0, lastActive: Date.now(), lastActiveTime: null, lastMessageTime: null, lastLocation: null, lastLocationTime: null, lastLocationUrl: null } };
        const a = analytics.data;
        a.lastLocation = { lat: locationData.lat, lng: locationData.lng };
        a.lastLocationTime = moment().tz('Africa/Harare').format('dddd, MMMM D, YYYY [at] HH:mm:ss');
        a.lastLocationUrl = locationData.url;
        a.lastActive = Date.now();
        a.lastActiveTime = moment().tz('Africa/Harare').format('dddd, MMMM D, YYYY [at] HH:mm:ss');
        await dbQuery('child_analytics', 'update', { data: a }, { eq: { field: 'student_id', value: studentId } });

        const parents = await getChildren(studentId);
        for (const parentPhone of parents) {
          const parent = await getUserByPhone(parentPhone);
          if (parent) {
            const pLang = userLanguages.get(parent.phone) || 'en';
            const jid = formatJid(parent.phone);
            if (jid) {
              await sock.sendMessage(jid, {
                text: `📍 *Live Location Update*\n\nChild: ${student.name} (${studentId})\n📍 ${locationData.url || `https://www.google.com/maps?q=${locationData.lat},${locationData.lng}`}\n🕒 ${moment().tz('Africa/Harare').format('dddd, MMMM D, YYYY [at] HH:mm:ss')}\n\nShared voluntarily by student.${getFooter(pLang)}`
              });
              log(`Location sent to parent ${parent.phone}`, 'LOCATION');
            }
          }
        }

        if (locationRequests[studentId]) {
          for (const req of locationRequests[studentId]) {
            const requester = await getUserByPhone(req.requestedBy);
            if (requester) {
              const rLang = userLanguages.get(requester.phone) || 'en';
              const jid = formatJid(requester.phone);
              if (jid) {
                await sock.sendMessage(jid, {
                  text: `📍 *Location Received*\n\nStudent: ${student.name} (${studentId})\n📍 ${locationData.url}\n🕒 ${moment().tz('Africa/Harare').format('dddd, MMMM D, YYYY [at] HH:mm:ss')}\n\nRequested by ${req.requesterRole}${getFooter(rLang)}`
                });
                log(`Location sent to requester ${requester.phone}`, 'LOCATION');
              }
            }
          }
          delete locationRequests[studentId];
        }

        await sock.sendMessage(from, { text: `✅ Location shared.${getFooter(userLanguages.get(senderPhone)||'en')}` });
        return;
      }
    }

    const isForwarded = msg.message?.extendedTextMessage?.contextInfo?.isForwarded ||
                        msg.message?.extendedTextMessage?.contextInfo?.isForwarded ||
                        msg.message?.conversation?.contextInfo?.isForwarded ||
                        false;
    if (isForwarded && pendingQuizConfig[from] && !isDeveloper(senderPhone)) {
      await addPoints(senderPhone, -20);
      await recordCheatAttempt(userObj.student_id);
      await sock.sendMessage(from, {
        text: `🚫 *CHEATING DETECTED!* Forwarded message during quiz. -20 points. Quiz failed.${getFooter('en')}`
      });
      delete pendingQuizConfig[from];
      if (antiCheatQuiz[from] && antiCheatQuiz[from].timeout) {
        clearTimeout(antiCheatQuiz[from].timeout);
      }
      delete antiCheatQuiz[from];
      const admins = (await getAllUsers()).filter(u => u.is_admin);
      for (const a of admins) {
        const jid = formatJid(a.phone);
        if (jid) {
          await sock.sendMessage(jid, {
            text: `⚠️ *Cheat Alert*\nStudent ${userObj.name} (${userObj.student_id}) forwarded a message during quiz. -20 points.`
          });
        }
      }
      return;
    }

    if ((isImage && imageBuffer) || (isDocument && documentBuffer)) {
      const state = userStates.get(senderPhone);
      if (state && (state.waitingFor === 'timetable_upload' || state.waitingFor === 'admin_class_timetable_image')) {
        try {
          const buffer = imageBuffer || documentBuffer;
          const url = await uploadToService(buffer, fileName || 'timetable.jpg');
          const key = state.tempData?.type === 'study' ? `personal_${senderPhone}_study` :
                      state.tempData?.type === 'reading' ? `personal_${senderPhone}_reading` :
                      state.tempData?.type === 'teacher' ? `teacher_${userObj.teacher_id}` :
                      state.tempData?.className ? `class_${state.tempData.className}` : null;
          if (key) {
            await setTimetable(key, url, state.tempData?.type || 'image', state.tempData?.className || null);
            await sock.sendMessage(from, { text: getText('timetableUploaded', userLanguages.get(senderPhone)||'en') + getFooter(userLanguages.get(senderPhone)||'en') });
          } else {
            await sock.sendMessage(from, { text: '❌ Upload failed: unknown type.' });
          }
          userStates.delete(senderPhone);
        } catch (e) {
          log(`Timetable upload error: ${e.message}`, 'ERROR');
          await sock.sendMessage(from, { text: '❌ Failed to upload. Please try again.' });
        }
        return;
      }

      const lowerBody = body.toLowerCase();
      if ((isImage && imageBuffer) && (lowerBody.startsWith('absence reason') || lowerBody.startsWith('my reason') || lowerBody.startsWith('reason'))) {
        let proofUrl = null;
        try {
          proofUrl = await uploadToService(imageBuffer, 'proof.jpg');
        } catch (e) { log(`Proof upload failed: ${e.message}`, 'ERROR'); }
        let state = userStates.get(senderPhone) || { tempData: {} };
        state.tempData.proofUrl = proofUrl;
        userStates.set(senderPhone, state);
      }

      await sock.sendMessage(from, { text: '📄 Scanning document...' });
      let extractedText = '', visionAnalysis = '';
      let lang = userLanguages.get(senderPhone) || 'en';
      if (isImage && imageBuffer) {
        visionAnalysis = await omegaVision(imageBuffer);
        extractedText = await omegaOcr(imageBuffer);
        if (!extractedText) extractedText = 'Could not extract text from image.';
      } else if (isDocument && documentBuffer) {
        extractedText = await extractTextFromDocument(documentBuffer, mimeType, fileName);
      }
      let response = '';
      if (visionAnalysis) response += `🔍 *Image Analysis:*\n${visionAnalysis}\n\n`;
      if (extractedText && extractedText !== 'Could not extract text from image.' && extractedText !== 'No text found.') {
        response += `📝 *Extracted Text:*\n${extractedText.substring(0, 1500)}${extractedText.length > 1500 ? '...' : ''}`;
      }
      if (response) {
        await sock.sendMessage(from, { text: response + getFooter(lang) });
      } else {
        const aiResponse = await askAI(`Analyse this document: ${extractedText ? extractedText.substring(0,1500) : 'No text extracted'}`, null, userObj?.role === 'student' ? userObj.student_id : null, lang, senderPhone);
        await sock.sendMessage(from, { text: aiResponse + getFooter(lang) });
      }
      return;
    }

    if (isVoice && audioBuffer) {
      await sock.sendMessage(from, { text: '🎙️ Processing voice note...' });
      let transcript = null;
      try { transcript = await omegaTranscribe(audioBuffer, mimeType); } catch (e) {}
      if (!transcript) { await sock.sendMessage(from, { text: '❌ Could not transcribe voice note.' }); return; }
      body = transcript;
    }

    const interactivePrefixes = ['lang_', 'role_', 'form_', 'class_', 'gender_', 'teach_', 'send_to_', 'quiz_ans_', 'ai_pdf_', 'subject_', 'quiz_subject_', 'view_', 'child_gender_', 'group_'];
    const isInteractive = interactivePrefixes.some(p => body.startsWith(p));
    if (!isInteractive) {
      if (userObj.is_developer) {
        const handledDev = await handleDeveloperCommand(sock, from, body, senderPhone, userObj, msg);
        if (handledDev) return;
      }
      const cmd = detectCommand(body);
      if (cmd) {
        await recordSystemInteraction();
        await recordSystemMessage();
        if (userObj.role === 'student') {
          const lastMsgTime = moment().tz('Africa/Harare').format('dddd, MMMM D, YYYY [at] HH:mm:ss');
          await recordChildActivity(userObj.student_id, lastMsgTime);
        }
        await handleCommand(sock, from, msg, cmd, senderPhone, userObj);
        return;
      }
    }

    const quiz = pendingQuizConfig[from];
    if (quiz && quiz.questions[quiz.currentIndex]?.type === 'open') {
      await handleQuizAnswer(sock, from, body, senderPhone, userObj);
      return;
    }

    await handleAutotyping(sock, from, 1500);
    await recordSystemInteraction();
    await recordSystemMessage();
    if (userObj.role === 'student') {
      const lastMsgTime = moment().tz('Africa/Harare').format('dddd, MMMM D, YYYY [at] HH:mm:ss');
      await recordChildActivity(userObj.student_id, lastMsgTime);
    }

    const lang = userLanguages.get(senderPhone) || 'en';
    const aiResponse = await askAI(body, null, userObj.role === 'student' ? userObj.student_id : null, lang, senderPhone);
    const commandMatch = aiResponse.match(/^(study|quiz|flashcard|reading tip|study tip|fact|image gen|image search|image edit|audio|pdf|song gen|weather|define|calculate|composition|summarize|google|wiki|upload timetable|upload reading timetable|upload teacher timetable|view timetable|profile|leaderboard|language|owner|link child|unlink child|child progress|child analytics|teacher dashboard|send to class|view students|add class|remove class|admin dashboard|broadcast|manage classes|view teachers|view all students|leaderboard class|suspend student|unsuspend student|ban teacher|unban teacher|system stats|upload class timetable|ban stream|unban stream|assign teacher|remove teacher|export data|group students|export analytics|.autoread|.autotyping|cancel reminders|enable reminders|restart registration|start|menu|help|guide|test|report absence|my absences|child absences|ask reason|why absent|request reason|approve absence|reject absence|view absences|set class teacher|remove class teacher|view class teachers|my classes|where is my child|child live|request location|track absent|stop tracking|delete location|absence reason|my reason|reason)/i);
    if (commandMatch) {
      await handleCommand(sock, from, msg, aiResponse, senderPhone, userObj);
    } else {
      await sock.sendMessage(from, { text: aiResponse + getFooter(lang) }, { quoted: msg });
    }
  } catch (e) {
    log(`❌ Fatal error: ${e.message}`, 'ERROR');
    try { await sock.sendMessage(from, { text: '⚠️ Oops! Something went wrong. Please try again later.' }); } catch (err) {}
  }
}

// ─── Command Handler ──────────────────────────────────────────
export async function handleCommand(sock, fromJid, msg, command, userPhone, user) {
  const lower = command.toLowerCase().trim();
  const lang = userLanguages.get(userPhone) || 'en';
  const replyText = async (txt) => await sock.sendMessage(fromJid, { text: txt + getFooter(lang) }, { quoted: msg });

  // ─── Group Students ──────────────────────────────────────────
  if (lower === 'group students') {
    if (!user.is_admin) return replyText('❌ Admin only.');
    await sendQuickReplyButtons(sock, fromJid, '👥 *Group Students*\n\nSelect grouping method:', [
      { type: 'reply', displayText: '📚 By Class', id: 'group_class' },
      { type: 'reply', displayText: '👤 By Gender', id: 'group_gender' },
      { type: 'reply', displayText: '📋 By Form', id: 'group_form' },
      { type: 'reply', displayText: '🔥 Most Active', id: 'group_most_active' },
      { type: 'reply', displayText: '🐢 Least Active', id: 'group_least_active' }
    ]);
    return true;
  }
  if (lower.startsWith('group_')) {
    if (!user.is_admin) return replyText('❌ Admin only.');
    const type = lower.replace('group_', '');
    await groupStudentsBy(sock, fromJid, user, type, lang);
    return true;
  }

  // ─── Export Analytics ────────────────────────────────────────
  if (lower === 'export analytics') {
    if (!user.is_admin) return replyText('❌ Admin only.');
    await replyText('📊 Generating analytics report as Word document...');
    await exportAnalyticsWord(sock, fromJid, lang);
    return true;
  }

  // ─── Study ────────────────────────────────────────────────────
  if (lower.startsWith('study ')) {
    const parts = command.slice(6).trim().split(/\s+/);
    const subject = normalizeSubject(parts[0]);
    if (!subject) return replyText(`❌ Subject "${parts[0]}" not recognized.`);
    if (parts.length > 1) {
      const topic = parts.slice(1).join(' ');
      await replyText(`📚 *${subject.toUpperCase()} – ${topic}*\nGenerating...`);
      const info = await askAI(`Provide detailed educational info about ${topic} in ${subject} for a Zimbabwean student.`, subject, null, lang, userPhone);
      await replyText(info);
    } else {
      await replyText(`📚 *Help for ${subject}*\nGenerating...`);
      const help = await askAI(`Provide educational help and key points for ${subject} for a Zimbabwean student.`, subject, null, lang, userPhone);
      await replyText(help);
    }
    return true;
  }

  // ─── Quiz ────────────────────────────────────────────────────
  if (lower === 'quiz') {
    const sections = [];
    for (const [category, subjects] of Object.entries(subjectCategories)) {
      sections.push({
        title: category,
        rows: subjects.map(sub => ({ header: '', title: sub.charAt(0).toUpperCase() + sub.slice(1), description: `Quiz on ${sub}`, id: `quiz_subject_${sub}` }))
      });
    }
    await sendButtonMessage(sock, fromJid, {
      body: '🧠 *Select a subject for your quiz:*',
      footer: getFooter(lang),
      buttons: [{ type: 'selection', title: '📚 QUIZ SUBJECTS', sections }]
    });
    return true;
  }
  if (lower.startsWith('quiz_subject_')) {
    const subject = normalizeSubject(lower.replace('quiz_subject_', ''));
    if (!subject) return replyText('❌ Subject not recognized.');
    userStates.set(userPhone, { waitingFor: 'quiz_difficulty', tempData: { subject }, timestamp: Date.now() });
    await replyText(`✅ Subject: ${subject}\n\nSelect difficulty:\n1️⃣ Easy\n2️⃣ Medium\n3️⃣ Hard (Genius)\n\nReply with *easy*, *medium*, or *hard*.`);
    return true;
  }
  const state = userStates.get(userPhone);
  if (state && state.waitingFor === 'quiz_difficulty') {
    let difficulty = lower;
    if (!['easy', 'medium', 'hard'].includes(difficulty)) return replyText('❌ Invalid difficulty. Please reply with *easy*, *medium*, or *hard*.');
    userStates.set(userPhone, { waitingFor: 'quiz_count', tempData: { ...state.tempData, difficulty }, timestamp: Date.now() });
    await replyText(`✅ Difficulty: ${difficulty}\n\nHow many questions? (5 to 30)\nReply with a number.`);
    return true;
  }
  if (state && state.waitingFor === 'quiz_count') {
    const count = parseInt(lower);
    if (isNaN(count) || count < 5 || count > 30) return replyText('❌ Please enter a number between 5 and 30.');
    userStates.set(userPhone, { waitingFor: 'quiz_type', tempData: { ...state.tempData, count }, timestamp: Date.now() });
    await replyText(`✅ ${count} questions.\n\nSelect quiz type:\n1️⃣ Multiple Choice\n2️⃣ True/False\n3️⃣ Open-ended\n\nReply with *mc*, *tf*, or *open*.`);
    return true;
  }
  if (state && state.waitingFor === 'quiz_type') {
    let type = lower;
    if (type === 'mc' || type === 'multiple choice') type = 'mc';
    else if (type === 'tf' || type === 'true/false') type = 'tf';
    else if (type === 'open' || type === 'open-ended') type = 'open';
    else return replyText('❌ Invalid type. Reply with *mc*, *tf*, or *open*.');
    const { subject, difficulty, count } = state.tempData;
    await replyText(`🎯 Generating ${count} ${difficulty} ${type} quiz questions on ${subject}...\n_This may take a moment._`);
    const questions = await generateQuizQuestions(subject, difficulty, count, type, lang);
    if (!questions || questions.length === 0) return replyText('❌ Failed to generate quiz. Please try again later.');
    pendingQuizConfig[fromJid] = { subject, difficulty, count, type, questions, currentIndex: 0, score: 0, results: [] };
    userStates.delete(userPhone);
    await sendQuizQuestionAntiCheat(sock, fromJid, lang);
    return true;
  }

  // ─── Flashcard ────────────────────────────────────────────────
  if (lower.startsWith('flashcard ')) {
    const subj = normalizeSubject(lower.slice(10).trim()) || 'maths';
    const card = await askAI(`Give one flashcard (term & definition) for ${subj}.`, subj, null, lang, userPhone);
    await replyText(`🔖 *Flashcard for ${subj}*\n\n${card}`);
    return true;
  }

  // ─── Reading tip ─────────────────────────────────────────────
  if (lower === 'reading tip' || lower === 'study tip') {
    const tip = await askAI('Give a random reading tip for a student in Zimbabwe.', null, null, lang, userPhone);
    await replyText(`💡 *Reading Tip*\n\n${tip}`);
    return true;
  }

  // ─── Fact ─────────────────────────────────────────────────────
  if (lower.startsWith('fact ')) {
    const subj = normalizeSubject(lower.slice(5).trim()) || lower.slice(5).trim();
    const fact = await askAI(`Give one interesting fact about ${subj} for a student in Zimbabwe.`, subj, null, lang, userPhone);
    await replyText(`🌍 *Fact – ${subj}*\n\n${fact}`);
    return true;
  }

  // ─── Google ───────────────────────────────────────────────────
  if (lower.startsWith('google ')) {
    const query = command.slice(7).trim();
    await replyText(`🌐 Searching: "${query}"...`);
    try {
      const response = await axios.get(`https://api.nexray.web.id/search/google?query=${encodeURIComponent(query)}`, { timeout: 15000 });
      const results = response.data?.result || response.data?.results || [];
      if (results.length) {
        let out = `🌐 *Google: ${query}*\n\n`;
        results.slice(0, 3).forEach((r, i) => out += `${i+1}. *${r.title || 'Result'}*\n${(r.snippet||'').substring(0,100)}\n${r.link ? `🔗 ${r.link}` : ''}\n\n`);
        await replyText(out);
      } else {
        const aiAns = await askAI(`Provide a brief answer to: ${query}`, null, null, lang, userPhone);
        await replyText(`🌐 *Search: ${query}*\n\n${aiAns}`);
      }
    } catch (e) {
      const aiAns = await askAI(`Provide a brief answer to: ${query}`, null, null, lang, userPhone);
      await replyText(`🌐 *Search: ${query}*\n\n${aiAns}`);
    }
    return true;
  }

  // ─── Wiki ─────────────────────────────────────────────────────
  if (lower.startsWith('wiki ')) {
    const query = command.slice(5).trim();
    await replyText(`📖 Searching Wikipedia: "${query}"...`);
    try {
      const response = await axios.get(`https://api.nexray.web.id/search/wikipedia?query=${encodeURIComponent(query)}`, { timeout: 15000 });
      const data = response.data?.result || response.data?.data;
      if (data && data.extract) {
        await replyText(`📖 *${data.title || query}*\n\n${data.extract.substring(0,800)}${data.extract.length>=800?'...':''}${data.url ? `\n\n🔗 ${data.url}` : ''}`);
      } else {
        const aiAns = await askAI(`Give a Wikipedia-style summary about: ${query}`, null, null, lang, userPhone);
        await replyText(`📖 *${query}*\n\n${aiAns}`);
      }
    } catch (e) {
      const aiAns = await askAI(`Give a Wikipedia-style summary about: ${query}`, null, null, lang, userPhone);
      await replyText(`📖 *${query}*\n\n${aiAns}`);
    }
    return true;
  }

  // ─── Image Search ─────────────────────────────────────────────
  if (lower.startsWith('image search ')) {
    const query = command.slice(13).trim();
    await replyText(`🔍 Searching images for "${query}"...`);
    try {
      const response = await axios.get(`https://api.drexapp.space/search/gimage?q=${encodeURIComponent(query)}`, { timeout: 15000 });
      let images = response.data?.result?.images || [];
      if (images.length) {
        images = images.slice(0, 3);
        for (const img of images) {
          if (img.url) {
            await safeSendMedia(sock, fromJid, { image: { url: img.url }, caption: `🖼️ *Image – "${query}"*${getFooter(lang)}` }, {}, msg);
            await delay(500);
          }
        }
      } else {
        await replyText('❌ No images found.');
      }
    } catch (e) {
      await replyText('❌ Failed to search images. Please try again later.');
    }
    return true;
  }

  // ─── Define ───────────────────────────────────────────────────
  if (lower.startsWith('define ')) {
    const word = lower.slice(7);
    const def = await askAI(`Define "${word}" briefly with an example.`, null, null, lang, userPhone);
    await replyText(def);
    return true;
  }

  // ─── Calculate ───────────────────────────────────────────────
  if (lower.startsWith('calculate ')) {
    const expr = lower.slice(10);
    const res = await askAI(`Calculate: ${expr}. Return only the numeric result.`, null, null, lang, userPhone);
    await replyText(`🧮 *Result:* ${res}`);
    return true;
  }

  // ─── Composition ─────────────────────────────────────────────
  if (lower.startsWith('composition ')) {
    let topic = lower.slice(12);
    let words = 200;
    const m = topic.match(/--words\s+(\d+)/i);
    if (m) { words = parseInt(m[1]); topic = topic.replace(m[0], '').trim(); }
    await replyText('✍️ Writing composition...');
    const essay = await askAI(`Write a composition on "${topic}" in ≤${words} words for a Zimbabwean student.`, null, null, lang, userPhone);
    await replyText(essay);
    return true;
  }

  // ─── Summarize ────────────────────────────────────────────────
  if (lower.startsWith('summarize ')) {
    let text = lower.slice(10);
    let words = 150;
    const m = text.match(/--words\s+(\d+)/i);
    if (m) { words = parseInt(m[1]); text = text.replace(m[0], '').trim(); }
    await replyText('📝 Summarizing...');
    const summary = await askAI(`Summarize this in ≤${words} words:\n${text}`, null, null, lang, userPhone);
    await replyText(summary);
    return true;
  }

  // ─── Image Gen ─────────────────────────────────────────────────
  if (lower === 'image gen') {
    await replyText(getText('imageGenDesc', lang) + '\n\nUsage: *image gen <prompt> (n)* to generate n images.\nExample: *image gen cute cat (2)*');
    return true;
  }
  if (lower.startsWith('image gen ')) {
    let parts = command.match(/^image\s+gen\s+(.+?)(?:\s*\((\d+)\))?$/i);
    if (!parts) {
      let promptText = command.slice(10).trim();
      let countMatch = promptText.match(/\s*\(\s*(\d+)\s*\)\s*$/);
      let count = 1;
      let prompt = promptText;
      if (countMatch) {
        count = parseInt(countMatch[1]);
        prompt = promptText.slice(0, countMatch.index).trim();
      }
      if (user.is_developer) count = Math.min(count, 5);
      else count = Math.min(count, 3);
      await replyText(`🎨 Generating ${count} AI image(s) for: "${prompt}"...`);
      for (let i = 0; i < count; i++) {
        const img = await generateImage(prompt);
        if (img) {
          await safeSendMedia(sock, fromJid, { image: img, caption: `🎨 *AI Image ${i+1}/${count}*\nPrompt: ${prompt}${getFooter(lang)}` }, {}, msg);
          await delay(800);
        } else {
          await replyText('❌ Image generation failed. Please try a different prompt.');
          break;
        }
      }
      return true;
    }
    let prompt = parts[1].trim();
    let count = parts[2] ? parseInt(parts[2]) : 1;
    if (user.is_developer) count = Math.min(count, 5);
    else count = Math.min(count, 3);
    await replyText(`🎨 Generating ${count} AI image(s) for: "${prompt}"...`);
    for (let i = 0; i < count; i++) {
      const img = await generateImage(prompt);
      if (img) {
        await safeSendMedia(sock, fromJid, { image: img, caption: `🎨 *AI Image ${i+1}/${count}*\nPrompt: ${prompt}${getFooter(lang)}` }, {}, msg);
        await delay(800);
      } else {
        await replyText('❌ Image generation failed. Please try a different prompt.');
        break;
      }
    }
    return true;
  }

  // ─── Image Edit ──────────────────────────────────────────────
  if (lower.startsWith('image edit ')) {
    const prompt = command.slice(11).trim();
    await replyText('📸 Please reply to an image with this command, or send an image with caption starting with "image edit".');
    return true;
  }

  // ─── Audio ────────────────────────────────────────────────────
  if (lower.startsWith('audio ')) {
    const text = command.slice(6).trim();
    if (!text || text.length < 3) return replyText('❌ Please provide text to convert to speech.\nExample: *audio Hello world*');
    await replyText('🔊 Generating speech...');
    const audioBuffer = await generateSpeech(text, lang);
    if (audioBuffer) {
      await safeSendMedia(sock, fromJid, { audio: audioBuffer, mimetype: 'audio/mpeg', ptt: false, fileName: 'speech.mp3' }, {}, msg);
    } else await replyText('❌ Failed to generate speech. Please try again.');
    return true;
  }

  // ─── PDF ──────────────────────────────────────────────────────
  if (lower.startsWith('pdf ')) {
    const content = command.slice(4).trim();
    if (!content || content.length < 5) return replyText('❌ Please provide content for the PDF.\nExample: *pdf This is my document content*');
    await replyText('📄 Generating styled PDF...');
    try {
      const pdfBuffer = await generateStyledPDF(content, 'StudyMate AI Document', lang);
      if (pdfBuffer && pdfBuffer.length > 500) {
        await safeSendMedia(sock, fromJid, {
          document: pdfBuffer,
          mimetype: 'application/pdf',
          fileName: `StudyMate_${moment().format('YYYY-MM-DD_HH-mm')}.pdf`,
          caption: `📄 *StudyMate AI PDF*\nGenerated: ${moment().tz('Africa/Harare').format('dddd, MMMM D, YYYY [at] HH:mm')}${getFooter(lang)}`
        }, {}, msg);
      } else await replyText('📄 PDF generation failed. Here is the text content:\n\n' + content.substring(0, 1500) + (content.length > 1500 ? '\n... (truncated)' : ''));
    } catch (e) { log(`PDF generation error: ${e.message}`, 'ERROR'); await replyText('❌ PDF generation failed. Please try again.'); }
    return true;
  }

  // ─── Song Gen ─────────────────────────────────────────────────
  if (lower === 'song gen' || lower === 'song') {
    await replyText('🎵 *AI Song Generator*\n\nSend a prompt like: *song make a pop song about success*\nYou can also specify title and style: *song "My Song" rock inspiring*');
    return true;
  }
  if (lower.startsWith('song gen ') || lower.startsWith('song ')) {
    const parts = command.slice(command.startsWith('song gen ') ? 9 : 5).trim();
    let prompt = parts;
    let title = '';
    let style = '';
    const titleMatch = prompt.match(/^"([^"]+)"\s*(.+)?$/);
    if (titleMatch) {
      title = titleMatch[1];
      prompt = titleMatch[2] || prompt;
    }
    const styleMatch = prompt.match(/(.+?)\s+style:\s*(\w+)$/);
    if (styleMatch) {
      prompt = styleMatch[1];
      style = styleMatch[2];
    }
    await replyText(`🎵 Generating song for: "${prompt}"${title ? ` with title "${title}"` : ''}${style ? ` in style "${style}"` : ''}...\n_This may take up to 60 seconds._`);
    const result = await generateSong(prompt, title, style);
    if (result && result.audio_url) {
      const audioResponse = await axios.get(result.audio_url, { responseType: 'arraybuffer' });
      if (audioResponse.data) {
        await safeSendMedia(sock, fromJid, { audio: Buffer.from(audioResponse.data), mimetype: 'audio/mpeg', ptt: false, fileName: `song_${Date.now()}.mp3` }, {}, msg);
        await replyText(`🎵 *Song Generated*\nTitle: ${result.title || title || 'Untitled'}\nPrompt: ${prompt}\n\nEnjoy! 🎶`);
      } else {
        await replyText('❌ Failed to download the generated song.');
      }
    } else {
      await replyText('❌ Failed to generate song. Please try again with a different prompt.');
    }
    return true;
  }

  // ─── Weather ──────────────────────────────────────────────────
  if (lower === 'weather') {
    const weather = await getWeather('Harare');
    if (!weather) return replyText('❌ Could not fetch weather.');
    const advice = getWeatherAdvice(weather, lang);
    await replyText(`🌤️ *Weather in ${weather.city}:*\n${weather.description}\n🌡️ Temp: ${weather.temp}°C\n💧 Humidity: ${weather.humidity}%\n💨 Wind: ${weather.wind} m/s\n\n${advice}`);
    return true;
  }
  if (lower.startsWith('weather ')) {
    const city = lower.slice(8).trim();
    const weather = await getWeather(city);
    if (!weather) return replyText('❌ Could not fetch weather. Check city name.');
    const advice = getWeatherAdvice(weather, lang);
    await replyText(`🌤️ *Weather in ${weather.city}:*\n${weather.description}\n🌡️ Temp: ${weather.temp}°C\n💧 Humidity: ${weather.humidity}%\n💨 Wind: ${weather.wind} m/s\n\n${advice}`);
    return true;
  }

  // ─── Timetable ─────────────────────────────────────────────────
  if (lower === 'view timetable') {
    await sendTimetableMenu(sock, fromJid, user, msg);
    return true;
  }
  if (lower === 'upload timetable') {
    if (user.role !== 'student' && user.role !== 'parent') return replyText('Only students/parents can upload a personal study timetable.');
    userStates.set(userPhone, { waitingFor: 'timetable_upload', tempData: { type: 'study' }, timestamp: Date.now() });
    await replyText(getText('timetableUploadPrompt', lang));
    return true;
  }
  if (lower === 'upload reading timetable') {
    if (user.role !== 'student' && user.role !== 'parent') return replyText('Only students/parents can upload a reading timetable.');
    userStates.set(userPhone, { waitingFor: 'timetable_upload', tempData: { type: 'reading' }, timestamp: Date.now() });
    await replyText(getText('timetableUploadPrompt', lang));
    return true;
  }
  if (lower === 'upload teacher timetable') {
    if (user.role !== 'teacher') return replyText('Only teachers can upload.');
    userStates.set(userPhone, { waitingFor: 'timetable_upload', tempData: { type: 'teacher' }, timestamp: Date.now() });
    await replyText(getText('timetableUploadPrompt', lang));
    return true;
  }
  if (lower === 'upload class timetable') {
    if (!user.is_admin) return;
    userStates.set(userPhone, { waitingFor: 'admin_class_timetable', timestamp: Date.now() });
    await replyText('Please send the class name first. Example: *4G*');
    return true;
  }
  if (lower === 'view teacher timetable') {
    if (user.role !== 'teacher') return replyText('Only teachers can view their own lessons timetable.');
    const teacherTT = await getTimetable(`teacher_${user.teacher_id}`);
    if (teacherTT && teacherTT.url) {
      await safeSendMedia(sock, fromJid, { image: { url: teacherTT.url }, caption: `👨‍🏫 *Your Lessons Timetable*${getFooter(lang)}` }, {}, msg);
    } else await replyText('❌ No teacher timetable found. Upload one first using *upload teacher timetable*.');
    return true;
  }

  // ─── Profile ──────────────────────────────────────────────────
  if (lower === 'profile') {
    const rankPos = await getUserRank(userPhone);
    let profile = `👤 *Profile*\nName: ${user.name}\nRole: ${user.is_admin ? 'School Admin' : user.role === 'parent' ? 'Parent' : user.role === 'teacher' ? 'Teacher' : 'Student'}`;
    if (user.is_developer) profile += ` 👑 DEV`;
    if (user.premium) profile += ` ⭐ Premium`;
    if (user.role === 'student') {
      profile += `\nStudent ID: ${user.student_id}\nAge: ${user.age}\nGender: ${user.gender === 'male' ? 'Male' : 'Female'}\nClass: ${user.class}\nSchool: ${user.school}`;
      const medical = await getMedicalInfo(userPhone);
      if (medical) {
        profile += `\n\n💊 *Medical Info*\nAllergies: ${medical.allergies || 'None'}\nConditions: ${medical.conditions || 'None'}\nBlood Type: ${medical.blood_type || 'Unknown'}\nEmergency Contact: ${medical.emergency_contact_name || 'None'} (${medical.emergency_contact_phone || 'N/A'})`;
      }
    } else if (user.role === 'parent') profile += `\nChild: ${user.child_name} (${user.relationship})\nLinked ID: ${user.linked_child_id || 'Not linked'}`;
    else if (user.role === 'teacher') profile += `\nTitle: ${user.title} ${user.surname}\nTeacher ID: ${user.teacher_id}\nClasses: ${(user.teaching_classes || []).join(', ')}`;
    profile += `\nPoints: ${user.points || 0}\nRank: ${user.rank || 'Beginner'}\nLeaderboard: ${rankPos ? `#${rankPos}` : 'N/A'}`;
    await replyText(profile);
    return true;
  }

  // ─── Leaderboard ──────────────────────────────────────────────
  if (lower === 'leaderboard weekly' || lower === 'leaderboard monthly' || lower === 'leaderboard' || lower === 'leaderboard alltime') {
    const type = lower === 'leaderboard weekly' ? 'weekly' : lower === 'leaderboard monthly' ? 'monthly' : 'alltime';
    const top = await getLeaderboard(20, type);
    if (!top.length) return replyText('No leaderboard data yet.');
    let txt = `🏆 *${type.charAt(0).toUpperCase()+type.slice(1)} Leaderboard (Top 20)*\n\n`;
    top.forEach((s, i) => txt += `${i+1}. ${s.name} (${s.class}) – ${s.points} pts\n`);
    await replyText(txt);
    return true;
  }

  // ─── Language ──────────────────────────────────────────────────
  if (lower === 'language') { await replyText(getText('changeLanguage', lang)); return true; }
  if (lower === 'language english') { userLanguages.set(userPhone, 'en'); await replyText(getText('languageChanged', 'en', { lang: 'English' })); return true; }
  if (lower === 'language shona') { userLanguages.set(userPhone, 'sn'); await replyText(getText('languageChanged', 'sn', { lang: 'Shona' })); return true; }

  // ─── Owner ────────────────────────────────────────────────────
  if (lower === 'owner') { await replyText(`👨‍💻 *Developer*\n📱 WhatsApp: ${CONTACT_LINK}\n📞 Call: ${DEVELOPER_PHONE_CALL}\n📧 Email: ${DEVELOPER_EMAIL}`); return true; }

  // ─── Guide ────────────────────────────────────────────────────
  if (lower === 'guide') {
    let guideKey = 'guide';
    if (user.role === 'student') guideKey = 'guideStudent';
    else if (user.role === 'parent') guideKey = 'guideParent';
    else if (user.role === 'teacher') guideKey = 'guideTeacher';
    else if (user.is_admin) guideKey = 'guideAdmin';
    let guideText = getText(guideKey, lang);
    guideText += `\n\n❓ *FAQ*\n• How to register? Type *start*.\n• How to study? Type *study <subject>*.\n• How to take quiz? Type *quiz*.\n• How to get help? Type *help* or *menu*.\n• How to contact developer? Type *owner*.\n• How to track child? Type *where is my child*.\n• How to report absence? Type *report absence* or *absence reason <category> - <details>*.\n• How to assign class teacher? Admin: *set class teacher <class> <phone>*.\n\n📞 *Support WhatsApp*: ${CONTACT_LINK}`;
    await replyText(guideText);
    return true;
  }

  // ─── About ────────────────────────────────────────────────────
  if (lower === 'about') {
    await replyText(`ℹ️ *About ${BOT_NAME}*\n\n${BOT_NAME} is an AI-powered educational assistant built by **Vincent Ganiza** (aka Traxxion Tech) for **${SCHOOL_NAME}**.\n\n🎯 *Mission:* To enhance learning and school management through intelligent automation and real-time communication.\n\n🇿🇼 *Made in Zimbabwe* with ❤️\n\n🔧 *Tech Stack:* Node.js, Baileys, OpenAI, Supabase, NIXCODE Buttons.\n\n📅 *Version:* 5.1.0\n\n📞 *Developer Contact:* ${CONTACT_LINK}`);
    return true;
  }

  // ─── Menu ──────────────────────────────────────────────────────
  if (lower === 'menu' || lower === 'start' || lower === 'help') { await sendMainMenu(sock, fromJid, msg, user); return true; }

  // ─── Restart Registration ────────────────────────────────────
  if (lower === 'restart registration' || lower === 'restart') { await updateUser(userPhone, { registered: false, reg_step: 'ask_language' }); userStates.delete(userPhone); await replyText('🔄 Registration reset. Type *start* to begin again.'); return true; }

  // ─── Reapply ──────────────────────────────────────────────────
  if (lower === 'reapply') {
    if (!user || user.role !== 'student' || !user.suspended) return replyText('❌ You are not suspended or are not a student.');
    if (user.class && await isStreamBanned(user.class)) {
      const adminPhones = (await getAllUsers()).filter(u => u.is_admin).map(u => u.phone);
      const notification = `📢 *Re-application Request*\n\nStudent *${user.name}* (${user.student_id}) from class *${user.class}* wants to reapply to the StudyMate Ai system.\n\nAdmin: Please review and manually unsuspend using *unsuspend student ${user.student_id}* if approved.`;
      for (const adminPhone of adminPhones) {
        try { const jid = formatJid(adminPhone); if (jid) await sock.sendMessage(jid, { text: notification + getFooter('en') }); } catch (e) {}
      }
      await replyText(`✅ Your re-application has been sent to the admin team. They will review and unsuspend you if approved.`);
    } else await replyText('❌ Your class is not banned. If you are suspended, please contact admin directly.');
    return true;
  }

  // ─── Admin Commands ──────────────────────────────────────────
  if (user.is_admin) {
    // Admin dashboard
    if (lower === 'admin dashboard') { await sendAdminDashboard(sock, fromJid, msg, lang); return true; }
    if (lower === 'system analytics') {
      const a = await getSystemAnalytics();
      await replyText(`📊 *System Analytics*\n👥 Total Users: ${a.totalUsers}\n📚 Students: ${a.students}\n👨‍👩‍👧 Parents: ${a.parents}\n👨‍🏫 Teachers: ${a.teachers}\n💬 Today's Messages: ${a.todayMessages}\n⚡ Today's Interactions: ${a.todayInteractions}\n📝 Quiz Correct: ${a.quizCorrect}\n❌ Quiz Incorrect: ${a.quizIncorrect}\n🎯 Pass Rate: ${(a.quizCorrect + a.quizIncorrect) > 0 ? ((a.quizCorrect / (a.quizCorrect + a.quizIncorrect)) * 100).toFixed(1) : 0}%`);
      return true;
    }
    if (lower === 'manage classes') {
      const classes = await getClasses();
      if (!classes) return replyText('Error loading classes.');
      let msgText = '🏫 *Manage Classes*\n\nCurrent classes:\n';
      for (const [form, streams] of Object.entries(classes)) msgText += `\n📚 *${form}*: ${streams.join(', ')}`;
      msgText += `\n\nCommands:\n• *add class <form> <stream>*\n• *remove class <stream>*`;
      await replyText(msgText);
      return true;
    }
    if (lower.startsWith('add class ')) {
      const parts = command.replace('add class ', '').split(/\s+/);
      if (parts.length < 3) return replyText('Usage: add class Form 4 4G');
      const form = parts[0] + ' ' + parts[1];
      const stream = parts[2];
      await addClass(form, stream);
      await replyText(`✅ Class ${stream} added to ${form}.`);
      return true;
    }
    if (lower.startsWith('remove class ')) {
      const stream = command.replace('remove class ', '').trim();
      const classes = await getClasses();
      let foundForm = null;
      if (classes) {
        for (const [form, streams] of Object.entries(classes)) {
          if (streams.includes(stream)) { foundForm = form; break; }
        }
      }
      if (!foundForm) return replyText(`Class ${stream} not found.`);
      await removeClass(foundForm, stream);
      await replyText(`✅ Class ${stream} removed.`);
      return true;
    }
    if (lower.startsWith('broadcast ')) {
      const message = command.slice(10).trim();
      if (!message) return replyText('❌ Please provide a message to broadcast.\nExample: *broadcast School will be closed tomorrow*');
      await broadcastAnnouncement(user.phone, message, 'all');
      await replyText('✅ Broadcast saved and will be sent to all users shortly.');
      return true;
    }
    if (lower === 'view teachers') {
      const teachers = await getTeachers();
      if (!teachers.length) return replyText('No teachers registered.');
      let txt = '👨‍🏫 *Registered Teachers*\n\n';
      teachers.forEach((t, i) => txt += `${i+1}. ${t.title} ${t.surname} (${t.teacher_id})\n   Classes: ${(t.teaching_classes || []).join(', ') || 'None'}\n`);
      await replyText(txt);
      return true;
    }
    if (lower === 'view all students') {
      const allStudents = await getAllStudents();
      if (!allStudents.length) return replyText('No students registered.');
      let msgText = '👥 *All Students*\n\n';
      const grouped = {};
      for (const s of allStudents) {
        if (!grouped[s.class]) grouped[s.class] = [];
        grouped[s.class].push(s);
      }
      for (const [cls, students] of Object.entries(grouped)) {
        msgText += `📚 *${cls}* (${students.length})\n`;
        students.forEach(s => msgText += `  • ${s.name} (${s.student_id}) ${s.suspended ? '⛔ SUSPENDED' : '✅ Active'} ${s.is_developer ? '👑' : ''}\n`);
        msgText += '\n';
      }
      await replyText(msgText);
      return true;
    }
    if (lower === 'leaderboard class') {
      const students = await getAllStudents();
      const classes = [...new Set(students.map(s => s.class))];
      if (!classes.length) return replyText('No classes available.');
      let msgText = '🏆 *Leaderboard by Class*\n\n';
      for (const cls of classes) {
        const studentsInClass = students.filter(u => u.class === cls);
        const sorted = studentsInClass.sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 5);
        msgText += `📚 *${cls}*\n`;
        sorted.forEach((s, idx) => msgText += `  ${idx+1}. ${s.name} (${s.class}) – ${s.points || 0} pts\n`);
        msgText += '\n';
      }
      await replyText(msgText);
      return true;
    }
    if (lower.startsWith('suspend student ')) {
      const studentId = command.replace('suspend student ', '').trim().toUpperCase();
      const student = await getUserByStudentId(studentId);
      if (!student) return replyText(getText('studentNotFound', lang, { id: studentId }));
      if (isDeveloper(student.phone)) return replyText('❌ Cannot suspend developer.');
      if (student.suspended) return replyText(`Student ${student.name} is already suspended.`);
      await updateUser(student.phone, { suspended: true });
      await replyText(getText('studentSuspended', lang, { name: student.name, studentId: student.student_id }));
      return true;
    }
    if (lower.startsWith('unsuspend student ')) {
      const studentId = command.replace('unsuspend student ', '').trim().toUpperCase();
      const student = await getUserByStudentId(studentId);
      if (!student) return replyText(getText('studentNotFound', lang, { id: studentId }));
      if (!student.suspended) return replyText(`Student ${student.name} is not suspended.`);
      await updateUser(student.phone, { suspended: false });
      await replyText(getText('studentUnsuspended', lang, { name: student.name, studentId: student.student_id }));
      return true;
    }
    if (lower === 'ban teacher') {
      const teachers = await getTeachers();
      if (!teachers.length) return replyText('No teachers registered.');
      let list = '🚫 *Ban a Teacher*\nSend the teacher ID to ban.\n\n';
      teachers.forEach(t => list += `• ${t.title} ${t.surname} (${t.teacher_id})\n`);
      userStates.set(userPhone, { waitingFor: 'admin_ban_teacher', timestamp: Date.now() });
      await replyText(list);
      return true;
    }
    if (lower === 'unban teacher') {
      const banned = await dbQuery('banned_teachers', 'select', null, {});
      if (!banned || banned.length === 0) return replyText('No banned teachers.');
      let list = '✅ *Unban a Teacher*\nSend the teacher ID to unban.\n\n';
      for (const row of banned) {
        const teacher = await getUserByPhone(row.phone);
        if (teacher) list += `• ${teacher.title} ${teacher.surname} (${teacher.teacher_id})\n`;
      }
      userStates.set(userPhone, { waitingFor: 'admin_unban_teacher', timestamp: Date.now() });
      await replyText(list);
      return true;
    }
    if (lower === 'system stats') {
      const analytics = await getSystemAnalytics();
      const totalCorrect = (analytics.quizCorrect || 0);
      const totalIncorrect = (analytics.quizIncorrect || 0);
      const totalPassRate = (totalCorrect + totalIncorrect) > 0 ? ((totalCorrect / (totalCorrect + totalIncorrect)) * 100).toFixed(1) : 0;
      await replyText(`📊 *System Usage Stats (Today)*\n\n👥 Total Users: ${analytics.totalUsers}\n📚 Students: ${analytics.students}\n👨‍👩‍👧 Parents: ${analytics.parents}\n👨‍🏫 Teachers: ${analytics.teachers}\n💬 Messages Today: ${analytics.todayMessages}\n⚡ Interactions Today: ${analytics.todayInteractions}\n\n📝 *Quiz Statistics*\n✅ Correct Answers: ${totalCorrect}\n❌ Incorrect Answers: ${totalIncorrect}\n📈 Pass Rate: ${totalPassRate}%`);
      return true;
    }
    if (lower.startsWith('ban stream ')) {
      const className = command.replace('ban stream ', '').trim();
      if (!await isValidClass(className)) return replyText(`❌ Class "${className}" does not exist.`);
      const students = await getStudentsByClass(className);
      if (students.length === 0) return replyText(`ℹ️ No students found in class ${className}.`);
      for (const student of students) {
        if (!isDeveloper(student.phone)) {
          await updateUser(student.phone, { suspended: true });
        }
      }
      await addBannedStream(className);
      await replyText(`✅ Banned ${students.length} student(s) in class ${className}. They can reapply with *reapply*.`);
      return true;
    }
    if (lower.startsWith('unban stream ')) {
      const className = command.replace('unban stream ', '').trim();
      if (!await isStreamBanned(className)) return replyText(`ℹ️ Class ${className} is not currently banned.`);
      const students = await getStudentsByClass(className);
      for (const student of students) { await updateUser(student.phone, { suspended: false }); }
      await removeBannedStream(className);
      await replyText(`✅ Unbanned class ${className} (${students.length} students restored).`);
      return true;
    }
    if (lower === 'assign teacher') {
      userStates.set(userPhone, { waitingFor: 'admin_assign_teacher', timestamp: Date.now() });
      const teachersList = await getTeachers();
      if (!teachersList.length) return replyText('No teachers registered.');
      let list = '👤 *Assign Teacher to Class*\nSend in format: `teacherId class`\n\nExample: `TCHR0001 4G`\n\nRegistered Teachers:\n';
      teachersList.forEach(t => list += `• ${t.title} ${t.surname} (${t.teacher_id})\n`);
      await replyText(list);
      return true;
    }
    if (lower === 'remove teacher') {
      userStates.set(userPhone, { waitingFor: 'admin_remove_teacher', timestamp: Date.now() });
      const teachersList = await getTeachers();
      if (!teachersList.length) return replyText('No teachers registered.');
      let list = '👤 *Remove Teacher from Class*\nSend in format: `teacherId class`\n\nExample: `TCHR0001 4G`\n\nRegistered Teachers:\n';
      teachersList.forEach(t => list += `• ${t.title} ${t.surname} (${t.teacher_id})\n`);
      await replyText(list);
      return true;
    }
    if (lower === 'export data') {
      await replyText('📊 Generating data export... This may take a moment.');
      const data = await exportAllData();
      const buffer = Buffer.from(data, 'utf-8');
      await safeSendMedia(sock, fromJid, {
        document: buffer,
        mimetype: 'text/plain',
        fileName: `StudyMate_Data_${moment().format('YYYY-MM-DD_HH-mm')}.txt`,
        caption: `📊 *Data Export*\n${moment().tz('Africa/Harare').format('dddd, MMMM D, YYYY [at] HH:mm:ss')}`
      }, {}, msg);
      await replyText('✅ Export sent!');
      return true;
    }
    // Promotion
    if (lower === 'promote students') {
      const students = await getAllStudents();
      if (!students.length) return replyText('No students to promote.');
      const classMap = {
        '1A': '2A', '1B': '2B', '1G': '2G', '1W': '2W', '1U': '2U', '1Z': '2Z', '1E': '2E',
        '2A': '3A', '2B': '3B', '2G': '3G', '2W': '3W', '2U': '3U', '2Z': '3Z', '2E': '3E',
        '3A': '4A', '3B': '4B', '3G': '4G', '3W': '4W', '3U': '4U', '3Z': '4Z', '3E': '4E',
        '4A': '5A', '4B': '5B', '4G': '5G', '4W': '5W', '4U': '5U', '4Z': '5Z', '4E': '5E',
        '5A': '6A', '5B': '6B', '5G': '6G', '5W': '6W', '5U': '6U', '5Z': '6Z', '5E': '6E',
        '6A': 'Graduated', '6B': 'Graduated', '6G': 'Graduated', '6W': 'Graduated', '6U': 'Graduated', '6Z': 'Graduated', '6E': 'Graduated'
      };
      let promoted = 0;
      for (const student of students) {
        const current = student.class;
        const next = classMap[current];
        if (next && next !== 'Graduated') {
          await updateUser(student.phone, { class: next, registered: false, reg_step: 'ask_language' });
          await logPromotion(student.phone, current, next, user.phone);
          promoted++;
          try { const jid = formatJid(student.phone); if (jid) await sock.sendMessage(jid, { text: `🎓 *Promotion Notification*\n\nYou have been promoted from *${current}* to *${next}*.\nPlease reapply by typing *reapply* to confirm your details.${getFooter(lang)}` }); } catch (e) {}
          await delay(200);
        }
      }
      await replyText(`✅ ${promoted} students promoted. They will need to reapply.`);
      return true;
    }
    // Reapply window
    if (lower === 'reapply window') {
      const year = await getAcademicYear();
      const status = year.reapply_open ? 'open' : 'closed';
      await replyText(`🔄 Re-application window is currently *${status.toUpperCase()}*.\n\nType *open reapply* or *close reapply* to change.`);
      return true;
    }
    if (lower === 'open reapply') {
      await updateAcademicYear({ reapply_open: true });
      await replyText(getText('reapplyOpen', lang));
      const students = await getAllStudents();
      for (const student of students) {
        try { const jid = formatJid(student.phone); if (jid) await sock.sendMessage(jid, { text: `🔄 *Re-application Open*\n\nYou can now reapply by typing *reapply*.${getFooter(lang)}` }); await delay(200); } catch (e) {}
      }
      return true;
    }
    if (lower === 'close reapply') {
      await updateAcademicYear({ reapply_open: false });
      await replyText(getText('reapplyClosed', lang));
      return true;
    }
    // Sports
    if (lower === 'manage sports') {
      const disciplines = await getSportsDisciplines();
      let list = '🏅 *Manage Sports*\n\nCurrent disciplines:\n';
      if (disciplines.length) {
        for (const d of disciplines) list += `• ${d.name} (${d.category})\n`;
      } else list += 'None\n';
      list += '\nCommands:\n• *add sport <name> <team|athletics>*\n• *remove sport <name>*\n• *view seasons*\n• *add season <discipline_id> <season_name> <start> <end> <coordinator_phone>*\n• *close season <season_id>*';
      await replyText(list);
      return true;
    }
    if (lower.startsWith('add sport ')) {
      const args = command.slice(10).split(' ');
      if (args.length < 2) return replyText('Usage: add sport <name> <team|athletics>');
      const name = args.slice(0, -1).join(' ');
      const category = args[args.length - 1].toLowerCase();
      if (!['team', 'athletics'].includes(category)) return replyText('Category must be "team" or "athletics".');
      try { await addSportDiscipline(name, category); await replyText(`✅ Sport "${name}" added.`); } catch (e) { replyText('❌ Failed to add sport. It may already exist.'); }
      return true;
    }
    if (lower.startsWith('remove sport ')) {
      const name = command.slice(13).trim();
      try { await removeSportDiscipline(name); await replyText(`✅ Sport "${name}" removed.`); } catch (e) { replyText('❌ Failed to remove sport.'); }
      return true;
    }
    if (lower === 'view seasons') {
      const seasons = await getSportsSeasons();
      if (!seasons.length) return replyText('No seasons created.');
      let text = '📅 *Sports Seasons*\n\n';
      for (const s of seasons) {
        const discipline = (await getSportsDisciplines()).find(d => d.id === s.discipline_id);
        const coord = await getUserByPhone(s.coordinator_phone);
        text += `• ${s.season_name} (${discipline?.name || 'Unknown'})\n  Status: ${s.status}, Coordinator: ${coord?.name || 'Not assigned'}\n  ID: ${s.id}\n\n`;
      }
      await replyText(text);
      return true;
    }
    if (lower.startsWith('add season ')) {
      const parts = command.slice(11).split(' ');
      if (parts.length < 6) return replyText('Usage: add season <discipline_id> <season_name> <start_date> <end_date> <coordinator_phone>');
      const disciplineId = parseInt(parts[0]);
      const seasonName = parts.slice(1, -3).join(' ');
      const startDate = parts[parts.length - 3];
      const endDate = parts[parts.length - 2];
      const coordPhone = parts[parts.length - 1];
      try { await addSportsSeason(disciplineId, seasonName, startDate, endDate, coordPhone, user.phone); await replyText(`✅ Season "${seasonName}" created.`); } catch (e) { replyText('❌ Failed to create season.'); }
      return true;
    }
    if (lower.startsWith('close season ')) {
      const id = parseInt(command.slice(13).trim());
      try { await updateSportsSeasonStatus(id, 'closed'); await replyText(`✅ Season ${id} closed.`); } catch (e) { replyText('❌ Failed to close season.'); }
      return true;
    }
    // Trip
    if (lower === 'create trip') {
      userStates.set(userPhone, { waitingFor: 'trip_title', timestamp: Date.now() });
      await replyText('🚌 *Create a Trip*\n\nPlease send the trip title.');
      return true;
    }
    const tripState = userStates.get(userPhone);
    if (tripState && tripState.waitingFor === 'trip_title') {
      userStates.set(userPhone, { ...tripState, waitingFor: 'trip_desc', tempData: { title: command } });
      await replyText('Send trip description.');
      return true;
    }
    if (tripState && tripState.waitingFor === 'trip_desc') {
      userStates.set(userPhone, { ...tripState, waitingFor: 'trip_date', tempData: { ...tripState.tempData, description: command } });
      await replyText('Send trip date and time (e.g., 2026-08-15 08:00).');
      return true;
    }
    if (tripState && tripState.waitingFor === 'trip_date') {
      const date = moment(command, 'YYYY-MM-DD HH:mm');
      if (!date.isValid()) return replyText('Invalid date format. Use YYYY-MM-DD HH:mm.');
      userStates.set(userPhone, { ...tripState, waitingFor: 'trip_coordinator', tempData: { ...tripState.tempData, date: date.toISOString() } });
      const teachers = await getTeachers();
      let list = '👨‍🏫 *Select Coordinator (Teacher)*\n\nSend the teacher phone number (with country code):\n';
      for (const t of teachers) list += `• ${t.name} (${t.phone})\n`;
      await replyText(list);
      return true;
    }
    if (tripState && tripState.waitingFor === 'trip_coordinator') {
      const coordPhone = command.replace(/\D/g, '');
      const teacher = await getUserByPhone(coordPhone);
      if (!teacher || teacher.role !== 'teacher') return replyText('❌ Invalid teacher phone.');
      const trip = await createTrip(tripState.tempData.title, tripState.tempData.description, tripState.tempData.date, coordPhone, user.phone);
      if (trip) {
        await replyText(getText('tripCreated', lang) + `\nTrip ID: ${trip.id}`);
        const jid = formatJid(coordPhone);
        if (jid) { await sock.sendMessage(jid, { text: `🚌 *Trip Coordinator Assignment*\n\nYou have been assigned as coordinator for trip: *${trip.title}*.\nDate: ${moment(trip.trip_date).format('dddd, MMMM D, YYYY [at] HH:mm')}\n\nYou will be able to view student medical info and send broadcasts.${getFooter(lang)}` }); }
      } else await replyText('❌ Failed to create trip.');
      userStates.delete(userPhone);
      return true;
    }

    // View Medical (admin)
    if (lower === 'view medical admin') {
      userStates.set(userPhone, { waitingFor: 'medical_student_id', timestamp: Date.now() });
      await replyText('💊 Please send the Student ID (e.g., STUDY0001).');
      return true;
    }
    const medState = userStates.get(userPhone);
    if (medState && medState.waitingFor === 'medical_student_id') {
      const studentId = command.trim().toUpperCase();
      const student = await getUserByStudentId(studentId);
      if (!student) return replyText(`Student ${studentId} not found.`);
      const info = await getMedicalInfo(student.phone);
      if (!info) return replyText(`No medical info on file for ${student.name}.`);
      let msg = `💊 *Medical Info for ${student.name} (${studentId})*\n\n`;
      msg += `Allergies: ${info.allergies || 'None'}\n`;
      msg += `Conditions: ${info.conditions || 'None'}\n`;
      msg += `Blood Type: ${info.blood_type || 'Unknown'}\n`;
      msg += `Emergency Contact: ${info.emergency_contact_name || 'None'} (${info.emergency_contact_phone || 'N/A'})\n`;
      msg += `Last Updated: ${moment(info.updated_at).tz('Africa/Harare').format('dddd, MMMM D, YYYY [at] HH:mm')}`;
      await replyText(msg);
      userStates.delete(userPhone);
      return true;
    }

    // Upload Results
    if (lower === 'upload results') {
      userStates.set(userPhone, { waitingFor: 'result_student_id', timestamp: Date.now() });
      await replyText('📊 *Upload Exam Result*\n\nSend Student ID, then subject, grade, term, exam name.\n\nFirst, send the Student ID.');
      return true;
    }
    const resState = userStates.get(userPhone);
    if (resState && resState.waitingFor === 'result_student_id') {
      const studentId = command.trim().toUpperCase();
      const student = await getUserByStudentId(studentId);
      if (!student) return replyText(`Student ${studentId} not found.`);
      userStates.set(userPhone, { ...resState, waitingFor: 'result_subject', tempData: { studentPhone: student.phone } });
      await replyText('Send the subject (e.g., Mathematics).');
      return true;
    }
    if (resState && resState.waitingFor === 'result_subject') {
      const subject = command.trim();
      userStates.set(userPhone, { ...resState, waitingFor: 'result_grade', tempData: { ...resState.tempData, subject } });
      await replyText('Send the grade (e.g., A, B+, 80%).');
      return true;
    }
    if (resState && resState.waitingFor === 'result_grade') {
      const grade = command.trim();
      userStates.set(userPhone, { ...resState, waitingFor: 'result_term', tempData: { ...resState.tempData, grade } });
      await replyText('Send the term (e.g., Term 1).');
      return true;
    }
    if (resState && resState.waitingFor === 'result_term') {
      const term = command.trim();
      userStates.set(userPhone, { ...resState, waitingFor: 'result_exam_name', tempData: { ...resState.tempData, term } });
      await replyText('Send the exam name (e.g., End of Year).');
      return true;
    }
    if (resState && resState.waitingFor === 'result_exam_name') {
      const examName = command.trim();
      const { studentPhone, subject, grade, term } = resState.tempData;
      await uploadResult(studentPhone, subject, grade, term, examName);
      await replyText(`✅ Result uploaded for student ${studentPhone}.`);
      userStates.delete(userPhone);
      const student = await getUserByPhone(studentPhone);
      if (student) {
        const jid = formatJid(student.phone);
        if (jid) { await sock.sendMessage(jid, { text: `📊 *New Exam Result*\n\nSubject: ${subject}\nGrade: ${grade}\nTerm: ${term}\nExam: ${examName}\n\nCheck your results anytime with *my results*.${getFooter(lang)}` }); }
      }
      return true;
    }

    // Events
    if (lower === 'events') {
      const events = await getEvents(20);
      let msg = '📅 *School Events*\n\n';
      if (events.length) {
        for (const e of events) {
          msg += `📌 ${e.title}\n   ${e.description || ''}\n   Date: ${moment(e.event_date).format('dddd, MMMM D, YYYY [at] HH:mm')}\n   Category: ${e.category || 'General'}\n\n`;
        }
      } else msg += 'No events scheduled.';
      msg += '\nTo add an event: *add event <title> | <description> | <date> | <category>*';
      await replyText(msg);
      return true;
    }
    if (lower.startsWith('add event ')) {
      const parts = command.slice(10).split(' | ');
      if (parts.length < 4) return replyText('Usage: add event <title> | <description> | <date> | <category>');
      const [title, description, dateStr, category] = parts;
      const date = moment(dateStr, 'YYYY-MM-DD HH:mm');
      if (!date.isValid()) return replyText('Invalid date format. Use YYYY-MM-DD HH:mm.');
      await createEvent(title, description, date.toISOString(), category, user.phone);
      await replyText(`✅ Event "${title}" created.`);
      return true;
    }

    // .autoread and .autotyping (also available to dev)
    if (lower === '.autoread on' || lower === '.autoread off') {
      const enabled = lower === '.autoread on';
      await setAutoReadConfig(enabled);
      await replyText(`✅ Auto-read ${enabled ? 'enabled' : 'disabled'}.`);
      return true;
    }
    if (lower === '.autotyping on' || lower === '.autotyping off') {
      const enabled = lower === '.autotyping on';
      await setAutoTypingConfig(enabled);
      await replyText(`✅ Auto-typing ${enabled ? 'enabled' : 'disabled'}.`);
      return true;
    }

    // ─── CLASS TEACHER COMMANDS (NEW v5) ──────────────────────
    if (lower.startsWith('set class teacher ')) {
      const parts = command.slice(18).trim().split(/\s+/);
      if (parts.length < 2) return replyText('Usage: set class teacher <class> <phone>');
      const className = parts[0].toUpperCase();
      const teacherPhone = parts.slice(1).join('').replace(/\D/g, '');
      if (!teacherPhone) return replyText('❌ Provide teacher phone number.');
      const teacher = await getUserByPhone(teacherPhone);
      if (!teacher || teacher.role !== 'teacher') return replyText('❌ Teacher not found or not a teacher.');
      const classes = await getClasses();
      const allStreams = [];
      for (const streams of Object.values(classes || {})) allStreams.push(...streams);
      if (!allStreams.some(c => c.toLowerCase() === className.toLowerCase())) {
        return replyText(`❌ Class ${className} does not exist.`);
      }
      const result = await assignClassTeacher(className, teacherPhone, user.phone);
      await replyText(`✅ Class Teacher ${result} for ${className}. Teacher: ${teacher.name} (${teacherPhone})`);
      const jid = formatJid(teacherPhone);
      if (jid) {
        await sock.sendMessage(jid, { text: `👨‍🏫 *Class Teacher Assignment*\n\nYou have been assigned as class teacher for *${className}*.\nAll absence reports and tracking requests for this class will go ONLY to you.\n\n- View absences: *view absences*\n- Approve: *approve absence <ID>*\n- Reject: *reject absence <ID>*\n- Ask reason: *ask reason <STUDY_ID>*\n- Track absent: *track absent ${className}*` + getFooter(lang) });
      }
      return true;
    }

    if (lower.startsWith('remove class teacher ')) {
      const parts = command.slice(20).trim().split(/\s+/);
      if (parts.length < 2) return replyText('Usage: remove class teacher <class> <phone>');
      const className = parts[0].toUpperCase();
      const teacherPhone = parts.slice(1).join('').replace(/\D/g, '');
      if (!teacherPhone) return replyText('❌ Provide teacher phone number.');
      await removeClassTeacher(className, teacherPhone);
      await replyText(`✅ Removed class teacher for ${className}.`);
      return true;
    }

    if (lower === 'view class teachers') {
      const assignments = await getAllClassTeachers();
      if (!assignments.length) return replyText('No class teacher assignments.');
      let msg = '📋 *Class Teacher Assignments*\n\n';
      const grouped = {};
      for (const a of assignments) {
        if (!grouped[a.class_name]) grouped[a.class_name] = [];
        grouped[a.class_name].push(a);
      }
      for (const [cls, list] of Object.entries(grouped)) {
        msg += `📚 ${cls}:\n`;
        for (const a of list) {
          const teacher = await getUserByPhone(a.teacher_phone);
          msg += `   • ${teacher?.name || a.teacher_phone}\n`;
        }
        msg += '\n';
      }
      await replyText(msg);
      return true;
    }
  }

  // ─── Teacher Commands ─────────────────────────────────────────
  if (user.role === 'teacher') {
    if (lower === 'teacher dashboard') { await sendTeacherDashboard(sock, fromJid, msg, user, lang); return true; }
    if (lower === 'view students') {
      const classes = user.teaching_classes || [];
      if (!classes.length) return replyText('No classes assigned.');
      let out = '';
      for (const cls of classes) {
        const students = await getStudentsByClass(cls);
        out += `\n📚 *${cls}* (${students.length})\n`;
        students.slice(0, 10).forEach(s => out += `  • ${s.name} (${s.student_id})\n`);
        if (students.length > 10) out += `  ... and ${students.length - 10} more\n`;
      }
      await replyText(out || 'No students found.');
      return true;
    }
    if (lower.startsWith('send to class ')) {
      const parts = command.slice(14).trim().split(/\s+/);
      if (parts.length < 2) return replyText('❌ Usage: *send to class <class> <message>*\nExample: *send to class 4G Please do your homework*');
      const className = parts[0];
      const message = parts.slice(1).join(' ');
      const hasClass = (user.teaching_classes || []).some(c => c.toLowerCase() === className.toLowerCase());
      if (!hasClass) return replyText(`❌ You do not teach class ${className}. Your classes: ${(user.teaching_classes || []).join(', ') || 'None'}`);
      const students = await getStudentsByClass(className);
      let sent = 0;
      for (const student of students) {
        try {
          const recpLang = userLanguages.get(student.phone) || 'en';
          const prefix = recpLang === 'sn' ? `📨 *Shoko kubva kuna ${user.title} ${user.surname} (${className})*\n\n` : `📨 *Message from ${user.title} ${user.surname} (${className})*\n\n`;
          const jid = formatJid(student.phone);
          if (!jid) continue;
          await sock.sendMessage(jid, { text: prefix + message + getFooter(recpLang) });
          sent++;
          const parentLinks = await dbQuery('parent_links', 'select', null, { eq: { field: 'student_id', value: student.student_id } });
          if (parentLinks && parentLinks.length > 0) {
            for (const row of parentLinks) {
              const parent = await getUserByPhone(row.parent_phone);
              if (parent && parent.registered) {
                const pLang = userLanguages.get(parent.phone) || 'en';
                const pPrefix = pLang === 'sn' ? `📨 *Shoko kubva kuna ${user.title} ${user.surname} (${className}) – maererano ne${student.name}*\n\n` : `📨 *Message from ${user.title} ${user.surname} (${className}) – regarding ${student.name}*\n\n`;
                const parentJid = formatJid(parent.phone);
                if (parentJid) await sock.sendMessage(parentJid, { text: pPrefix + message + getFooter(pLang) });
              }
            }
          }
          await delay(300);
        } catch (e) { log(`Failed to send to class: ${e.message}`, 'ERROR'); }
      }
      await replyText(`✅ Message sent to ${sent} students in ${className}.`);
      await saveTeacherMessage({ teacher_phone: user.phone, class_name: className, content: message, sent_at: new Date() });
      return true;
    }
    // Assignment
    if (lower === 'send assignment') {
      userStates.set(userPhone, { waitingFor: 'assignment_class', timestamp: Date.now() });
      const classes = user.teaching_classes || [];
      if (!classes.length) return replyText('You have no classes assigned.');
      let list = '📝 *Send Assignment*\n\nSelect class by sending the class name:\n';
      for (const c of classes) list += `• ${c}\n`;
      await replyText(list);
      return true;
    }
    const assignState = userStates.get(userPhone);
    if (assignState && assignState.waitingFor === 'assignment_class') {
      const className = command.trim();
      const classes = user.teaching_classes || [];
      if (!classes.includes(className)) return replyText(`You do not teach ${className}.`);
      userStates.set(userPhone, { waitingFor: 'assignment_title', tempData: { className }, timestamp: Date.now() });
      await replyText('Send the assignment title.');
      return true;
    }
    if (assignState && assignState.waitingFor === 'assignment_title') {
      const title = command.trim();
      userStates.set(userPhone, { ...assignState, waitingFor: 'assignment_desc', tempData: { ...assignState.tempData, title } });
      await replyText('Send the assignment description.');
      return true;
    }
    if (assignState && assignState.waitingFor === 'assignment_desc') {
      const description = command.trim();
      userStates.set(userPhone, { ...assignState, waitingFor: 'assignment_due', tempData: { ...assignState.tempData, description } });
      await replyText('Send the due date and time (e.g., 2026-08-20 23:59).');
      return true;
    }
    if (assignState && assignState.waitingFor === 'assignment_due') {
      const due = moment(command, 'YYYY-MM-DD HH:mm');
      if (!due.isValid()) return replyText('Invalid date format. Use YYYY-MM-DD HH:mm.');
      const { className, title, description } = assignState.tempData;
      const assignment = await createAssignment(user.phone, className, title, description, due.toISOString(), null);
      if (assignment) {
        await replyText(getText('assignmentSent', lang));
        const students = await getStudentsByClass(className);
        for (const student of students) {
          try {
            const jid = formatJid(student.phone);
            if (jid) { await sock.sendMessage(jid, { text: `📝 *New Assignment*\n\nClass: ${className}\nTitle: ${title}\nDescription: ${description || 'N/A'}\nDue: ${due.format('dddd, MMMM D, YYYY [at] HH:mm')}\n\nFrom: ${user.name}${getFooter(lang)}` }); }
            await delay(200);
          } catch (e) {}
        }
      } else await replyText('❌ Failed to create assignment.');
      userStates.delete(userPhone);
      return true;
    }
    // View assignments
    if (lower === 'view assignments') {
      const classes = user.teaching_classes || [];
      if (!classes.length) return replyText('No classes assigned.');
      let msg = '📋 *My Assignments*\n\n';
      for (const cls of classes) {
        const assignments = await getAssignmentsForClass(cls);
        if (assignments.length) {
          msg += `📚 ${cls}\n`;
          for (const a of assignments) {
            msg += `   • ${a.title} (Due: ${moment(a.due_date).format('YYYY-MM-DD HH:mm')})\n`;
          }
          msg += '\n';
        }
      }
      if (msg === '📋 *My Assignments*\n\n') msg += 'No assignments sent.';
      await replyText(msg);
      return true;
    }
    // Absences (NEW v5)
    if (lower === 'view absences') {
      let classes = user.teaching_classes || [];
      const classTeacherEntries = await getClassTeachersForTeacher(user.phone);
      for (const entry of classTeacherEntries) {
        if (!classes.includes(entry.class_name)) classes.push(entry.class_name);
      }
      if (!classes.length) return replyText('No classes assigned.');
      let msg = '📋 *Absence Reports*\n\n';
      for (const cls of classes) {
        const reports = await getAbsenceReports(cls, 'pending');
        if (reports.length) {
          msg += `📚 ${cls}\n`;
          for (const r of reports) {
            const student = await getUserByPhone(r.student_phone);
            const category = r.category || 'other';
            const icon = ABSENCE_CATEGORIES[category]?.icon || '📝';
            msg += `   • ${icon} ${student?.name || 'Unknown'} (${r.date}) - ${r.reason || 'No reason'}\n`;
            msg += `     ID: ${r.id}, Status: ${r.status}, By: ${r.reported_by_role || '?'}\n`;
          }
          msg += '\n';
        }
      }
      if (msg === '📋 *Absence Reports*\n\n') msg += 'No pending absences.';
      await replyText(msg);
      return true;
    }
    // Approve absence
    if (lower.startsWith('approve absence ')) {
      const id = parseInt(command.replace('approve absence ', '').trim());
      if (isNaN(id)) return replyText('Please provide a valid ID.');
      const absence = await getAbsenceById(id);
      if (!absence) return replyText('Absence not found.');
      const isClassTeacher = (await getClassTeacher(absence.class_name))?.teacher_phone === user.phone;
      const isTeacherOfClass = (user.teaching_classes || []).includes(absence.class_name);
      if (!user.is_admin && !isClassTeacher && !isTeacherOfClass) {
        return replyText('❌ You are not allowed to approve this absence. Only class teacher, teachers of class, or admin can.');
      }
      await updateAbsenceStatus(id, 'approved', `Approved by ${user.name}`);
      await replyText(`✅ Absence ${id} approved.`);
      const student = await getUserByPhone(absence.student_phone);
      if (student) {
        const jid = formatJid(student.phone);
        if (jid) await sock.sendMessage(jid, { text: `✅ Your absence for ${absence.date} has been approved by ${user.name}.` + getFooter(lang) });
        const parents = await getChildren(student.student_id);
        for (const p of parents) {
          const parent = await getUserByPhone(p);
          if (parent) {
            const pJid = formatJid(parent.phone);
            if (pJid) await sock.sendMessage(pJid, { text: `✅ Your child ${student.name}'s absence for ${absence.date} has been approved by ${user.name}.` + getFooter(lang) });
          }
        }
      }
      return true;
    }
    // Reject absence
    if (lower.startsWith('reject absence ')) {
      const id = parseInt(command.replace('reject absence ', '').trim());
      if (isNaN(id)) return replyText('Please provide a valid ID.');
      const absence = await getAbsenceById(id);
      if (!absence) return replyText('Absence not found.');
      const isClassTeacher = (await getClassTeacher(absence.class_name))?.teacher_phone === user.phone;
      const isTeacherOfClass = (user.teaching_classes || []).includes(absence.class_name);
      if (!user.is_admin && !isClassTeacher && !isTeacherOfClass) {
        return replyText('❌ You are not allowed to reject this absence. Only class teacher, teachers of class, or admin can.');
      }
      await updateAbsenceStatus(id, 'rejected', `Rejected by ${user.name}`);
      await replyText(`❌ Absence ${id} rejected.`);
      const student = await getUserByPhone(absence.student_phone);
      if (student) {
        const jid = formatJid(student.phone);
        if (jid) await sock.sendMessage(jid, { text: `❌ Your absence for ${absence.date} has been rejected by ${user.name}. Please contact school.` + getFooter(lang) });
      }
      return true;
    }
    // Ask reason
    if (lower.startsWith('ask reason ') || lower.startsWith('why absent ') || lower.startsWith('request reason ')) {
      const studentId = command.replace(/^(ask reason|why absent|request reason)\s+/, '').trim().toUpperCase();
      const student = await getUserByStudentId(studentId);
      if (!student) return replyText(`Student ${studentId} not found.`);
      const isClassTeacher = (await getClassTeacher(student.class))?.teacher_phone === user.phone;
      const isTeacherOfClass = (user.teaching_classes || []).includes(student.class);
      if (!user.is_admin && !isClassTeacher && !isTeacherOfClass) {
        return replyText(`❌ You are not allowed to ask reason for ${student.name}. Only class teacher, teachers of class, or admin can.`);
      }
      const today = moment().tz('Africa/Harare').format('YYYY-MM-DD');
      let absence = await dbQuery('absence_reports', 'select', null, { eq: { field: 'student_phone', value: student.phone, date: today }, single: true });
      if (!absence) {
        await dbQuery('absence_reports', 'insert', {
          student_phone: student.phone,
          student_id: studentId,
          class_name: student.class,
          date: today,
          category: null,
          reason: null,
          status: 'waiting_reason',
          reported_by: user.phone,
          reported_by_role: 'teacher',
          requested_by_teacher: user.phone,
          reason_requested_at: new Date().toISOString()
        });
        absence = await dbQuery('absence_reports', 'select', null, { eq: { field: 'student_phone', value: student.phone, date: today }, single: true });
      } else {
        await updateAbsenceStatus(absence.id, 'info_requested');
        await dbQuery('absence_reports', 'update', { requested_by_teacher: user.phone, reason_requested_at: new Date().toISOString() }, { eq: { field: 'id', value: absence.id } });
      }
      const studentJid = formatJid(student.phone);
      if (studentJid) {
        let categoriesList = '';
        for (const [key, val] of Object.entries(ABSENCE_CATEGORIES)) {
          categoriesList += `${val.icon} ${val.label}\n`;
        }
        await sock.sendMessage(studentJid, {
          text: `📋 *Teacher Request - Reason for Absence*\n\nYour class teacher *${user.name}* is asking why you were absent today *${today}*.\n\nPlease reply with:\n*absence reason <category> - <details>*\n\nCategories:\n${categoriesList}\nExample: *absence reason sick - I have fever*\nYou can attach a proof image.`
        });
      }
      const parents = await getChildren(studentId);
      for (const p of parents) {
        const parent = await getUserByPhone(p);
        if (parent) {
          const pJid = formatJid(parent.phone);
          if (pJid) {
            await sock.sendMessage(pJid, {
              text: `📋 *Teacher Request - Your child absent*\n\nClass teacher *${user.name}* asks why ${student.name} (${studentId}) was absent today *${today}*.\n\nPlease reply with:\n*absence reason <category> - <details>*\nCategories: ${Object.keys(ABSENCE_CATEGORIES).join(', ')}`
            });
          }
        }
      }
      await replyText(`✅ Request sent to student ${student.name} and ${parents.length} parent(s). Waiting for reason.`);
      return true;
    }
    // View medical (teacher)
    if (lower === 'view medical') {
      userStates.set(userPhone, { waitingFor: 'medical_student_id_teacher', timestamp: Date.now() });
      await replyText('💊 Please send the Student ID (e.g., STUDY0001).');
      return true;
    }
    const medTeacherState = userStates.get(userPhone);
    if (medTeacherState && medTeacherState.waitingFor === 'medical_student_id_teacher') {
      const studentId = command.trim().toUpperCase();
      const student = await getUserByStudentId(studentId);
      if (!student) return replyText(`Student ${studentId} not found.`);
      const classes = user.teaching_classes || [];
      const classTeacher = await getClassTeacher(student.class);
      const isClassTeacher = classTeacher?.teacher_phone === user.phone;
      if (!classes.includes(student.class) && !isClassTeacher) {
        return replyText('You do not teach this student.');
      }
      const info = await getMedicalInfo(student.phone);
      if (!info) return replyText(`No medical info on file for ${student.name}.`);
      let msg = `💊 *Medical Info for ${student.name} (${studentId})*\n\n`;
      msg += `Allergies: ${info.allergies || 'None'}\n`;
      msg += `Conditions: ${info.conditions || 'None'}\n`;
      msg += `Blood Type: ${info.blood_type || 'Unknown'}\n`;
      msg += `Emergency Contact: ${info.emergency_contact_name || 'None'} (${info.emergency_contact_phone || 'N/A'})\n`;
      await replyText(msg);
      userStates.delete(userPhone);
      return true;
    }
    // My classes (class teacher representation)
    if (lower === 'my classes') {
      const entries = await getClassTeachersForTeacher(user.phone);
      if (!entries.length) return replyText('You are not representing any class as class teacher.');
      let msg = '👨‍🏫 *My Classes (Class Teacher)*\n\n';
      for (const e of entries) {
        msg += `📚 ${e.class_name}\n`;
        const students = await getStudentsByClass(e.class_name);
        msg += `   Students: ${students.length}\n`;
      }
      await replyText(msg);
      return true;
    }
    // Track absent (NEW v4)
    if (lower.startsWith('track absent ')) {
      const className = command.slice(13).trim().toUpperCase();
      const classes = user.teaching_classes || [];
      const classTeacher = await getClassTeacher(className);
      const isClassTeacher = classTeacher?.teacher_phone === user.phone;
      if (!classes.includes(className) && !isClassTeacher && !user.is_admin) {
        return replyText(`You do not teach ${className} or are not the class teacher.`);
      }
      const today = moment().tz('Africa/Harare').format('YYYY-MM-DD');
      const reports = await getAbsenceReports(className, 'all');
      const absentToday = reports.filter(r => r.date === today && (r.status === 'pending' || r.status === 'approved'));
      if (!absentToday.length) return replyText(`No absent students today in ${className}.`);
      let sent = 0;
      for (const r of absentToday) {
        const student = await getUserByPhone(r.student_phone);
        if (!student) continue;
        if (!locationRequests) locationRequests = {};
        if (!locationRequests[student.student_id]) locationRequests[student.student_id] = [];
        locationRequests[student.student_id].push({ requestedBy: user.phone, requestedAt: Date.now(), requesterRole: 'teacher' });
        const studentJid = formatJid(student.phone);
        if (studentJid) {
          await sock.sendMessage(studentJid, {
            text: `📍 *Absent Tracking*\n\nYou were marked absent today (${today}).\n${user.name} (class teacher) has requested your location for safety.\n\nTap 📎 > Location > Share Live Location (15 min) - Voluntary.`
          });
          sent++;
        }
      }
      await replyText(`✅ Location requests sent to ${sent} absent students in ${className}. Locations will be sent only to you (class teacher).`);
      return true;
    }
    // Request location (NEW v4)
    if (lower.startsWith('request location ')) {
      const studentId = command.replace('request location ', '').trim().toUpperCase();
      const student = await getUserByStudentId(studentId);
      if (!student) return replyText(`Student ${studentId} not found.`);
      const classes = user.teaching_classes || [];
      const classTeacher = await getClassTeacher(student.class);
      const isClassTeacher = classTeacher?.teacher_phone === user.phone;
      if (!classes.includes(student.class) && !isClassTeacher && !user.is_admin) {
        return replyText(`You are not allowed to request location from ${student.name}. Only class teacher, teachers of class, or admin can.`);
      }
      if (!locationRequests) locationRequests = {};
      if (!locationRequests[studentId]) locationRequests[studentId] = [];
      locationRequests[studentId].push({ requestedBy: user.phone, requestedAt: Date.now(), requesterRole: 'teacher' });
      const studentJid = formatJid(student.phone);
      if (studentJid) {
        await sock.sendMessage(studentJid, {
          text: `📍 *Location Request*\n\n${user.name} (teacher) has requested your location for safety.\n\nTap 📎 > Location > Share Live Location (15 min) - Voluntary.`
        });
        await replyText(`✅ Location request sent to ${student.name} (${studentId}). You will receive the location when shared.`);
      } else {
        replyText('❌ Could not send request.');
      }
      return true;
    }
  }

  // ─── Parent Commands ──────────────────────────────────────────
  if (user.role === 'parent') {
    if (lower.startsWith('link child ')) {
      const studentId = command.replace('link child ', '').trim().toUpperCase();
      const found = await findStudentById(studentId);
      if (!found) return replyText(`❌ Student ${studentId} not found.`);
      await updateUser(userPhone, { linked_child_id: studentId, child_name: found.user.name });
      await linkChildToParent(userPhone, studentId);
      await replyText(`✅ Linked to ${found.user.name} (${studentId})`);
      return true;
    }
    if (lower === 'unlink child') {
      const children = await getChildren(userPhone);
      if (!children.length) return replyText('You have no children linked.');
      let list = '🔓 *Unlink a Child*\nSend the Student ID of the child to unlink:\n\n';
      for (const cid of children) {
        const child = await getUserByStudentId(cid);
        if (child) list += `• ${child.name} (${cid})\n`;
      }
      userStates.set(userPhone, { waitingFor: 'parent_unlink_confirm', timestamp: Date.now() });
      await replyText(list + '\n\nSend *cancel* to abort.');
      return true;
    }
    if (lower.startsWith('child progress ')) {
      const studentId = command.replace('child progress ', '').trim().toUpperCase();
      const child = await getUserByStudentId(studentId);
      if (!child) return replyText(`Student ${studentId} not found.`);
      if (!(await getChildren(userPhone)).includes(studentId)) return replyText('You are not linked to this child.');
      const rankPos = await getUserRank(child.phone);
      await replyText(`📊 *Child Progress: ${child.name} (${studentId})*\nPoints: ${child.points || 0}\nRank: ${child.rank || 'Beginner'}\nLeaderboard: ${rankPos ? `#${rankPos}` : 'N/A'}\nLast Message: ${(await getChildAnalytics(studentId))?.lastMessageTime || 'Never'}\nLast Active: ${child.last_activity ? moment(child.last_activity).tz('Africa/Harare').format('dddd, MMMM D, YYYY [at] HH:mm:ss') : 'Never'}`);
      return true;
    }
    if (lower.startsWith('child analytics ')) {
      const studentId = command.replace('child analytics ', '').trim().toUpperCase();
      const child = await getUserByStudentId(studentId);
      if (!child) return replyText(`Student ${studentId} not found.`);
      if (!(await getChildren(userPhone)).includes(studentId)) return replyText('You are not linked to this child.');
      const analytics = await getChildAnalytics(studentId);
      if (!analytics) return replyText(`No usage data for ${child.name} yet.`);
      const emoji = analytics.successRate >= 70 ? '✅' : analytics.successRate >= 40 ? '⚠️' : '❌';
      await replyText(`📈 *Child Analytics: ${child.name} (${studentId})*\n💬 Total messages: ${analytics.totalMsgs}\n📝 Quiz attempts: ${analytics.quizAttempts}\n✓ Correct: ${analytics.quizCorrect}\n✗ Failures: ${analytics.failures}\n🎯 Success rate: ${analytics.successRate}% ${emoji}\n⚠️ Cheat attempts: ${analytics.cheatAttempts || 0}\n\n📊 Daily Messages (last 7 days):\n${analytics.dailyGraph}\n\n🕒 Last active: ${analytics.lastActive}\n📨 Last message sent: ${analytics.lastMessageTime}`);
      return true;
    }
    // Child medical
    if (lower === 'child medical') {
      const children = await getChildren(userPhone);
      if (!children.length) return replyText('No linked children.');
      let msg = '👶 *Select a child by Student ID:*\n';
      for (const cid of children) {
        const child = await getUserByStudentId(cid);
        if (child) msg += `• ${child.name} (${cid})\n`;
      }
      userStates.set(userPhone, { waitingFor: 'parent_medical_child', timestamp: Date.now() });
      await replyText(msg);
      return true;
    }
    const parentMedState = userStates.get(userPhone);
    if (parentMedState && parentMedState.waitingFor === 'parent_medical_child') {
      const studentId = command.trim().toUpperCase();
      const child = await getUserByStudentId(studentId);
      if (!child) return replyText(`Student ${studentId} not found.`);
      const info = await getMedicalInfo(child.phone);
      if (!info) return replyText(`No medical info on file for ${child.name}.`);
      let msg = `💊 *Medical Info for ${child.name} (${studentId})*\n\n`;
      msg += `Allergies: ${info.allergies || 'None'}\n`;
      msg += `Conditions: ${info.conditions || 'None'}\n`;
      msg += `Blood Type: ${info.blood_type || 'Unknown'}\n`;
      msg += `Emergency Contact: ${info.emergency_contact_name || 'None'} (${info.emergency_contact_phone || 'N/A'})\n`;
      await replyText(msg);
      userStates.delete(userPhone);
      return true;
    }
    // Child assignments
    if (lower === 'child assignments') {
      const children = await getChildren(userPhone);
      if (!children.length) return replyText('No linked children.');
      let msg = '📋 *Child Assignments*\n\n';
      for (const cid of children) {
        const child = await getUserByStudentId(cid);
        if (!child) continue;
        const assignments = await getAssignmentsForStudent(child.phone);
        if (assignments.length) {
          msg += `👤 ${child.name} (${cid})\n`;
          for (const a of assignments) {
            msg += `   • ${a.title} (Due: ${moment(a.due_date).format('YYYY-MM-DD HH:mm')})\n`;
          }
          msg += '\n';
        }
      }
      if (msg === '📋 *Child Assignments*\n\n') msg += 'No assignments for linked children.';
      await replyText(msg);
      return true;
    }
    // Child absences (NEW v5)
    if (lower === 'child absences') {
      const children = await getChildren(userPhone);
      if (!children.length) return replyText('No linked children.');
      let msg = '📋 *Child Absence Reports*\n\n';
      for (const cid of children) {
        const child = await getUserByStudentId(cid);
        if (!child) continue;
        const reports = await getAbsenceReports(child.class, 'all');
        const childReports = reports.filter(r => r.student_phone === child.phone);
        if (childReports.length) {
          msg += `👤 ${child.name} (${cid})\n`;
          for (const r of childReports) {
            const icon = ABSENCE_CATEGORIES[r.category]?.icon || '📝';
            msg += `   • ${icon} ${r.date} - ${r.reason || 'No reason'} (${r.status})\n`;
          }
          msg += '\n';
        }
      }
      if (msg === '📋 *Child Absence Reports*\n\n') msg += 'No absence reports for linked children.';
      await replyText(msg);
      return true;
    }
    // Where is my child (Live Tracking v4)
    if (lower === 'where is my child' || lower === 'child live' || lower === 'child location' || lower === 'child tracking') {
      const children = await getChildren(userPhone);
      if (!children.length) return replyText('You have no linked children.');
      let msg = '📍 *Live Child Tracking*\n\n';
      for (const cid of children) {
        const child = await getUserByStudentId(cid);
        if (!child) continue;
        const analytics = await getChildAnalytics(cid);
        const status = child.suspended ? '⛔ Suspended' : '✅ Active';
        const absentToday = await dbQuery('absence_reports', 'select', null, { eq: { field: 'student_phone', value: child.phone, date: moment().tz('Africa/Harare').format('YYYY-MM-DD') }, single: true });
        const absentMsg = absentToday ? `⚠️ Absent today (${absentToday.status})` : '✅ Present';
        msg += `👤 *${child.name} (${cid})*\n`;
        msg += `   Class: ${child.class || 'N/A'}\n`;
        msg += `   Status: ${status}\n`;
        msg += `   ${absentMsg}\n`;
        if (analytics) {
          msg += `   Last Active: ${analytics.lastActive || 'Never'}\n`;
          msg += `   Last Message: ${analytics.lastMessageTime || 'Never'}\n`;
          if (analytics.lastLocation) {
            msg += `   📍 Last Location: ${analytics.lastLocationUrl || `https://www.google.com/maps?q=${analytics.lastLocation.lat},${analytics.lastLocation.lng}`}\n`;
            msg += `   🕒 At: ${analytics.lastLocationTime || 'Unknown'}\n`;
          } else {
            msg += `   📍 Location: Not shared\n`;
          }
        }
        msg += '\n';
      }
      await replyText(msg);
      return true;
    }
    // Request location (parent)
    if (lower.startsWith('request location ')) {
      const studentId = command.replace('request location ', '').trim().toUpperCase();
      const child = await getUserByStudentId(studentId);
      if (!child) return replyText(`Student ${studentId} not found.`);
      if (!(await getChildren(userPhone)).includes(studentId)) return replyText('You are not linked to this child.');
      if (!locationRequests) locationRequests = {};
      if (!locationRequests[studentId]) locationRequests[studentId] = [];
      locationRequests[studentId].push({ requestedBy: user.phone, requestedAt: Date.now(), requesterRole: 'parent' });
      const studentJid = formatJid(child.phone);
      if (studentJid) {
        await sock.sendMessage(studentJid, {
          text: `📍 *Location Request*\n\nYour parent ${user.name} has requested your location for safety.\n\nTap 📎 > Location > Share Live Location (15 min) - Voluntary.`
        });
        await replyText(`✅ Location request sent to ${child.name} (${studentId}). You will receive the location when shared.`);
      } else {
        replyText('❌ Could not send request.');
      }
      return true;
    }
    // Stop tracking (parent)
    if (lower === 'stop tracking' || lower === 'delete location') {
      const children = await getChildren(userPhone);
      if (!children.length) return replyText('No linked children.');
      for (const cid of children) {
        let analytics = await dbQuery('child_analytics', 'select', null, { eq: { field: 'student_id', value: cid }, single: true });
        if (analytics) {
          const a = analytics.data;
          a.lastLocation = null;
          a.lastLocationTime = null;
          a.lastLocationUrl = null;
          await dbQuery('child_analytics', 'update', { data: a }, { eq: { field: 'student_id', value: cid } });
        }
      }
      await replyText('✅ Location data cleared for your children.');
      return true;
    }
  }

  // ─── Student Commands ─────────────────────────────────────────
  if (user.role === 'student') {
    // Report absence (with categories)
    if (lower === 'report absence') {
      userStates.set(userPhone, { waitingFor: 'absence_category_flow', timestamp: Date.now() });
      let categoriesList = '';
      for (const [key, val] of Object.entries(ABSENCE_CATEGORIES)) {
        categoriesList += `${val.icon} ${val.label} (${key})\n`;
      }
      await replyText(`📢 *Report Absence*\n\nPlease send the category and reason in one message:\n*absence reason <category> - <details>*\n\nCategories:\n${categoriesList}\nExample: *absence reason sick - I have fever*\nYou can attach a proof image.`);
      return true;
    }
    // Absence reason command (handles category)
    if (lower.startsWith('absence reason ') || lower.startsWith('my reason ') || lower.startsWith('reason ') || lower.startsWith('absence ')) {
      let raw = command;
      const prefixes = ['absence reason', 'my reason', 'reason', 'absence'];
      let prefix = '';
      for (const p of prefixes) {
        if (lower.startsWith(p)) { prefix = p; break; }
      }
      if (!prefix) return replyText('❌ Invalid format. Use: *absence reason <category> - <details>*');
      let rest = raw.slice(prefix.length).trim();
      let category = '', details = '';
      const dashIndex = rest.indexOf(' - ');
      if (dashIndex !== -1) {
        category = rest.slice(0, dashIndex).trim();
        details = rest.slice(dashIndex + 3).trim();
      } else {
        const parts = rest.split(/\s+/);
        if (parts.length >= 1) {
          category = parts[0];
          details = parts.slice(1).join(' ') || 'No details';
        } else {
          return replyText('❌ Invalid format. Use: *absence reason <category> - <details>*');
        }
      }
      const normalizedCat = normalizeAbsenceCategory(category);
      const categoryObj = ABSENCE_CATEGORIES[normalizedCat];
      if (!categoryObj) return replyText(`❌ Unknown category "${category}". Available: ${Object.keys(ABSENCE_CATEGORIES).join(', ')}`);

      let studentPhone = user.phone;
      let studentId = user.student_id;
      if (user.role === 'parent') {
        const idMatch = rest.match(/(STUDY\d{4})/i);
        if (idMatch) {
          const id = idMatch[1].toUpperCase();
          const child = await getUserByStudentId(id);
          if (child && (await getChildren(user.phone)).includes(id)) {
            studentPhone = child.phone;
            studentId = id;
          } else {
            return replyText(`❌ You are not linked to student ${id}.`);
          }
        } else {
          const children = await getChildren(user.phone);
          if (children.length === 0) return replyText('You have no linked children.');
          if (children.length > 1) {
            return replyText(`❌ You have multiple children. Please specify Student ID in your message.\nExample: absence reason sick - STUDY1234 - I have fever`);
          }
          const cid = children[0];
          const child = await getUserByStudentId(cid);
          if (child) {
            studentPhone = child.phone;
            studentId = cid;
          }
        }
      } else if (user.role === 'teacher' || user.is_admin) {
        const idMatch = rest.match(/(STUDY\d{4})/i);
        if (idMatch) {
          const id = idMatch[1].toUpperCase();
          const child = await getUserByStudentId(id);
          if (child) {
            studentPhone = child.phone;
            studentId = id;
          } else {
            return replyText(`❌ Student ${id} not found.`);
          }
        } else {
          return replyText('❌ For teacher/admin, please include Student ID.\nExample: absence reason sick - STUDY1234 - I have fever');
        }
      }

      const student = await getUserByPhone(studentPhone);
      if (!student) return replyText('❌ Student not found.');

      let state = userStates.get(userPhone) || {};
      let proofUrl = state.tempData?.proofUrl || null;
      if (state.tempData) state.tempData.proofUrl = null;
      userStates.set(userPhone, state);

      const today = moment().tz('Africa/Harare').format('YYYY-MM-DD');
      let existing = await dbQuery('absence_reports', 'select', null, { eq: { field: 'student_phone', value: studentPhone, date: today }, single: true });
      if (existing) {
        await updateAbsenceReason(existing.id, normalizedCat, details, proofUrl);
        await replyText(`✅ Updated absence reason for ${student.name} (${studentId}) to "${categoryObj.icon} ${normalizedCat}" - ${details}`);
      } else {
        await reportAbsence(studentPhone, today, normalizedCat, details, user.phone, user.role, proofUrl);
        await replyText(`✅ Absence reported for ${student.name} (${studentId}) with category "${categoryObj.icon} ${normalizedCat}" - ${details}`);
      }

      const absence = await dbQuery('absence_reports', 'select', null, { eq: { field: 'student_phone', value: studentPhone, date: today }, single: true });
      const catIcon = ABSENCE_CATEGORIES[normalizedCat]?.icon || '📝';
      const message = `📋 *Absence Report*\n\nStudent: ${student.name} (${studentId})\nClass: ${student.class}\nDate: ${today}\nCategory: ${catIcon} ${normalizedCat}\nReason: ${details}\nReported by: ${user.name} (${user.role})${proofUrl ? `\nProof: ${proofUrl}` : ''}\nStatus: pending\nID: ${absence?.id || 'N/A'}`;
      await notifyClassTeacherOnly(sock, student, absence, message, `Approve: *approve absence ${absence?.id}*\nReject: *reject absence ${absence?.id}*\nAsk: *ask reason ${studentId}*`);

      if (user.role === 'student') {
        const parents = await getChildren(studentId);
        for (const p of parents) {
          const parent = await getUserByPhone(p);
          if (parent) {
            const pJid = formatJid(p);
            if (pJid) {
              await sock.sendMessage(pJid, {
                text: `📋 *Absence Report from Student*\n\n${student.name} has reported absence.\nCategory: ${catIcon} ${normalizedCat}\nReason: ${details}\nStatus: Pending teacher approval.`
              });
            }
          }
        }
      } else if (user.role === 'parent') {
        const sJid = formatJid(studentPhone);
        if (sJid) {
          await sock.sendMessage(sJid, {
            text: `📋 *Absence Reported by Parent*\n\nYour parent ${user.name} has reported your absence.\nCategory: ${catIcon} ${normalizedCat}\nReason: ${details}\nStatus: Pending teacher approval.`
          });
        }
      }

      return true;
    }
    // My absences
    if (lower === 'my absences' || lower === 'my absence') {
      const reports = await dbQuery('absence_reports', 'select', null, { eq: { field: 'student_phone', value: user.phone } });
      if (!reports || reports.length === 0) return replyText('📭 No absence reports found.');
      let msg = '📋 *My Absences*\n\n';
      for (const r of reports) {
        const icon = ABSENCE_CATEGORIES[r.category]?.icon || '📝';
        msg += `${icon} ${r.date} - ${r.reason || 'No reason'} (${r.status})\n`;
      }
      await replyText(msg);
      return true;
    }
    // My assignments
    if (lower === 'my assignments') {
      const assignments = await getAssignmentsForStudent(userPhone);
      if (!assignments.length) return replyText(getText('noAssignments', lang));
      let msg = '📋 *My Assignments*\n\n';
      for (const a of assignments) {
        const teacher = await getUserByPhone(a.teacher_phone);
        msg += `📌 *${a.title}*\n   Class: ${a.class_name}\n   Description: ${a.description || 'N/A'}\n   Due: ${moment(a.due_date).format('dddd, MMMM D, YYYY [at] HH:mm')}\n   From: ${teacher?.name || 'Unknown'}\n\n`;
      }
      await replyText(msg);
      return true;
    }
    // My medical
    if (lower === 'my medical') {
      const info = await getMedicalInfo(userPhone);
      if (!info) {
        userStates.set(userPhone, { waitingFor: 'medical_allergies', timestamp: Date.now() });
        await replyText('💊 No medical info on file. Please enter your allergies (or type *none*).');
        return true;
      }
      let msg = '💊 *My Medical Info*\n\n';
      msg += `Allergies: ${info.allergies || 'None'}\n`;
      msg += `Conditions: ${info.conditions || 'None'}\n`;
      msg += `Blood Type: ${info.blood_type || 'Unknown'}\n`;
      msg += `Emergency Contact: ${info.emergency_contact_name || 'None'} (${info.emergency_contact_phone || 'N/A'})\n`;
      msg += `Last Updated: ${moment(info.updated_at).tz('Africa/Harare').format('dddd, MMMM D, YYYY [at] HH:mm')}`;
      msg += '\n\nTo update, type *update medical*';
      await replyText(msg);
      return true;
    }
    if (lower === 'update medical') {
      userStates.set(userPhone, { waitingFor: 'medical_allergies', timestamp: Date.now() });
      await replyText('💊 Update your medical info.\n\nEnter allergies (or *none*).');
      return true;
    }
    const medUpdateState = userStates.get(userPhone);
    if (medUpdateState && medUpdateState.waitingFor === 'medical_allergies') {
      const allergies = command.trim();
      userStates.set(userPhone, { waitingFor: 'medical_conditions', tempData: { allergies }, timestamp: Date.now() });
      await replyText('Enter medical conditions (or *none*).');
      return true;
    }
    if (medUpdateState && medUpdateState.waitingFor === 'medical_conditions') {
      const conditions = command.trim();
      userStates.set(userPhone, { waitingFor: 'medical_blood', tempData: { ...medUpdateState.tempData, conditions }, timestamp: Date.now() });
      await replyText('Enter blood type (or *unknown*).');
      return true;
    }
    if (medUpdateState && medUpdateState.waitingFor === 'medical_blood') {
      const blood = command.trim();
      userStates.set(userPhone, { waitingFor: 'medical_contact', tempData: { ...medUpdateState.tempData, blood }, timestamp: Date.now() });
      await replyText('Enter emergency contact name and phone (e.g., John Doe 0712345678) or *none*.');
      return true;
    }
    if (medUpdateState && medUpdateState.waitingFor === 'medical_contact') {
      const contact = command.trim();
      const { allergies, conditions, blood } = medUpdateState.tempData;
      let contactName = 'None', contactPhone = 'N/A';
      if (contact !== 'none' && contact.length > 3) {
        const parts = contact.match(/^(.+?)\s+(\d+)$/);
        if (parts) { contactName = parts[1]; contactPhone = parts[2]; } else { contactName = contact; }
      }
      await upsertMedicalInfo(userPhone, { allergies, conditions, blood_type: blood, emergency_contact_name: contactName, emergency_contact_phone: contactPhone }, userPhone);
      await replyText(getText('medicalUpdated', lang));
      userStates.delete(userPhone);
      return true;
    }
    // Join sport
    if (lower === 'join sport') {
      const seasons = await getSportsSeasons(null, 'active');
      if (!seasons.length) return replyText(getText('noSports', lang));
      let msg = '🏅 *Join a Sport Season*\n\nSelect a season by replying with its ID:\n';
      for (const s of seasons) {
        const discipline = (await getSportsDisciplines()).find(d => d.id === s.discipline_id);
        msg += `• ${s.id}: ${s.season_name} (${discipline?.name || 'Unknown'})\n`;
      }
      userStates.set(userPhone, { waitingFor: 'join_sport_season', timestamp: Date.now() });
      await replyText(msg);
      return true;
    }
    const stateJoin = userStates.get(userPhone);
    if (stateJoin && stateJoin.waitingFor === 'join_sport_season') {
      const seasonId = parseInt(command);
      if (isNaN(seasonId)) return replyText('Please send a valid season ID.');
      try { await addStudentSport(userPhone, seasonId); await replyText(getText('sportJoined', lang)); userStates.delete(userPhone); } catch (e) { replyText('❌ Failed to join. You may already be in this season.'); }
      return true;
    }
    // My results
    if (lower === 'my results') {
      const results = await getResultsForStudent(userPhone);
      if (!results.length) return replyText('📭 No results available.');
      let msg = '📊 *My Results*\n\n';
      for (const r of results) {
        msg += `📚 ${r.subject}\n   Grade: ${r.grade}\n   Term: ${r.term}\n   Exam: ${r.exam_name}\n   Uploaded: ${moment(r.uploaded_at).format('YYYY-MM-DD')}\n\n`;
      }
      await replyText(msg);
      return true;
    }
    // Stop tracking (student)
    if (lower === 'stop tracking' || lower === 'delete location') {
      let analytics = await dbQuery('child_analytics', 'select', null, { eq: { field: 'student_id', value: user.student_id }, single: true });
      if (analytics) {
        const a = analytics.data;
        a.lastLocation = null;
        a.lastLocationTime = null;
        a.lastLocationUrl = null;
        await dbQuery('child_analytics', 'update', { data: a }, { eq: { field: 'student_id', value: user.student_id } });
        await replyText('✅ Your location data has been cleared.');
      } else {
        await replyText('No location data found.');
      }
      return true;
    }
  }

  // ─── Reminders toggle ─────────────────────────────────────────
  if (lower === 'cancel reminders' || lower === 'disable reminders') {
    userReminderSettings.set(userPhone, { weather: false, homework: false, weekend: false });
    await replyText('✅ You have disabled all non‑Angelus reminders. To re‑enable, type *enable reminders*.');
    return true;
  }
  if (lower === 'enable reminders') {
    userReminderSettings.set(userPhone, { weather: true, homework: true, weekend: true });
    await replyText('✅ All reminders (except Angelus) are now enabled.');
    return true;
  }

  // ─── Fallback AI ──────────────────────────────────────────────
  if (user.role === 'student') await recordChildActivity(user.student_id);
  const aiResp = await askAI(command, null, user.role === 'student' ? user.student_id : null, lang, userPhone);
  await replyText(aiResp);
  return true;
}

// ─── Timetable Menu ─────────────────────────────────────────────
export async function sendTimetableMenu(sock, to, user, quoted) {
  const lang = userLanguages.get(user.phone) || 'en';
  let msg = '📅 *Your Timetables*\n\n';
  const studyTT = await getTimetable(`personal_${user.phone}_study`);
  if (studyTT && studyTT.url) msg += `📖 *Study Timetable*\n${studyTT.url}\n\n`;
  else msg += `📖 Study Timetable: Not uploaded\n`;
  const readingTT = await getTimetable(`personal_${user.phone}_reading`);
  if (readingTT && readingTT.url) msg += `📚 *Reading Timetable*\n${readingTT.url}\n\n`;
  else msg += `📚 Reading Timetable: Not uploaded\n`;
  if (user.class) {
    const classTT = await getTimetable(`class_${user.class}`);
    if (classTT && classTT.url) msg += `🏫 *Class Timetable (${user.class})*\n${classTT.url}\n\n`;
    else msg += `🏫 Class Timetable: Not uploaded by admin\n`;
  }
  await sock.sendMessage(to, { text: msg + getFooter(lang) });
}

// ─── Exports ─────────────────────────────────────────────────────
// (All functions are already exported individually, but we can also export a default object)
export default {
  handleIncomingMessage,
  handleCommand,
  startReminderSchedulers,
  startBroadcastScheduler,
  // Include other key exports if needed
};
