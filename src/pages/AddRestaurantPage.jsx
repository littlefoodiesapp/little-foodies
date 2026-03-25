import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const font = { fontFamily: "'Montserrat', sans-serif" }
const WORKER_URL = 'https://little-foodies-places.littlefoodiesapp.workers.dev'

const CUISINES = [
  'American', 'Italian', 'Mexican', 'Chinese', 'Japanese', 'Indian',
  'Thai', 'Mediterranean', 'Greek', 'French', 'Spanish', 'Korean',
  'Vietnamese', 'Middle Eastern', 'BBQ', 'Seafood', 'Pizza',
  'Burgers', 'Sandwiches', 'Breakfast & Brunch', 'Cafe & Coffee',
  'Bakery', 'Ice Cream & Desserts', 'Irish Pub', 'Bar & Grill',
  'Farm to Table', 'Vegetarian & Vegan', 'Other'
]

const EMOJIS = ['🍕','🍝','🍔','🌮','🍣','🍜','🥗','🍺','🍷','🛒','🍽️','🥘','🌯','🥙','🍱','🧆','🥞','🍦','☕','🥐']

const AMENITIES = [
  { id: 'highchair',  label: 'High chairs',       icon: '🪑', desc: 'Baby or toddler high chairs available' },
  { id: 'changing_f', label: "Women's changing",   icon: '🚺', desc: "Changing table in women's restroom" },
  { id: 'changing_m', label: "Men's changing",     icon: '🚹', desc: "Changing table in men's restroom" },
  { id: 'kidsmenu',   label: 'Kids menu',          icon: '🍟', desc: 'Dedicated kids menu available' },
  { id: 'stroller',   label: 'Stroller friendly',  icon: '🛻', desc: 'Easy stroller access throughout' },
  { id: 'outdoor',    label: 'Outdoor seating',    icon: '🌿', desc: 'Outdoor or patio seating available' },
  { id: 'quiet',      label: 'Quiet atmosphere',   icon: '🤫', desc: 'Generally quiet, good for little ones' },
]

const inp = {
  width: '100%', padding: '10px 13px', border: '1.5px solid #e5e7eb',
  borderRadius: 10, fontSize: 13, boxSizing: 'border-box',
  outline: 'none', ...font, background: '#fafafa', marginTop: 4
}
const lbl = {
  fontSize: 11, fontWeight: 600, color: '#374151',
  textTransform: 'uppercase', letterSpacing: '.05em', ...font
}

