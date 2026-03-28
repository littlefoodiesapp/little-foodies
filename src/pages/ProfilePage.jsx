import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const font = { fontFamily: "'Montserrat', sans-serif" }

// Module-level cache so profile survives navigation
let cachedProfile = null
let cachedHistory = []
let cachedFavorites = []

const TIERS = [
  { name: 'Sprout',   icon: '🌱', min: 0,    max: 99,   color: '#86efac', text: '#166534' },
  { name: 'Explorer', icon: '🗺️', min: 100,  max: 499,  color: '#93c5fd', text: '#1e40af' },
  { name: 'Guide',    icon: '🧭', min: 500,  max: 999,  color: '#fcd34d', text: '#92400e' },
  { name: 'Champion', icon: '🏆', min: 1000, max: 2499, color: '#f97316', text: '#7c2d12' },
  { name: 'Legend',   icon: '⭐', min: 2500, max: Infinity, color: '#f46ab8', text: '#831843' },
]

function getTier(pts) {
  return TIERS.findLast(t => pts >= t.min) || TIERS[0]
}
function getNextTier(pts) {
  return TIERS.find(t => t.min > pts) || null
}

function formatDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

const ACTION_LABELS = {
  vote:            { label: 'Voted on amenity',    icon: '🗳️', color: '#0692e5' },
  streak_bonus:    { label: 'Streak bonus!',        icon: '🔥', color: '#f57b46' },
  add_restaurant:  { label: 'Added a restaurant',   icon: '📍', color: '#00a994' },
  review:          { label: 'Wrote a review',        icon: '⭐', color: '#fbca3f' },
  photo:           { label: 'Added a photo',         icon: '📸', color: '#f46ab8' },
  event_rsvp:      { label: 'RSVP\'d to an event',  icon: '🎉', color: '#0692e5' },
  referral:        { label: 'Referred a friend',     icon: '👥', color: '#00a994' },
}

