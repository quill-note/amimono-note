// オフライン対応用。ネット優先で最新を取りに行き、つながらないときだけキャッシュを使う。
// （GitHubで更新したのに反映されない…を避けるため）
const CACHE = 'amimono-note-v3';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // 同じ quill-note.github.io のほかのアプリ（writing-studio など）のキャッシュは消さない。
  // 自分の古いキャッシュ（amimono-note-…）だけを片付ける
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('amimono-note') && k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.open(CACHE).then(c => c.match(e.request).then(r => r || c.match('./index.html'))))
  );
});

// タイマー通知のボタン
self.addEventListener('notificationclick', e => {
  const n = e.notification, pid = n.data?.pid, at = Date.now();
  n.close();
  e.waitUntil((async () => {
    const wins = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (e.action === 'stop') {
      // 開いているアプリに「この時刻で止めて」と伝える。閉じていれば開いて止める
      if (wins.length) { wins.forEach(c => c.postMessage({ type: 'timer-stop', pid, at })); return; }
      return clients.openWindow(`./?stop=${encodeURIComponent(pid)}&at=${at}`);
    }
    // 通知そのものをタップ → その作品を開く
    if (wins.length) { wins[0].postMessage({ type: 'open', pid }); return wins[0].focus(); }
    return clients.openWindow(`./?open=${encodeURIComponent(pid)}`);
  })());
});
