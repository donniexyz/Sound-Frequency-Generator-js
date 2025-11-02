// sw.js (Service Worker for offline support)
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open('soundgen-v1').then((cache) => {
            return cache.addAll([
                '/',
                '/index.html',
                '/app.js',
                '/manifest.json',
                '/icon.png'
            ]);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
