// Caches the app shell so the installed app opens instantly; live data (url.json, relay) always goes to the network.
const CACHE = 'cursor-remote-v32';
const SHELL = ['./', 'index.html', 'i18n.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
    .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
    .then(clients => clients.forEach(c => c.postMessage({ type: 'cr-sw-updated', cache: CACHE }))));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.endsWith('url.json')) return;
  // Never cache-control the SW script itself via this handler's put — and always prefer network.
  // Some WebViews fail fetch(..., {cache:'no-store'}); fall back to a plain fetch before Cache Storage.
  const network = () => fetch(e.request, { cache: 'no-store' }).catch(() => fetch(e.request));
  e.respondWith(network()
    .then(res => {
      if (res && res.ok && !url.pathname.endsWith('sw.js')) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    })
    .catch(() => caches.match(e.request)));
});

// iOS revokes push permission if a push arrives without a visible notification, so every push shows one.
function showPush(text) {
  let d = {};
  try { d = JSON.parse(text); } catch {}
  const win = d.win || '';
  const actions = [];
  if (d.kind === 'waiting') {
    actions.push({ action: 'approve', title: 'Approve' }, { action: 'skip', title: 'Skip' }, { action: 'stop', title: 'Stop' });
  } else if (d.kind === 'done') {
    actions.push({ action: 'continue', title: 'Continue' }, { action: 'reply', title: 'Reply' });
  }
  return self.registration.showNotification(d.title || 'Cursor Remote', {
    body: d.body || '',
    tag: win || 'cursor-remote',
    renotify: true,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    data: { win, kind: d.kind || '' },
    actions,
  });
}
self.addEventListener('push', e => e.waitUntil(showPush(e.data ? e.data.text() : '')));

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const win = e.notification.data?.win || '';
  const action = e.action || '';
  const hash = win ? '#win=' + encodeURIComponent(win) : '';
  const extra = action === 'reply' ? (hash ? hash + '&reply=1' : '#reply=1')
    : action === 'continue' ? (hash ? hash + '&continue=1' : '#continue=1')
    : action === 'approve' ? (hash ? hash + '&approve=1' : '#approve=1')
    : action === 'skip' ? (hash ? hash + '&skip=1' : '#skip=1')
    : action === 'stop' ? (hash ? hash + '&stop=1' : '#stop=1')
    : (hash || '');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const client = list[0];
    if (client) {
      client.postMessage({ openWin: win, notifAction: action || '' });
      return client.focus();
    }
    return self.clients.openWindow('./' + (extra || ''));
  }));
});
