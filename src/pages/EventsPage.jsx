import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const font = { fontFamily: "'Montserrat', sans-serif" }

const EVENT_TYPES = {
  family_night:    { label: 'Family Night',      icon: '🍽️', color: '#fff3ee', border: '#fdc9b0', text: '#c2410c' },
  cooking_class:   { label: 'Cooking Class',     icon: '👨‍🍳', color: '#e6f7f5', border: '#99ddd6', text: '#065f55' },
  seasonal:        { label: 'Seasonal Event',    icon: '🎉', color: '#fefae8', border: '#fde9a0', text: '#854d0e' },
  community_meetup:{ label: 'Community Meetup',  icon: '👨‍👩‍👧‍👦', color: '#eff6ff', border: '#93c5fd', text: '#1e40af' },
  kids_discount:   { label: 'Kids Discount',     icon: '🏷️', color: '#fdf2f8', border: '#f0abfc', text: '#701a75' },
}

function formatDate(dateStr) {
  const d = new Date(dateStr)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const isToday = d.toDateString() === today.toDateString()
  const isTomorrow = d.toDateString() === tomorrow.toDateString()

  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  if (isToday) return `Today · ${time}`
  if (isTomorrow) return `Tomorrow · ${time}`
  return `${date} · ${time}`
}

function getDaysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today!'
  if (days === 1) return 'Tomorrow!'
  if (days <= 7) return `In ${days} days`
  return null
}

