import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env if present
if (fs.existsSync('.env')) {
  try {
    process.loadEnvFile('.env');
  } catch {
    const envContent = fs.readFileSync('.env', 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...values] = trimmed.split('=');
        if (key && values.length > 0) {
          process.env[key.trim()] = values.join('=').trim();
        }
      }
    }
  }
}

const BOT_TOKEN = process.env.BOT_TOKEN || '9095781903:AAHmhhxAIfQEPtwoFE8tewprM7evU7WUHDM';
const BASE_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;
const PORT = process.env.PORT || 3000;

// Persistent data paths
const CONFIG_FILE = path.join(__dirname, 'config.json');
const USERS_FILE = path.join(__dirname, 'users.json');
const LOGS_FILE = path.join(__dirname, 'logs.json');

// Memory State
let botInfo = null;
let config = {
  welcomeMessage: "👋 <b>សួស្តី {firstName}!</b>\n\n🎉 <b>Welcome to KHProAccount Bot!</b>\nសូមស្វាគមន៍មកកាន់ប្រព័ន្ធរបស់យើងខ្ញុំ! ✨",
  defaultReply: "សូមអរគុណ <b>{firstName}</b> សម្រាប់ការផ្ញើសារ! ប្រសិនបើចង់ចាប់ផ្តើមឡើងវិញ សូមចុច /start",
  botActive: true,
  buttons: []
};
let users = {};
let logs = [];

// Helper functions for storage
function loadData() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    } catch (e) {
      console.error('Error reading config.json:', e.message);
    }
  } else {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  }

  if (fs.existsSync(USERS_FILE)) {
    try {
      users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    } catch (e) {
      users = {};
    }
  }

  if (fs.existsSync(LOGS_FILE)) {
    try {
      logs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8'));
    } catch (e) {
      logs = [];
    }
  }
}

