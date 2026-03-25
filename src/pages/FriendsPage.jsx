import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const font = { fontFamily: "'Montserrat', sans-serif" }

const ACTIVITY_CONFIG = {
  add_restaurant: { icon: '📍', color: '#00a994', label: 'added' },
  review:         { icon: '⭐', color: '#fbca3f', label: 'reviewed' },
  vote:           { icon: '🗳️', color: '#0692e5', label: 'voted on amenities at' },
  points:         { icon: '🏅', color: '#f57b46', label: 'earned points at' },
  share:          { icon: '📤', color: '#f46ab8', label: 'shared' },
}

export default function FriendsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab]     = useState('feed')
  const [friends, setFriends]         = useState([])
  const [pending, setPending]         = useState([])
  const [activity, setActivity]       = useState([])
  const [shares, setShares]           = useState([])
  const [searchEmail, setSearchEmail] = useState('')
  const [searchResult, setSearchResult] = useState(null)
  const [searching, setSearching]     = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [loading, setLoading]         = useState(true)
  const [toast, setToast]             = useState(null)

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    loadAll()
  }, [user])

  async function loadAll() {
    setLoading(true)
    await Promise.all([loadFriends(), loadActivity(), loadShares()])
    setLoading(false)
  }

  async function loadFriends() {
    const { data } = await supabase
      .from('friendships')
      .select(`
        id, status, requester_id, addressee_id,
        requester:profiles!friendships_requester_id_fkey(id, display_name, avatar_url, points),
        addressee:profiles!friendships_addressee_id_fkey(id, display_name, avatar_url, points)
      `)
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (data) {
      setFriends(data.filter(f => f.status === 'accepted'))
      setPending(data.filter(f => f.status === 'pending'))
    }
  }

  async function loadActivity() {
    // Get IDs of accepted friends
    const { data: friendData } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq('status', 'accepted')

    if (!friendData?.length) { setActivity([]); return }

    const friendIds = friendData.map(f =>
      f.requester_id === user.id ? f.addressee_id : f.requester_id
    )

    const { data } = await supabase
      .from('friend_activity')
      .select('*, profiles(display_name, avatar_url)')
      .in('user_id', friendIds)
      .order('created_at', { ascending: false })
      .limit(50)

    setActivity(data || [])
  }

  async function loadShares() {
    const { data } = await supabase
      .from('restaurant_shares')
      .select('*, from_profile:profiles!restaurant_shares_from_user_id_fkey(display_name, avatar_url), restaurants(id, name, emoji, city, state)')
      .eq('to_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    setShares(data || [])

    // Mark unread as read
    const unreadIds = (data || []).filter(s => !s.is_read).map(s => s.id)
    if (unreadIds.length > 0) {
      await supabase.from('restaurant_shares').update({ is_read: true }).in('id', unreadIds)
    }
  }

  async function searchByEmail() {
    if (!searchEmail.trim()) return
    setSearching(true)
    setSearchError(null)
    setSearchResult(null)

    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, points')
      .eq('id', (await supabase.auth.admin?.getUserByEmail?.(searchEmail.trim()))?.data?.user?.id || '00000000-0000-0000-0000-000000000000')
      .single()

    // Fallback: search via a function or by matching auth users
    // Since we can't query auth.users directly, search profiles by display_name or look up via edge function
    // Instead, we'll use a workaround: search display_name + show email match note
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, points')
      .neq('id', user.id)
      .limit(50)

    // We need to match email - check if any existing friendship or use auth lookup
    // Best approach: store email in profiles table or use a search endpoint
    // For now, match via the auth user lookup through the Supabase admin
    // Since we don't have admin access client-side, we'll look up by checking if
    // the email matches any user in auth by triggering a magic link check
    
    // Practical solution: add email column to profiles on signup
    // For now show a helpful message
    setSearchError('To search by email, we need to add email to profiles. See note below.')
    setSearching(false)
  }

  async function sendFriendRequest(profileId) {
    const { error } = await supabase.from('friendships').insert({
      requester_id: user.id,
      addressee_id: profileId,
      status: 'pending'
    })
    if (error) { showToast('Could not send request: ' + error.message, false); return }
    showToast('Friend request sent! 👋')
    setSearchResult(null)
    setSearchEmail('')
  }

  async function acceptRequest(friendship) {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendship.id)
    showToast('Friend added! 🎉')
    loadFriends()
  }

  async function declineRequest(id) {
    await supabase.from('friendships').update({ status: 'declined' }).eq('id', id)
    loadFriends()
  }

  async function removeFriend(id) {
    if (!window.confirm('Remove this friend?')) return
    await supabase.from('friendships').delete().eq('id', id)
    loadFriends()
    showToast('Friend removed')
  }

  function showToast(msg, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }

  function getFriend(friendship) {
    return friendship.requester_id === user.id
      ? friendship.addressee
      : friendship.requester
  }

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    const hrs  = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    if (hrs < 24) return `${hrs}h ago`
    if (days < 7) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const incomingRequests = pending.filter(f => f.addressee_id === user.id)
  const outgoingRequests = pending.filter(f => f.requester_id === user.id)
  const unreadShares = shares.filter(s => !s.is_read).length

  if (!user) return null

  return (
    <div style={{ ...font, paddingBottom: 100 }}>

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
      <div style={{ padding: '14px 16px', borderBottom: '0.5px solid #e5e7eb',
        background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Friends</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {incomingRequests.length > 0 && (
            <div style={{ background: '#f57b46', color: '#fff', borderRadius: '50%',
              width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700 }}>
              {incomingRequests.length}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: '#fff', borderBottom: '0.5px solid #e5e7eb' }}>
        {[
          { id: 'feed',    label: '📰 Feed' },
          { id: 'friends', label: `👥 Friends${friends.length > 0 ? ` (${friends.length})` : ''}` },
          { id: 'shared',  label: `📤 Shared${unreadShares > 0 ? ` (${unreadShares})` : ''}` },
          { id: 'add',     label: '➕ Add' },
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

        {/* ── FEED TAB ── */}
        {activeTab === 'feed' && (
          <>
            {/* Incoming requests banner */}
            {incomingRequests.length > 0 && (
              <div style={{ background: '#fff3ee', border: '1.5px solid #fdc9b0',
                borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#c2410c', marginBottom: 10 }}>
                  👋 {incomingRequests.length} friend request{incomingRequests.length !== 1 ? 's' : ''}
                </div>
                {incomingRequests.map(req => (
                  <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f3f4f6',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 600, color: '#f57b46', overflow: 'hidden', flexShrink: 0 }}>
                      {req.requester?.avatar_url
                        ? <img src={req.requester.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : (req.requester?.display_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#374151' }}>
                      {req.requester?.display_name}
                    </div>
                    <button onClick={() => acceptRequest(req)}
                      style={{ padding: '6px 12px', background: '#00a994', border: 'none',
                        borderRadius: 8, fontSize: 11, fontWeight: 600, color: '#fff', cursor: 'pointer', ...font }}>
                      Accept
                    </button>
                    <button onClick={() => declineRequest(req.id)}
                      style={{ padding: '6px 12px', background: '#f3f4f6', border: 'none',
                        borderRadius: 8, fontSize: 11, fontWeight: 600, color: '#6b7280', cursor: 'pointer', ...font }}>
                      Decline
                    </button>
                  </div>
                ))}
              </div>
            )}

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 13 }}>Loading…</div>
            ) : friends.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  No friends yet
                </div>
                <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 20 }}>
                  Add friends to see their activity here
                </div>
                <button onClick={() => setActiveTab('add')}
                  style={{ padding: '11px 24px', background: '#f57b46', border: 'none',
                    borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', ...font }}>
                  Add friends
                </button>
              </div>
            ) : activity.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 13 }}>
                No activity from friends yet — check back soon!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {activity.map(item => {
                  const cfg = ACTIVITY_CONFIG[item.activity_type] || ACTIVITY_CONFIG.vote
                  return (
                    <div key={item.id} style={{ background: '#fff', border: '0.5px solid #e5e7eb',
                      borderRadius: 14, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#f3f4f6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, fontWeight: 600, color: '#f57b46', overflow: 'hidden', flexShrink: 0 }}>
                        {item.profiles?.avatar_url
                          ? <img src={item.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : (item.profiles?.display_name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
                          <span style={{ fontWeight: 700 }}>{item.profiles?.display_name}</span>
                          {' '}
                          <span style={{ color: cfg.color, fontWeight: 600 }}>{cfg.icon} {cfg.label}</span>
                          {' '}
                          {item.restaurant_id ? (
                            <Link to={`/restaurant/${item.restaurant_id}`}
                              style={{ color: '#111827', fontWeight: 600, textDecoration: 'none' }}>
                              {item.restaurant_name}
                            </Link>
                          ) : item.restaurant_name}
                          {item.points > 0 && (
                            <span style={{ color: '#f57b46', fontWeight: 600 }}> +{item.points} pts</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>
                          {timeAgo(item.created_at)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ── FRIENDS TAB ── */}
        {activeTab === 'friends' && (
          <>
            {friends.length === 0 && outgoingRequests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 6 }}>No friends yet</div>
                <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 20 }}>Search by email to find friends</div>
                <button onClick={() => setActiveTab('add')}
                  style={{ padding: '11px 24px', background: '#f57b46', border: 'none',
                    borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', ...font }}>
                  Add friends
                </button>
              </div>
            ) : (
              <>
                {outgoingRequests.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af',
                      textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                      Pending requests
                    </div>
                    {outgoingRequests.map(req => (
                      <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                        background: '#f9fafb', borderRadius: 12, padding: '10px 12px', marginBottom: 8 }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#e5e7eb',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 16, fontWeight: 600, color: '#9ca3af' }}>
                          {(req.addressee?.display_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                            {req.addressee?.display_name}
                          </div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>Request pending…</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {friends.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af',
                      textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                      {friends.length} friend{friends.length !== 1 ? 's' : ''}
                    </div>
                    {friends.map(f => {
                      const friend = getFriend(f)
                      return (
                        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                          background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 12,
                          padding: '12px 14px', marginBottom: 8 }}>
                          <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#fff3ee',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 18, fontWeight: 700, color: '#f57b46', overflow: 'hidden', flexShrink: 0 }}>
                            {friend?.avatar_url
                              ? <img src={friend.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : (friend?.display_name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                              {friend?.display_name}
                            </div>
                            <div style={{ fontSize: 11, color: '#9ca3af' }}>
                              🏅 {friend?.points || 0} pts
                            </div>
                          </div>
                          <button onClick={() => removeFriend(f.id)}
                            style={{ padding: '6px 12px', background: '#f3f4f6', border: 'none',
                              borderRadius: 8, fontSize: 11, fontWeight: 600, color: '#9ca3af',
                              cursor: 'pointer', ...font }}>
                            Remove
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── SHARED TAB ── */}
        {activeTab === 'shared' && (
          <>
            {shares.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📤</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  No shared restaurants
                </div>
                <div style={{ fontSize: 13, color: '#9ca3af' }}>
                  When friends share restaurants with you they'll appear here
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {shares.map(share => (
                  <Link key={share.id} to={`/restaurant/${share.restaurant_id}`}
                    style={{ textDecoration: 'none' }}>
                    <div style={{ background: '#fff', border: '0.5px solid #e5e7eb',
                      borderRadius: 14, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ fontSize: 32 }}>
                        {share.restaurants?.emoji || '🍽️'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 2 }}>
                          {share.restaurant_name}
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>
                          Shared by <span style={{ fontWeight: 600 }}>{share.from_profile?.display_name}</span>
                          {share.message && <span> · "{share.message}"</span>}
                        </div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                          {timeAgo(share.created_at)}
                        </div>
                      </div>
                      <span style={{ color: '#9ca3af', fontSize: 16 }}>›</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── ADD FRIENDS TAB ── */}
        {activeTab === 'add' && (
          <>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 1.6 }}>
              Search for friends using their email address
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                value={searchEmail}
                onChange={e => { setSearchEmail(e.target.value); setSearchResult(null); setSearchError(null) }}
                onKeyDown={e => e.key === 'Enter' && searchByEmail()}
                placeholder="friend@email.com"
                type="email"
                style={{ flex: 1, padding: '12px 14px', border: '1.5px solid #e5e7eb',
                  borderRadius: 10, fontSize: 14, outline: 'none', ...font, background: '#fafafa' }}
              />
              <button onClick={searchByEmail} disabled={searching || !searchEmail.trim()}
                style={{ padding: '12px 16px', background: '#f57b46', border: 'none',
                  borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', ...font, opacity: (!searchEmail.trim() || searching) ? .6 : 1 }}>
                {searching ? '…' : 'Search'}
              </button>
            </div>

            {searchError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
                padding: '12px 14px', fontSize: 12, color: '#dc2626', marginBottom: 12 }}>
                {searchError}
              </div>
            )}

            {searchResult && (
              <div style={{ background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 14,
                padding: '14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#fff3ee',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, fontWeight: 700, color: '#f57b46' }}>
                  {(searchResult.display_name || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{searchResult.display_name}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>🏅 {searchResult.points || 0} pts</div>
                </div>
                <button onClick={() => sendFriendRequest(searchResult.id)}
                  style={{ padding: '9px 16px', background: '#f57b46', border: 'none',
                    borderRadius: 10, color: '#fff', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', ...font }}>
                  Add friend
                </button>
              </div>
            )}

            {/* Note about email search */}
            <div style={{ background: '#fefae8', border: '0.5px solid #fde9a0', borderRadius: 12,
              padding: '12px 14px', marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#854d0e', marginBottom: 4 }}>
                📧 One quick setup needed
              </div>
              <div style={{ fontSize: 11, color: '#92400e', lineHeight: 1.6 }}>
                To search by email we need to store emails in the profiles table. Run this in Supabase SQL editor:
              </div>
              <div style={{ background: '#fff', borderRadius: 8, padding: '8px 10px', marginTop: 8,
                fontSize: 10, color: '#374151', fontFamily: 'monospace', lineHeight: 1.8 }}>
                ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;<br/>
                UPDATE profiles SET email = auth.users.email FROM auth.users WHERE profiles.id = auth.users.id;
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
