const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const XAI_API_KEY = process.env.XAI_API_KEY;
const XAI_BASE_URL = 'https://api.x.ai/v1';

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname)));

// ---- Chat (Grok text) ----
app.post('/api/chat', async (req, res) => {
  try {
    if (!XAI_API_KEY) {
      return res.status(500).json({ error: 'XAI_API_KEY is not set on the server.' });
    }
    const { messages } = req.body;

    const xaiRes = await fetch(`${XAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${XAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-4.3',
        messages: messages || [],
        temperature: 0.7
      })
    });

    const data = await xaiRes.json();
    if (!xaiRes.ok) {
      return res.status(xaiRes.status).json({ error: data });
    }

    const reply = data.choices?.[0]?.message?.content || '';
    res.json({ reply, raw: data });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Chat request failed.' });
  }
});

// ---- Image generation (Grok Imagine) ----
app.post('/api/image', async (req, res) => {
  try {
    if (!XAI_API_KEY) {
      return res.status(500).json({ error: 'XAI_API_KEY is not set on the server.' });
    }
    const { prompt } = req.body;

    const xaiRes = await fetch(`${XAI_BASE_URL}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${XAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-2-image',
        prompt: prompt || ''
      })
    });

    const data = await xaiRes.json();
    if (!xaiRes.ok) {
      return res.status(xaiRes.status).json({ error: data });
    }

    const url = data.data?.[0]?.url || '';
    res.json({ url, raw: data });
  } catch (err) {
    console.error('Image error:', err);
    res.status(500).json({ error: 'Image generation failed.' });
  }
});

// ---- Voice token (placeholder — voice uses the browser's built-in Web Speech API, no key needed) ----
app.post('/api/voice-token', (req, res) => {
  res.json({ ok: true, note: 'Voice uses the browser Web Speech API and does not require a server token.' });
});

// ---- Video (not supported by a keyless xAI endpoint yet — placeholder) ----
app.post('/api/video', (req, res) => {
  res.status(501).json({ error: 'Video generation is not yet connected to a live API.' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`AsteronAI server running on port ${PORT}`);
});
