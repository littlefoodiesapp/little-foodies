import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useRestaurants } from '../hooks/useRestaurants'
import { useAuth } from '../hooks/useAuth'
import { toggleFavorite, getFavorites } from '../lib/api'

export default function ExplorePage() {
  const { restaurants, loading } = useRestaurants()
  const { session } = useAuth()
  const [favIds, setFavIds] = useState(new Set())

  useEffect(() => {
    if (!session) return
    getFavorites(session.user.id).then(({ data }) => {
      setFavIds(new Set((data || []).map(f => f.restaurant_id)))
    })
  }, [session])

  async function handleFav(e, restId) {
    e.preventDefault()
    if (!session) return alert('Sign in to save favorites!')
    const isFaved = favIds.has(restId)
    await toggleFavorite(session.user.id, restId, isFaved)
    setFavIds(prev => {
      const next = new Set(prev)
      isFaved ? next.delete(restId) : next.add(restId)
      return next
    })
  }

  if (loading) return <div style={{ padding: 32 }}>Loading restaurants...</div>

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 0 80px' }}>
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #f3f4f6' }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 4 }}>Little Foodies</h1>
        <p style={{ fontSize: 13, color: '#6b7280' }}>Family-friendly restaurants near you</p>
      </div>

      {restaurants.map(r => (
        <Link to={`/restaurant/${r.id}`} key={r.id}
          style={{ display: 'block', textDecoration: 'none', color: 'inherit',
            borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 2 }}>{r.name}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>{r.cuisine}</div>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 500,
                  background: r.status === 'verified' ? '#e6f7f5' : '#fefae8',
                  color: r.status === 'verified' ? '#065f55' : '#854d0e',
                  border: `0.5px solid ${r.status === 'verified' ? '#99ddd6' : '#fde9a0'}` }}>
                  {r.status === 'verified' ? '✓ Verified' : '⏳ Pending'}
                </span>
              </div>
              <button onClick={e => handleFav(e, r.id)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer',
                  color: favIds.has(r.id) ? '#f46ab8' : '#d1d5db' }}>
                {favIds.has(r.id) ? '♥' : '♡'}
              </button>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
