import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const font = { fontFamily: "'Montserrat', sans-serif" }

const AMENITIES = [
  { id: 'highchair',  label: 'High chairs',      icon: '🪑', color: '#fff3ee', border: '#fdc9b0', text: '#c2410c' },
  { id: 'changing_f', label: "Women's changing",  icon: '🚺', color: '#fef0f8', border: '#f9b8e0', text: '#9d1479' },
  { id: 'changing_m', label: "Men's changing",    icon: '🚹', color: '#e8f4fd', border: '#9ed4f6', text: '#0552a0' },
  { id: 'kidsmenu',   label: 'Kids menu',         icon: '🍟', color: '#fefae8', border: '#fde9a0', text: '#854d0e' },
  { id: 'stroller',   label: 'Stroller friendly', icon: '🛻', color: '#e6f7f5', border: '#99ddd6', text: '#065f55' },
  { id: 'outdoor',    label: 'Outdoor seating',   icon: '🌿', color: '#f0fdf4', border: '#86efac', text: '#166534' },
]

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const NOISE_EMOJI = { 1:'😌', 2:'🤫', 3:'😊', 4:'🔊', 5:'📢' }
const NOISE_LABELS = { 1:'Very quiet', 2:'Quiet', 3:'Moderate', 4:'Lively', 5:'Very loud' }

function parseHours(raw) {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  return { Daily: raw }
}

function getTodayHours(hoursObj) {
  if (!hoursObj) return null
  const today = DAYS[new Date().getDay()]
  return hoursObj[today] || hoursObj['Daily'] || null
}

