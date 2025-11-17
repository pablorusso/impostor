// Simple service worker for PWA functionality
const CACHE_NAME = 'impostor-game-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/apple-touch-icon.png',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Install event - cache essential resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.warn('[SW] Cache failed:', error);
      })
  );
});

// Fetch event - serve from cache when offline, network when online
self.addEventListener('fetch', (event) => {
  // Skip caching for API requests and dynamic content
  const shouldCache = (url) => {
    // Don't cache API requests
    if (url.includes('/api/')) return false;
    // Don't cache requests with query parameters (like ?t=timestamp)
    if (url.includes('?')) return false;
    // Only cache static assets and main pages
    return url.endsWith('/') || 
           url.endsWith('.html') || 
           url.endsWith('.js') || 
           url.endsWith('.css') || 
           url.endsWith('.png') || 
           url.endsWith('.jpg') || 
           url.endsWith('.ico') || 
           url.endsWith('.json');
  };

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache static resources, not API calls or dynamic content
        if (response.status === 200 && shouldCache(event.request.url)) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
        }
        return response;
      })
      .catch(() => {
        // Network failed, try to serve from cache
        return caches.match(event.request)
          .then((response) => {
            if (response) {
              return response;
            }
            // If not in cache, return a basic offline page
            if (event.request.destination === 'document') {
              return new Response(
                '<h1>Sin conexión</h1><p>No hay conexión a internet. Intenta más tarde.</p>',
                {
                  headers: { 'Content-Type': 'text/html' }
                }
              );
            }
            return new Response('Recurso no disponible sin conexión');
          });
      })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});