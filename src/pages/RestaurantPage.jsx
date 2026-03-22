import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const font = { fontFamily: "'Montserrat', sans-serif" }

const AMENITIES = [
  { id: 'highchair',  label: 'High chairs',      icon: '🪑' },
  { id: 'changing_f', label: "Women's changing",  icon: '🚺' },
  { id: 'changing_m', label: "Men's changing",    icon: '🚹' },
  { id: 'kidsmenu',   label: 'Kids menu',         icon: '🍟' },
  { id: 'stroller',   label: 'Stroller friendly', icon: '🛻' },
  { id: 'outdoor',    label: 'Outdoor seating',   icon: '🌿' },
]

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function getTodayLabel(hoursObj) {
  if (!hoursObj || typeof hoursObj !== 'object') return null
  const today = DAYS[new Date().getDay()]
  return hoursObj[today] || hoursObj['Daily'] || null
}

function parseHours(hoursRaw) {
  // If it's already an object, return it
  if (hoursRaw && typeof hoursRaw === 'object') return hoursRaw
  // If it's a plain string like "11am–10pm", return as Daily
  if (hoursRaw && typeof hoursRaw === 'string') {
    return { Daily: hoursRaw }
  }
  return null
}

export default function RestaurantPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [restaurant, setRestaurant] = useState(null)
  const [amenities, setAmenities]   = useState([])
  const [myVotes, setMyVotes]       = useState({})
  const [photos, setPhotos]         = useState([])
  const [noiseVotes, setNoiseVotes] = useState({ 1:0, 2:0, 3:0, 4:0, 5:0 })
  const [myNoise, setMyNoise]       = useState(null)
  const [uploading, setUploading]   = useState(false)
  const [toast, setToast]           = useState(null)
  const [loading, setLoading]       = useState(true)
  const [activePhoto, setActivePhoto] = useState(0)

  useEffect(() => {
    loadAll()
  }, [id])

  async function loadAll() {
    // Load restaurant
    const { data: r } = await supabase
      .from('restaurants')
      .select('*, amenities(*)')
      .eq('id', id)
      .single()
    setRestaurant(r)
    setAmenities(r?.amenities || [])

    // Load photos
    const { data: pData } = await supabase
      .from('restaurant_photos')
      .select('*')
      .eq('restaurant_id', id)
      .order('created_at')
      .limit(3)
    setPhotos(pData || [])

    // Load noise votes
    const { data: nData } = await supabase
      .from('noise_votes')
      .select('score')
      .eq('restaurant_id', id)
    if (nData) {
      const counts = { 1:0, 2:0, 3:0, 4:0, 5:0 }
      nData.forEach(v => { counts[v.score] = (counts[v.score]||0) + 1 })
      setNoiseVotes(counts)
    }

    // Load my noise vote
    if (user) {
      const { data: myN } = await supabase
        .from('noise_votes')
        .select('score')
        .eq('restaurant_id', id)
        .eq('user_id', user.id)
        .single()
      if (myN) setMyNoise(myN.score)
    }

    setLoading(false)
  }

  function showToast(msg, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }

  async function castVote(amenity_key, vote) {
    if (!user) { showToast('Sign in to vote!', false); return }
    if (myVotes[amenity_key]) return
    const { error } = await supabase.from('amenity_votes').insert({
      restaurant_id: id, amenity_key, vote, user_id: user.id
    })
    if (error) { showToast(error.message, false); return }

    setMyVotes(prev => ({ ...prev, [amenity_key]: vote }))
    setAmenities(prev => prev.map(a =>
      a.amenity_key === amenity_key
        ? { ...a,
            yes_votes: a.yes_votes + (vote === 'yes' ? 1 : 0),
            no_votes:  a.no_votes  + (vote === 'no'  ? 1 : 0),
            is_verified: (a.yes_votes + a.no_votes + 1) >= 5
          }
        : a
    ))
    showToast('+5 pts! Thanks for voting 🙌')
  }

  async function castNoiseVote(score) {
    if (!user) { showToast('Sign in to vote!', false); return }
    if (myNoise) return
    const { error } = await supabase.from('noise_votes').insert({
      restaurant_id: id, user_id: user.id, score
    })
    if (error) { showToast(error.message, false); return }
    setMyNoise(score)
    setNoiseVotes(prev => ({ ...prev, [score]: (prev[score]||0) + 1 }))
    showToast('+5 pts! Thanks for rating the noise level 🙌')
  }

  async function uploadPhoto(e) {
    if (!user) { showToast('Sign in to upload photos!', false); return }
    if (photos.length >= 3) { showToast('Max 3 photos per restaurant', false); return }
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const ext  = file.name.split('.').pop()
    const path = `${id}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('restaurant-photos')
      .upload(path, file, { upsert: false })
    if (upErr) { showToast(upErr.message, false); setUploading(false); return }

    const { data: urlData } = supabase.storage
      .from('restaurant-photos')
      .getPublicUrl(path)

    const { error: dbErr } = await supabase.from('restaurant_photos').insert({
      restaurant_id: id,
      user_id:       user.id,
      url:           urlData.publicUrl,
      path
    })
    if (dbErr) { showToast(dbErr.message, false); setUploading(false); return }

    setPhotos(prev => [...prev, { url: urlData.publicUrl }])
    showToast('+15 pts! Photo added 📸')
    setUploading(false)
  }

  if (loading) return <div style={{ ...font, padding: 32, color: '#6b7280' }}>Loading...</div>
  if (!restaurant) return <div style={{ ...font, padding: 32 }}>Restaurant not found.</div>

  const amenityMap  = Object.fromEntries(amenities.map(a => [a.amenity_key, a]))
  const hoursObj    = parseHours(restaurant.hours)
  const todayHours  = getTodayLabel(hoursObj)
  const totalNoise  = Object.values(noiseVotes).reduce((a, b) => a + b, 0)
  const avgNoise    = totalNoise > 0
    ? (Object.entries(noiseVotes).reduce((sum, [k, v]) => sum + Number(k) * v, 0) / totalNoise).toFixed(1)
    : null

  const noiseLabel = avgNoise
    ? avgNoise <= 1.5 ? 'Very quiet' : avgNoise <= 2.5 ? 'Quiet' : avgNoise <= 3.5 ? 'Moderate' : avgNoise <= 4.5 ? 'Lively' : 'Very loud'
    : 'Not yet rated'

  return (
    <div style={{ ...font, paddingBottom: 80 }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 74, left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? '#00a994' : '#ef4444', color: '#fff',
          padding: '9px 18px', borderRadius: 20, fontSize: 13, fontWeight: 500,
          zIndex: 999, whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(0,0,0,.15)' }}>
          {toast.msg}
        </div>
      )}

      {/* Back */}
      <div style={{ padding: '14px 16px', borderBottom: '0.5px solid #e5e7eb', background: '#fff' }}>
        <Link to="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: 13 }}>← Back</Link>
      </div>

      {/* Photo gallery */}
      <div style={{ position: 'relative', height: 220, background: '#f3f4f6', overflow: 'hidden' }}>
        {photos.length > 0 ? (
          <>
            <img src={photos[activePhoto]?.url} alt="Restaurant"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {photos.length > 1 && (
              <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                display: 'flex', gap: 6 }}>
                {photos.map((_, i) => (
                  <div key={i} onClick={() => setActivePhoto(i)}
                    style={{ width: i === activePhoto ? 20 : 8, height: 8, borderRadius: 4,
                      background: i === activePhoto ? '#fff' : 'rgba(255,255,255,.6)',
                      cursor: 'pointer', transition: 'all .2s' }} />
                ))}
              </div>
            )}
            {photos.length > 1 && activePhoto > 0 && (
              <button onClick={() => setActivePhoto(p => p - 1)}
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(0,0,0,.4)', border: 'none', borderRadius: '50%',
                  width: 32, height: 32, color: '#fff', fontSize: 16, cursor: 'pointer' }}>‹</button>
            )}
            {photos.length > 1 && activePhoto < photos.length - 1 && (
              <button onClick={() => setActivePhoto(p => p + 1)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(0,0,0,.4)', border: 'none', borderRadius: '50%',
                  width: 32, height: 32, color: '#fff', fontSize: 16, cursor: 'pointer' }}>›</button>
            )}
          </>
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 52 }}>{restaurant.emoji || '🍽️'}</span>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>No photos yet</span>
          </div>
        )}

        {/* Upload button */}
        {photos.length < 3 && (
          <label style={{ position: 'absolute', top: 10, right: 10,
            background: 'rgba(0,0,0,.45)', color: '#fff', borderRadius: 20,
            padding: '5px 11px', fontSize: 11, fontWeight: 600, cursor: 'pointer', ...font }}>
            {uploading ? 'Uploading…' : '📷 Add photo'}
            <input type="file" accept="image/*" onChange={uploadPhoto}
              style={{ display: 'none' }} />
          </label>
        )}

        {/* Photo strip thumbnails */}
        {photos.length > 1 && (
          <div style={{ position: 'absolute', bottom: 30, right: 10, display: 'flex', gap: 4 }}>
            {photos.map((p, i) => (
              <img key={i} src={p.url} alt="" onClick={() => setActivePhoto(i)}
                style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6,
                  border: i === activePhoto ? '2px solid #f57b46' : '2px solid transparent',
                  cursor: 'pointer' }} />
            ))}
          </div>
        )}
      </div>

      {/* Restaurant info */}
      <div style={{ padding: '16px 16px 12px', background: '#fff',
        borderBottom: '0.5px solid #f3f4f6' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 4,
          fontFamily: "'IntroRust', cursive" }}>
          {restaurant.name}
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>{restaurant.cuisine}</div>

        {restaurant.address && (
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 3 }}>
            📍 {restaurant.address}{restaurant.city ? ', ' + restaurant.city : ''}{restaurant.state ? ', ' + restaurant.state : ''}
          </div>
        )}

        {/* Today's hours */}
        {todayHours && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#e6f7f5', border: '0.5px solid #99ddd6',
            borderRadius: 20, padding: '4px 10px', marginBottom: 6 }}>
            <span style={{ fontSize: 11 }}>🕐</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#065f55' }}>
              Today: {todayHours}
            </span>
          </div>
        )}

        {/* Full week hours if available */}
        {hoursObj && Object.keys(hoursObj).length > 1 && (
          <details style={{ marginTop: 6 }}>
            <summary style={{ fontSize: 11, color: '#6b7280', cursor: 'pointer', fontWeight: 600 }}>
              See all hours
            </summary>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {DAYS.map(day => hoursObj[day] && (
                <div key={day} style={{ display: 'flex', justifyContent: 'space-between',
                  fontSize: 12, color: day === DAYS[new Date().getDay()] ? '#065f55' : '#6b7280',
                  fontWeight: day === DAYS[new Date().getDay()] ? 600 : 400 }}>
                  <span>{day}</span>
                  <span>{hoursObj[day]}</span>
                </div>
              ))}
            </div>
          </details>
        )}

        {restaurant.phone && (
          <div style={{ fontSize: 13, color: '#f57b46', marginTop: 4 }}>📞 {restaurant.phone}</div>
        )}
      </div>

      {/* Amenity summary strip */}
      <div style={{ padding: '14px 16px', background: '#fff',
        borderBottom: '0.5px solid #f3f4f6' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#374151',
          textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
          Family amenities
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {AMENITIES.map(am => {
            const data       = amenityMap[am.id]
            const isVerified = data?.is_verified
            const hasVotes   = data && (data.yes_votes + data.no_votes) >= 3
            const likelyYes  = data && data.yes_votes > data.no_votes
            return (
              <div key={am.id} style={{ display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 4, minWidth: 52 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12,
                  background: isVerified ? (likelyYes ? '#e6f7f5' : '#fef0f8') : '#f3f4f6',
                  border: isVerified ? (likelyYes ? '1.5px solid #99ddd6' : '1.5px solid #f9b8e0') : '1.5px solid #e5e7eb',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 18 }}>{am.icon}</span>
                  <span style={{ fontSize: 10 }}>
                    {isVerified
                      ? (likelyYes ? '✓' : '✗')
                      : hasVotes ? '?' : '–'
                    }
                  </span>
                </div>
                <span style={{ fontSize: 9, color: '#9ca3af', textAlign: 'center',
                  lineHeight: 1.2, maxWidth: 52 }}>{am.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Noise level */}
      <div style={{ padding: '14px 16px', background: '#fff',
        borderBottom: '0.5px solid #f3f4f6' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#374151',
          textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
          🔊 Noise level
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
          {totalNoise > 0
            ? `${noiseLabel} (avg ${avgNoise}/5 · ${totalNoise} vote${totalNoise !== 1 ? 's' : ''})`
            : 'No ratings yet — be the first!'}
        </div>

        {/* Scale labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between',
          fontSize: 10, color: '#9ca3af', marginBottom: 6 }}>
          <span>Very quiet</span>
          <span>Very loud</span>
        </div>

        {/* Vote buttons */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[1,2,3,4,5].map(score => {
            const labels = {1:'😌',2:'🤫',3:'😊',4:'🔊',5:'📢'}
            const isMyVote = myNoise === score
            const voteCount = noiseVotes[score] || 0
            return (
              <div key={score} onClick={() => castNoiseVote(score)}
                style={{ flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 4, cursor: myNoise ? 'default' : 'pointer' }}>
                <div style={{ width: '100%', paddingBottom: '100%', position: 'relative' }}>
                  <div style={{ position: 'absolute', inset: 0, borderRadius: 10,
                    border: isMyVote ? '2px solid #f57b46' : '1.5px solid #e5e7eb',
                    background: isMyVote ? '#fff3ee' : '#f9fafb',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, transition: 'all .15s' }}>
                    {labels[score]}
                  </div>
                </div>
                <div style={{ fontSize: 10, color: isMyVote ? '#f57b46' : '#9ca3af',
                  fontWeight: isMyVote ? 600 : 400 }}>
                  {score}
                  {voteCount > 0 && <span style={{ color: '#d1d5db' }}> ({voteCount})</span>}
                </div>
              </div>
            )
          })}
        </div>
        {myNoise && (
          <div style={{ fontSize: 11, color: '#00a994', fontWeight: 600, marginTop: 8 }}>
            ✓ You rated this {myNoise}/5
          </div>
        )}
      </div>

      {/* Amenity voting */}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#374151',
          textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
          Confirm amenities · earn 5 pts each
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10 }}>
          5 votes = verified ✓ · Help other parents know what to expect!
        </div>

        {AMENITIES.map(am => {
          const data  = amenityMap[am.id] || { yes_votes: 0, no_votes: 0, is_verified: false }
          const total = data.yes_votes + data.no_votes
          const myV   = myVotes[am.id]
          const pct   = total > 0 ? Math.round((data.yes_votes / total) * 100) : 0
          return (
            <div key={am.id} style={{ background: '#f9fafb', borderRadius: 12,
              padding: '12px 14px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>{am.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{am.label}</span>
                {data.is_verified && (
                  <span style={{ fontSize: 10, background: '#e6f7f5', color: '#065f55',
                    border: '0.5px solid #99ddd6', padding: '1px 7px', borderRadius: 20,
                    fontWeight: 600 }}>✓ Verified</span>
                )}
                {total > 0 && (
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>{total} votes</span>
                )}
              </div>

              {/* Progress bar */}
              {total > 0 && (
                <div style={{ height: 4, background: '#e5e7eb', borderRadius: 2,
                  overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ height: '100%', width: pct + '%',
                    background: '#00a994', borderRadius: 2, transition: 'width .4s' }} />
                </div>
              )}

              {myV ? (
                <div style={{ fontSize: 12, color: '#00a994', fontWeight: 600 }}>
                  ✓ You voted {myV}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => castVote(am.id, 'yes')}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12,
                      fontWeight: 600, cursor: 'pointer', background: '#e6f7f5',
                      color: '#065f55', border: '1.5px solid #99ddd6', ...font }}>
                    Yes ✓
                  </button>
                  <button onClick={() => castVote(am.id, 'no')}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12,
                      fontWeight: 600, cursor: 'pointer', background: '#fef0f8',
                      color: '#9d1479', border: '1.5px solid #f9b8e0', ...font }}>
                    No ✕
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
