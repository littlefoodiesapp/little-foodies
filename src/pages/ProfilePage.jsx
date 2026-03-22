import { useAuth } from '../hooks/useAuth'
import { getPointsHistory, signOut } from '../lib/api'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function ProfilePage() {
  const { profile, session } = useAuth()
  const [history, setHistory] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    if (!session) return
    getPointsHistory(session.user.id).then(({ data }) => setHistory(data || []))
  }, [session])

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  if (!profile) return <div style={{ padding: 32 }}>Loading profile...</div>

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 0 80px' }}>
      <div style={{ background: '#f57b46', padding: '24px 20px 20px' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, fontWeight: 500, color: '#fff', marginBottom: 12 }}>
          {(profile.display_name || 'U').charAt(0).toUpperCase()}
        </div>
        <div style={{ fontSize: 18, fontWeight: 500, color: '#fff' }}>{profile.display_name}</div>
        <div style={{ fontSize: 22, fontWeight: 500, color: '#fff', marginTop: 8 }}>
          {profile.points || 0} pts
        </div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <h2 style={{ fontSize: 14, fontWeight: 500, marginBottom: 10, textTransform: 'uppercase',
          letterSpacing: '.05em', color: '#6b7280' }}>Recent activity</h2>
        {history.length === 0 && (
          <p style={{ color: '#6b7280', fontSize: 14 }}>No activity yet. Start voting or adding restaurants!</p>
        )}
        {history.map(item => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between',
            padding: '10px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
            <span style={{ color: '#374151', textTransform: 'capitalize' }}>{item.action.replace('_', ' ')}</span>
            <span style={{ color: '#f57b46', fontWeight: 500 }}>+{item.points} pts</span>
          </div>
        ))}
      </div>

      <div style={{ padding: '20px 16px 0' }}>
        <button onClick={handleSignOut}
          style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: 8,
            background: '#fff', fontSize: 13, cursor: 'pointer', color: '#6b7280' }}>
          Sign out
        </button>
      </div>
    </div>
  )
}
