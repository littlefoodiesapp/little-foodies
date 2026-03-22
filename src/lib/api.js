import { supabase } from './supabase'

// ── AUTH ─────────────────────────────────────────────────────

export async function signUp(email, password, displayName) {
  return supabase.auth.signUp({
    email, password,
    options: { data: { full_name: displayName } }
  })
}

export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  })
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// ── PROFILE ──────────────────────────────────────────────────

export async function getProfile(userId) {
  return supabase.from('profiles').select('*').eq('id', userId).single()
}

export async function updateProfile(userId, updates) {
  return supabase.from('profiles').update(updates).eq('id', userId)
}

// ── RESTAURANTS ──────────────────────────────────────────────

export async function getRestaurants(filters = {}) {
  let query = supabase
    .from('restaurants')
    .select('*, amenities(*)')
    .order('name')
  if (filters.status) query = query.eq('status', filters.status)
  return query
}

export async function getRestaurant(id) {
  return supabase
    .from('restaurants')
    .select('*, amenities(*), reviews(*, profiles(display_name)), events(*)')
    .eq('id', id)
    .single()
}

export async function addRestaurant(restaurant) {
  const session = await getSession()
  return supabase.from('restaurants')
    .insert({ ...restaurant, submitted_by: session?.user?.id })
    .select()
    .single()
}

// ── AMENITY VOTES ─────────────────────────────────────────────

export async function castVote(restaurantId, amenityKey, vote) {
  const session = await getSession()
  return supabase.from('amenity_votes').insert({
    restaurant_id: restaurantId,
    amenity_key: amenityKey,
    vote,
    user_id: session?.user?.id
  })
}

export async function getUserVotes(userId, restaurantIds) {
  return supabase
    .from('amenity_votes')
    .select('restaurant_id, amenity_key, vote')
    .eq('user_id', userId)
    .in('restaurant_id', restaurantIds)
}

// ── FAVORITES ────────────────────────────────────────────────

export async function getFavorites(userId) {
  return supabase
    .from('favorites')
    .select('restaurant_id, restaurants(*)')
    .eq('user_id', userId)
}

export async function toggleFavorite(userId, restaurantId, isFaved) {
  if (isFaved) {
    return supabase.from('favorites')
      .delete().eq('user_id', userId).eq('restaurant_id', restaurantId)
  }
  return supabase.from('favorites')
    .insert({ user_id: userId, restaurant_id: restaurantId })
}

// ── REVIEWS ──────────────────────────────────────────────────

export async function addReview(restaurantId, rating, body, tags = []) {
  const session = await getSession()
  return supabase.from('reviews').insert({
    restaurant_id: restaurantId,
    user_id: session?.user?.id,
    rating, body, tags
  })
}

// ── EVENTS ───────────────────────────────────────────────────

export async function getEvents() {
  return supabase
    .from('events')
    .select('*, restaurants(name, emoji)')
    .gte('event_date', new Date().toISOString().split('T')[0])
    .order('event_date')
}

export async function rsvpEvent(eventId, userId, isGoing) {
  if (isGoing) {
    return supabase.from('event_rsvps')
      .delete().eq('event_id', eventId).eq('user_id', userId)
  }
  return supabase.from('event_rsvps')
    .insert({ event_id: eventId, user_id: userId })
}

// ── POINTS ───────────────────────────────────────────────────

export async function getPointsHistory(userId) {
  return supabase
    .from('points_ledger')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
}

// ── FAVORITES (additional helpers) ───────────────────────────

export async function addFavorite(restaurantId) {
  const session = await getSession()
  return supabase.from('favorites')
    .insert({ user_id: session?.user?.id, restaurant_id: restaurantId })
}

export async function removeFavorite(restaurantId) {
  const session = await getSession()
  return supabase.from('favorites')
    .delete()
    .eq('user_id', session?.user?.id)
    .eq('restaurant_id', restaurantId)
}