export default function EventsPage() {
  const { user } = useAuth()
  const [events, setEvents]       = useState([])
  const [myRsvps, setMyRsvps]     = useState(new Set())
  const [rsvpCounts, setRsvpCounts] = useState({})
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState('all')
  const [toast, setToast]         = useState(null)
  const [rsvping, setRsvping]     = useState(null)

  useEffect(() => {
    loadEvents()
  }, [])

  async function loadEvents() {
    const { data: eventsData } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'upcoming')
      .gte('event_date', new Date().toISOString())
      .order('event_date')

    setEvents(eventsData || [])

    // Load RSVP counts
    const { data: rsvpData } = await supabase
      .from('rsvps')
      .select('event_id, party_size')
      .eq('status', 'confirmed')

    if (rsvpData) {
      const counts = {}
      rsvpData.forEach(r => {
        counts[r.event_id] = (counts[r.event_id] || 0) + (r.party_size || 1)
      })
      setRsvpCounts(counts)
    }

    // Load my RSVPs
    if (user) {
      const { data: myData } = await supabase
        .from('rsvps')
        .select('event_id')
        .eq('user_id', user.id)
        .eq('status', 'confirmed')
      if (myData) setMyRsvps(new Set(myData.map(r => r.event_id)))
    }

    setLoading(false)
  }

  function showToast(msg, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }

  async function toggleRsvp(event) {
    if (!user) { showToast('Sign in to RSVP!', false); return }
    setRsvping(event.id)

    const isRsvped = myRsvps.has(event.id)

    if (isRsvped) {
      // Cancel RSVP
      await supabase.from('rsvps')
        .delete()
        .eq('event_id', event.id)
        .eq('user_id', user.id)
      setMyRsvps(prev => { const n = new Set(prev); n.delete(event.id); return n })
      setRsvpCounts(prev => ({ ...prev, [event.id]: Math.max(0, (prev[event.id] || 1) - 1) }))
      showToast('RSVP cancelled')
    } else {
      // Check if full
      const count = rsvpCounts[event.id] || 0
      if (event.max_spots && count >= event.max_spots) {
        showToast('Sorry, this event is full!', false)
        setRsvping(null)
        return
      }
      // Add RSVP
      const { error } = await supabase.from('rsvps').insert({
        event_id: event.id, user_id: user.id, party_size: 1, status: 'confirmed'
      })
      if (error) { showToast(error.message, false); setRsvping(null); return }

      setMyRsvps(prev => new Set([...prev, event.id]))
      setRsvpCounts(prev => ({ ...prev, [event.id]: (prev[event.id] || 0) + 1 }))

      // Award 30 points
      await supabase.from('points_ledger').insert({
        id: crypto.randomUUID(), user_id: user.id, action: 'event_rsvp', points: 30
      })
      const { data: profile } = await supabase
        .from('profiles').select('points').eq('id', user.id).single()
      if (profile) {
        await supabase.from('profiles')
          .update({ points: (profile.points || 0) + 30 })
          .eq('id', user.id)
      }
      showToast("You're going! +30 pts 🎉")
    }
    setRsvping(null)
  }

  const FILTERS = [
    { id: 'all', label: 'All events' },
    { id: 'family_night', label: '🍽️ Family nights' },
    { id: 'cooking_class', label: '👨‍🍳 Cooking' },
    { id: 'seasonal', label: '🎉 Seasonal' },
    { id: 'community_meetup', label: '👨‍👩‍👧‍👦 Meetups' },
    { id: 'kids_discount', label: '🏷️ Discounts' },
  ]

  const visible = filter === 'all' ? events : events.filter(e => e.event_type === filter)

  return (
    <div style={{ ...font, paddingBottom: 80, background: '#f9fafb', minHeight: '100vh' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 74, left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? '#00a994' : '#ef4444', color: '#fff',
          padding: '9px 18px', borderRadius: 20, fontSize: 13, fontWeight: 500,
          zIndex: 999, whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(0,0,0,.15)' }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #f57b46 0%, #f46ab8 100%)',
        padding: '28px 20px 20px' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#fff',
          fontFamily: "'IntroRust', cursive", marginBottom: 4 }}>
          Family Events
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.85)' }}>
          Discover family-friendly events near you
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px',
        overflowX: 'auto', scrollbarWidth: 'none', background: '#fff',
        borderBottom: '0.5px solid #e5e7eb' }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            style={{ padding: '6px 12px', borderRadius: 20, whiteSpace: 'nowrap',
              border: filter === f.id ? '1.5px solid #f57b46' : '1.5px solid #e5e7eb',
              background: filter === f.id ? '#fff3ee' : '#fff',
              color: filter === f.id ? '#c2410c' : '#6b7280',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', ...font, flexShrink: 0 }}>
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
            Loading events...
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              No events yet
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
              Check back soon — we're always planning something fun for families!
            </div>
          </div>
        )}

        {!loading && visible.map(event => {
          const type      = EVENT_TYPES[event.event_type] || EVENT_TYPES.family_night
          const isRsvped  = myRsvps.has(event.id)
          const count     = rsvpCounts[event.id] || 0
          const spotsLeft = event.max_spots ? event.max_spots - count : null
          const isFull    = spotsLeft !== null && spotsLeft <= 0
          const daysUntil = getDaysUntil(event.event_date)

          return (
            <div key={event.id} style={{ background: '#fff', border: '0.5px solid #e5e7eb',
              borderRadius: 16, overflow: 'hidden', marginBottom: 14 }}>

              {/* Event image or color header */}
              <div style={{ height: 80, background: type.color,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 16px' }}>
                <div style={{ fontSize: 40 }}>{type.icon}</div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  {daysUntil && (
                    <div style={{ background: isRsvped ? '#00a994' : '#f57b46',
                      color: '#fff', padding: '3px 10px', borderRadius: 20,
                      fontSize: 11, fontWeight: 700 }}>
                      {daysUntil}
                    </div>
                  )}
                  <div style={{ background: type.border, color: type.text,
                    padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>
                    {type.label}
                  </div>
                </div>
              </div>

              <div style={{ padding: '14px 16px' }}>
                {/* Title */}
                <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 6 }}>
                  {event.title}
                </div>

                {/* Date + location */}
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                  🕐 {formatDate(event.event_date)}
                  {event.end_time && (
                    <span> – {new Date(event.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                  )}
                </div>
                {event.location_name && (
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                    📍 {event.location_name}{event.address ? ` · ${event.address.split(',')[1]?.trim() || ''}` : ''}
                  </div>
                )}

                {/* Description */}
                <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, marginBottom: 12 }}>
                  {event.description}
                </div>

                {/* Price + spots */}
                <div style={{ display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700,
                      color: event.is_free ? '#065f55' : '#f57b46' }}>
                      {event.is_free ? '🆓 Free' : `$${event.price}`}
                    </span>
                    {!event.is_free && (
                      <span style={{ fontSize: 10, color: '#9ca3af' }}>
                        (paid events coming soon)
                      </span>
                    )}
                  </div>
                  {event.max_spots && (
                    <div style={{ fontSize: 11, color: isFull ? '#ef4444' : '#6b7280' }}>
                      {isFull
                        ? '❌ Full'
                        : spotsLeft <= 5
                          ? `🔥 Only ${spotsLeft} spots left!`
                          : `${count} / ${event.max_spots} going`}
                    </div>
                  )}
                </div>

                {/* RSVP button */}
                <button
                  onClick={() => toggleRsvp(event)}
                  disabled={rsvping === event.id || (isFull && !isRsvped)}
                  style={{ width: '100%', padding: '12px 0',
                    background: isRsvped ? '#e6f7f5' : isFull ? '#f3f4f6' : '#f57b46',
                    border: isRsvped ? '1.5px solid #99ddd6' : 'none',
                    borderRadius: 10, fontSize: 14, fontWeight: 600,
                    color: isRsvped ? '#065f55' : isFull ? '#9ca3af' : '#fff',
                    cursor: isFull && !isRsvped ? 'not-allowed' : 'pointer',
                    opacity: rsvping === event.id ? .6 : 1, ...font,
                    boxShadow: isRsvped || isFull ? 'none' : '0 4px 14px rgba(245,123,70,.3)' }}>
                  {rsvping === event.id
                    ? 'Processing…'
                    : isRsvped
                      ? "✓ You're going! (tap to cancel)"
                      : isFull
                        ? 'Event full'
                        : event.is_free
                          ? "RSVP free · +30 pts 🎉"
                          : "RSVP · +30 pts 🎉"}
                </button>

                {/* Points note */}
                {!isRsvped && !isFull && (
                  <div style={{ fontSize: 10, color: '#9ca3af',
                    textAlign: 'center', marginTop: 6 }}>
                    Earn 30 points when you RSVP!
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