export default function ProfilePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const fileRef  = useRef()

  const [profile, setProfile]       = useState(cachedProfile)
  const [history, setHistory]       = useState(cachedHistory)
  const [favorites, setFavorites]   = useState(cachedFavorites)
  const [uploading, setUploading]   = useState(false)
  const [editName, setEditName]     = useState(false)
  const [nameVal, setNameVal]       = useState('')
  const [loading, setLoading]       = useState(!cachedProfile)
  const [activeTab, setActiveTab]   = useState('overview')
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [editForm, setEditForm]     = useState({})
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackType, setFeedbackType] = useState('suggestion')
  const [feedbackMsg, setFeedbackMsg]   = useState('')
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [sendingFeedback, setSendingFeedback] = useState(false)

  useEffect(() => {
    // Always clear cache if profile is null so we always re-fetch
    if (!cachedProfile) {
      cachedHistory   = []
      cachedFavorites = []
    }
    // Clear stale cache on logout
    if (window.__lf_clear_profile_cache) {
      cachedProfile   = null
      cachedHistory   = []
      cachedFavorites = []
      window.__lf_clear_profile_cache = false
    }
    if (user) {
      setLoading(true)
      loadAll()
    } else {
      // Not logged in — reset local state too
      setProfile(null)
      setHistory([])
      setFavorites([])
      setLoading(false)
    }
  }, [user?.id])

  async function loadAll(attempt = 1) {
    // Safety timeout - never stay stuck loading more than 8 seconds
    const timeout = setTimeout(() => setLoading(false), 8000)
    try {
      // Refresh session first to ensure auth token is valid on new domain
      if (attempt === 1) {
        await supabase.auth.getSession()
      }

      // Fetch profile directly first — this is the most important query
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()

      if (profileErr || !profileData) {
        console.error('Profile fetch error (attempt ' + attempt + '):', profileErr?.message, 'user.id:', user.id)
        if (attempt < 3) {
          // Force a fresh session token before retrying
          await supabase.auth.refreshSession()
          clearTimeout(timeout)
          setTimeout(() => loadAll(attempt + 1), attempt * 1500)
          return
        }
        // All retries failed - create a minimal profile from auth user data
        // so we never show "Parent"
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser) {
          const fallbackProfile = {
            id: authUser.id,
            email: authUser.email,
            display_name: authUser.user_metadata?.display_name || 
                         authUser.user_metadata?.first_name ||
                         authUser.email?.split('@')[0] || 'User',
            points: 0,
            account_type: 'family',
          }
          // Try to upsert this profile so future loads work
          await supabase.from('profiles').upsert(fallbackProfile, { onConflict: 'id' }).catch(() => {})
          setProfile(fallbackProfile)
          setNameVal(fallbackProfile.display_name)
        }
      }

      // Fetch history and favorites independently so failures don't block profile
      const [histRes, favRes] = await Promise.all([
        supabase.from('points_ledger').select('*').eq('user_id', user.id)
          .order('created_at', { ascending: false }).limit(50)
          .then(r => r).catch(() => ({ data: [] })),
        supabase.from('favorites')
          .select('restaurant_id, restaurants(id, name, emoji, cuisine, city, state, status)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .then(r => r).catch(() => ({ data: [] })),
      ])

      cachedProfile   = profileData
      cachedHistory   = histRes.data || []
      cachedFavorites = favRes.data || []
      setProfile(profileData)
      setNameVal(profileData?.display_name || '')
      setHistory(histRes.data || [])
      setFavorites(favRes.data || [])
    } catch (err) {
      console.error('Profile load error:', err)
    } finally {
      clearTimeout(timeout)
      setLoading(false)
    }
  }

  async function uploadAvatar(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const ext  = file.name.split('.').pop()
    const path = 'avatars/' + user.id + '.' + ext
    const { error: upErr } = await supabase.storage
      .from('restaurant-photos')
      .upload(path, file, { upsert: true })
    if (upErr) { alert(upErr.message); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('restaurant-photos').getPublicUrl(path)
    await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', user.id)
    setProfile(prev => ({ ...prev, avatar_url: urlData.publicUrl }))
    setUploading(false)
  }

  async function saveName() {
    if (!nameVal.trim()) return
    await supabase.from('profiles').update({ display_name: nameVal.trim() }).eq('id', user.id)
    setProfile(prev => ({ ...prev, display_name: nameVal.trim() }))
    setEditName(false)
  }

  async function saveFeedback() {
    if (!feedbackMsg.trim()) return
    setSendingFeedback(true)
    await supabase.from('feedback').insert({
      user_id: user.id,
      type:    feedbackType,
      message: feedbackMsg.trim(),
    })
    setFeedbackSent(true)
    setSendingFeedback(false)
    setTimeout(() => {
      setShowFeedback(false)
      setFeedbackSent(false)
      setFeedbackMsg('')
      setFeedbackType('suggestion')
    }, 2000)
  }

  async function saveProfile() {
    const updates = {
      display_name: editForm.firstName && editForm.lastName
        ? `${editForm.firstName} ${editForm.lastName.charAt(0).toUpperCase()}.`
        : editForm.firstName || editForm.lastName || '',
      first_name:   editForm.firstName,
      last_name:    editForm.lastName,
      zip:          editForm.zip,
      kids:         editForm.kids,
    }
    await supabase.from('profiles').update(updates).eq('id', user.id)
    setProfile(prev => ({ ...prev, ...updates }))
    setNameVal(updates.display_name)
    setShowEditProfile(false)
  }

  async function removeFavorite(restaurantId) {
    await supabase.from('favorites')
      .delete().eq('user_id', user.id).eq('restaurant_id', restaurantId)
    setFavorites(prev => prev.filter(f => f.restaurant_id !== restaurantId))
  }

  if (loading) return (
    <div style={{ ...font, padding: 32, textAlign: 'center', color: '#6b7280' }}>
      Loading profile...
    </div>
  )

  const pts      = profile?.points || 0
  const tier     = getTier(pts)
  const nextTier = getNextTier(pts)
  const pct      = nextTier
    ? Math.round(((pts - tier.min) / (nextTier.min - tier.min)) * 100)
    : 100
  const joinDate = formatDate(profile?.created_at || user?.created_at)
  const totalVotes = history.filter(h => h.action === 'vote').length
  const totalAdded = history.filter(h => h.action === 'add_restaurant').length
  const totalReviews = history.filter(h => h.action === 'review' || h.action === 'write_review').length

  // Format name as "First L." for privacy
  function formatName(p) {
    if (!p) return 'Parent'
    const first = p.first_name || p.display_name?.split(' ')[0] || ''
    const last  = p.last_name  || p.display_name?.split(' ')[1] || ''
    if (first && last) return `${first} ${last.charAt(0).toUpperCase()}.`
    if (first) return first
    return p.display_name || 'Parent'
  }

  const tabs = [
    { id: 'overview',   label: 'Overview' },
    { id: 'favorites',  label: 'Favorites' + (favorites.length > 0 ? ' (' + favorites.length + ')' : '') },
    { id: 'activity',   label: 'Activity' },
  ]

  return (
    <div style={{ ...font, paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #f57b46 0%, #f46ab8 100%)',
        padding: '24px 20px 20px' }}>

        {/* Avatar */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div onClick={() => fileRef.current?.click()}
              style={{ width: 72, height: 72, borderRadius: '50%',
                background: 'rgba(255,255,255,.25)', border: '3px solid rgba(255,255,255,.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', overflow: 'hidden' }}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>
                  {(profile?.display_name || user?.email || 'U').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div style={{ position: 'absolute', bottom: 0, right: 0,
              width: 22, height: 22, background: '#fff', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,.15)' }}
              onClick={() => fileRef.current?.click()}>
              {uploading ? '⏳' : '📷'}
            </div>
            <input type="file" ref={fileRef} accept="image/*"
              onChange={uploadAvatar} style={{ display: 'none' }} />
          </div>

          <div style={{ flex: 1, paddingTop: 4 }}>
            {editName ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                <input value={nameVal} onChange={e => setNameVal(e.target.value)}
                  style={{ flex: 1, padding: '5px 10px', borderRadius: 8, border: 'none',
                    fontSize: 14, fontWeight: 600, ...font, outline: 'none' }}
                  onKeyDown={e => e.key === 'Enter' && saveName()}
                  autoFocus />
                <button onClick={saveName}
                  style={{ padding: '5px 12px', background: 'rgba(255,255,255,.3)',
                    border: 'none', borderRadius: 8, color: '#fff', fontSize: 12,
                    fontWeight: 600, cursor: 'pointer', ...font }}>
                  Save
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>
                  {formatName(profile)}
                </span>
                <button onClick={() => setEditName(true)}
                  style={{ background: 'rgba(255,255,255,.2)', border: 'none',
                    borderRadius: 6, padding: '2px 8px', color: '#fff',
                    fontSize: 10, cursor: 'pointer', fontWeight: 500, ...font }}>
                  Edit
                </button>
              </div>
            )}
            {joinDate && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.8)', marginBottom: 2 }}>
                Joined {joinDate}
              </div>
            )}
            {profile?.kids && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.8)', marginBottom: 6 }}>
                {profile.kids === 'expecting' ? '🤰 Expecting' :
                 profile.kids === '1' ? '👶 1 child' :
                 profile.kids === '4+' ? '👨‍👩‍👧‍👦 4+ children' :
                 `👨‍👩‍👧‍👦 ${profile.kids} children`}
              </div>
            )}
            {/* Tier badge — clickable */}
            <Link to="/tiers" style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
              background: 'rgba(255,255,255,.2)', borderRadius: 20,
              padding: '3px 10px', textDecoration: 'none' }}>
              <span style={{ fontSize: 13 }}>{tier.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{tier.name}</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,.7)' }}>›</span>
            </Link>
          </div>

          {/* Points */}
          <div style={{ textAlign: 'right', paddingTop: 4 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{pts}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.8)' }}>points</div>
          </div>
        </div>

        {/* Progress bar to next tier */}
        {nextTier && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between',
              fontSize: 10, color: 'rgba(255,255,255,.75)', marginBottom: 4 }}>
              <span>{tier.name} · {pts} pts</span>
              <span>{nextTier.icon} {nextTier.name} at {nextTier.min} pts</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,.25)', borderRadius: 3,
              overflow: 'hidden' }}>
              <div style={{ height: '100%', width: pct + '%', background: '#fff',
                borderRadius: 3, transition: 'width .6s' }} />
            </div>
          </div>
        )}
        {!nextTier && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.9)', fontWeight: 600,
            textAlign: 'center' }}>
            ⭐ You've reached Legend status — the highest tier!
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: '#fff',
        borderBottom: '0.5px solid #e5e7eb' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ flex: 1, padding: '12px 4px', background: 'none', border: 'none',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', ...font,
              color: activeTab === t.id ? '#f57b46' : '#6b7280',
              borderBottom: activeTab === t.id ? '2.5px solid #f57b46' : '2.5px solid transparent',
              transition: 'all .15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ───────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div style={{ padding: '16px 16px 0' }}>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Votes cast',        value: totalVotes,   icon: '🗳️', color: '#e8f4fd', border: '#9ed4f6' },
              { label: 'Restaurants added', value: totalAdded,   icon: '📍', color: '#e6f7f5', border: '#99ddd6' },
              { label: 'Reviews written',   value: totalReviews, icon: '⭐', color: '#fefae8', border: '#fde9a0' },
              { label: 'Favorites saved',   value: favorites.length, icon: '♥', color: '#fef0f8', border: '#f9b8e0' },
              { label: 'Total points',      value: pts,          icon: '🏅', color: '#fff3ee', border: '#fdc9b0' },
              { label: 'Current tier',      value: tier.name,    icon: tier.icon, color: '#f0fdf4', border: '#86efac' },
            ].map(s => (
              <div key={s.label} style={{ background: s.color, border: '0.5px solid ' + s.border,
                borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{s.value}</div>
                <div style={{ fontSize: 9, color: '#6b7280', fontWeight: 500, lineHeight: 1.3 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* How to earn more points */}
          <div style={{ background: '#fff', border: '0.5px solid #e5e7eb',
            borderRadius: 12, padding: '14px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>
              Ways to earn points
            </div>
            {[
              { action: 'Vote on an amenity',     pts: '+5 pts',  icon: '🗳️' },
              { action: '5-vote streak bonus',    pts: '+20 pts', icon: '🔥' },
              { action: 'Write a review',         pts: '+25 pts', icon: '⭐' },
              { action: 'Add a photo',            pts: '+15 pts', icon: '📸' },
              { action: 'Add a restaurant',       pts: '+50 pts', icon: '📍' },
              { action: 'RSVP to a family event', pts: '+30 pts', icon: '🎉' },
            ].map(e => (
              <div key={e.action} style={{ display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', padding: '7px 0',
                borderBottom: '0.5px solid #f3f4f6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>{e.icon}</span>
                  <span style={{ fontSize: 12, color: '#374151' }}>{e.action}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#f57b46' }}>{e.pts}</span>
              </div>
            ))}
          </div>

          {/* Invite friends */}
          <Link to="/invite"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '13px 16px', background: 'linear-gradient(135deg, #00a994 0%, #0692e5 100%)',
              border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 600,
              color: '#fff', cursor: 'pointer', textDecoration: 'none',
              marginBottom: 10, boxSizing: 'border-box',
              boxShadow: '0 4px 14px rgba(0,169,148,.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>👨‍👩‍👧‍👦</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Invite friends</div>
                <div style={{ fontSize: 10, opacity: .85, fontWeight: 400 }}>
                  Earn 50 pts for every friend who joins!
                </div>
              </div>
            </div>
            <span style={{ fontSize: 16, opacity: .8 }}>›</span>
          </Link>

          {/* Admin panel - only show if admin */}
          {profile?.is_admin && (
            <Link to="/admin"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '13px 16px', background: '#111827',
                border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 600,
                color: '#fff', cursor: 'pointer', textDecoration: 'none',
                marginBottom: 10, boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>⚙️</span>
                <span>Admin panel</span>
              </div>
              <span style={{ opacity: .6, fontSize: 16 }}>›</span>
            </Link>
          )}

          {/* Edit profile */}
          <button onClick={() => setShowEditProfile(true)}
            style={{ width: '100%', padding: '13px 16px', background: '#fff',
              border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 13,
              fontWeight: 600, color: '#374151', cursor: 'pointer', ...font,
              marginBottom: 10, display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>✏️</span>
              <span>Edit profile</span>
            </div>
            <span style={{ color: '#9ca3af', fontSize: 16 }}>›</span>
          </button>

          {/* Feedback */}
          <button onClick={() => setShowFeedback(true)}
            style={{ width: '100%', padding: '13px 16px', background: '#fff',
              border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 13,
              fontWeight: 600, color: '#374151', cursor: 'pointer', ...font,
              marginBottom: 10, display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>💬</span>
              <span>Send feedback or suggestions</span>
            </div>
            <span style={{ color: '#9ca3af', fontSize: 16 }}>›</span>
          </button>

          {/* Sign out */}
          <button onClick={async () => {
              try { await logout() } catch (e) { console.error('Logout error:', e) }
              // Always redirect regardless of logout success
              window.location.replace('/')
            }}
            style={{ width: '100%', padding: '11px 0', background: '#fff',
              border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13,
              fontWeight: 600, color: '#6b7280', cursor: 'pointer', ...font,
              marginBottom: 16 }}>
            Sign out
          </button>
        </div>
      )}

      {/* ── FAVORITES TAB ──────────────────────────────────── */}
      {activeTab === 'favorites' && (
        <div style={{ padding: '16px 16px 0' }}>
          {favorites.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>♡</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                No favorites yet
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 20 }}>
                Tap the ♡ on any restaurant to save it here
              </div>
              <Link to="/" style={{ padding: '10px 24px', background: '#f57b46',
                color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 600,
                textDecoration: 'none' }}>
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
                    border: '0.5px solid #e5e7eb', borderRadius: 12,
                    overflow: 'hidden', display: 'flex' }}>
                    <Link to={'/restaurant/' + r.id}
                      style={{ flex: 1, textDecoration: 'none', color: 'inherit',
                        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
                      <div style={{ width: 48, height: 48, borderRadius: 10,
                        background: '#fff3ee', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                        {r.emoji || '🍽️'}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 2 }}>
                          {r.name}
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>{r.cuisine}</div>
                        {r.city && (
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>
                            📍 {r.city}, {r.state}
                          </div>
                        )}
                      </div>
                    </Link>
                    <button onClick={() => removeFavorite(f.restaurant_id)}
                      style={{ padding: '0 16px', background: 'none', border: 'none',
                        cursor: 'pointer', fontSize: 20, color: '#f46ab8' }}>
                      ♥
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ACTIVITY TAB ───────────────────────────────────── */}
      {activeTab === 'activity' && (
        <div style={{ padding: '16px 16px 0' }}>
          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🗳️</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                No activity yet
              </div>
              <div style={{ fontSize: 12 }}>
                Start voting on amenities to earn your first points!
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {history.map(item => {
                const meta = ACTION_LABELS[item.action] || { label: item.action, icon: '🏅', color: '#9ca3af' }
                const date = new Date(item.created_at).toLocaleDateString('en-US',
                  { month: 'short', day: 'numeric' })
                return (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center',
                    gap: 12, padding: '10px 0',
                    borderBottom: '0.5px solid #f3f4f6' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: '#f9fafb', border: '0.5px solid #e5e7eb',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16 }}>
                      {meta.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                        {meta.label}
                      </div>
                      <div style={{ fontSize: 10, color: '#9ca3af' }}>{date}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f57b46' }}>
                      +{item.points}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
      {/* Feedback Modal */}
      {showFeedback && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 9999, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: '#fff', width: '100%', borderRadius: '20px 20px 0 0',
            padding: '24px 20px 100px', ...font }}>

            <div style={{ display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
                💬 Share your thoughts
              </div>
              <button onClick={() => { setShowFeedback(false); setFeedbackSent(false); setFeedbackMsg('') }}
                style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%',
                  width: 32, height: 32, fontSize: 16, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ✕
              </button>
            </div>

            {feedbackSent ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>🙏</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 6 }}>
                  Thank you!
                </div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>
                  Your feedback helps make Little Foodies better for every family!
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16, lineHeight: 1.6 }}>
                  We read every message and use your feedback to improve the app!
                </div>

                {/* Feedback type */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#374151',
                    textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                    What kind of feedback?
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[
                      { val: 'suggestion', label: '💡 Suggestion' },
                      { val: 'bug',        label: '🐛 Bug report' },
                      { val: 'restaurant', label: '🍽️ Restaurant issue' },
                      { val: 'general',    label: '💬 General' },
                    ].map(t => (
                      <button key={t.val} onClick={() => setFeedbackType(t.val)}
                        style={{ padding: '7px 14px', borderRadius: 20, fontSize: 12,
                          fontWeight: 600, cursor: 'pointer', border: 'none',
                          background: feedbackType === t.val ? '#fff3ee' : '#f3f4f6',
                          color: feedbackType === t.val ? '#c2410c' : '#6b7280',
                          border: feedbackType === t.val ? '1.5px solid #fdc9b0' : '1.5px solid transparent',
                          ...font }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#374151',
                    textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
                    Your message
                  </div>
                  <textarea
                    value={feedbackMsg}
                    onChange={e => setFeedbackMsg(e.target.value)}
                    rows={4}
                    placeholder={
                      feedbackType === 'suggestion' ? "I'd love to see..."
                      : feedbackType === 'bug' ? "When I try to... it..."
                      : feedbackType === 'restaurant' ? "The restaurant listing for..."
                      : "I wanted to share..."
                    }
                    style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #e5e7eb',
                      borderRadius: 12, fontSize: 16, boxSizing: 'border-box',
                      outline: 'none', resize: 'none', ...font, background: '#fafafa',
                      lineHeight: 1.6 }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => { setShowFeedback(false); setFeedbackMsg('') }}
                    style={{ flex: 1, padding: '13px 0', background: '#fff',
                      border: '1.5px solid #e5e7eb', borderRadius: 12, fontSize: 14,
                      fontWeight: 600, color: '#6b7280', cursor: 'pointer', ...font }}>
                    Cancel
                  </button>
                  <button onClick={saveFeedback}
                    disabled={!feedbackMsg.trim() || sendingFeedback}
                    style={{ flex: 2, padding: '13px 0', background: '#f57b46',
                      border: 'none', borderRadius: 12, fontSize: 14,
                      fontWeight: 600, color: '#fff', cursor: 'pointer', ...font,
                      opacity: !feedbackMsg.trim() || sendingFeedback ? .6 : 1,
                      boxShadow: '0 4px 14px rgba(245,123,70,.3)' }}>
                    {sendingFeedback ? 'Sending…' : 'Send feedback 🙏'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 9999, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: '#fff', width: '100%', borderRadius: '20px 20px 0 0',
            padding: '24px 20px 100px', ...font }}>

            <div style={{ display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
                Edit profile
              </div>
              <button onClick={() => setShowEditProfile(false)}
                style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%',
                  width: 32, height: 32, fontSize: 16, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ✕
              </button>
            </div>

            {/* First + Last name */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#374151',
                  textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
                  First name
                </div>
                <input
                  defaultValue={profile?.first_name || profile?.display_name?.split(' ')[0] || ''}
                  onChange={e => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                  style={{ width: '100%', padding: '11px 13px', border: '1.5px solid #e5e7eb',
                    borderRadius: 10, fontSize: 16, boxSizing: 'border-box',
                    outline: 'none', ...font, background: '#fafafa' }}
                  placeholder="First name"
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#374151',
                  textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
                  Last name
                </div>
                <input
                  defaultValue={profile?.last_name || profile?.display_name?.split(' ')[1] || ''}
                  onChange={e => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                  style={{ width: '100%', padding: '11px 13px', border: '1.5px solid #e5e7eb',
                    borderRadius: 10, fontSize: 16, boxSizing: 'border-box',
                    outline: 'none', ...font, background: '#fafafa' }}
                  placeholder="Last name"
                />
              </div>
            </div>

            {/* Zip code */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#374151',
                textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
                Zip code
              </div>
              <input
                defaultValue={profile?.zip || ''}
                onChange={e => setEditForm(prev => ({ ...prev, zip: e.target.value }))}
                style={{ width: '100%', padding: '11px 13px', border: '1.5px solid #e5e7eb',
                  borderRadius: 10, fontSize: 16, boxSizing: 'border-box',
                  outline: 'none', ...font, background: '#fafafa' }}
                placeholder="07083" inputMode="numeric" maxLength={5}
              />
            </div>

            {/* Number of kids */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#374151',
                textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
                Number of kids
              </div>
              <select
                defaultValue={profile?.kids || ''}
                onChange={e => setEditForm(prev => ({ ...prev, kids: e.target.value }))}
                style={{ width: '100%', padding: '11px 13px', border: '1.5px solid #e5e7eb',
                  borderRadius: 10, fontSize: 16, boxSizing: 'border-box',
                  outline: 'none', ...font, background: '#fafafa',
                  appearance: 'none', cursor: 'pointer' }}>
                <option value="">Select...</option>
                <option value="expecting">🤰 Expecting</option>
                <option value="1">1 child</option>
                <option value="2">2 children</option>
                <option value="3">3 children</option>
                <option value="4+">4+ children</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowEditProfile(false)}
                style={{ flex: 1, padding: '13px 0', background: '#fff',
                  border: '1.5px solid #e5e7eb', borderRadius: 12, fontSize: 14,
                  fontWeight: 600, color: '#6b7280', cursor: 'pointer', ...font }}>
                Cancel
              </button>
              <button onClick={() => {
                  setEditForm(prev => ({
                    firstName: prev.firstName ?? profile?.first_name ?? profile?.display_name?.split(' ')[0] ?? '',
                    lastName:  prev.lastName  ?? profile?.last_name  ?? profile?.display_name?.split(' ')[1] ?? '',
                    zip:       prev.zip       ?? profile?.zip        ?? '',
                    kids:      prev.kids      ?? profile?.kids       ?? '',
                  }))
                  saveProfile()
                }}
                style={{ flex: 2, padding: '13px 0', background: '#f57b46',
                  border: 'none', borderRadius: 12, fontSize: 14,
                  fontWeight: 600, color: '#fff', cursor: 'pointer', ...font,
                  boxShadow: '0 4px 14px rgba(245,123,70,.3)' }}>
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
