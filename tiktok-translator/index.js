// Перевод комментариев TikTok LIVE с казахского на русский в реальном времени.
// Запуск:  node index.js <ник_стримера>
// Оверлей для OBS / браузера:  http://localhost:3000

const http = require('http');
const { TikTokLiveConnection } = require('tiktok-live-connector');

const username = (process.argv[2] || process.env.TIKTOK_USER || '').replace(/^@/, '');
const PORT = Number(process.env.PORT || 3000);
const TARGET = process.env.TARGET_LANG || 'ru';
// ONLY_KAZAKH=1 — переводить только казахские комментарии, остальные пропускать
const ONLY_KAZAKH = process.env.ONLY_KAZAKH === '1';

if (!username) {
  console.log('Укажите ник стримера:  node index.js имя_пользователя');
  process.exit(1);
}

// ---------- Перевод (бесплатный веб-эндпоинт Google Translate) ----------
const cache = new Map();

async function translate(text) {
  if (cache.has(text)) return cache.get(text);
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t' +
    `&sl=auto&tl=${TARGET}&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Переводчик ответил ${res.status}`);
  const data = await res.json();
  const result = {
    text: (data[0] || []).map((p) => p[0]).join(''),
    lang: data[2] || '?',
  };
  if (cache.size > 2000) cache.clear();
  cache.set(text, result);
  return result;
}

// Буквы, которые есть в казахском, но нет в русском
const KAZAKH_LETTERS = /[әғқңөұүһіӘҒҚҢӨҰҮҺІ]/;

// ---------- Оверлей: страница + поток событий (SSE) ----------
const clients = new Set();
const history = [];

function broadcast(msg) {
  history.push(msg);
  if (history.length > 50) history.shift();
  const payload = `data: ${JSON.stringify(msg)}\n\n`;
  for (const res of clients) res.write(payload);
}

const PAGE = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"><title>Перевод чата</title>
<style>
  body{margin:0;padding:12px;font:20px/1.35 system-ui,sans-serif;background:transparent;color:#fff;
       display:flex;flex-direction:column;justify-content:flex-end;min-height:calc(100vh - 24px);overflow:hidden}
  .m{background:rgba(0,0,0,.6);border-radius:12px;padding:8px 12px;margin-top:8px;animation:in .25s ease-out}
  .u{color:#7fd3ff;font-weight:600}
  .o{opacity:.7;font-size:.85em}
  .t{font-weight:500}
  @keyframes in{from{opacity:0;transform:translateY(10px)}}
</style></head><body>
<script>
  const MAX = 8;
  function add(m){
    const d=document.createElement('div');d.className='m';
    const esc=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    d.innerHTML='<span class="u">'+esc(m.user)+':</span> <span class="t">'+esc(m.translated||m.original)+'</span>'+
      (m.translated?'<div class="o">'+esc(m.original)+'</div>':'');
    document.body.appendChild(d);
    while(document.body.querySelectorAll('.m').length>MAX)document.body.querySelector('.m').remove();
  }
  new EventSource('/events').onmessage=e=>add(JSON.parse(e.data));
</script></body></html>`;

http
  .createServer((req, res) => {
    if (req.url === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      for (const m of history.slice(-8)) res.write(`data: ${JSON.stringify(m)}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(PAGE);
  })
  .listen(PORT, () => console.log(`Оверлей: http://localhost:${PORT}`));

// ---------- Подключение к эфиру ----------
const connection = new TikTokLiveConnection(username, { processInitialData: false });

connection.on('chat', async (data) => {
  const user = data.user?.nickname || data.user?.uniqueId || 'гость';
  const original = (data.comment || '').trim();
  if (!original) return;

  let translated = '';
  try {
    if (!ONLY_KAZAKH || KAZAKH_LETTERS.test(original)) {
      const r = await translate(original);
      const isKazakh = r.lang === 'kk' || KAZAKH_LETTERS.test(original);
      if (ONLY_KAZAKH ? isKazakh : r.lang !== TARGET) {
        if (r.text && r.text.toLowerCase() !== original.toLowerCase()) translated = r.text;
      }
    }
  } catch (e) {
    console.error('Ошибка перевода:', e.message);
  }

  if (ONLY_KAZAKH && !translated) return;
  if (translated) {
    console.log(`\x1b[36m${user}\x1b[0m: \x1b[1m${translated}\x1b[0m\n   \x1b[2m(${original})\x1b[0m`);
  } else {
    console.log(`\x1b[36m${user}\x1b[0m: ${original}`);
  }
  broadcast({ user, original, translated });
});

connection.on('streamEnd', () => {
  console.log('Эфир завершён.');
  process.exit(0);
});
connection.on('disconnected', () => {
  console.log('Соединение потеряно, переподключаюсь через 5 с...');
  setTimeout(start, 5000);
});

async function start() {
  try {
    const state = await connection.connect();
    console.log(`Подключено к эфиру @${username} (room ${state.roomId}). Жду комментарии...`);
  } catch (e) {
    console.error('Не удалось подключиться:', e.message || e);
    console.error('Проверьте, что пользователь сейчас в эфире. Повтор через 15 с...');
    setTimeout(start, 15000);
  }
}

start();
