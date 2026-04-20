const CACHE_NAME = 'dailyos-v1';
const ASSETS = [
  './app.html',
  './manifest.json',
  './icon.svg',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// ===== INSTALL — cache semua aset =====
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(() => {
        // Abaikan error jika ada aset eksternal yang gagal
      });
    })
  );
  self.skipWaiting();
});

// ===== ACTIVATE — hapus cache lama =====
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ===== FETCH — serve dari cache, fallback ke network =====
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        // Cache response baru untuk request yang berhasil
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Offline fallback ke app.html
      if (event.request.destination === 'document') {
        return caches.match('./app.html');
      }
    })
  );
});

// ===== NOTIFICATION CLICK =====
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Fokus ke tab yang sudah terbuka
      for (const client of clientList) {
        if (client.url.includes('app.html') && 'focus' in client) {
          return client.focus();
        }
      }
      // Buka tab baru kalau belum ada
      if (clients.openWindow) {
        return clients.openWindow('./app.html');
      }
    })
  );
});

// ===== SCHEDULED NOTIFICATION via postMessage =====
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { title, body, delay, tag } = event.data;
    setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        tag,
        icon: './icon.svg',
        badge: './icon.svg',
        vibrate: [200, 100, 200],
        requireInteraction: false,
        data: { url: './app.html' }
      });
    }, delay);
  }

  if (event.data && event.data.type === 'CANCEL_NOTIFICATION') {
    self.registration.getNotifications({ tag: event.data.tag }).then(notifs => {
      notifs.forEach(n => n.close());
    });
  }
});