export default function RestaurantPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [restaurant, setRestaurant] = useState(null)
  const [amenities, setAmenities]   = useState([])
  const [myVotes, setMyVotes]       = useState({})
  const [photos, setPhotos]         = useState([])
  const [noiseVotes, setNoiseVotes] = useState({ 1:0, 2:0, 3:0, 4:0, 5:0 })
  const [selectedNoise, setSelectedNoise] = useState(null) // temp selection before save
  const [savedNoise, setSavedNoise]       = useState(null) // confirmed saved vote
  const [reviews, setReviews]       = useState([])
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewText, setReviewText] = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [uploading, setUploading]   = useState(false)
  const [toast, setToast]           = useState(null)
  const [loading, setLoading]       = useState(true)
  const [activePhoto, setActivePhoto] = useState(0)
  const [savingNoise, setSavingNoise] = useState(false)

  useEffect(() => { loadAll() }, [id])

  async function loadAll() {
    const { data: r } = await supabase
      .from('restaurants')
      .select('*, amenities(*)')
      .eq('id', id)
      .single()
    setRestaurant(r)
    setAmenities(r?.amenities || [])

    const { data: pData } = await supabase
      .from('restaurant_photos')
      .select('*')
      .eq('restaurant_id', id)
      .order('created_at').limit(3)
    setPhotos(pData || [])

    const { data: nData } = await supabase
      .from('noise_votes')
      .select('score, user_id')
      .eq('restaurant_id', id)
    if (nData) {
      const counts = { 1:0, 2:0, 3:0, 4:0, 5:0 }
      nData.forEach(v => { counts[v.score] = (counts[v.score]||0) + 1 })
      setNoiseVotes(counts)
      if (user) {
        const mine = nData.find(v => v.user_id === user.id)
        if (mine) { setSavedNoise(mine.score); setSelectedNoise(mine.score) }
      }
    }

    // Load my amenity votes
    if (user) {
      const { data: vData } = await supabase
        .from('amenity_votes')
        .select('amenity_key, vote')
        .eq('restaurant_id', id)
        .eq('user_id', user.id)
      if (vData) {
        const map = {}
        vData.forEach(v => { map[v.amenity_key] = v.vote })
        setMyVotes(map)
      }
    }

    const { data: revData } = await supabase
      .from('reviews')
      .select('*, profiles(display_name)')
      .eq('restaurant_id', id)
      .order('created_at', { ascending: false })
    setReviews(revData || [])

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
            no_votes:  a.no_votes  + (vote === 'no' ? 1 : 0),
            is_verified: (a.yes_votes + a.no_votes + 1) >= 5 }
        : a
    ))
    showToast('+5 pts! Thanks for voting 🙌')
  }

  async function saveNoiseVote() {
    if (!user || !selectedNoise) return
    setSavingNoise(true)
    if (savedNoise) {
      // Update existing vote
      await supabase.from('noise_votes')
        .update({ score: selectedNoise })
        .eq('restaurant_id', id)
        .eq('user_id', user.id)
      setNoiseVotes(prev => ({
        ...prev,
        [savedNoise]: Math.max(0, (prev[savedNoise]||0) - 1),
        [selectedNoise]: (prev[selectedNoise]||0) + 1
      }))
    } else {
      // New vote
      await supabase.from('noise_votes').insert({
        restaurant_id: id, user_id: user.id, score: selectedNoise
      })
      setNoiseVotes(prev => ({ ...prev, [selectedNoise]: (prev[selectedNoise]||0) + 1 }))
    }
    setSavedNoise(selectedNoise)
    setSavingNoise(false)
    showToast('+5 pts! Noise level saved 🔊')
  }

  async function submitReview() {
    if (!user) { showToast('Sign in to leave a review!', false); return }
    if (!reviewText.trim()) return
    const { error } = await supabase.from('reviews').insert({
      restaurant_id: id,
      user_id: user.id,
      rating: reviewRating,
      body: reviewText.trim()
    })
    if (error) { showToast(error.message, false); return }
    setReviewText('')
    setReviewRating(5)
    setShowReviewForm(false)
    showToast('+25 pts! Review posted ⭐')
    loadAll()
  }

  async function uploadPhoto(e) {
    if (!user) { showToast('Sign in to upload photos!', false); return }
    if (photos.length >= 3) { showToast('Max 3 photos per restaurant', false); return }
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const ext  = file.name.split('.').pop()
    const path = id + '/' + Date.now() + '.' + ext
    const { error: upErr } = await supabase.storage
      .from('restaurant-photos')
      .upload(path, file)
    if (upErr) { showToast(upErr.message, false); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('restaurant-photos').getPublicUrl(path)
    await supabase.from('restaurant_photos').insert({
      restaurant_id: id, user_id: user.id, url: urlData.publicUrl, path
    })
    setPhotos(prev => [...prev, { url: urlData.publicUrl }])
    showToast('+15 pts! Photo added 📸')
    setUploading(false)
  }

  if (loading) return <div style={{ ...font, padding: 32, color: '#6b7280' }}>Loading...</div>
  if (!restaurant) return <div style={{ ...font, padding: 32 }}>Restaurant not found.</div>

  const amenityMap    = Object.fromEntries(amenities.map(a => [a.amenity_key, a]))
  const hoursObj      = parseHours(restaurant.hours)
  const todayHours    = getTodayHours(hoursObj)
  const isVerified    = restaurant.status === 'verified' || restaurant.status === 'partner'
  const totalNoise    = Object.values(noiseVotes).reduce((a, b) => a + b, 0)
  const avgNoise      = totalNoise > 0
    ? (Object.entries(noiseVotes).reduce((sum, [k,v]) => sum + Number(k)*v, 0) / totalNoise).toFixed(1)
    : null
  const noiseLabel    = avgNoise
    ? avgNoise <= 1.5 ? 'Very quiet' : avgNoise <= 2.5 ? 'Quiet' : avgNoise <= 3.5 ? 'Moderate' : avgNoise <= 4.5 ? 'Lively' : 'Very loud'
    : null

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
              <>
                {activePhoto > 0 && (
                  <button onClick={() => setActivePhoto(p => p-1)}
                    style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                      background: 'rgba(0,0,0,.4)', border: 'none', borderRadius: '50%',
                      width: 32, height: 32, color: '#fff', fontSize: 18, cursor: 'pointer' }}>‹</button>
                )}
                {activePhoto < photos.length - 1 && (
                  <button onClick={() => setActivePhoto(p => p+1)}
                    style={{ position: 'absolute', right: 50, top: '50%', transform: 'translateY(-50%)',
                      background: 'rgba(0,0,0,.4)', border: 'none', borderRadius: '50%',
                      width: 32, height: 32, color: '#fff', fontSize: 18, cursor: 'pointer' }}>›</button>
                )}
                <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                  display: 'flex', gap: 6 }}>
                  {photos.map((_, i) => (
                    <div key={i} onClick={() => setActivePhoto(i)}
                      style={{ width: i === activePhoto ? 20 : 8, height: 8, borderRadius: 4,
                        background: i === activePhoto ? '#fff' : 'rgba(255,255,255,.6)', cursor: 'pointer' }} />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 52 }}>{restaurant.emoji || '🍽️'}</span>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>No photos yet — be the first!</span>
          </div>
        )}
        {photos.length < 3 && (
          <label style={{ position: 'absolute', top: 10, right: 10,
            background: 'rgba(0,0,0,.5)', color: '#fff', borderRadius: 20,
            padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', ...font }}>
            {uploading ? 'Uploading…' : '📷 Add photo'}
            <input type="file" accept="image/*" onChange={uploadPhoto} style={{ display: 'none' }} />
          </label>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '16px 16px 14px', background: '#fff', borderBottom: '0.5px solid #f3f4f6' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 4,
          fontFamily: "'IntroRust', cursive" }}>
          {restaurant.name}
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>{restaurant.cuisine}</div>
        {restaurant.address && (
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>
            📍 {restaurant.address}{restaurant.city ? ', ' + restaurant.city : ''}{restaurant.state ? ', ' + restaurant.state : ''}
          </div>
        )}
        {todayHours && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#e6f7f5', border: '0.5px solid #99ddd6',
            borderRadius: 20, padding: '4px 12px', marginBottom: 6 }}>
            <span style={{ fontSize: 11 }}>🕐</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#065f55' }}>Today: {todayHours}</span>
          </div>
        )}
        {hoursObj && Object.keys(hoursObj).length > 1 && (
          <details style={{ marginTop: 4 }}>
            <summary style={{ fontSize: 11, color: '#9ca3af', cursor: 'pointer' }}>See all hours ▾</summary>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {DAYS.map(day => hoursObj[day] && (
                <div key={day} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12,
                  color: day === DAYS[new Date().getDay()] ? '#065f55' : '#6b7280',
                  fontWeight: day === DAYS[new Date().getDay()] ? 600 : 400 }}>
                  <span>{day}</span><span>{hoursObj[day]}</span>
                </div>
              ))}
            </div>
          </details>
        )}
        {restaurant.phone && (
          <div style={{ fontSize: 13, color: '#f57b46', marginTop: 6 }}>📞 {restaurant.phone}</div>
        )}
      </div>

      {/* Amenity summary strip */}
      <div style={{ padding: '14px 16px', background: '#fff', borderBottom: '0.5px solid #f3f4f6' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#374151',
          textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
          Family amenities
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {AMENITIES.map(am => {
            const data       = amenityMap[am.id]
            const isVer      = data?.is_verified
            const likelyYes  = data && data.yes_votes >= data.no_votes
            const confirmed  = isVer && likelyYes
            const denied     = isVer && !likelyYes
            return (
              <div key={am.id} style={{ display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 5, minWidth: 60 }}>
                <div style={{ width: 52, height: 52, borderRadius: 14,
                  background: confirmed ? am.color : denied ? '#f3f4f6' : '#f9fafb',
                  border: confirmed ? '1.5px solid ' + am.border : denied ? '1.5px solid #d1d5db' : '1.5px solid #e5e7eb',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'column', gap: 1,
                  opacity: denied ? 0.5 : 1,
                  filter: denied ? 'grayscale(60%)' : 'none' }}>
                  <span style={{ fontSize: 20 }}>{am.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 600,
                    color: confirmed ? am.text : denied ? '#9ca3af' : '#d1d5db' }}>
                    {confirmed ? '✓' : denied ? '✗' : '–'}
                  </span>
                </div>
                <span style={{ fontSize: 9, color: confirmed ? am.text : '#9ca3af',
                  textAlign: 'center', lineHeight: 1.3, maxWidth: 60, fontWeight: confirmed ? 600 : 400 }}>
                  {am.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Noise level */}
      <div style={{ padding: '14px 16px', background: '#fff', borderBottom: '0.5px solid #f3f4f6' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#374151',
          textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
          🔊 Noise level
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
          {totalNoise > 0
            ? noiseLabel + ' · avg ' + avgNoise + '/5 · ' + totalNoise + ' vote' + (totalNoise !== 1 ? 's' : '')
            : 'No ratings yet — be the first!'}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af', marginBottom: 8 }}>
          <span>1 — Very quiet</span>
          <span>5 — Very loud</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {[1,2,3,4,5].map(score => {
            const isSelected = selectedNoise === score
            const isSaved    = savedNoise === score
            return (
              <div key={score} onClick={() => setSelectedNoise(score)}
                style={{ flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <div style={{ width: '100%', aspectRatio: '1', borderRadius: 12,
                  border: isSelected ? '2.5px solid #f57b46' : '1.5px solid #e5e7eb',
                  background: isSelected ? '#fff3ee' : '#f9fafb',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, transition: 'all .15s',
                  boxShadow: isSelected ? '0 2px 8px rgba(245,123,70,.25)' : 'none' }}>
                  {NOISE_EMOJI[score]}
                </div>
                <span style={{ fontSize: 10, fontWeight: isSelected ? 600 : 400,
                  color: isSelected ? '#f57b46' : '#9ca3af' }}>
                  {score}{isSaved && !isSelected ? '' : ''}
                  {noiseVotes[score] > 0 && (
                    <span style={{ color: '#d1d5db' }}> ({noiseVotes[score]})</span>
                  )}
                </span>
              </div>
            )
          })}
        </div>

        {/* Save noise button — only show if selection differs from saved */}
        {selectedNoise && selectedNoise !== savedNoise && (
          <button onClick={saveNoiseVote} disabled={savingNoise}
            style={{ width: '100%', padding: '10px 0', background: '#f57b46', border: 'none',
              borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', ...font, opacity: savingNoise ? .6 : 1 }}>
            {savingNoise ? 'Saving…' : 'Save noise rating · ' + NOISE_LABELS[selectedNoise]}
          </button>
        )}
        {savedNoise && selectedNoise === savedNoise && (
          <div style={{ fontSize: 12, color: '#00a994', fontWeight: 600 }}>
            ✓ You rated this {savedNoise}/5 — {NOISE_LABELS[savedNoise]}
          </div>
        )}
      </div>

      {/* Amenity voting — only show if NOT verified */}
      {!isVerified && (
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#374151',
            textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
            Help verify amenities · earn 5 pts
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10 }}>
            5 votes = verified ✓ · This restaurant needs community verification!
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
                      border: '0.5px solid #99ddd6', padding: '1px 7px',
                      borderRadius: 20, fontWeight: 600 }}>✓ Verified</span>
                  )}
                  {total > 0 && <span style={{ fontSize: 11, color: '#9ca3af' }}>{total} votes</span>}
                </div>
                {total > 0 && (
                  <div style={{ height: 4, background: '#e5e7eb', borderRadius: 2,
                    overflow: 'hidden', marginBottom: 8 }}>
                    <div style={{ height: '100%', width: pct + '%',
                      background: '#00a994', borderRadius: 2, transition: 'width .4s' }} />
                  </div>
                )}
                {myV ? (
                  <div style={{ fontSize: 12, color: '#00a994', fontWeight: 600 }}>✓ You voted {myV}</div>
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
      )}

      {/* Reviews */}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#374151',
            textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Parent reviews {reviews.length > 0 && '(' + reviews.length + ')'}
          </div>
          {user && !showReviewForm && (
            <button onClick={() => setShowReviewForm(true)}
              style={{ padding: '6px 14px', background: '#f57b46', border: 'none',
                borderRadius: 20, color: '#fff', fontSize: 11, fontWeight: 600,
                cursor: 'pointer', ...font }}>
              + Write a review
            </button>
          )}
          {!user && (
            <Link to="/login" style={{ fontSize: 11, color: '#f57b46', fontWeight: 600 }}>
              Sign in to review
            </Link>
          )}
        </div>

        {/* Review form */}
        {showReviewForm && (
          <div style={{ background: '#f9fafb', borderRadius: 12, padding: '14px',
            marginBottom: 16, border: '0.5px solid #e5e7eb' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
              Your rating
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {[1,2,3,4,5].map(r => (
                <button key={r} onClick={() => setReviewRating(r)}
                  style={{ width: 36, height: 36, borderRadius: 8, border: 'none',
                    background: reviewRating >= r ? '#fbca3f' : '#e5e7eb',
                    fontSize: 18, cursor: 'pointer', transition: 'all .15s' }}>
                  ⭐
                </button>
              ))}
              <span style={{ fontSize: 12, color: '#6b7280', alignSelf: 'center', marginLeft: 4 }}>
                {reviewRating}/5
              </span>
            </div>
            <textarea
              value={reviewText}
              onChange={e => setReviewText(e.target.value)}
              placeholder="Share your experience as a parent — was it kid-friendly? Stroller-accessible? Great for toddlers?"
              rows={3}
              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb',
                borderRadius: 10, fontSize: 12, resize: 'none', outline: 'none',
                boxSizing: 'border-box', ...font, background: '#fff' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => { setShowReviewForm(false); setReviewText('') }}
                style={{ flex: 1, padding: '9px 0', background: '#fff',
                  border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 12,
                  fontWeight: 600, cursor: 'pointer', color: '#6b7280', ...font }}>
                Cancel
              </button>
              <button onClick={submitReview}
                style={{ flex: 2, padding: '9px 0', background: '#f57b46', border: 'none',
                  borderRadius: 10, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', color: '#fff', ...font }}>
                Post review · +25 pts
              </button>
            </div>
          </div>
        )}

        {/* Review list */}
        {reviews.length === 0 && !showReviewForm && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af', fontSize: 13 }}>
            No reviews yet — be the first parent to share your experience!
          </div>
        )}
        {reviews.map(rev => (
          <div key={rev.id} style={{ background: '#fff', border: '0.5px solid #e5e7eb',
            borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%',
                  background: '#fff3ee', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 14, fontWeight: 600, color: '#f57b46' }}>
                  {(rev.profiles?.display_name || 'P').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                    {rev.profiles?.display_name || 'Parent'}
                  </div>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>
                    {new Date(rev.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 13 }}>
                {'⭐'.repeat(rev.rating || 0)}
              </div>
            </div>
            {rev.body && (
              <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{rev.body}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
