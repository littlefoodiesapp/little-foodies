import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { getRestaurants, addFavorite, removeFavorite } from '../lib/api'
import { useAuth } from '../hooks/useAuth'

const LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAIAAAAiOjnJAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAAAtJElEQVR42u29abRk2XUW+O19zh1iemPOmVVZc6mqVHKVhCRsY1tGhuUJFhZu3G67DTRg3NZqsdxu/4DVDYjGDW1oscRgaIZm4QWyjC1LGOHGZVkykmXKJck1uKqUyhpynvONMd57z9mbH/fGexHxIuK9lE23VXW+lap8iowXce8539ln72/vsy+pKgICfq/BYQgCArECArECArECAgKxAgKxAgKxAgICsQICsQICsQICArECArECArECAgKxAgKxAgKxAgICsQICsQICsQICArECArECArECAgKxAgKxAgKxAgICsQICsQICsQICArECArECArECAgKxAgKxAgKxAgICsQICsQICsQICArECArECArECAgKxAgKxAgKxAgICsQICsQICsQICArECArECArECAgKxAgKxAgKxAgICsQICsQICsQICArECArECArECAgKxAgKxAgKxAgICsQICsQICsQICpsKGIXiTQrX8Czp8har/Tf4ciPWG5QAmOaB7GQIQgQACBGCAaAafVEA8/Gfahz+qUB3/wvKb9tnrSFX/q48KHeBNWg7bxMXs3PboSvrdLiZMm55qFEdeYqKDfszk0NNwxdNXfWGiUK24wjTn8mnPi+WIk+ieXxRRZgACUJFpt41OW/NMxRMxkoTSOqUNiiIYo8bQkD20Z8SoHKnZQ3TnxNqZfp3xz8QAdHQlzLkIFQD70n/6iJbTWX04T/180TGLvzPhqBY3zf8WVZ1Nr3Lpm/2uVcYYsGMnZkAUCjXjX+pV27n2nQ68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AGG1bn7o0fiPP6CXt+EErcTctWRXanSkrl7Rzv35TRUgNXzPItdiOlaHF3RyuboNJ7ya2ncci771ND9xWDMPLgvjPURIAct6s6t9h3rkf+Wc+2fP6pU2v/VQ9MQx00zst96NXGitP/jQM36tDwXe0Mr0m0DHKp+uWoj5Yw/G33aaUquA9kQJnJjy4fMcs4gqMw8KiMIyLEGUEjNszSHl3+gXMMwnmiLXIEad3z2QbqsmN+VjcDSN7Nefin7gUU0tgOi7HpRzW/LKup7dcL/wFfMXn4C8kbfDNwGxmuVDBxE9vMypRe4pNlSzRKztXPuOCdr3AGgxppoBAwMnnYKZtOdVlRZjOlaHYd3IdOBpgfy1HgzDK3JBdfhDyTAdSilizTw/ftj+d49R3bpPvOIvbsc//HV2qWa+8S558TbXrKz13vDb4RufWLSalrNeCd9MAOjeBRhC7t1vX5duJre6FBu+ZxG1iJjVq//ta4hZrnfJGrprwTy4SolB5vNfOEOW9dnrqFlkjpxwEqkx5ASG+b5lWk61XejFbffRL+Pqtl7qUGp1M8tfXiueOoeG1XZhHj40IsMGYn2NepGnWjAkULSSnZP+5vEjxUqKzUw+dd5/5jxyoSMN89AqIsaJOl3ry3++6p+5xn2PlcQ8dohWavTIijx3S1+4JQOHuoUTeCiAlRRMxMyHamyN+Y773L96UaH0xWsgUkPmu+9zHz+rX7pBzUgGnu5dMH/09Bs+q/OGdt7LUv17l+meRTq5QIfr1YuqZiGJv+8RANLJsZHDkvn+R1CPODLx9z+GmHU7o41MIfZPvYVX6qyIvu8xPtZQJ1hO7J95nN96GEdqONLAkQadbulDS/zAMhT2vffaH3gUzVgbMY434j/3dfY779dugZpFZMy7jsYfeKdpJW/8jeINXzajgGwPAOKFZKzVNZF7bdN/4YoaNu88Ye9ZhCqBQHAXt/xvXYEov/2EfXC5fF0Jup3Jaxt0qmUON7TwKKTsTqzdAoY4tdgJ9dq5bmV0pE6xEQDdXC+30Ur4RJPe6Jvgm4VY8xg3+tiNsUOZkGEDw4nXK8jc6q5R3ky88w56ZQZifW1IWVPPr+lug+Ox6dexxsWjn1P+Ak0tfJj4xpG25RO/iECsgIDgvAcEYgUEYgUEBGIFBGIFBGIFBARiBQRiBQRiBQQEYgUEYgUEYgUEBGIFBGIFBGIFBARiBQRiBQRiBQQEYgUEYgUEYgUEBGIFBGIFBGIFBARiBQRiBQRiBQQEYgUEYgUEYgUEBGIFBGIFBGIFBARiBQRiBQRiBQQEYgUEYgUEYgUEBGIFBGIFBGIFBARiBQRiBQRiBQQEYgUEYgUEYgUEBGIFBGIFBGIFBARiBQRiBQRiBQRihSEICMQKCMQKCMQKCAjECgjECgjECggIxAr4GsB/AX4MxGszn5N/AAAAAElFTkSuQmCC'

