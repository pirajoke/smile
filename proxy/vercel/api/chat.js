import { kv } from '@vercel/kv';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SMILE_TOKEN = process.env.SMILE_TOKEN || 'smile-2024-secret';
const RATE_LIMIT = 20; // per IP per hour
const RATE_WINDOW = 3600; // seconds
const DAILY_CAP = 500; // total requests per day

async function checkRateLimit(ip) {
  const key = `rl:${ip}`;
  const count = await kv.incr(key);
  if (count === 1) {
    await kv.expire(key, RATE_WINDOW);
  }
  return count <= RATE_LIMIT;
}

async function checkDailyCap() {
  const today = new Date().toISOString().slice(0, 10);
  const key = `daily:${today}`;
  const count = await kv.incr(key);
  if (count === 1) {
    await kv.expire(key, 86400);
  }
  return count <= DAILY_CAP;
}

export default async function handler(req, res) {
  // CORS: only allow chrome extensions
  const origin = req.headers.origin || '';
  if (origin.startsWith('chrome-extension://')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-smile-token');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Token validation
  const token = req.headers['x-smile-token'];
  if (token !== SMILE_TOKEN) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Daily cost cap
  if (!(await checkDailyCap())) {
    return res.status(429).json({ error: 'Daily limit reached. Try again tomorrow or add your own API key.' });
  }

  // Per-IP rate limit (persistent via KV)
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  if (!(await checkRateLimit(ip))) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
  }

  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing API key' });
  }

  try {
    const body = req.body;
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return res.status(400).json({ error: 'Invalid request: messages required' });
    }

    const maxTokens = Math.min(body.max_tokens || 512, 1024);
    const apiBody = {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: body.messages.slice(-10),
    };
    if (body.system) apiBody.system = body.system.slice(0, 5000);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(apiBody),
    });

    const data = await response.json();
    if (data.content && data.content[0]) {
      return res.json({ content: data.content[0].text });
    }
    return res.status(response.status).json({ error: data.error?.message || 'API error' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal error: ' + err.message });
  }
}
