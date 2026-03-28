import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const font = { fontFamily: "'Montserrat', sans-serif" }

const TIERS = [
  { name: 'Sprout',   icon: '🌱', min: 0,    max: 99   },
  { name: 'Explorer', icon: '🗺️', min: 100,  max: 499  },
  { name: 'Guide',    icon: '🧭', min: 500,  max: 999  },
  { name: 'Champion', icon: '🏆', min: 1000, max: 2499 },
  { name: 'Legend',   icon: '⭐', min: 2500, max: Infinity },
]

function getTier(pts) {
  return TIERS.find(t => pts >= t.min && pts <= t.max) || TIERS[0]
}

function formatName(p) {
  if (!p) return 'Parent'
  const first = p.first_name || p.display_name?.split(' ')[0] || ''
  const last  = p.last_name  || p.display_name?.split(' ')[1] || ''
  if (first && last) return `${first} ${last.charAt(0).toUpperCase()}.`
  if (first) return first
  return p.display_name || 'Parent'
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function FriendProfilePage() {
  const { friendId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile]       = useState(null)
  const [restaurants, setRestaurants] = useState([])
  const [reviews, setReviews]       = useState([])
  const [favorites, setFavorites]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [activeTab, setActiveTab]   = useState('restaurants')

  useEffect(() => {
    if (!friendId) return
    loadAll()
  }, [friendId])

  async function loadAll() {
    setLoading(true)
    const [profRes, restRes, revRes, favRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', friendId).single(),
      supabase.from('restaurants').select('id, name, emoji, cuisine, city, state, status, created_at')
        .eq('submitted_by', friendId).eq('status', 'approved').order('created_at', { ascending: false }),
      supabase.from('reviews').select('*, restaurants(id, name, emoji, city, state)')
        .eq('user_id', friendId).order('created_at', { ascending: false }),
      supabase.from('favorites').select('restaurants(id, name, emoji, cuisine, city, state, status)')
        .eq('user_id', friendId).order('created_at', { ascending: false }),
    ])
    setProfile(profRes.data)
    setRestaurants(restRes.data || [])
    setReviews(revRes.data || [])
    setFavorites((favRes.data || []).map(f => f.restaurants).filter(Boolean))
    setLoading(false)
  }

  if (loading) return (
    <div style={{ ...font, padding: 32, textAlign: 'center', color: '#9ca3af' }}>
      Loading profile…
    </div>
  )

  if (!profile) return (
    <div style={{ ...font, padding: 32, textAlign: 'center', color: '#9ca3af' }}>
      Profile not found.
    </div>
  )

  const tier = getTier(profile.points || 0)
  const name = formatName(profile)

  return (
    <div style={{ ...font, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px', borderBottom: '0.5px solid #e5e7eb', background: '#fff' }}>
        <button onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', fontSize: 20,
            cursor: 'pointer', color: '#374151', padding: 0 }}>←</button>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{name}'s Profile</div>
      </div>

      {/* Profile hero */}
      <div style={{ background: 'linear-gradient(135deg, #f57b46 0%, #f46ab8 100%)',
        padding: '28px 20px 24px', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 32, fontWeight: 800, color: '#fff',
          margin: '0 auto 12px', border: '3px solid rgba(255,255,255,0.4)' }}>
          {name.charAt(0).toUpperCase()}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
          {name}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.8)', marginBottom: 12 }}>
          {tier.icon} {tier.name} · {profile.points || 0} pts
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24 }}>
          {[
            { label: 'Added', value: restaurants.length },
            { label: 'Reviews', value: reviews.length },
            { label: 'Favorites', value: favorites.length },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.75)', fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: '#fff', borderBottom: '0.5px solid #e5e7eb' }}>
        {[
          { id: 'restaurants', label: `📍 Added (${restaurants.length})` },
          { id: 'reviews',     label: `⭐ Reviews (${reviews.length})` },
          { id: 'favorites',   label: `❤️ Favorites (${favorites.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ flex: 1, padding: '11px 0', background: 'none', border: 'none',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', ...font,
              color: activeTab === t.id ? '#f57b46' : '#6b7280',
              borderBottom: activeTab === t.id ? '2.5px solid #f57b46' : '2.5px solid transparent' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '14px 16px' }}>
        {/* Restaurants tab */}
        {activeTab === 'restaurants' && (
          restaurants.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 13 }}>
              {name} hasn't added any restaurants yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {restaurants.map(r => (
                <Link key={r.id} to={`/restaurant/${r.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: '#fff', border: '0.5px solid #e5e7eb',
                    borderRadius: 14, padding: '12px 14px',
                    display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 32 }}>{r.emoji || '🍽️'}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{r.name}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{r.cuisine}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.city}, {r.state}</div>
                    </div>
                    <span style={{ color: '#9ca3af', fontSize: 16 }}>›</span>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}

        {/* Reviews tab */}
        {activeTab === 'reviews' && (
          reviews.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 13 }}>
              {name} hasn't written any reviews yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {reviews.map(rev => (
                <Link key={rev.id} to={`/restaurant/${rev.restaurant_id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: '#fff', border: '0.5px solid #e5e7eb',
                    borderRadius: 14, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                        {rev.restaurants?.emoji || '🍽️'} {rev.restaurants?.name}
                      </div>
                      <div style={{ fontSize: 12 }}>{'⭐'.repeat(rev.rating || 0)}</div>
                    </div>
                    {rev.body && (
                      <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, marginBottom: 6 }}>
                        "{rev.body}"
                      </div>
                    )}
                    {rev.photos && rev.photos.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                        {rev.photos.map((url, i) => (
                          <img key={i} src={url} style={{ width: 56, height: 56,
                            objectFit: 'cover', borderRadius: 8, border: '0.5px solid #e5e7eb' }} />
                        ))}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{timeAgo(rev.created_at)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}

        {/* Favorites tab */}
        {activeTab === 'favorites' && (
          favorites.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 13 }}>
              {name} hasn't saved any favorites yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {favorites.map(r => (
                <Link key={r.id} to={`/restaurant/${r.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: '#fff', border: '0.5px solid #e5e7eb',
                    borderRadius: 14, padding: '12px 14px',
                    display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 32 }}>{r.emoji || '🍽️'}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{r.name}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{r.cuisine}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.city}, {r.state}</div>
                    </div>
                    <span style={{ color: '#9ca3af', fontSize: 16 }}>›</span>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
