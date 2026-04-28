import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const font = { fontFamily: "'Montserrat', sans-serif" }

export default function FavoritesPage() {
  const { user } = useAuth()
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    loadFavorites()
  }, [user?.id])

  async function loadFavorites() {
    setLoading(true)
    const { data } = await supabase
      .from('favorites')
      .select('restaurant_id, restaurants(id, name, emoji, cuisine, city, state, status)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setFavorites(data || [])
    setLoading(false)
  }

  async function removeFavorite(restaurantId) {
    await supabase.from('favorites')
      .delete().eq('user_id', user.id).eq('restaurant_id', restaurantId)
    setFavorites(prev => prev.filter(f => f.restaurant_id !== restaurantId))
  }

  return (
    <div style={{ ...font, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '0.5px solid #e5e7eb',
        background: '#fff', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>
          ❤️ My Favorites
        </div>
        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
          {favorites.length > 0 ? `${favorites.length} saved restaurant${favorites.length !== 1 ? 's' : ''}` : 'Your saved restaurants'}
        </div>
      </div>

      <div style={{ padding: '14px 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af', fontSize: 13 }}>
            Loading favorites…
          </div>
        ) : !user ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>♡</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Sign in to see your favorites
            </div>
            <Link to="/login" style={{ padding: '10px 24px', background: '#f57b46',
              color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 600,
              textDecoration: 'none', display: 'inline-block' }}>
              Sign in
            </Link>
          </div>
        ) : favorites.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>♡</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              No favorites yet
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 20 }}>
              Tap the ♡ on any restaurant to save it here
            </div>
            <Link to="/" style={{ padding: '10px 24px', background: '#f57b46',
              color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 600,
              textDecoration: 'none', display: 'inline-block' }}>
              Explore restaurants
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {favorites.map(f => {
              const r = f.restaurants
              if (!r) return null
              return (
                <div key={f.restaurant_id} style={{ background: '#fff',
                  border: '0.5px solid #e5e7eb', borderRadius: 14,
                  overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
                  <Link to={'/restaurant/' + r.id}
                    style={{ flex: 1, textDecoration: 'none', color: 'inherit',
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 12,
                      background: '#fff3ee', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>
                      {r.emoji || '🍽️'}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 2 }}>
                        {r.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{r.cuisine}</div>
                      {r.city && (
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                          📍 {r.city}, {r.state}
                        </div>
                      )}
                    </div>
                  </Link>
                  <button onClick={() => removeFavorite(f.restaurant_id)}
                    style={{ padding: '0 16px', background: 'none', border: 'none',
                      cursor: 'pointer', fontSize: 22, color: '#f46ab8',
                      alignSelf: 'stretch', display: 'flex', alignItems: 'center' }}>
                    ♥
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
