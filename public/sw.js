// Little Foodies Service Worker
// Version is injected at build time via index.html meta tag
// Strategy: Network first for HTML, cache first for assets

const CACHE_NAME = 'little-foodies-v1'

// Assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/favicon.ico',
  '/favicon-192x192.png',
  '/favicon-512x512.png',
  '/apple-touch-icon.png',
  '/manifest.json',
]

// On install: pre-cache core assets
self.addEventListener('install', event => {
  // Skip waiting so new SW activates immediately
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS))
  )
})

// On activate: delete ALL old caches so users always get fresh code
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

// Fetch strategy:
// - HTML pages: network first, fall back to cache (ensures latest app code)
// - JS/CSS/images: cache first, fall back to network (fast loads)
// - Supabase / API calls: network only (never cache auth or data)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Never cache Supabase, Google APIs, or analytics
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('googletagmanager.com') ||
    url.hostname.includes('workers.dev')
  ) {
    return // Let browser handle it normally
  }

  // HTML pages — network first so users always get latest version
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the fresh HTML
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
          return response
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  // JS/CSS/fonts/images — cache first for performance
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached
      return fetch(event.request).then(response => {
        // Only cache successful responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response
        }
        const clone = response.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        return response
      })
    })
  )
})

// Listen for messages from the app
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting()
  }
})