const FILTERS = [
  { id: 'highchair',  label: 'High chairs',     icon: '🪑' },
  { id: 'changing_f', label: "Women's changing", icon: '🚺' },
  { id: 'changing_m', label: "Men's changing",   icon: '🚹' },
  { id: 'kidsmenu',   label: 'Kids menu',        icon: '🍟' },
  { id: 'stroller',   label: 'Stroller',         icon: '🛻' },
  { id: 'outdoor',    label: 'Outdoor',          icon: '🌿' },
  { id: 'quiet',      label: 'Quiet',            icon: '🤫' },
]

const BG = ['#fff3ee','#fefae8','#e6f7f5','#fef0f8','#e8f4fd','#f0fdf4']
const font = { fontFamily: "'Montserrat', sans-serif" }

// NJ zip code coordinates for radius search
const ZIP_COORDS = {
  '07001': [40.576, -74.264], '07002': [40.666, -74.107], '07003': [40.808, -74.188],
  '07004': [40.877, -74.299], '07005': [40.918, -74.329], '07006': [40.857, -74.285],
  '07007': [40.820, -74.205], '07008': [40.577, -74.228], '07009': [40.851, -74.222],
  '07010': [40.827, -74.003], '07011': [40.899, -74.139], '07012': [40.864, -74.215],
  '07013': [40.857, -74.182], '07014': [40.840, -74.147], '07015': [40.886, -74.106],
  '07016': [40.657, -74.301], '07017': [40.763, -74.218], '07018': [40.739, -74.218],
  '07019': [40.763, -74.218], '07020': [40.827, -73.975], '07021': [40.828, -74.275],
  '07022': [40.823, -74.006], '07023': [40.642, -74.352], '07024': [40.853, -73.993],
  '07025': [40.953, -74.128], '07026': [40.930, -74.102], '07027': [40.650, -74.325],
  '07028': [40.796, -74.203], '07029': [40.744, -74.154], '07030': [40.744, -74.031],
  '07031': [40.792, -74.127], '07032': [40.744, -74.127], '07033': [40.658, -74.281],
  '07034': [40.878, -74.329], '07035': [40.946, -74.279], '07036': [40.617, -74.243],
  '07039': [40.777, -74.327], '07040': [40.727, -74.264], '07041': [40.726, -74.302],
  '07042': [40.795, -74.206], '07043': [40.843, -74.223], '07044': [40.831, -74.248],
  '07045': [40.908, -74.357], '07046': [40.947, -74.368], '07047': [40.793, -74.015],
  '07050': [40.769, -74.237], '07052': [40.793, -74.246], '07054': [40.845, -74.401],
  '07055': [40.856, -74.128], '07057': [40.855, -74.109], '07058': [40.866, -74.338],
  '07059': [40.622, -74.442], '07060': [40.620, -74.421], '07061': [40.620, -74.421],
  '07062': [40.596, -74.388], '07063': [40.591, -74.431], '07064': [40.550, -74.245],
  '07065': [40.570, -74.286], '07066': [40.627, -74.314], '07067': [40.580, -74.310],
  '07068': [40.817, -74.297], '07069': [40.638, -74.430], '07070': [40.858, -74.099],
  '07071': [40.833, -74.115], '07072': [40.815, -74.060], '07073': [40.818, -74.086],
  '07074': [40.837, -74.051], '07075': [40.842, -74.073], '07076': [40.641, -74.357],
  '07077': [40.544, -74.259], '07078': [40.739, -74.325], '07079': [40.745, -74.257],
  '07080': [40.573, -74.411], '07081': [40.700, -74.327], '07082': [40.898, -74.340],
  '07083': [40.698, -74.268], '07086': [40.768, -74.018], '07087': [40.756, -74.034],
  '07088': [40.706, -74.280], '07090': [40.657, -74.349], '07091': [40.657, -74.349],
  '07092': [40.677, -74.338], '07093': [40.787, -74.010], '07094': [40.786, -74.030],
  '07095': [40.556, -74.281], '07096': [40.786, -74.030], '07097': [40.786, -74.030],
  '07099': [40.744, -74.127], '07101': [40.735, -74.172], '07102': [40.735, -74.172],
  '07103': [40.730, -74.185], '07104': [40.762, -74.165], '07105': [40.716, -74.143],
  '07106': [40.738, -74.207], '07107': [40.756, -74.183], '07108': [40.722, -74.196],
  '07109': [40.793, -74.152], '07110': [40.808, -74.157], '07111': [40.722, -74.233],
  '07112': [40.714, -74.218], '07114': [40.699, -74.169], '07201': [40.663, -74.213],
  '07202': [40.649, -74.220], '07203': [40.635, -74.241], '07204': [40.650, -74.252],
  '07205': [40.670, -74.235], '07206': [40.660, -74.196], '07207': [40.663, -74.213],
  '07208': [40.671, -74.254], '07302': [40.719, -74.048], '07303': [40.719, -74.048],
  '07304': [40.714, -74.073], '07305': [40.695, -74.090], '07306': [40.733, -74.063],
  '07307': [40.752, -74.053], '07310': [40.733, -74.046], '07311': [40.717, -74.033],
}

