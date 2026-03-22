import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getRestaurant, castVote } from '../lib/api'
import { useAuth } from '../hooks/useAuth'

const AMENITIES = [
  { key: 'highchair',  label: "High chairs",       icon: '🪑' },
  { key: 'changing_f', label: "Women's changing",  icon: '🚺' },
  { key: 'changing_m', label: "Men's changing",    icon: '🚹' },
  { key: 'kidsmenu',   label: "Kids menu",         icon: '🍟' },
  { key: 'stroller',   label: "Stroller friendly", icon: '🛻' },
  { key: 'outdoor',    label: "Outdoor seating",   icon: '🌿' },
  { key: 'quiet',      label: "Quiet",             icon: '🤫' },
]

export default function RestaurantPage() {
  const { id }   = useParams()
  const { session } = useAuth()
  const [restaurant, setRestaurant] = useState(null)
  const [myVotes, setMyVotes] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getRestaurant(id).then(({ data }) => {
      setRestaurant(data)
      setLoading(false)
    })
  }, [id])

  async function handleVote(amenityKey, vote) {
    if (!session) return alert('Sign in to vote!')
    if (myVotes[amenityKey]) return
    await castVote(id, amenityKey, vote)
    setMyVotes(prev => ({ ...prev, [amenityKey]: vote }))
    // Optimistically update counts
    setRestaurant(prev => ({
      ...prev,
      amenities: prev.amenities.map(a =>
        a.amenity_key === amenityKey
          ? { ...a, yes_votes: a.yes_votes + (vote==='yes'?1:0), no_votes: a.no_votes + (vote==='no'?1:0) }
          : a
      )
    }))
  }

  if (loading) return <div style={{ padding: 32 }}>Loading...</div>
  if (!restaurant) return <div style={{ padding: 32 }}>Restaurant not found.</div>

  const amenityMap = Object.fromEntries(
    (restaurant.amenities || []).map(a => [a.amenity_key, a])
  )

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 0 40px' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 8 }}>
        <Link to="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: 13 }}>← Back</Link>
      </div>
      <div style={{ padding: '16px 16px 12px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>{restaurant.name}</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>{restaurant.cuisine}</p>
        <p style={{ fontSize: 13, color: '#6b7280' }}>📍 {restaurant.address}, {restaurant.city}, {restaurant.state}</p>
        {restaurant.hours && <p style={{ fontSize: 13, color: '#6b7280' }}>🕐 {restaurant.hours}</p>}
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        <h2 style={{ fontSize: 14, fontWeight: 500, marginBottom: 10, textTransform: 'uppercase',
          letterSpacing: '.05em', color: '#6b7280' }}>Amenities</h2>
        {AMENITIES.map(am => {
          const data    = amenityMap[am.key] || { yes_votes: 0, no_votes: 0 }
          const total   = data.yes_votes + data.no_votes
          const myVote  = myVotes[am.key]
          return (
            <div key={am.key} style={{ background: '#f9fafb', borderRadius: 10,
              padding: '12px 14px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span>{am.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{am.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6b7280' }}>
                  {total} votes
                </span>
              </div>
              {!myVote && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleVote(am.key, 'yes')}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 500,
                      cursor: 'pointer', background: '#e6f7f5', color: '#065f55', border: '1.5px solid #99ddd6' }}>
                    Yes ✓
                  </button>
                  <button onClick={() => handleVote(am.key, 'no')}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 500,
                      cursor: 'pointer', background: '#fef0f8', color: '#9d1479', border: '1.5px solid #f9b8e0' }}>
                    No ✕
                  </button>
                </div>
              )}
              {myVote && (
                <p style={{ fontSize: 12, color: '#00a994', fontWeight: 500 }}>
                  ✓ You voted {myVote}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
