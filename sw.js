// Saitama Physio Fit - Service Worker
// Handles push notifications and PWA offline caching

const CACHE_NAME = 'saitama-physio-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/styles.css',
    '/logo.png'
];

// ── Install: cache static assets ──────────────────────────────────────────────
self.addEventListener('install', (event) => {
    console.log('[SW] Install');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
    self.skipWaiting();
});

// ── Activate: clean up old caches ─────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    console.log('[SW] Activate');
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// ── Fetch: serve from cache when offline ──────────────────────────────────────
self.addEventListener('fetch', (event) => {
    // Only intercept same-origin GET requests
    if (event.request.method !== 'GET') return;
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});

// ── Push: show native notification ────────────────────────────────────────────
self.addEventListener('push', (event) => {
    console.log('[SW] Push received');
    let data = { title: 'Saitama Physio Fit', body: 'Sie haben eine neue Benachrichtigung.' };
    if (event.data) {
        try { data = event.data.json(); } catch (e) { data.body = event.data.text(); }
    }
    event.waitUntil(
        self.registration.showNotification(data.title || 'Saitama Physio Fit', {
            body: data.body || '',
            icon: '/logo.png',
            badge: '/logo.png',
            tag: data.tag || 'saitama-notification',
            vibrate: [200, 100, 200],
            data: { url: data.url || '/' }
        })
    );
});

// ── Notification click: focus or open the app ─────────────────────────────────
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification click');
    event.notification.close();
    const targetUrl = (event.notification.data && event.notification.data.url) || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url === targetUrl && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) return clients.openWindow(targetUrl);
        })
    );
});

// ── Message: trigger local notification from page ─────────────────────────────
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        const { title, body, tag } = event.data;
        self.registration.showNotification(title || 'Saitama Physio Fit', {
            body: body || '',
            icon: '/logo.png',
            badge: '/logo.png',
            tag: tag || 'saitama-notification',
            vibrate: [200, 100, 200]
        });
    }
});