function formatUrl(url) {
  if (!url) return '';
  url = url.trim();
  if (url.startsWith('@')) {
    return `https://t.me/${url.substring(1)}`;
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  return url;
}

function saveConfig(newConfig) {
  if (newConfig.buttons && Array.isArray(newConfig.buttons)) {
    newConfig.buttons = newConfig.buttons.map(b => ({
      text: b.text ? b.text.trim() : '',
      url: formatUrl(b.url)
    }));
  }
  config = { ...config, ...newConfig };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

function saveUser(chatId, userInfo) {
  users[chatId] = {
    ...users[chatId],
    ...userInfo,
    lastSeen: new Date().toISOString()
  };
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

function addLog(chatId, from, text, reply) {
  const logEntry = {
    id: Date.now(),
    chatId,
    from,
    text,
    reply: reply ? (reply.length > 60 ? reply.slice(0, 60) + '...' : reply) : '',
    time: new Date().toLocaleTimeString('km-KH', { hour12: false })
  };
  logs.push(logEntry);
  if (logs.length > 100) logs.shift(); // keep last 100 logs
  fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2), 'utf-8');
}

loadData();

// --- Telegram Bot API Helpers ---
async function callTelegram(method, params = {}) {
  const url = `${BASE_URL}/${method}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return await response.json();
}

async function sendMessage(chatId, text, extraParams = {}) {
  try {
    const res = await callTelegram('sendMessage', {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      ...extraParams
    });

    if (!res.ok) {
      console.error(`❌ Telegram API Error (${chatId}):`, res.description);
      // Fallback: If it failed due to buttons or html parsing, try sending as plain text without buttons
      if (extraParams.reply_markup || extraParams.parse_mode) {
        console.log(`🔄 កំពុងសាកល្បងផ្ញើឡើងវិញដោយគ្មាន Markup សម្រាប់ chatId ${chatId}...`);
        const fallbackRes = await callTelegram('sendMessage', {
          chat_id: chatId,
          text: text.replace(/<[^>]*>/g, ''), // strip HTML tags
        });
        return fallbackRes;
      }
    }
    return res;
  } catch (error) {
    console.error(`Error sending message to ${chatId}:`, error.message);
  }
}

// --- Telegram Polling ---
async function startBotPolling() {
  console.log('🤖 កំពុងភ្ជាប់ទៅកាន់ Telegram API...');
  const me = await callTelegram('getMe');
  if (!me.ok) {
    console.error('❌ មិនអាចភ្ជាប់ទៅកាន់ Telegram Bot បានទេ:', me);
    return;
  }
  botInfo = me.result;
  console.log(`✅ Bot Online: @${botInfo.username} (${botInfo.first_name})`);

  let offset = 0;
  while (true) {
    try {
      const data = await callTelegram('getUpdates', {
        offset: offset,
        timeout: 25,
      });

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          offset = update.update_id + 1;

          if (update.message) {
            const msg = update.message;
            const chatId = msg.chat.id;
            const firstName = msg.from?.first_name || 'មិត្តភក្តិ';
            const username = msg.from?.username || '';
            const text = (msg.text || '').trim();

            saveUser(chatId, { firstName, username });

            if (!config.botActive) {
              console.log(`⏸️ Bot ត្រូវបានបិទជាបណ្តោះអាសន្ន (Paused). សារពី ${firstName}: "${text}"`);
              addLog(chatId, firstName, text, '[Bot Paused]');
              continue;
            }

            console.log(`📩 ទទួលបានសារពី [${firstName}]: "${text}"`);

            if (text.startsWith('/start')) {
              // Format welcome message
              const messageText = (config.welcomeMessage || '')
                .replace(/\{firstName\}/g, firstName);

              // Build inline keyboard if buttons exist
              const replyMarkup = {};
              if (Array.isArray(config.buttons) && config.buttons.length > 0) {
                const validButtons = config.buttons
                  .map(b => ({
                    text: b.text,
                    url: formatUrl(b.url)
                  }))
                  .filter(b => b.text && b.url && (b.url.startsWith('http://') || b.url.startsWith('https://')));

                if (validButtons.length > 0) {
                  replyMarkup.inline_keyboard = validButtons.map(b => ([{
                    text: b.text,
                    url: b.url
                  }]));
                }
              }

              const params = {};
              if (replyMarkup.inline_keyboard) {
                params.reply_markup = replyMarkup;
              }

              await sendMessage(chatId, messageText, params);
              addLog(chatId, firstName, text, messageText);
              console.log(`📤 បានឆ្លើយតបសារ Welcome ទៅកាន់ ${firstName}`);

            } else {
              // Default reply for other texts
              const replyText = (config.defaultReply || '')
                .replace(/\{firstName\}/g, firstName);

              await sendMessage(chatId, replyText);
              addLog(chatId, firstName, text, replyText);
            }
          }
        }
      }
    } catch (err) {
      console.error('⚠️ Polling error:', err.message);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

// --- Web Server & REST API ---
const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // Serve Static Web UI
  if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
    const htmlPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(htmlPath));
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('File not found');
    }
    return;
  }

  // API: Get Status
  if (req.method === 'GET' && pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      bot: botInfo,
      usersCount: Object.keys(users).length,
      messagesCount: logs.length,
      botActive: config.botActive
    }));
    return;
  }

  // API: Get Config
  if (req.method === 'GET' && pathname === '/api/config') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(config));
    return;
  }

  // API: Save Config
  if (req.method === 'POST' && pathname === '/api/config') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const updated = JSON.parse(body);
        saveConfig(updated);
        console.log('⚙️ បានកែប្រែការកំណត់ (Config updated via Web UI)!');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, config }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  // API: Get Logs
  if (req.method === 'GET' && pathname === '/api/logs') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(logs));
    return;
  }

  // API: Broadcast message
  if (req.method === 'POST' && pathname === '/api/broadcast') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { message } = JSON.parse(body);
        if (!message) throw new Error('Message is required');

        const chatIds = Object.keys(users);
        let sentCount = 0;
        for (const cid of chatIds) {
          try {
            await sendMessage(cid, message);
            sentCount++;
          } catch (err) {
            console.error(`Broadcast failed for ${cid}:`, err.message);
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, sentCount }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

function findAvailablePort(startPort) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(startPort, () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', () => {
      resolve(findAvailablePort(startPort + 1));
    });
  });
}

// Start Server and Bot cleanly
const initialPort = parseInt(process.env.PORT, 10) || 3000;
findAvailablePort(initialPort).then((availablePort) => {
  server.listen(availablePort, '0.0.0.0', () => {
    console.log(`🌐 Admin Web UI កំពុងដំណើរការនៅ: http://localhost:${availablePort}`);
    console.log(`👉 បើក Browser ហើយចូលទៅកាន់: http://localhost:${availablePort}`);
    startBotPolling();
  });
});


