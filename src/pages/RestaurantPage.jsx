import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { track } from '../lib/analytics'

const font = { fontFamily: "'Montserrat', sans-serif" }

// Cache restaurant data so back navigation is instant
const restaurantCache = {}

const AMENITIES = [
  { id: 'highchair',  label: 'High chairs',      icon: '🪑', color: '#fff3ee', border: '#fdc9b0', text: '#c2410c' },
  { id: 'changing_f', label: "Women's changing",  icon: '🚺', color: '#fef0f8', border: '#f9b8e0', text: '#9d1479' },
  { id: 'changing_m', label: "Men's changing",    icon: '🚹', color: '#e8f4fd', border: '#9ed4f6', text: '#0552a0' },
  { id: 'kidsmenu',   label: 'Kids menu',         icon: '🍟', color: '#fefae8', border: '#fde9a0', text: '#854d0e' },
  { id: 'stroller',   label: 'Stroller friendly', icon: '🛻', color: '#e6f7f5', border: '#99ddd6', text: '#065f55' },
  { id: 'outdoor',    label: 'Outdoor seating',   icon: '🌿', color: '#f0fdf4', border: '#86efac', text: '#166534' },
]

const ALLERGENS = [
  { id: 'peanut_free',   label: 'Peanut-free',        icon: '🥜', color: '#fff3ee', border: '#fdc9b0', text: '#c2410c' },
  { id: 'tree_nut_free', label: 'Tree nut-free',       icon: '🌰', color: '#fefae8', border: '#fde9a0', text: '#854d0e' },
  { id: 'gluten_free',   label: 'Gluten-free options', icon: '🌾', color: '#e6f7f5', border: '#99ddd6', text: '#065f55' },
  { id: 'dairy_free',    label: 'Dairy-free options',  icon: '🥛', color: '#e8f4fd', border: '#9ed4f6', text: '#0552a0' },
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
  const [allergens, setAllergens]       = useState([])
  const [myAllergenVotes, setMyAllergenVotes] = useState({})
  const [kidsMenuPhotos, setKidsMenuPhotos]   = useState([])
  const [showKidsMenu, setShowKidsMenu]       = useState(false)
  const [uploadingKidsMenu, setUploadingKidsMenu] = useState(false)
  const [reportingPhoto, setReportingPhoto]       = useState(false)

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

    // Load allergens
    const { data: aData } = await supabase
      .from('allergens')
      .select('*')
      .eq('restaurant_id', id)
    setAllergens(aData || [])

    // Load kids menu photos
    const { data: kmData } = await supabase
      .from('kids_menu_photos')
      .select('*')
      .eq('restaurant_id', id)
      .order('created_at')
    setKidsMenuPhotos(kmData || [])

    // Load my allergen votes
    if (user) {
      const { data: avData } = await supabase
        .from('allergen_votes')
        .select('allergen_key, vote')
        .eq('restaurant_id', id)
        .eq('user_id', user.id)
      if (avData) {
        const map = {}
        avData.forEach(v => { map[v.allergen_key] = v.vote })
        setMyAllergenVotes(map)
      }
    }

    // Store in cache
    restaurantCache[id] = {
      restaurant: r,
      amenities: r?.amenities || [],
      photos: pData || [],
      noiseVotes: nData ? Object.fromEntries([1,2,3,4,5].map(s => [s, nData.filter(v => v.score === s).length])) : {1:0,2:0,3:0,4:0,5:0},
      reviews: revData || [],
    }
    setLoading(false)
    if (r) track.viewRestaurant(r.name)
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

  async function castAllergenVote(allergen_key, vote) {
    if (!user) { showToast('Sign in to vote!', false); return }
    if (myAllergenVotes[allergen_key]) return
    // Check if allergen row exists, if not create it
    const existing = allergens.find(a => a.allergen_key === allergen_key)
    if (existing) {
      await supabase.from('allergens').update({
        yes_votes: existing.yes_votes + (vote === 'yes' ? 1 : 0),
        no_votes:  existing.no_votes  + (vote === 'no' ? 1 : 0),
        is_verified: (existing.yes_votes + existing.no_votes + 1) >= 5,
      }).eq('id', existing.id)
    } else {
      await supabase.from('allergens').insert({
        restaurant_id: id, allergen_key,
        yes_votes: vote === 'yes' ? 1 : 0,
        no_votes:  vote === 'no' ? 1 : 0,
      })
    }
    await supabase.from('allergen_votes').insert({
      restaurant_id: id, allergen_key, vote, user_id: user.id
    })
    setMyAllergenVotes(prev => ({ ...prev, [allergen_key]: vote }))
    setAllergens(prev => {
      const idx = prev.findIndex(a => a.allergen_key === allergen_key)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = {
          ...updated[idx],
          yes_votes: updated[idx].yes_votes + (vote === 'yes' ? 1 : 0),
          no_votes:  updated[idx].no_votes  + (vote === 'no' ? 1 : 0),
        }
        return updated
      }
      return [...prev, { restaurant_id: id, allergen_key,
        yes_votes: vote === 'yes' ? 1 : 0, no_votes: vote === 'no' ? 1 : 0, is_verified: false }]
    })
    showToast('+5 pts! Thanks for voting 🙌')
  }

  async function reportPhoto(photo) {
    if (!user) { showToast('Sign in to report!', false); return }
    setReportingPhoto(true)
    await supabase.from('photo_reports').insert({
      restaurant_id: id,
      photo_url: photo.photo_url,
      photo_id: photo.id || null,
      reported_by: user.id,
      status: 'pending',
    })
    setReportingPhoto(false)
    showToast('Thanks! We\'ll review this photo 🙏')
  }

  async function uploadKidsMenuPhoto(e) {
    if (!user) { showToast('Sign in to upload!', false); return }
    if (kidsMenuPhotos.length >= 1) { showToast('A menu photo already exists for this restaurant', false); return }
    const file = e.target.files[0]
    if (!file) return
    setUploadingKidsMenu(true)
    const ext  = file.name.split('.').pop()
    const path = 'kids-menus/' + id + '/' + Date.now() + '.' + ext
    const { error: upErr } = await supabase.storage
      .from('restaurant-photos')
      .upload(path, file)
    if (upErr) { showToast(upErr.message, false); setUploadingKidsMenu(false); return }
    const { data: urlData } = supabase.storage.from('restaurant-photos').getPublicUrl(path)
    await supabase.from('kids_menu_photos').insert({
      restaurant_id: id, uploaded_by: user.id, photo_url: urlData.publicUrl
    })
    setKidsMenuPhotos(prev => [...prev, { photo_url: urlData.publicUrl }])
    showToast('+10 pts! Kids menu photo added 🍟')
    setUploadingKidsMenu(false)
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
  const allergenMap   = Object.fromEntries(allergens.map(a => [a.allergen_key, a]))
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

      {/* Back nav with logo */}
      <div style={{ padding: '10px 16px', borderBottom: '0.5px solid #e5e7eb', background: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => window.history.back()}
          style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 13,
            cursor: 'pointer', fontFamily: "'Montserrat', sans-serif", display: 'flex',
            alignItems: 'center', gap: 4 }}>
          ← Back
        </button>
        <Link to="/">
          <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAIAAAAiOjnJAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAAAtJElEQVR42u29abRk2XUW+O19zh1iemPOmVVZc6mqVHKVhCRsY1tGhuUJFhZu3G67DTRg3NZqsdxu/4DVDYjGDW1oscRgaIZm4QWyjC1LGOHGZVkykmXKJck1uKqUyhpynvONMd57z9mbH/fGexHxIuK9lE23VXW+lap8iowXce8539ln72/vsy+pKgICfq/BYQgCArECArECArECAgKxAgKxAgKxAgICsQICsQICsQICArECArECArECAgKxAgKxAgKxAgICsQICsQICsQICArECArECArECAgKxAgKxAgKxAgICsQICsQICsQICArECArECArECAgKxAgKxAgKxAgICsQICsQICsQICArECArECArECAgKxAgKxAgKxAgICsQICsQICsQICArECArECArECAgKxAgKxAgKxAgICsQICsQICsQICArECArECArECAgKxAgKxAgKxAgICsQICsQICsQICpsKGIXiTQrX8Czp8har/Tf4ciPWG5QAmOaB7GQIQgQACBGCAaAafVEA8/Gfahz+qUB3/wvKb9tnrSFX/q48KHeBNWg7bxMXs3PboSvrdLiZMm55qFEdeYqKDfszk0NNwxdNXfWGiUK24wjTn8mnPi+WIk+ieXxRRZgACUJFpt41OW/NMxRMxkoTSOqUNiiIYo8bQkD20Z8SoHKnZQ3TnxNqZfp3xz8QAdHQlzLkIFQD70n/6iJbTWX04T/180TGLvzPhqBY3zf8WVZ1Nr3Lpm/2uVcYYsGMnZkAUCjXjX+pV27n2nQ68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AGG1bn7o0fiPP6CXt+EErcTctWRXanSkrl7Rzv35TRUgNXzPItdiOlaHF3RyuboNJ7ya2ncci771ND9xWDMPLgvjPURIAct6s6t9h3rkf+Wc+2fP6pU2v/VQ9MQx00zst96NXGitP/jQM36tDwXe0Mr0m0DHKp+uWoj5Yw/G33aaUquA9kQJnJjy4fMcs4gqMw8KiMIyLEGUEjNszSHl3+gXMMwnmiLXIEad3z2QbqsmN+VjcDSN7Nefin7gUU0tgOi7HpRzW/LKup7dcL/wFfMXn4C8kbfDNwGxmuVDBxE9vMypRe4pNlSzRKztXPuOCdr3AGgxppoBAwMnnYKZtOdVlRZjOlaHYd3IdOBpgfy1HgzDK3JBdfhDyTAdSilizTw/ftj+d49R3bpPvOIvbsc//HV2qWa+8S558TbXrKz13vDb4RufWLSalrNeCd9MAOjeBRhC7t1vX5duJre6FBu+ZxG1iJjVq//ta4hZrnfJGrprwTy4SolB5vNfOEOW9dnrqFlkjpxwEqkx5ASG+b5lWk61XejFbffRL+Pqtl7qUGp1M8tfXiueOoeG1XZhHj40IsMGYn2NepGnWjAkULSSnZP+5vEjxUqKzUw+dd5/5jxyoSMN89AqIsaJOl3ry3++6p+5xn2PlcQ8dohWavTIijx3S1+4JQOHuoUTeCiAlRRMxMyHamyN+Y773L96UaH0xWsgUkPmu+9zHz+rX7pBzUgGnu5dMH/09Bs+q/OGdt7LUv17l+meRTq5QIfr1YuqZiGJv+8RANLJsZHDkvn+R1CPODLx9z+GmHU7o41MIfZPvYVX6qyIvu8xPtZQJ1hO7J95nN96GEdqONLAkQadbulDS/zAMhT2vffaH3gUzVgbMY434j/3dfY779dugZpFZMy7jsYfeKdpJW/8jeINXzajgGwPAOKFZKzVNZF7bdN/4YoaNu88Ye9ZhCqBQHAXt/xvXYEov/2EfXC5fF0Jup3Jaxt0qmUON7TwKKTsTqzdAoY4tdgJ9dq5bmV0pE6xEQDdXC+30Ur4RJPe6Jvgm4VY8xg3+tiNsUOZkGEDw4nXK8jc6q5R3ky88w56ZQZifW1IWVPPr+lug+Ox6dexxsWjn1P+Ak0tfJj4xpG25RO/iECsgIDgvAcEYgUEYgUEBGIFBGIFBGIFBARiBQRiBQRiBQQEYgUEYgUEYgUEBGIFBGIFBGIFBARiBQRiBQRiBQQEYgUEYgUEYgUEBGIFBGIFBGIFBARiBQRiBQRiBQQEYgUEYgUEYgUEBGIFBGIFBGIFBARiBQRiBQRiBQQEYgUEYgUEYgUEBGIFBGIFBGIFBARiBQRiBQRiBQQEYgUEYgUEYgUEBGIFBGIFBGIFBARiBQRiBQRiBQRihSEICMQKCMQKCMQKCAjECgjECgjECggIxAr4GsB/AX4MxGszn5N/AAAAAElFTkSuQmCC"
            alt="Little Foodies" style={{ height: 28, width: 'auto' }} />
        </Link>
        <div style={{ width: 60 }} />
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
          fontFamily: "'IntroRust', 'Georgia', serif" }}>
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

        {/* Reservation button */}
        <div style={{ marginTop: 14 }}>
          {restaurant.opentable_url ? (
            <a href={restaurant.opentable_url} target="_blank" rel="noopener noreferrer"
              onClick={() => track.makeReservation(restaurant.name)}
              style={{ display: 'flex', alignItems: 'center', gap: 10,
                padding: '11px 14px', background: '#DA3743',
                borderRadius: 10, textDecoration: 'none',
                boxShadow: '0 2px 8px rgba(218,55,67,.25)' }}>
              <span style={{ fontSize: 18 }}>📅</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                  Make a reservation
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.8)' }}>
                  Opens reservation page
                </div>
              </div>
              <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,.7)', fontSize: 16 }}>›</span>
            </a>
          ) : restaurant.phone ? (
            <a href={'tel:' + restaurant.phone.replace(/[^0-9]/g, '')}
              style={{ display: 'flex', alignItems: 'center', gap: 10,
                padding: '11px 14px', background: '#fff',
                border: '1.5px solid #e5e7eb', borderRadius: 10, textDecoration: 'none' }}>
              <span style={{ fontSize: 18 }}>📞</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                  Call to reserve
                </div>
                <div style={{ fontSize: 10, color: '#9ca3af' }}>{restaurant.phone}</div>
              </div>
              <span style={{ marginLeft: 'auto', color: '#9ca3af', fontSize: 16 }}>›</span>
            </a>
          ) : null}
        </div>
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
              <div key={am.id}
                onClick={am.id === 'kidsmenu' ? () => setShowKidsMenu(true) : undefined}
                style={{ display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 5, minWidth: 60,
                cursor: am.id === 'kidsmenu' ? 'pointer' : 'default' }}>
                {am.id === 'kidsmenu' && (
                  <div style={{ fontSize: 8, color: '#f57b46', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: -2 }}>
                    View menu
                  </div>
                )}
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

      {/* Kids Menu Photo Modal */}
      {showKidsMenu && (
        <div onClick={() => setShowKidsMenu(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            zIndex: 9999, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 400,
              maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '0.5px solid #e5e7eb',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', ...font }}>
                🍟 Kids Menu
              </div>
              <button onClick={() => setShowKidsMenu(false)}
                style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%',
                  width: 30, height: 30, cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', padding: 16, flex: 1 }}>
              {kidsMenuPhotos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 13, ...font }}>
                  No kids menu photo yet — be the first to add one!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <img src={kidsMenuPhotos[0].photo_url} alt="Kids menu"
                    style={{ width: '100%', borderRadius: 12, objectFit: 'contain',
                      maxHeight: 420, background: '#f3f4f6' }} />
                  {/* Report button */}
                  <button
                    onClick={() => reportPhoto(kidsMenuPhotos[0])}
                    disabled={reportingPhoto}
                    style={{ width: '100%', padding: '10px 0', background: '#fff',
                      border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 12,
                      fontWeight: 600, color: '#9ca3af', cursor: 'pointer', ...font,
                      opacity: reportingPhoto ? .6 : 1 }}>
                    {reportingPhoto ? 'Reporting…' : '🚩 Report image as incorrect'}
                  </button>
                </div>
              )}
              {/* Only show upload button if no photo exists yet */}
              {kidsMenuPhotos.length === 0 && (
                <label style={{ display: 'block', marginTop: 16, padding: '12px 0',
                  background: '#fff3ee', border: '1.5px dashed #fdc9b0', borderRadius: 12,
                  textAlign: 'center', cursor: 'pointer', ...font }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#c2410c' }}>
                    {uploadingKidsMenu ? 'Uploading…' : '📷 Add kids menu photo · +10 pts'}
                  </span>
                  <input type="file" accept="image/*" onChange={uploadKidsMenuPhoto}
                    style={{ display: 'none' }} />
                </label>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Allergen Section */}
      <div style={{ padding: '14px 16px', background: '#fff', borderBottom: '0.5px solid #f3f4f6', marginTop: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#374151',
          textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
          ⚠️ Allergen info
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 12, lineHeight: 1.6 }}>
          Community-reported · always confirm with the restaurant directly
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {ALLERGENS.map(al => {
            const data      = allergenMap[al.id]
            const isVer     = data?.is_verified
            const likelyYes = data && data.yes_votes >= data.no_votes && data.yes_votes > 0
            const confirmed = isVer && likelyYes
            const denied    = isVer && !likelyYes
            const noData    = !data
            return (
              <div key={al.id} style={{ display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: confirmed ? al.color : denied ? '#f3f4f6' : '#fafafa',
                border: '1.5px solid ' + (confirmed ? al.border : denied ? '#d1d5db' : '#e5e7eb'),
                color: confirmed ? al.text : denied ? '#9ca3af' : '#d1d5db',
                opacity: denied ? 0.6 : 1 }}>
                <span>{al.icon}</span>
                <span>{al.label}</span>
                {confirmed && <span style={{ fontSize: 10 }}>✓</span>}
                {denied && <span style={{ fontSize: 10 }}>✗</span>}
                {noData && <span style={{ fontSize: 10, color: '#d1d5db' }}>?</span>}
              </div>
            )
          })}
        </div>

        {/* Allergen voting */}
        <div style={{ borderTop: '0.5px solid #f3f4f6', paddingTop: 12 }}>
          <div style={{ fontSize: 11, color: '#374151', fontWeight: 600, marginBottom: 8 }}>
            Know something? Help other parents · earn 5 pts each
          </div>
          {ALLERGENS.map(al => {
            const myV  = myAllergenVotes[al.id]
            const data = allergenMap[al.id] || { yes_votes: 0, no_votes: 0 }
            const total = data.yes_votes + data.no_votes
            return (
              <div key={al.id} style={{ display: 'flex', alignItems: 'center',
                gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 16, minWidth: 24 }}>{al.icon}</span>
                <span style={{ fontSize: 12, flex: 1, color: '#374151', fontWeight: 500 }}>
                  {al.label}
                  {total > 0 && <span style={{ color: '#9ca3af', fontWeight: 400 }}> · {total} vote{total !== 1 ? 's' : ''}</span>}
                </span>
                {myV ? (
                  <span style={{ fontSize: 11, color: '#00a994', fontWeight: 600 }}>✓ Voted {myV}</span>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => castAllergenVote(al.id, 'yes')}
                      style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11,
                        fontWeight: 600, cursor: 'pointer', background: '#e6f7f5',
                        color: '#065f55', border: '1.5px solid #99ddd6', ...font }}>
                      Yes
                    </button>
                    <button onClick={() => castAllergenVote(al.id, 'no')}
                      style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11,
                        fontWeight: 600, cursor: 'pointer', background: '#fef0f8',
                        color: '#9d1479', border: '1.5px solid #f9b8e0', ...font }}>
                      No
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
