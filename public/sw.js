// Little Foodies Service Worker v3
// Minimal SW - handles updates only, no fetch interception

const CACHE_NAME = 'little-foodies-v3'

// On install: skip waiting so new SW activates immediately
self.addEventListener('install', event => {
  self.skipWaiting()
})

// On activate: clear all old caches and claim clients
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  )
})

// No fetch handler — let all requests go straight to network
// This avoids any SW interference with Supabase or page navigation

// Listen for skipWaiting message
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting()
})
