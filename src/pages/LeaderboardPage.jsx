import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const font = { fontFamily: "'Montserrat', sans-serif" }

const TIERS = [
  { name: 'Sprout',   icon: '🌱', min: 0    },
  { name: 'Explorer', icon: '🗺️', min: 100  },
  { name: 'Guide',    icon: '🧭', min: 500  },
  { name: 'Champion', icon: '🏆', min: 1000 },
  { name: 'Legend',   icon: '⭐', min: 2500 },
]

function getTierIcon(pts) {
  let icon = '🌱'
  for (const t of TIERS) { if (pts >= t.min) icon = t.icon }
  return icon
}

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' }

const TABS = [
  { id: 'alltime', label: 'All time' },
  { id: 'month',   label: 'This month' },
]

export default function LeaderboardPage() {
  const { user } = useAuth()
  const [leaders, setLeaders]   = useState([])
  const [myRank, setMyRank]     = useState(null)
  const [myEntry, setMyEntry]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('alltime')

  useEffect(() => { loadLeaderboard() }, [tab])

  async function loadLeaderboard() {
    setLoading(true)

    if (tab === 'alltime') {
      // All time — use profiles.points
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, first_name, points, avatar_url')
        .gt('points', 0)
        .order('points', { ascending: false })
        .limit(50)

      const list = (data || []).map((p, i) => ({
        rank: i + 1,
        id: p.id,
        name: p.display_name || p.first_name || 'Parent',
        points: p.points || 0,
        avatar: p.avatar_url,
        tierIcon: getTierIcon(p.points || 0),
      }))

      setLeaders(list)

      if (user) {
        const mine = list.find(l => l.id === user.id)
        if (mine) {
          setMyRank(mine.rank)
          setMyEntry(mine)
        } else {
          // User exists but not in top 50 — get their rank
          const { data: myProfile } = await supabase
            .from('profiles')
            .select('id, display_name, first_name, points, avatar_url')
            .eq('id', user.id)
            .single()
          if (myProfile) {
            const { count } = await supabase
              .from('profiles')
              .select('id', { count: 'exact', head: true })
              .gt('points', myProfile.points || 0)
            setMyRank((count || 0) + 1)
            setMyEntry({
              rank: (count || 0) + 1,
              id: myProfile.id,
              name: myProfile.display_name || myProfile.first_name || 'Parent',
              points: myProfile.points || 0,
              avatar: myProfile.avatar_url,
              tierIcon: getTierIcon(myProfile.points || 0),
            })
          }
        }
      }
    } else {
      // This month — sum points_ledger
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const { data } = await supabase
        .from('points_ledger')
        .select('user_id, points, profiles(id, display_name, first_name, avatar_url)')
        .gte('created_at', startOfMonth.toISOString())

      // Aggregate by user
      const map = {}
      ;(data || []).forEach(row => {
        const id = row.user_id
        if (!map[id]) {
          map[id] = {
            id,
            name: row.profiles?.display_name || row.profiles?.first_name || 'Parent',
            avatar: row.profiles?.avatar_url,
            points: 0,
          }
        }
        map[id].points += row.points || 0
      })

      const list = Object.values(map)
        .sort((a, b) => b.points - a.points)
        .slice(0, 50)
        .map((p, i) => ({
          ...p,
          rank: i + 1,
          tierIcon: getTierIcon(p.points),
        }))

      setLeaders(list)

      if (user) {
        const mine = list.find(l => l.id === user.id)
        setMyRank(mine?.rank || null)
        setMyEntry(mine || null)
      }
    }

    setLoading(false)
  }

  const topThree = leaders.slice(0, 3)
  const rest     = leaders.slice(3)

  return (
    <div style={{ ...font, paddingBottom: 80, background: '#f9fafb', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #f57b46 0%, #f46ab8 100%)',
        padding: '24px 20px 20px' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#fff',
          fontFamily: "'IntroRust', cursive", marginBottom: 4 }}>
          Leaderboard 🏆
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.85)' }}>
          Top parents in the Little Foodies community
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: '#fff',
        borderBottom: '0.5px solid #e5e7eb' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, padding: '12px 0', background: 'none', border: 'none',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', ...font,
              color: tab === t.id ? '#f57b46' : '#6b7280',
              borderBottom: tab === t.id ? '2.5px solid #f57b46' : '2.5px solid transparent' }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
          Loading...
        </div>
      ) : leaders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏅</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
            No activity yet this month
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
            Start voting on amenities, adding restaurants, and writing reviews to appear here!
          </div>
          <Link to="/" style={{ display: 'inline-block', marginTop: 20,
            padding: '10px 24px', background: '#f57b46', color: '#fff',
            borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            Start exploring
          </Link>
        </div>
      ) : (
        <>
          {/* Top 3 podium */}
          {topThree.length > 0 && (
            <div style={{ background: '#fff', padding: '24px 20px 20px',
              borderBottom: '0.5px solid #f3f4f6' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end',
                justifyContent: 'center', gap: 12 }}>
                {/* Reorder to show 2nd, 1st, 3rd */}
                {[topThree[1], topThree[0], topThree[2]].filter(Boolean).map((leader, idx) => {
                  const actualRank = leader.rank
                  const isFirst = actualRank === 1
                  const heights = { 1: 90, 2: 70, 3: 55 }
                  const bgColors = {
                    1: 'linear-gradient(135deg, #fbca3f, #f57b46)',
                    2: 'linear-gradient(135deg, #d1d5db, #9ca3af)',
                    3: 'linear-gradient(135deg, #fdba74, #ea580c)',
                  }
                  const isMe = user && leader.id === user.id

                  return (
                    <div key={leader.id} style={{ flex: 1, display: 'flex',
                      flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      {/* Avatar */}
                      <div style={{ position: 'relative' }}>
                        <div style={{ width: isFirst ? 64 : 52, height: isFirst ? 64 : 52,
                          borderRadius: '50%', background: leader.avatar ? 'transparent' : '#f3f4f6',
                          border: isMe ? '3px solid #f57b46' : '2px solid #e5e7eb',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          overflow: 'hidden', fontSize: isFirst ? 24 : 20,
                          fontWeight: 700, color: '#f57b46' }}>
                          {leader.avatar
                            ? <img src={leader.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : leader.name.charAt(0).toUpperCase()
                          }
                        </div>
                        <div style={{ position: 'absolute', bottom: -4, right: -4,
                          fontSize: 16 }}>{leader.tierIcon}</div>
                      </div>

                      {/* Name */}
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#111827',
                        textAlign: 'center', maxWidth: 80,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {isMe ? 'You' : leader.name.split(' ')[0]}
                      </div>

                      {/* Points */}
                      <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>
                        {leader.points.toLocaleString()} pts
                      </div>

                      {/* Podium block */}
                      <div style={{ width: '100%', height: heights[actualRank] || 55,
                        background: bgColors[actualRank] || bgColors[3],
                        borderRadius: '8px 8px 0 0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 24 }}>
                        {MEDAL[actualRank]}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* My rank banner (if not in top 3) */}
          {myEntry && myRank > 3 && (
            <div style={{ margin: '12px 16px 0', background: '#fff3ee',
              border: '1.5px solid #fdc9b0', borderRadius: 12,
              padding: '12px 14px', display: 'flex',
              alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#f57b46',
                minWidth: 32, textAlign: 'center' }}>#{myRank}</div>
              <div style={{ width: 36, height: 36, borderRadius: '50%',
                background: '#f3f4f6', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#f57b46',
                flexShrink: 0 }}>
                {myEntry.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                  Your rank {myEntry.tierIcon}
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>
                  {myEntry.points.toLocaleString()} points
                </div>
              </div>
              <Link to="/tiers" style={{ fontSize: 11, fontWeight: 600,
                color: '#f57b46', textDecoration: 'none' }}>
                View tiers ›
              </Link>
            </div>
          )}

          {/* Ranks 4+ */}
          <div style={{ padding: '12px 16px 0' }}>
            {rest.map(leader => {
              const isMe = user && leader.id === user.id
              return (
                <div key={leader.id} style={{ display: 'flex', alignItems: 'center',
                  gap: 12, padding: '10px 14px', marginBottom: 8,
                  background: isMe ? '#fff3ee' : '#fff',
                  border: isMe ? '1.5px solid #fdc9b0' : '0.5px solid #e5e7eb',
                  borderRadius: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700,
                    color: isMe ? '#f57b46' : '#9ca3af',
                    minWidth: 28, textAlign: 'center' }}>
                    #{leader.rank}
                  </div>
                  <div style={{ width: 36, height: 36, borderRadius: '50%',
                    background: leader.avatar ? 'transparent' : '#f3f4f6',
                    border: '1.5px solid #e5e7eb',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700, color: '#f57b46',
                    overflow: 'hidden', flexShrink: 0 }}>
                    {leader.avatar
                      ? <img src={leader.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : leader.name.charAt(0).toUpperCase()
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                      {isMe ? 'You' : leader.name} {leader.tierIcon}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>
                      {leader.points.toLocaleString()} points
                    </div>
                  </div>
                  {isMe && (
                    <span style={{ fontSize: 10, background: '#f57b46', color: '#fff',
                      padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                      You
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* CTA */}
          <div style={{ margin: '16px', background: '#fff',
            border: '0.5px solid #e5e7eb', borderRadius: 12, padding: '16px',
            textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              Climb the leaderboard! 🚀
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14, lineHeight: 1.6 }}>
              Vote on amenities (+5 pts), add restaurants (+50 pts), write reviews (+25 pts)
            </div>
            <Link to="/" style={{ display: 'inline-block', padding: '10px 24px',
              background: '#f57b46', color: '#fff', borderRadius: 10,
              fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              Start earning points
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