export default function AddRestaurantPage() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const [step, setStep]           = useState(1)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [success, setSuccess]     = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [placeSelected, setPlaceSelected] = useState(false)
  const debounceRef = useRef(null)

  const [form, setForm] = useState({
    name: '', cuisine: '', address: '', city: '', state: 'NJ',
    zip: '', phone: '', website: '', hours: '', emoji: '🍽️', opentable_url: ''
  })

  const [amenitySelections, setAmenitySelections] = useState({
    highchair: 'unknown', changing_f: 'unknown', changing_m: 'unknown',
    kidsmenu: 'unknown', stroller: 'unknown', outdoor: 'unknown', quiet: 'unknown'
  })

  function update(field, val) {
    setForm(prev => ({ ...prev, [field]: val }))
    setError(null)
  }

  // Search Google Places as user types
  async function handleSearchInput(val) {
    setSearchQuery(val)
    setPlaceSelected(false)
    update('name', val)

    if (val.length < 2) { setSuggestions([]); setShowSuggestions(false); return }

    // Debounce
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${WORKER_URL}/places/autocomplete?input=${encodeURIComponent(val)}&location=40.698,-74.268&radius=50000`
        )
        const data = await res.json()
        if (data.predictions) {
          setSuggestions(data.predictions.slice(0, 5))
          setShowSuggestions(true)
        }
      } catch (e) {
        console.error('Places error:', e)
      }
    }, 300)
  }

  // When user selects a suggestion, fetch full details
  async function selectPlace(prediction) {
    setShowSuggestions(false)
    setSearchQuery(prediction.structured_formatting?.main_text || prediction.description)

    try {
      const res = await fetch(
        `${WORKER_URL}/places/details?place_id=${prediction.place_id}`
      )
      const data = await res.json()
      const p = data.result

      if (p) {
        // Parse address components
        const components = p.address_components || []
        const get = (type) => components.find(c => c.types.includes(type))?.long_name || ''
        const getShort = (type) => components.find(c => c.types.includes(type))?.short_name || ''

        const streetNumber = get('street_number')
        const streetName   = get('route')
        const city         = get('locality') || get('sublocality') || get('neighborhood')
        const state        = getShort('administrative_area_level_1')
        const zip          = get('postal_code')

        // Parse hours from Google Places opening_hours
        let parsedHours = ''
        if (p.opening_hours?.weekday_text?.length) {
          // Convert "Monday: 11:00 AM – 10:00 PM" → { Monday: "11:00 AM – 10:00 PM", ... }
          const hoursObj = {}
          p.opening_hours.weekday_text.forEach(line => {
            const colon = line.indexOf(': ')
            if (colon > -1) {
              const day = line.slice(0, colon)
              const time = line.slice(colon + 2)
              hoursObj[day] = time
            }
          })
          parsedHours = JSON.stringify(hoursObj)
        }

        setForm(prev => ({
          ...prev,
          name:    p.name || prev.name,
          address: streetNumber ? `${streetNumber} ${streetName}` : streetName,
          city,
          state:   state || 'NJ',
          zip,
          phone:   p.formatted_phone_number || '',
          website: p.website ? p.website.replace(/\/$/, '') : '',
          hours:   parsedHours || prev.hours,
        }))
        setPlaceSelected(true)
      }
    } catch (e) {
      console.error('Place details error:', e)
    }
  }

  async function handleSubmit() {
    if (!form.name || !form.address) { setError('Restaurant name and address are required'); return }
    setLoading(true)
    setError(null)
    try {
      const currentUser = user
      const { data: newRestaurant, error: insertErr } = await supabase
        .from('restaurants')
        .insert({
          name: form.name, cuisine: form.cuisine, address: form.address,
          city: form.city, state: form.state, zip: form.zip,
          phone: form.phone, website: form.website, hours: form.hours,
          emoji: form.emoji, opentable_url: form.opentable_url || null,
          status: 'pending', submitted_by: currentUser?.id,
        })
        .select().single()

      if (insertErr) throw new Error(insertErr.message)

      // Insert amenity votes
      const amenityInserts = Object.entries(amenitySelections)
        .filter(([, val]) => val !== 'unknown')
        .map(([key, val]) => ({
          id: crypto.randomUUID(), restaurant_id: newRestaurant.id,
          amenity_key: key, yes_votes: val === 'yes' ? 1 : 0,
          no_votes: val === 'no' ? 1 : 0, is_verified: false,
        }))
      if (amenityInserts.length > 0) {
        await supabase.from('amenities').insert(amenityInserts)
        const voteInserts = Object.entries(amenitySelections)
          .filter(([, val]) => val !== 'unknown')
          .map(([key, val]) => ({
            id: crypto.randomUUID(), restaurant_id: newRestaurant.id,
            amenity_key: key, user_id: currentUser?.id, vote: val,
          }))
        await supabase.from('amenity_votes').insert(voteInserts)
      }

      // Award points
      if (currentUser) {
        const amenityVoteCount = Object.values(amenitySelections).filter(v => v !== 'unknown').length
        const totalPoints = 50 + (amenityVoteCount * 5)
        await supabase.from('points_ledger').insert([
          { id: crypto.randomUUID(), user_id: currentUser.id, action: 'add_restaurant', points: 50 },
          ...Object.entries(amenitySelections).filter(([,v]) => v !== 'unknown').map(([key]) => ({
            id: crypto.randomUUID(), user_id: currentUser.id, action: 'vote', points: 5
          }))
        ])
        const { data: profile } = await supabase.from('profiles').select('points').eq('id', currentUser.id).single()
        if (profile) {
          await supabase.from('profiles').update({ points: (profile.points || 0) + totalPoints }).eq('id', currentUser.id)
        }
      }
      // Log activity for friends feed
      if (currentUser) {
        await supabase.from('friend_activity').insert({
          user_id: currentUser.id, activity_type: 'add_restaurant',
          restaurant_id: newRestaurant?.id, restaurant_name: form.name, points: 50
        }).catch(() => {})
      }
      // Invalidate explore cache
      if (typeof window !== 'undefined') window.__lf_invalidate_restaurants = true
      setSuccess(true)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const answeredAmenities = Object.values(amenitySelections).filter(v => v !== 'unknown').length

  if (success) return (
    <div style={{ ...font, padding: '60px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: '#111827', marginBottom: 8 }}>Restaurant added!</div>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8, lineHeight: 1.6 }}>
        Thank you! It will show as pending until the community verifies the amenities.
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#f57b46', marginBottom: 4 }}>+50 pts for adding 🏅</div>
      {answeredAmenities > 0 && (
        <div style={{ fontSize: 13, fontWeight: 600, color: '#00a994', marginBottom: 24 }}>
          +{answeredAmenities * 5} pts for {answeredAmenities} amenity vote{answeredAmenities !== 1 ? 's' : ''} 🗳️
        </div>
      )}
      <button onClick={() => navigate('/')}
        style={{ padding: '12px 28px', background: '#f57b46', border: 'none',
          borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', ...font }}>
        Back to Explore
      </button>
    </div>
  )

  return (
    <div style={{ ...font, paddingBottom: 80 }}>
      <div style={{ padding: '14px 16px', borderBottom: '0.5px solid #e5e7eb',
        display: 'flex', alignItems: 'center', gap: 12, background: '#fff' }}>
        <Link to="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: 20 }}>←</Link>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>Add a restaurant</div>
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', padding: '14px 16px', gap: 6 }}>
        {[1,2,3].map(s => (
          <div key={s} style={{ flex: 1, height: 4, borderRadius: 2,
            background: s <= step ? '#f57b46' : '#e5e7eb', transition: 'background .3s' }} />
        ))}
      </div>

      <div style={{ padding: '0 16px' }}>

        {/* STEP 1 */}
        {step === 1 && (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
              Step 1 of 3 · Find the restaurant
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16, lineHeight: 1.6 }}>
              Start typing the restaurant name and we'll look it up automatically!
            </div>

            {/* Smart search field */}
            <div style={{ marginBottom: 16, position: 'relative' }}>
              <div style={lbl}>Restaurant name *</div>
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...inp, paddingLeft: 36,
                    borderColor: placeSelected ? '#00a994' : '#e5e7eb' }}
                  value={searchQuery}
                  onChange={e => handleSearchInput(e.target.value)}
                  placeholder="Start typing a restaurant name..."
                  autoComplete="off"
                />
                <span style={{ position: 'absolute', left: 11, top: '50%',
                  transform: 'translateY(-50%)', fontSize: 15, pointerEvents: 'none' }}>
                  {placeSelected ? '✅' : '🔍'}
                </span>
              </div>

              {/* Suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                  background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,.12)', overflow: 'hidden', marginTop: 4 }}>
                  {suggestions.map((s, i) => (
                    <div key={s.place_id} onClick={() => selectPlace(s)}
                      style={{ padding: '11px 14px', cursor: 'pointer',
                        borderBottom: i < suggestions.length - 1 ? '0.5px solid #f3f4f6' : 'none',
                        background: '#fff' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                        📍 {s.structured_formatting?.main_text || s.description}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                        {s.structured_formatting?.secondary_text || ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Show auto-filled fields if place selected */}
            {placeSelected && (
              <div style={{ background: '#e6f7f5', border: '0.5px solid #99ddd6',
                borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#065f55', marginBottom: 8 }}>
                  ✓ Details filled in from Google — review and edit if needed
                </div>
                <div style={{ fontSize: 12, color: '#065f55' }}>
                  {form.address}{form.city ? ', ' + form.city : ''}{form.state ? ', ' + form.state : ''} {form.zip}
                  {form.phone && <span> · {form.phone}</span>}
                </div>
              </div>
            )}

            {/* Editable fields */}
            <div style={{ marginBottom: 14 }}>
              <div style={lbl}>Cuisine type</div>
              <select value={form.cuisine} onChange={e => update('cuisine', e.target.value)}
                style={{ ...inp, appearance: 'none', cursor: 'pointer',
                  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")",
                  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 36 }}>
                <option value="">Select cuisine type...</option>
                {CUISINES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Address fields — editable in case auto-fill needs correction */}
            <div style={{ marginBottom: 14 }}>
              <div style={lbl}>Street address *</div>
              <input style={inp} value={form.address}
                onChange={e => update('address', e.target.value)} placeholder="142 Morris Ave" />
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 2 }}>
                <div style={lbl}>City</div>
                <input style={inp} value={form.city}
                  onChange={e => update('city', e.target.value)} placeholder="Union" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={lbl}>State</div>
                <select value={form.state} onChange={e => update('state', e.target.value)}
                  style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
                  {['NJ','NY','CT','PA','DE'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={lbl}>Zip code</div>
                <input style={inp} value={form.zip}
                  onChange={e => update('zip', e.target.value)} placeholder="07083" />
              </div>
              <div style={{ flex: 2 }}>
                <div style={lbl}>Phone</div>
                <input style={inp} value={form.phone}
                  onChange={e => update('phone', e.target.value)} placeholder="(908) 555-1234" />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={lbl}>Website</div>
              <input style={inp} value={form.website}
                onChange={e => update('website', e.target.value)} placeholder="pizzapiazza.com" />
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={lbl}>Hours</div>
                {form.hours && (() => {
                  try { JSON.parse(form.hours); return (
                    <span style={{ fontSize: 10, background: '#e6f7f5', color: '#065f55',
                      border: '0.5px solid #99ddd6', borderRadius: 20,
                      padding: '2px 8px', fontWeight: 600 }}>
                      ✓ Auto-filled from Google
                    </span>
                  )} catch { return null }
                })()}
              </div>
              {form.hours && (() => {
                try {
                  const hoursObj = JSON.parse(form.hours)
                  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
                  return (
                    <div style={{ background: '#f9fafb', border: '1.5px solid #e5e7eb',
                      borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#374151' }}>
                      {days.map(day => hoursObj[day] ? (
                        <div key={day} style={{ display: 'flex', justifyContent: 'space-between',
                          padding: '3px 0', borderBottom: '0.5px solid #f3f4f6' }}>
                          <span style={{ fontWeight: 600, color: '#6b7280', minWidth: 90 }}>{day}</span>
                          <span>{hoursObj[day]}</span>
                        </div>
                      ) : null)}
                      <button onClick={() => update('hours', '')}
                        style={{ marginTop: 8, fontSize: 11, color: '#9ca3af', background: 'none',
                          border: 'none', cursor: 'pointer', padding: 0, fontFamily: font.fontFamily }}>
                        ✕ Clear and enter manually
                      </button>
                    </div>
                  )
                } catch {
                  return (
                    <input style={inp} value={form.hours}
                      onChange={e => update('hours', e.target.value)} placeholder="11am–10pm" />
                  )
                }
              })()}
              {!form.hours && (
                <input style={inp} value={form.hours}
                  onChange={e => update('hours', e.target.value)} placeholder="11am–10pm (optional)" />
              )}
            </div>

            {/* Emoji picker */}
            <div style={{ marginBottom: 24 }}>
              <div style={lbl}>Pick an icon</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {EMOJIS.map(e => (
                  <div key={e} onClick={() => update('emoji', e)}
                    style={{ width: 42, height: 42, borderRadius: 10, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, border: form.emoji === e ? '2px solid #f57b46' : '2px solid #e5e7eb',
                      background: form.emoji === e ? '#fff3ee' : '#fff' }}>
                    {e}
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12,
                padding: '9px 12px', background: '#fef2f2', borderRadius: 8 }}>{error}</div>
            )}

            <button onClick={() => {
              if (!form.name || !form.address) {
                setError('Please fill in the restaurant name and address')
                return
              }
              setError(null); setStep(2)
            }} style={{ width: '100%', padding: 13, background: '#f57b46', border: 'none',
              borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', ...font }}>
              Next: Family amenities →
            </button>
          </>
        )}

        {/* STEP 2 - Amenities */}
        {step === 2 && (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
              Step 2 of 3 · Family amenities
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: answeredAmenities > 0 ? 8 : 16, lineHeight: 1.6 }}>
              Tell other parents what this restaurant has. Skip anything you're not sure about!
            </div>
            {answeredAmenities > 0 && (
              <div style={{ background: '#e6f7f5', border: '0.5px solid #99ddd6',
                borderRadius: 10, padding: '8px 12px', marginBottom: 12,
                fontSize: 12, color: '#065f55', fontWeight: 600 }}>
                🗳️ {answeredAmenities} answered · +{answeredAmenities * 5} pts to earn!
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {AMENITIES.map(am => {
                const val = amenitySelections[am.id]
                return (
                  <div key={am.id} style={{ background: '#f9fafb', borderRadius: 12, padding: '12px 14px',
                    border: val !== 'unknown' ? '1.5px solid #e5e7eb' : '1.5px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 22 }}>{am.icon}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{am.label}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{am.desc}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {['yes', 'no', 'unknown'].map(option => {
                        const isSelected = val === option
                        const configs = {
                          yes:     { label: 'Yes ✓',      bg: isSelected ? '#e6f7f5' : '#fff', border: isSelected ? '#99ddd6' : '#e5e7eb', color: isSelected ? '#065f55' : '#6b7280' },
                          no:      { label: 'No ✕',       bg: isSelected ? '#fef0f8' : '#fff', border: isSelected ? '#f9b8e0' : '#e5e7eb', color: isSelected ? '#9d1479' : '#6b7280' },
                          unknown: { label: "Don't know", bg: isSelected ? '#fefae8' : '#fff', border: isSelected ? '#fde9a0' : '#e5e7eb', color: isSelected ? '#854d0e' : '#6b7280' },
                        }
                        const c = configs[option]
                        return (
                          <button key={option}
                            onClick={() => setAmenitySelections(prev => ({ ...prev, [am.id]: option }))}
                            style={{ flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 11,
                              fontWeight: 600, cursor: 'pointer', background: c.bg,
                              border: '1.5px solid ' + c.border, color: c.color, ...font }}>
                            {c.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(1)}
                style={{ flex: 1, padding: 13, background: '#fff', border: '1.5px solid #e5e7eb',
                  borderRadius: 10, color: '#6b7280', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', ...font }}>← Back</button>
              <button onClick={() => setStep(3)}
                style={{ flex: 2, padding: 13, background: '#f57b46', border: 'none',
                  borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', ...font }}>Next: Review →</button>
            </div>
          </>
        )}

        {/* STEP 3 - Review */}
        {step === 3 && (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
              Step 3 of 3 · Review & submit
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>Does everything look right?</div>

            <div style={{ background: '#f9fafb', border: '0.5px solid #e5e7eb',
              borderRadius: 14, overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ height: 80, background: '#fff3ee',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>
                {form.emoji}
              </div>
              <div style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 2 }}>{form.name}</div>
                {form.cuisine && <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{form.cuisine}</div>}
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  {form.address}{form.city ? ', ' + form.city : ''}{form.state ? ', ' + form.state : ''}{form.zip ? ' ' + form.zip : ''}
                </div>
                {form.phone && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{form.phone}</div>}
                {form.website && <div style={{ fontSize: 12, color: '#0692e5', marginTop: 2 }}>{form.website}</div>}
                {form.hours && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{form.hours}</div>}
              </div>
            </div>

            <div style={{ background: '#fff', border: '0.5px solid #e5e7eb',
              borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#374151',
                textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                Amenities you confirmed
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {AMENITIES.map(am => {
                  const val = amenitySelections[am.id]
                  if (val === 'unknown') return (
                    <div key={am.id} style={{ display: 'flex', alignItems: 'center', gap: 5,
                      padding: '4px 10px', borderRadius: 20, background: '#f3f4f6',
                      fontSize: 11, color: '#9ca3af' }}>
                      <span>{am.icon}</span><span>–</span>
                    </div>
                  )
                  return (
                    <div key={am.id} style={{ display: 'flex', alignItems: 'center', gap: 5,
                      padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: val === 'yes' ? '#e6f7f5' : '#fef0f8',
                      color: val === 'yes' ? '#065f55' : '#9d1479',
                      border: '0.5px solid ' + (val === 'yes' ? '#99ddd6' : '#f9b8e0') }}>
                      <span>{am.icon}</span><span>{val === 'yes' ? '✓' : '✗'}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ background: '#fefae8', border: '0.5px solid #fde9a0',
              borderRadius: 12, padding: '12px 14px', marginBottom: 20,
              display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 22 }}>🏅</span>
              <div>
                <div style={{ fontSize: 12, color: '#854d0e', fontWeight: 600 }}>
                  You'll earn {50 + (answeredAmenities * 5)} points!
                </div>
                <div style={{ fontSize: 11, color: '#92400e' }}>
                  50 for adding + {answeredAmenities * 5} for {answeredAmenities} amenity vote{answeredAmenities !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            {error && (
              <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 14,
                padding: '9px 12px', background: '#fef2f2', borderRadius: 8 }}>{error}</div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setStep(2); setError(null) }}
                style={{ flex: 1, padding: 13, background: '#fff', border: '1.5px solid #e5e7eb',
                  borderRadius: 10, color: '#6b7280', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', ...font }}>← Back</button>
              <button onClick={handleSubmit} disabled={loading}
                style={{ flex: 2, padding: 13, background: '#f57b46', border: 'none',
                  borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', opacity: loading ? .6 : 1, ...font }}>
                {loading ? 'Submitting…' : 'Submit restaurant'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
