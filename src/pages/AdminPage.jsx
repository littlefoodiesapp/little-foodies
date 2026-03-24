import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const font = { fontFamily: "'Montserrat', sans-serif" }

const inp = {
  width: '100%', padding: '10px 13px', border: '1.5px solid #e5e7eb',
  borderRadius: 10, fontSize: 16, boxSizing: 'border-box',
  outline: 'none', fontFamily: "'Montserrat', sans-serif",
  background: '#fafafa', marginTop: 4
}
const lbl = {
  fontSize: 11, fontWeight: 600, color: '#374151',
  textTransform: 'uppercase', letterSpacing: '.05em',
  fontFamily: "'Montserrat', sans-serif"
}

const EVENT_TYPES = [
  { value: 'family_night',    label: '🍽️ Family Night' },
  { value: 'cooking_class',   label: '👨‍🍳 Cooking Class' },
  { value: 'seasonal',        label: '🎉 Seasonal Event' },
  { value: 'community_meetup',label: '👨‍👩‍👧‍👦 Community Meetup' },
  { value: 'kids_discount',   label: '🏷️ Kids Discount Night' },
]

export default function AdminPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [isAdmin, setIsAdmin]       = useState(false)
  const [loading, setLoading]       = useState(true)
  const [activeTab, setActiveTab]   = useState('restaurants')
  const [toast, setToast]           = useState(null)

  // Restaurants
  const [restaurants, setRestaurants] = useState([])
  const [restFilter, setRestFilter]   = useState('pending')

  // Claims
  const [claims, setClaims]         = useState([])

  // Feedback
  const [feedback, setFeedback]     = useState([])

  // Photo Reports
  const [photoReports, setPhotoReports] = useState([])

  // Events
  const [events, setEvents]         = useState([])
  const [showEventForm, setShowEventForm] = useState(false)
  const [savingEvent, setSavingEvent] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [eventForm, setEventForm]   = useState({
    title: '', description: '', event_type: 'family_night',
    location_name: '', address: '', event_date: '', event_time: '',
    end_time: '', is_free: true, price: '', max_spots: ''
  })

  useEffect(() => {
    if (!user) { navigate('/'); return }
    checkAdmin()
  }, [user])

  async function checkAdmin() {
    const { data } = await supabase
      .from('profiles').select('is_admin').eq('id', user.id).single()
    if (!data?.is_admin) { navigate('/'); return }
    setIsAdmin(true)
    loadRestaurants()
    loadEvents()
    loadClaims()
    loadFeedback()
    loadPhotoReports()
    setLoading(false)
  }

  async function loadRestaurants() {
    const { data } = await supabase
      .from('restaurants')
      .select('*, amenities(*)')
      .order('created_at', { ascending: false })
    setRestaurants(data || [])
  }

  async function loadEvents() {
    const { data } = await supabase
      .from('events')
      .select('*, rsvps(count)')
      .order('event_date')
    setEvents(data || [])
  }

  async function loadClaims() {
    const { data } = await supabase
      .from('restaurant_claims')
      .select('*, profiles(display_name, first_name, last_name)')
      .order('created_at', { ascending: false })
    setClaims(data || [])
  }

  async function loadFeedback() {
    const { data } = await supabase
      .from('feedback')
      .select('*, profiles(display_name, first_name)')
      .order('created_at', { ascending: false })
    setFeedback(data || [])
  }

  async function loadPhotoReports() {
    const { data } = await supabase
      .from('photo_reports')
      .select('*, profiles(display_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setPhotoReports(data || [])
  }

  async function deleteReportedPhoto(report) {
    if (!window.confirm('Delete this kids menu photo? This cannot be undone.')) return
    // Delete from kids_menu_photos
    await supabase.from('kids_menu_photos')
      .delete().eq('photo_url', report.photo_url)
    // Try to delete from storage
    const path = report.photo_url.split('/restaurant-photos/')[1]
    if (path) await supabase.storage.from('restaurant-photos').remove([path])
    // Mark report as resolved
    await supabase.from('photo_reports')
      .update({ status: 'resolved' }).eq('id', report.id)
    setPhotoReports(prev => prev.filter(r => r.id !== report.id))
    showToast('Photo deleted ✓')
  }

  async function dismissReport(id) {
    await supabase.from('photo_reports')
      .update({ status: 'dismissed' }).eq('id', id)
    setPhotoReports(prev => prev.filter(r => r.id !== id))
    showToast('Report dismissed')
  }

  async function approveClaim(claim) {
    // Find matching restaurant
    const { data: restaurants } = await supabase
      .from('restaurants')
      .select('id, name')
      .ilike('name', '%' + claim.restaurant_name.split(' ')[0] + '%')

    let restaurantId = null
    if (restaurants && restaurants.length === 1) {
      restaurantId = restaurants[0].id
      // Link owner to restaurant
      await supabase.from('restaurants')
        .update({ owner_id: claim.user_id, status: 'claimed' })
        .eq('id', restaurantId)
    }

    await supabase.from('restaurant_claims')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', claim.id)

    // Update user account type
    await supabase.from('profiles')
      .update({ account_type: 'restaurant_owner' })
      .eq('id', claim.user_id)

    loadClaims()
    loadRestaurants()
    showToast('Claim approved ✓')
  }

  async function rejectClaim(id) {
    await supabase.from('restaurant_claims')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', id)
    loadClaims()
    showToast('Claim rejected')
  }

  function showToast(msg, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }

  // ── RESTAURANT ACTIONS ──────────────────────────────
  async function verifyRestaurant(id) {
    await supabase.from('restaurants').update({ status: 'verified' }).eq('id', id)
    setRestaurants(prev => prev.map(r => r.id === id ? { ...r, status: 'verified' } : r))
    showToast('Restaurant verified ✓')
  }

  async function unverifyRestaurant(id) {
    await supabase.from('restaurants').update({ status: 'pending' }).eq('id', id)
    setRestaurants(prev => prev.map(r => r.id === id ? { ...r, status: 'pending' } : r))
    showToast('Restaurant set to pending')
  }

  async function deleteRestaurant(id, name) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    await supabase.from('restaurants').delete().eq('id', id)
    setRestaurants(prev => prev.filter(r => r.id !== id))
    showToast('Restaurant deleted')
  }

  // ── EVENT ACTIONS ───────────────────────────────────
  function openNewEvent() {
    setEditingEvent(null)
    setEventForm({
      title: '', description: '', event_type: 'family_night',
      location_name: '', address: '', event_date: '', event_time: '18:00',
      end_time: '20:00', is_free: true, price: '', max_spots: ''
    })
    setShowEventForm(true)
  }

  function openEditEvent(event) {
    const d = new Date(event.event_date)
    const dateStr = d.toISOString().split('T')[0]
    const timeStr = d.toTimeString().slice(0, 5)
    const endD = event.end_time ? new Date(event.end_time) : null
    const endTimeStr = endD ? endD.toTimeString().slice(0, 5) : ''
    setEditingEvent(event)
    setEventForm({
      title: event.title || '',
      description: event.description || '',
      event_type: event.event_type || 'family_night',
      location_name: event.location_name || '',
      address: event.address || '',
      event_date: dateStr,
      event_time: timeStr,
      end_time: endTimeStr,
      is_free: event.is_free ?? true,
      price: event.price || '',
      max_spots: event.max_spots || ''
    })
    setShowEventForm(true)
  }

  async function saveEvent() {
    if (!eventForm.title || !eventForm.event_date) {
      showToast('Title and date are required', false); return
    }
    setSavingEvent(true)

    const eventDatetime = new Date(`${eventForm.event_date}T${eventForm.event_time || '18:00'}`)
    const endDatetime   = eventForm.end_time
      ? new Date(`${eventForm.event_date}T${eventForm.end_time}`)
      : null

    const payload = {
      title:         eventForm.title,
      description:   eventForm.description,
      event_type:    eventForm.event_type,
      location_name: eventForm.location_name,
      address:       eventForm.address,
      event_date:    eventDatetime.toISOString(),
      end_time:      endDatetime?.toISOString() || null,
      is_free:       eventForm.is_free,
      price:         eventForm.is_free ? 0 : Number(eventForm.price) || 0,
      max_spots:     eventForm.max_spots ? Number(eventForm.max_spots) : null,
      status:        'upcoming',
    }

    if (editingEvent) {
      await supabase.from('events').update(payload).eq('id', editingEvent.id)
      showToast('Event updated ✓')
    } else {
      await supabase.from('events').insert(payload)
      showToast('Event created ✓')
    }

    setShowEventForm(false)
    loadEvents()
    setSavingEvent(false)
  }

  async function cancelEvent(id) {
    if (!window.confirm('Cancel this event? RSVPs will not be automatically notified.')) return
    await supabase.from('events').update({ status: 'cancelled' }).eq('id', id)
    loadEvents()
    showToast('Event cancelled')
  }

  async function deleteEvent(id) {
    if (!window.confirm('Delete this event permanently?')) return
    await supabase.from('events').delete().eq('id', id)
    loadEvents()
    showToast('Event deleted')
  }

  if (loading) return (
    <div style={{ ...font, padding: 32, textAlign: 'center', color: '#6b7280' }}>
      Checking access...
    </div>
  )

  const filteredRestaurants = restaurants.filter(r =>
    restFilter === 'all' ? true : r.status === restFilter
  )

  return (
    <div style={{ ...font, paddingBottom: 40, background: '#f9fafb', minHeight: '100vh' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%',
          transform: 'translateX(-50%)',
          background: toast.ok ? '#00a994' : '#ef4444', color: '#fff',
          padding: '9px 18px', borderRadius: 20, fontSize: 13, fontWeight: 500,
          zIndex: 999, whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(0,0,0,.15)' }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #111827 0%, #374151 100%)',
        padding: '20px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff',
            fontFamily: "'IntroRust', cursive" }}>
            Admin Panel
          </div>
          <Link to="/" style={{ fontSize: 12, color: 'rgba(255,255,255,.7)',
            textDecoration: 'none' }}>← Back to app</Link>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>
          Little Foodies · Management Console
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', background: '#fff',
        borderBottom: '0.5px solid #e5e7eb' }}>
        {[
          { label: 'Total', count: restaurants.length, color: '#6b7280' },
          { label: 'Pending', count: restaurants.filter(r => r.status === 'pending').length, color: '#f57b46' },
          { label: 'Verified', count: restaurants.filter(r => r.status === 'verified').length, color: '#00a994' },
          { label: 'Events', count: events.filter(e => e.status === 'upcoming').length, color: '#0692e5' },
          { label: 'Claims', count: claims.filter(c => c.status === 'pending').length, color: '#f46ab8' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, padding: '12px 8px', textAlign: 'center',
            borderRight: '0.5px solid #f3f4f6' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: '#fff',
        borderBottom: '0.5px solid #e5e7eb' }}>
        {[
          { id: 'restaurants', label: '🍽️ Restaurants' },
          { id: 'events',      label: '🎉 Events' },
          { id: 'claims',      label: `🔑 Claims${claims.filter(c => c.status === 'pending').length > 0 ? ` (${claims.filter(c => c.status === 'pending').length})` : ''}` },
          { id: 'feedback',    label: `💬 Feedback${feedback.length > 0 ? ` (${feedback.length})` : ''}` },
          { id: 'reports',     label: `🚩 Reports${photoReports.filter(r => r.status === 'pending').length > 0 ? ` (${photoReports.filter(r => r.status === 'pending').length})` : ''}` },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ flex: 1, padding: '12px 0', background: 'none', border: 'none',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', ...font,
              color: activeTab === t.id ? '#f57b46' : '#6b7280',
              borderBottom: activeTab === t.id
                ? '2.5px solid #f57b46' : '2.5px solid transparent' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── RESTAURANTS TAB ──────────────────────────── */}
      {activeTab === 'restaurants' && (
        <div style={{ padding: '14px 16px 0' }}>

          {/* Filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {[
              { id: 'pending',  label: '⏳ Pending' },
              { id: 'verified', label: '✓ Verified' },
              { id: 'all',      label: 'All' },
            ].map(f => (
              <button key={f.id} onClick={() => setRestFilter(f.id)}
                style={{ padding: '6px 14px', borderRadius: 20, border: 'none',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', ...font,
                  background: restFilter === f.id ? '#111827' : '#f3f4f6',
                  color: restFilter === f.id ? '#fff' : '#6b7280' }}>
                {f.label}
              </button>
            ))}
          </div>

          {filteredRestaurants.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
              No {restFilter} restaurants
            </div>
          )}

          {filteredRestaurants.map(r => (
            <div key={r.id} style={{ background: '#fff', border: '0.5px solid #e5e7eb',
              borderRadius: 14, padding: '14px', marginBottom: 10 }}>

              <div style={{ display: 'flex', alignItems: 'flex-start',
                justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 20 }}>{r.emoji || '🍽️'}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
                      {r.name}
                    </span>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20,
                      fontWeight: 600,
                      background: r.status === 'verified' ? '#e6f7f5' : '#fefae8',
                      color: r.status === 'verified' ? '#065f55' : '#854d0e',
                      border: '0.5px solid ' + (r.status === 'verified' ? '#99ddd6' : '#fde9a0') }}>
                      {r.status === 'verified' ? '✓ Verified' : '⏳ Pending'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {r.cuisine} · {r.city}, {r.state} {r.zip}
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                    {r.address} · {r.phone}
                  </div>
                </div>
              </div>

              {/* Amenity summary */}
              {r.amenities && r.amenities.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  {r.amenities.map(a => (
                    <span key={a.amenity_key} style={{ fontSize: 10, padding: '2px 8px',
                      borderRadius: 20, fontWeight: 500,
                      background: a.yes_votes > a.no_votes ? '#e6f7f5' : '#fef0f8',
                      color: a.yes_votes > a.no_votes ? '#065f55' : '#9d1479' }}>
                      {a.amenity_key} {a.yes_votes}↑ {a.no_votes}↓
                    </span>
                  ))}
                </div>
              )}

              {/* OpenTable URL */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af',
                  textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
                  OpenTable URL (optional)
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    defaultValue={r.opentable_url || ''}
                    id={`ot-${r.id}`}
                    placeholder="https://www.opentable.com/restaurant-name"
                    style={{ flex: 1, padding: '7px 10px', border: '1px solid #e5e7eb',
                      borderRadius: 8, fontSize: 11, outline: 'none',
                      fontFamily: "'Montserrat', sans-serif", background: '#fafafa' }}
                  />
                  <button onClick={async () => {
                    const val = document.getElementById('ot-' + r.id)?.value || null
                    await supabase.from('restaurants')
                      .update({ opentable_url: val || null }).eq('id', r.id)
                    showToast('OpenTable link saved ✓')
                  }}
                    style={{ padding: '7px 12px', background: '#DA3743', border: 'none',
                      borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 600,
                      cursor: 'pointer', fontFamily: "'Montserrat', sans-serif",
                      whiteSpace: 'nowrap' }}>
                    Save
                  </button>
                </div>
              </div>

              {/* OpenTable URL */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af',
                  textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
                  OpenTable URL (optional)
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    defaultValue={r.opentable_url || ''}
                    onBlur={async e => {
                      const val = e.target.value.trim()
                      await supabase.from('restaurants')
                        .update({ opentable_url: val || null })
                        .eq('id', r.id)
                      showToast('OpenTable URL saved ✓')
                    }}
                    placeholder="https://www.opentable.com/restaurant-name"
                    style={{ flex: 1, padding: '7px 10px', border: '1px solid #e5e7eb',
                      borderRadius: 8, fontSize: 11, outline: 'none',
                      fontFamily: "'Montserrat', sans-serif", color: '#374151' }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8 }}>
                {r.status === 'pending' ? (
                  <button onClick={() => verifyRestaurant(r.id)}
                    style={{ flex: 2, padding: '9px 0', background: '#00a994',
                      border: 'none', borderRadius: 8, color: '#fff',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', ...font }}>
                    ✓ Verify restaurant
                  </button>
                ) : (
                  <button onClick={() => unverifyRestaurant(r.id)}
                    style={{ flex: 2, padding: '9px 0', background: '#f3f4f6',
                      border: 'none', borderRadius: 8, color: '#6b7280',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', ...font }}>
                    ↩ Set to pending
                  </button>
                )}
                <Link to={`/restaurant/${r.id}`}
                  style={{ flex: 1, padding: '9px 0', background: '#f3f4f6',
                    border: 'none', borderRadius: 8, color: '#374151',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    textDecoration: 'none', textAlign: 'center' }}>
                  View
                </Link>
                <button onClick={() => deleteRestaurant(r.id, r.name)}
                  style={{ padding: '9px 12px', background: '#fef2f2',
                    border: '0.5px solid #fecaca', borderRadius: 8, color: '#dc2626',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', ...font }}>
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── EVENTS TAB ───────────────────────────────── */}
      {activeTab === 'events' && (
        <div style={{ padding: '14px 16px 0' }}>

          <button onClick={openNewEvent}
            style={{ width: '100%', padding: '13px 0', background: '#f57b46',
              border: 'none', borderRadius: 12, color: '#fff', fontSize: 14,
              fontWeight: 600, cursor: 'pointer', ...font, marginBottom: 16,
              boxShadow: '0 4px 14px rgba(245,123,70,.3)' }}>
            + Create new event
          </button>

          {events.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
              No events yet — create one above!
            </div>
          )}

          {events.map(event => {
            const rsvpCount = event.rsvps?.[0]?.count || 0
            const isPast    = new Date(event.event_date) < new Date()
            return (
              <div key={event.id} style={{ background: '#fff',
                border: '0.5px solid #e5e7eb', borderRadius: 14,
                padding: '14px', marginBottom: 10,
                opacity: event.status === 'cancelled' ? 0.6 : 1 }}>

                <div style={{ display: 'flex', alignItems: 'flex-start',
                  justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700,
                      color: '#111827', marginBottom: 2 }}>
                      {event.title}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>
                      📍 {event.location_name} · {new Date(event.event_date).toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric',
                        hour: 'numeric', minute: '2-digit'
                      })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column',
                    alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20,
                      fontWeight: 600,
                      background: event.status === 'cancelled' ? '#fef2f2'
                        : isPast ? '#f3f4f6' : '#e6f7f5',
                      color: event.status === 'cancelled' ? '#dc2626'
                        : isPast ? '#6b7280' : '#065f55' }}>
                      {event.status === 'cancelled' ? 'Cancelled'
                        : isPast ? 'Past' : 'Upcoming'}
                    </span>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>
                      👥 {rsvpCount}{event.max_spots ? ` / ${event.max_spots}` : ''} RSVPs
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => openEditEvent(event)}
                    style={{ flex: 2, padding: '8px 0', background: '#f3f4f6',
                      border: 'none', borderRadius: 8, color: '#374151',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', ...font }}>
                    ✏️ Edit
                  </button>
                  {event.status !== 'cancelled' && !isPast && (
                    <button onClick={() => cancelEvent(event.id)}
                      style={{ flex: 2, padding: '8px 0', background: '#fefae8',
                        border: '0.5px solid #fde9a0', borderRadius: 8, color: '#854d0e',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer', ...font }}>
                      Cancel event
                    </button>
                  )}
                  <button onClick={() => deleteEvent(event.id)}
                    style={{ padding: '8px 12px', background: '#fef2f2',
                      border: '0.5px solid #fecaca', borderRadius: 8, color: '#dc2626',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', ...font }}>
                    🗑
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── CLAIMS TAB ──────────────────────────────── */}
      {activeTab === 'claims' && (
        <div style={{ padding: '14px 16px 0' }}>
          {claims.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
              No claim requests yet
            </div>
          )}
          {claims.map(claim => (
            <div key={claim.id} style={{ background: '#fff', border: '0.5px solid #e5e7eb',
              borderRadius: 14, padding: '14px', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start',
                justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 2 }}>
                    🍽️ {claim.restaurant_name}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    👤 {claim.profiles?.display_name || claim.profiles?.first_name || 'Unknown'}
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                    📧 {claim.business_email}
                    {claim.business_phone && ` · 📞 ${claim.business_phone}`}
                  </div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
                    Submitted {new Date(claim.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric'
                    })}
                  </div>
                </div>
                <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20,
                  fontWeight: 600,
                  background: claim.status === 'approved' ? '#e6f7f5'
                    : claim.status === 'rejected' ? '#fef2f2' : '#fefae8',
                  color: claim.status === 'approved' ? '#065f55'
                    : claim.status === 'rejected' ? '#dc2626' : '#854d0e' }}>
                  {claim.status === 'approved' ? '✓ Approved'
                    : claim.status === 'rejected' ? '✗ Rejected' : '⏳ Pending'}
                </span>
              </div>
              {claim.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => approveClaim(claim)}
                    style={{ flex: 2, padding: '9px 0', background: '#00a994',
                      border: 'none', borderRadius: 8, color: '#fff',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', ...font }}>
                    ✓ Approve claim
                  </button>
                  <button onClick={() => rejectClaim(claim.id)}
                    style={{ flex: 1, padding: '9px 0', background: '#fef2f2',
                      border: '0.5px solid #fecaca', borderRadius: 8, color: '#dc2626',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', ...font }}>
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── FEEDBACK TAB ────────────────────────────── */}
      {activeTab === 'feedback' && (
        <div style={{ padding: '14px 16px 0' }}>
          {feedback.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
              No feedback yet
            </div>
          )}
          {feedback.map(f => {
            const typeConfig = {
              suggestion: { icon: '💡', bg: '#fefae8', color: '#854d0e' },
              bug:        { icon: '🐛', bg: '#fef2f2', color: '#dc2626' },
              restaurant: { icon: '🍽️', bg: '#fff3ee', color: '#c2410c' },
              general:    { icon: '💬', bg: '#eff6ff', color: '#1e40af' },
            }
            const cfg = typeConfig[f.type] || typeConfig.general
            return (
              <div key={f.id} style={{ background: '#fff', border: '0.5px solid #e5e7eb',
                borderRadius: 14, padding: '14px', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, padding: '4px 10px',
                      background: cfg.bg, borderRadius: 20,
                      color: cfg.color, fontWeight: 600, fontSize: 11 }}>
                      {cfg.icon} {f.type}
                    </span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>
                      {f.profiles?.display_name || f.profiles?.first_name || 'User'}
                    </span>
                  </div>
                  <span style={{ fontSize: 10, color: '#9ca3af' }}>
                    {new Date(f.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric'
                    })}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                  {f.message}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── PHOTO REPORTS TAB ──────────────────────── */}
      {activeTab === 'reports' && (
        <div style={{ padding: '14px 16px 0' }}>
          {photoReports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 13, ...font }}>
              No pending photo reports 🎉
            </div>
          ) : (
            photoReports.map(report => (
              <div key={report.id} style={{ background: '#fff', border: '0.5px solid #e5e7eb',
                borderRadius: 14, overflow: 'hidden', marginBottom: 14 }}>
                {/* Photo preview */}
                <img src={report.photo_url} alt="Reported photo"
                  style={{ width: '100%', maxHeight: 280, objectFit: 'contain',
                    background: '#f3f4f6', display: 'block' }} />
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                      🚩 Reported as incorrect
                    </div>
                    <div style={{ fontSize: 10, color: '#9ca3af' }}>
                      {new Date(report.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 12 }}>
                    Reported by: {report.profiles?.display_name || 'Unknown'}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => dismissReport(report.id)}
                      style={{ flex: 1, padding: '9px 0', background: '#fff',
                        border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 12,
                        fontWeight: 600, color: '#6b7280', cursor: 'pointer', ...font }}>
                      Dismiss
                    </button>
                    <button onClick={() => deleteReportedPhoto(report)}
                      style={{ flex: 2, padding: '9px 0', background: '#ef4444',
                        border: 'none', borderRadius: 10, fontSize: 12,
                        fontWeight: 600, color: '#fff', cursor: 'pointer', ...font }}>
                      🗑️ Delete photo
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── EVENT FORM MODAL ─────────────────────────── */}
      {showEventForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 9999, overflowY: 'auto' }}>
          <div style={{ background: '#fff', margin: '20px auto',
            maxWidth: 480, borderRadius: 20, overflow: 'hidden' }}>

            {/* Modal header */}
            <div style={{ background: 'linear-gradient(135deg, #f57b46, #f46ab8)',
              padding: '16px 20px', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
                {editingEvent ? 'Edit event' : 'Create new event'}
              </div>
              <button onClick={() => setShowEventForm(false)}
                style={{ background: 'rgba(255,255,255,.2)', border: 'none',
                  borderRadius: '50%', width: 32, height: 32, color: '#fff',
                  fontSize: 16, cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <div style={{ padding: '20px' }}>

              {/* Title */}
              <div style={{ marginBottom: 14 }}>
                <div style={lbl}>Event title *</div>
                <input style={inp} value={eventForm.title}
                  onChange={e => setEventForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Family Night at Pizza Piazza 🍕" />
              </div>

              {/* Event type */}
              <div style={{ marginBottom: 14 }}>
                <div style={lbl}>Event type</div>
                <select value={eventForm.event_type}
                  onChange={e => setEventForm(p => ({ ...p, event_type: e.target.value }))}
                  style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                  {EVENT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div style={{ marginBottom: 14 }}>
                <div style={lbl}>Description</div>
                <textarea value={eventForm.description}
                  onChange={e => setEventForm(p => ({ ...p, description: e.target.value }))}
                  rows={3} placeholder="Tell parents what to expect..."
                  style={{ ...inp, resize: 'vertical', marginTop: 4 }} />
              </div>

              {/* Location */}
              <div style={{ marginBottom: 14 }}>
                <div style={lbl}>Venue name</div>
                <input style={inp} value={eventForm.location_name}
                  onChange={e => setEventForm(p => ({ ...p, location_name: e.target.value }))}
                  placeholder="Pizza Piazza" />
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={lbl}>Address</div>
                <input style={inp} value={eventForm.address}
                  onChange={e => setEventForm(p => ({ ...p, address: e.target.value }))}
                  placeholder="142 Morris Ave, Union, NJ 07083" />
              </div>

              {/* Date + Time */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <div style={{ flex: 2 }}>
                  <div style={lbl}>Date *</div>
                  <input style={inp} type="date" value={eventForm.event_date}
                    onChange={e => setEventForm(p => ({ ...p, event_date: e.target.value }))} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={lbl}>Start time</div>
                  <input style={inp} type="time" value={eventForm.event_time}
                    onChange={e => setEventForm(p => ({ ...p, event_time: e.target.value }))} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={lbl}>End time</div>
                  <input style={inp} type="time" value={eventForm.end_time}
                    onChange={e => setEventForm(p => ({ ...p, end_time: e.target.value }))} />
                </div>
              </div>

              {/* Free / Paid */}
              <div style={{ marginBottom: 14 }}>
                <div style={lbl}>Pricing</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  {[
                    { val: true,  label: '🆓 Free event' },
                    { val: false, label: '💳 Paid (coming soon)' },
                  ].map(o => (
                    <button key={String(o.val)}
                      onClick={() => setEventForm(p => ({ ...p, is_free: o.val }))}
                      style={{ flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 12,
                        fontWeight: 600, cursor: 'pointer', border: 'none',
                        background: eventForm.is_free === o.val ? '#e6f7f5' : '#f3f4f6',
                        color: eventForm.is_free === o.val ? '#065f55' : '#6b7280',
                        ...font }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Max spots */}
              <div style={{ marginBottom: 24 }}>
                <div style={lbl}>Max spots (leave blank for unlimited)</div>
                <input style={inp} type="number" value={eventForm.max_spots}
                  onChange={e => setEventForm(p => ({ ...p, max_spots: e.target.value }))}
                  placeholder="e.g. 40" />
              </div>

              {/* Save */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowEventForm(false)}
                  style={{ flex: 1, padding: '13px 0', background: '#fff',
                    border: '1.5px solid #e5e7eb', borderRadius: 12, fontSize: 14,
                    fontWeight: 600, color: '#6b7280', cursor: 'pointer', ...font }}>
                  Cancel
                </button>
                <button onClick={saveEvent} disabled={savingEvent}
                  style={{ flex: 2, padding: '13px 0', background: '#f57b46',
                    border: 'none', borderRadius: 12, fontSize: 14,
                    fontWeight: 600, color: '#fff', cursor: 'pointer',
                    opacity: savingEvent ? .6 : 1, ...font }}>
                  {savingEvent ? 'Saving…' : editingEvent ? 'Save changes' : 'Create event'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