// Haversine distance in miles
function distanceMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function isZipCode(str) {
  return /^\d{5}$/.test(str.trim())
}

function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="2"/>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/>
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor"/>
    </svg>
  )
}

export default function ExplorePage() {
  const { user } = useAuth()
  const [restaurants, setRestaurants] = useState([])
  const [favIds, setFavIds]           = useState(new Set())
  const [activeFilters, setFilters]   = useState(new Set())
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [radius, setRadius]           = useState(5)

  useEffect(() => {
    getRestaurants().then(({ data }) => {
      setRestaurants(data || [])
      setLoading(false)
    })
    // Restore search state when coming back from a restaurant page
    const savedSearch = sessionStorage.getItem('lf_search')
    const savedRadius = sessionStorage.getItem('lf_radius')
    if (savedSearch) {
      setSearch(savedSearch)
      setHasSearched(true)
      sessionStorage.removeItem('lf_search')
    }
    if (savedRadius) {
      setRadius(Number(savedRadius))
      sessionStorage.removeItem('lf_radius')
    }
  }, [])

  function handleSearchChange(val) {
    setSearch(val)
    sessionStorage.setItem('lf_search', val)
    if (val.trim().length === 0) {
      setHasSearched(false)
      sessionStorage.setItem('lf_hassearched', 'false')
    }
  }

  function submitSearch() {
    if (search.trim().length > 0) {
      setHasSearched(true)
      sessionStorage.setItem('lf_hassearched', 'true')
    }
  }

  function handleQuickSearch(val) {
    setSearch(val)
    setHasSearched(true)
    sessionStorage.setItem('lf_search', val)
    sessionStorage.setItem('lf_hassearched', 'true')
  }

  function clearSearch() {
    setSearch('')
    setHasSearched(false)
    setFilters(new Set())
  }

  function toggleFilter(id) {
    setFilters(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  async function toggleFav(e, r) {
    e.preventDefault()
    if (!user) { alert('Sign in to save favorites!'); return }
    const wasFaved = favIds.has(r.id)
    setFavIds(prev => {
      const n = new Set(prev)
      wasFaved ? n.delete(r.id) : n.add(r.id)
      return n
    })
    wasFaved ? await removeFavorite(r.id) : await addFavorite(r.id)
  }

  const term = search.trim().toLowerCase()
  const isZip = true  // Search is zip-code only
  const searchCoords = ZIP_COORDS[term] || null

  const visible = restaurants
    .filter(r => {
      if (!term) return false

      // Zip radius search
      if (isZip && searchCoords) {
        const rCoords = ZIP_COORDS[r.zip]
        if (rCoords) {
          const dist = distanceMiles(searchCoords[0], searchCoords[1], rCoords[0], rCoords[1])
          return dist <= radius
        }
        // Fallback: match zip directly if no coords
        return (r.zip || '').includes(term)
      }

      // Zip code text match fallback
      return (r.zip || '').toLowerCase().includes(term)
    })
    .filter(r => {
      if (!activeFilters.size) return true
      return [...activeFilters].every(f =>
        (r.amenities || []).some(a => a.amenity_key === f && a.yes_votes > a.no_votes)
      )
    })

  const noResults = hasSearched && term && visible.length === 0

  return (
    <div style={{ ...font, background: '#f9fafb', minHeight: '100vh', paddingBottom: 80 }}>

      {/* ── HOME / LANDING ─────────────────────────────────── */}
      {!hasSearched && (
        <div style={{ background: '#fff' }}>
          <div style={{ padding: '48px 24px 20px', textAlign: 'center' }}>
            <img src={LOGO} alt="Little Foodies"
              style={{ height: 80, width: 'auto', marginBottom: 16 }} />
            <p style={{ fontSize: 16, color: '#6b7280', lineHeight: 1.5,
              fontWeight: 500, maxWidth: 280, margin: '0 auto 28px' }}>
              Because every family deserves a great meal out.
            </p>
          </div>

          <div style={{ padding: '0 20px 24px' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%',
                transform: 'translateY(-50%)', fontSize: 18, pointerEvents: 'none' }}>🔍</span>
              <input
                type="search"
                value={search}
                onChange={e => handleSearchChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitSearch()}
                placeholder="Search by zip code..."
                style={{ width: '100%', padding: '14px 100px 14px 44px',
                  border: '2px solid #f57b46', borderRadius: 14, fontSize: 16,
                  outline: 'none', background: '#fff',
                  boxSizing: 'border-box', ...font,
                  boxShadow: '0 4px 20px rgba(245,123,70,.15)' }}
              />
              <button onClick={submitSearch}
                style={{ position: 'absolute', right: 8, top: '50%',
                  transform: 'translateY(-50%)', padding: '8px 16px',
                  background: '#f57b46', border: 'none', borderRadius: 10,
                  color: '#fff', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', ...font }}>
                Search
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {['07083', '07066', '07016', '07974', '07060', '07901'].map(q => (
                <button key={q} onClick={() => handleQuickSearch(q)}
                  style={{ padding: '6px 13px', background: '#fff',
                    border: '1px solid #e5e7eb', borderRadius: 20,
                    fontSize: 12, fontWeight: 500, color: '#6b7280',
                    cursor: 'pointer', ...font }}>
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { icon: '✓', color: '#00a994', bg: '#e6f7f5', border: '#99ddd6',
                title: 'Community verified',
                desc: 'Real parents confirm high chairs, changing tables, kids menus & more' },
              { icon: '🏅', color: '#f57b46', bg: '#fff3ee', border: '#fdc9b0',
                title: 'Earn points',
                desc: 'Vote on amenities, add restaurants, write reviews — earn rewards' },
              { icon: '🎉', color: '#0692e5', bg: '#e8f4fd', border: '#9ed4f6',
                title: 'Family events',
                desc: 'Find family nights, cooking classes and kids events near you' },
            ].map(f => (
              <div key={f.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start',
                padding: '12px 14px', background: f.bg, border: '0.5px solid ' + f.border,
                borderRadius: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, flexShrink: 0, color: f.color, fontWeight: 700 }}>
                  {f.icon}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 2 }}>{f.title}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: '28px 20px 20px', textAlign: 'center',
            borderTop: '0.5px solid #f3f4f6', marginTop: 24 }}>
            <a href="https://www.instagram.com/littlefoodiesapp/"
              target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
                textDecoration: 'none', color: '#6b7280', padding: '10px 20px',
                borderRadius: 20, border: '1px solid #e5e7eb', background: '#fff',
                fontSize: 13, fontWeight: 600, ...font }}>
              <span style={{ color: '#e1306c' }}><InstagramIcon /></span>
              Follow us @littlefoodiesapp
            </a>
            <p style={{ fontSize: 10, color: '#d1d5db', marginTop: 12 }}>
              Little Foodies · Union, Clark & Cranford, NJ
            </p>
          </div>
        </div>
      )}

      {/* ── SEARCH RESULTS ─────────────────────────────────── */}
      {hasSearched && (
        <>
          {/* Sticky compact header */}
          <div style={{ background: '#fff', padding: '12px 16px',
            borderBottom: '0.5px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <img src={LOGO} alt="Little Foodies" style={{ height: 28, width: 'auto' }} />
              <div style={{ flex: 1 }} />
              <button onClick={clearSearch}
                style={{ fontSize: 11, color: '#f57b46', fontWeight: 600,
                  background: 'none', border: 'none', cursor: 'pointer', ...font }}>
                ← Home
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 11, top: '50%',
                transform: 'translateY(-50%)', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
              <input
                type="search"
                value={search}
                onChange={e => handleSearchChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitSearch()}
                placeholder="Search by zip code..."
                style={{ width: '100%', padding: '9px 70px 9px 33px',
                  border: '1.5px solid #f57b46', borderRadius: 10, fontSize: 16,
                  outline: 'none', background: '#fff', boxSizing: 'border-box', ...font }}
              />
              <button onClick={submitSearch}
                style={{ position: 'absolute', right: search ? 28 : 6, top: '50%',
                  transform: 'translateY(-50%)', padding: '5px 10px',
                  background: '#f57b46', border: 'none', borderRadius: 8,
                  color: '#fff', fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', ...font }}>
                Go
              </button>
              {search && (
                <button onClick={clearSearch}
                  style={{ position: 'absolute', right: 6, top: '50%',
                    transform: 'translateY(-50%)', background: '#e5e7eb',
                    border: 'none', borderRadius: '50%', width: 20, height: 20,
                    cursor: 'pointer', fontSize: 11, color: '#6b7280',
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ✕
                </button>
              )}
            </div>

            {/* Radius selector — only show for zip searches */}
            {isZip && searchCoords && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>Radius:</span>
                {[2, 5, 10, 15, 25].map(r => (
                  <button key={r} onClick={() => { setRadius(r); sessionStorage.setItem('lf_radius', r) }}
                    style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11,
                      fontWeight: 600, cursor: 'pointer', border: 'none',
                      background: radius === r ? '#f57b46' : '#f3f4f6',
                      color: radius === r ? '#fff' : '#6b7280', ...font }}>
                    {r} mi
                  </button>
                ))}
              </div>
            )}

            {/* Zip context label */}
            {isZip && searchCoords && (
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
                📍 Showing restaurants within {radius} miles of {term}
              </div>
            )}
            {isZip && !searchCoords && (
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
                📍 Zip code not in our database yet — showing exact matches
              </div>
            )}
          </div>

          {/* Points banner */}
          <div style={{ margin: '10px 16px 0', background: '#e8f4fd',
            border: '0.5px solid #9ed4f6', borderRadius: 12,
            padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>🗳️</span>
            <div style={{ fontSize: 11, color: '#0552a0' }}>
              <strong>Help verify family amenities</strong> · Earn 5 pts per vote · 5 in a row = +20 pt bonus!
            </div>
          </div>

          {/* Filter chips */}
          <div style={{ display: 'flex', gap: 7, padding: '10px 16px',
            overflowX: 'auto', scrollbarWidth: 'none' }}>
            {FILTERS.map(f => (
              <div key={f.id} onClick={() => toggleFilter(f.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 4,
                  padding: '6px 11px', borderRadius: 20, whiteSpace: 'nowrap',
                  border: activeFilters.has(f.id) ? '1.5px solid #f57b46' : '1.5px solid #e5e7eb',
                  background: activeFilters.has(f.id) ? '#fff3ee' : '#fff',
                  color: activeFilters.has(f.id) ? '#c2410c' : '#6b7280',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                <span style={{ fontSize: 12 }}>{f.icon}</span>{f.label}
              </div>
            ))}
          </div>

          {/* Count */}
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af',
            padding: '0 16px', marginBottom: 10, textTransform: 'uppercase',
            letterSpacing: '.06em' }}>
            {loading ? 'Loading...'
              : visible.length + ' restaurant' + (visible.length !== 1 ? 's' : '') + ' found'
              + (isZip && searchCoords ? ' within ' + radius + ' miles' : '')}
          </div>

          {/* No results */}
          {noResults && (
            <div style={{ margin: '0 16px', background: '#fff', border: '0.5px solid #e5e7eb',
              borderRadius: 14, padding: '32px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 6 }}>
                No restaurants found{isZip ? ' within ' + radius + ' miles of ' + term : ' for "' + search + '"'}
              </div>
              {isZip && (
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                  Try increasing the radius above ↑
                </div>
              )}
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 20, lineHeight: 1.6 }}>
                Be the first to add a family-friendly restaurant here and earn <strong>50 points!</strong>
              </div>
              <Link to="/add" style={{ display: 'inline-block', padding: '11px 24px',
                background: '#f57b46', color: '#fff', borderRadius: 10,
                fontSize: 13, fontWeight: 600, textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(245,123,70,.35)' }}>
                + Add a restaurant
              </Link>
              <div style={{ marginTop: 14 }}>
                <button onClick={clearSearch}
                  style={{ background: 'none', border: 'none', color: '#6b7280',
                    fontSize: 12, cursor: 'pointer', textDecoration: 'underline', ...font }}>
                  ← Back to home
                </button>
              </div>
            </div>
          )}

          {/* Cards */}
          {!noResults && visible.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 16px' }}>
              {visible.map((r, i) => {
                const verifiedAms = (r.amenities || []).filter(a => a.is_verified).slice(0, 3)
                const isPending   = r.status === 'pending'
                // Calculate distance if zip search
                let distLabel = null
                if (isZip && searchCoords && r.zip && ZIP_COORDS[r.zip]) {
                  const d = distanceMiles(searchCoords[0], searchCoords[1],
                    ZIP_COORDS[r.zip][0], ZIP_COORDS[r.zip][1])
                  distLabel = d.toFixed(1) + ' mi away'
                }
                return (
                  <Link key={r.id} to={'/restaurant/' + r.id}
                    onClick={() => {
                      sessionStorage.setItem('lf_search', search)
                      sessionStorage.setItem('lf_radius', String(radius))
                    }}
                    style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ background: '#fff', border: '0.5px solid #e5e7eb',
                      borderRadius: 14, overflow: 'hidden' }}>
                      <div style={{ height: 90, background: BG[i % BG.length],
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 42 }}>
                        {r.emoji || '🍽️'}
                      </div>
                      <div style={{ padding: '11px 13px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start',
                          justifyContent: 'space-between', marginBottom: 2 }}>
                          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{r.name}</div>
                          <button onClick={e => toggleFav(e, r)}
                            style={{ background: 'none', border: 'none', fontSize: 18,
                              cursor: 'pointer', color: favIds.has(r.id) ? '#f46ab8' : '#d1d5db',
                              padding: 0, flexShrink: 0, marginLeft: 8 }}>
                            {favIds.has(r.id) ? '♥' : '♡'}
                          </button>
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>{r.cuisine}</div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                          {isPending ? (
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20,
                              fontWeight: 600, background: '#fefae8', color: '#854d0e',
                              border: '0.5px solid #fde9a0' }}>⏳ Pending</span>
                          ) : (
                            <>
                              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20,
                                fontWeight: 600, background: '#e6f7f5', color: '#065f55',
                                border: '0.5px solid #99ddd6' }}>✓ Verified</span>
                              {verifiedAms.map(a => (
                                <span key={a.amenity_key} style={{ fontSize: 10, padding: '2px 7px',
                                  borderRadius: 20, background: '#e6f7f5', color: '#065f55',
                                  border: '0.5px solid #99ddd6' }}>
                                  {FILTERS.find(x => x.id === a.amenity_key)?.icon}
                                </span>
                              ))}
                            </>
                          )}
                          {distLabel && (
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20,
                              fontWeight: 600, background: '#f0fdf4', color: '#166534',
                              border: '0.5px solid #86efac' }}>
                              📍 {distLabel}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center',
                          justifyContent: 'space-between', paddingTop: 8,
                          borderTop: '0.5px solid #f3f4f6' }}>
                          <span style={{ fontSize: 10, color: '#9ca3af' }}>{r.hours}</span>
                          {r.city && <span style={{ fontSize: 10, color: '#9ca3af' }}>{r.city}, {r.state}</span>}
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          <div style={{ padding: '24px 20px 8px', textAlign: 'center' }}>
            <a href="https://www.instagram.com/littlefoodiesapp/"
              target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7,
                textDecoration: 'none', color: '#9ca3af', fontSize: 11, ...font }}>
              <InstagramIcon />
              @littlefoodiesapp
            </a>
          </div>
        </>
      )}
    </div>
  )
}
