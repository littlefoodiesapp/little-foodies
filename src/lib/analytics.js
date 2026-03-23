// analytics.js — Google Analytics 4 helper
// Place in: lf-cloudflare/src/lib/analytics.js

export function trackEvent(name, params = {}) {
  if (typeof window === 'undefined' || !window.gtag) return
  window.gtag('event', name, params)
}

export function trackPageView(path) {
  if (typeof window === 'undefined' || !window.gtag) return
  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: document.title,
  })
}

// Predefined events for Little Foodies
export const track = {
  // Auth
  signup:        (type) => trackEvent('sign_up', { method: type }),
  login:         ()     => trackEvent('login'),

  // Restaurants
  viewRestaurant: (name) => trackEvent('view_restaurant', { restaurant_name: name }),
  addRestaurant:  (name) => trackEvent('add_restaurant',  { restaurant_name: name }),
  makeReservation:(name) => trackEvent('make_reservation', { restaurant_name: name }),

  // Engagement
  voteAmenity:   (key)  => trackEvent('vote_amenity',  { amenity: key }),
  addReview:     ()     => trackEvent('add_review'),
  uploadPhoto:   ()     => trackEvent('upload_photo'),
  rsvpEvent:     (name) => trackEvent('rsvp_event',   { event_name: name }),
  inviteFriend:  ()     => trackEvent('invite_friend'),

  // Navigation
  searchZip:     (zip)  => trackEvent('search', { search_term: zip }),
}
