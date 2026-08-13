const express = require('express');
const path = require('path');
const fs = require('fs');

// Load .env if present (local only; on Render use Environment Variables)
(function loadEnvFile() {
  try {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;
    fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
      const t = line.trim();
      if (!t || t.startsWith('#')) return;
      const i = t.indexOf('=');
      if (i < 1) return;
      const key = t.slice(0, i).trim();
      let val = t.slice(i + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    });
  } catch (e) {}
})();

const app = express();
const PORT = process.env.PORT || 3000;
const GROK_API_KEY = process.env.GROK_API_KEY || process.env.XAI_API_KEY || '';
const GROK_BASE_URL = process.env.GROK_BASE_URL || 'https://api.x.ai/v1';
const CHAT_MODEL = process.env.GROK_CHAT_MODEL || 'grok-2-latest';
const IMAGE_MODEL = process.env.GROK_IMAGE_MODEL || 'grok-2-image';

function findHtmlFile() {
  const names = ['index.html', 'Index.html', 'Asteron-AI.html'];
  for (const name of names) {
    const full = path.join(__dirname, name);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'microphone=(self), camera=(self), geolocation=(self)');
  next();
});

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname), { index: false }));

app.get('/api/health', (req, res) => {
  const html = findHtmlFile();
  res.json({
    ok: true,
    hasKey: !!GROK_API_KEY,
    htmlFile: html ? path.basename(html) : null,
    files: fs.readdirSync(__dirname).filter(f => !f.startsWith('.')).slice(0, 30)
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    if (!GROK_API_KEY) {
      return res.status(500).json({
        error: 'GROK_API_KEY is not set. Render → Environment → add GROK_API_KEY'
      });
    }
    const { messages } = req.body;
    const grokRes = await fetch(`${GROK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROK_API_KEY}`
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: messages || [],
        temperature: 0.7
      })
    });
    const data = await grokRes.json();
    if (!grokRes.ok) {
      return res.status(grokRes.status).json({ error: data });
    }
    const reply =
      (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
    res.json({ reply, raw: data });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Chat request failed: ' + (err.message || 'unknown') });
  }
});

app.post('/api/image', async (req, res) => {
  try {
    if (!GROK_API_KEY) {
      return res.status(500).json({ error: 'GROK_API_KEY is not set on the server.' });
    }
    const { prompt } = req.body;
    const grokRes = await fetch(`${GROK_BASE_URL}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROK_API_KEY}`
      },
      body: JSON.stringify({ model: IMAGE_MODEL, prompt: prompt || '', n: 1 })
    });
    const data = await grokRes.json();
    if (!grokRes.ok) {
      return res.status(grokRes.status).json({ error: data });
    }
    const url =
      (data.data && data.data[0] && (data.data[0].url || data.data[0].b64_json)) || '';
    res.json({ url, raw: data });
  } catch (err) {
    console.error('Image error:', err);
    res.status(500).json({ error: 'Image generation failed: ' + (err.message || 'unknown') });
  }
});

app.post('/api/voice-token', (req, res) => {
  res.json({ ok: true });
});

app.post('/api/video', (req, res) => {
  res.status(501).json({ error: 'Video not connected yet.' });
});

// Serve app HTML for / and any unknown GET (SPA-style)
function sendApp(req, res) {
  const html = findHtmlFile();
  if (!html) {
    return res.status(404).type('html').send(
      '<h1>Not found</h1><p>No index.html in this folder on the server.</p>' +
      '<p>Put <b>index.html</b> + <b>server.js</b> + <b>package.json</b> in the <b>same</b> GitHub folder (repo root).</p>' +
      '<p>Files here: ' + fs.readdirSync(__dirname).join(', ') + '</p>'
    );
  }
  res.sendFile(html);
}

app.get('/', sendApp);
// Avoid stealing /api/* 
app.get(/^\/(?!api\/).*/, sendApp);

app.listen(PORT, '0.0.0.0', () => {
  console.log('AsteronAI listening on 0.0.0.0:' + PORT);
  console.log('HTML:', findHtmlFile() || 'MISSING');
  console.log('API key:', GROK_API_KEY ? 'YES' : 'NO');
  console.log('Dir files:', fs.readdirSync(__dirname).join(', '));
});
