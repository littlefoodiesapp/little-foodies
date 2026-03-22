import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const font = { fontFamily: "'Montserrat', sans-serif" }

const EMOJIS = ['🍕','🍝','🍔','🌮','🍣','🍜','🥗','🍺','🍷','🛒','🍽️','🥘','🌯','🥙','🍱','🧆']

export default function AddRestaurantPage() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const [step, setStep]       = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    name: '', cuisine: '', address: '', city: '', state: 'NJ',
    zip: '', phone: '', website: '', hours: '', emoji: '🍽️'
  })

  function update(field, val) {
    setForm(prev => ({ ...prev, [field]: val }))
  }

  async function handleSubmit() {
    if (!form.name || !form.address) {
      setError('Restaurant name and address are required')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      const { error: err } = await supabase
        .from('restaurants')
        .insert({
          name:         form.name,
          cuisine:      form.cuisine,
          address:      form.address,
          city:         form.city,
          state:        form.state,
          zip:          form.zip,
          phone:        form.phone,
          website:      form.website,
          hours:        form.hours,
          emoji:        form.emoji,
          status:       'pending',
          submitted_by: currentUser?.id,
        })
      if (err) throw new Error(err.message)

      // Award 50 points
      if (currentUser) {
        await supabase.from('points_ledger').insert({
          user_id: currentUser.id,
          action:  'add_restaurant',
          points:  50,
        })
        await supabase.rpc('increment_user_points', { user_id: currentUser.id, amount: 50 })
          .then(() => {}) // ignore if RPC doesn't exist yet
        // Fallback: direct update
        const { data: profile } = await supabase
          .from('profiles').select('points').eq('id', currentUser.id).single()
        if (profile) {
          await supabase.from('profiles')
            .update({ points: (profile.points || 0) + 50 })
            .eq('id', currentUser.id)
        }
      }

      setSuccess(true)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const inp = {
    width: '100%', padding: '10px 13px',
    border: '1.5px solid #e5e7eb', borderRadius: 10,
    fontSize: 13, boxSizing: 'border-box',
    outline: 'none', ...font, background: '#fafafa', marginTop: 4
  }
  const lbl = {
    fontSize: 11, fontWeight: 600, color: '#374151',
    textTransform: 'uppercase', letterSpacing: '.05em', ...font
  }

  if (success) return (
    <div style={{ ...font, padding: '60px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: '#111827', marginBottom: 8 }}>
        Restaurant added!
      </div>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8, lineHeight: 1.6 }}>
        Thank you! It will show as pending until the community verifies the amenities.
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#f57b46', marginBottom: 28 }}>
        +50 pts earned 🏅
      </div>
      <button onClick={() => navigate('/')}
        style={{ padding: '12px 28px', background: '#f57b46', border: 'none',
          borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600,
          cursor: 'pointer', ...font, boxShadow: '0 4px 14px rgba(245,123,70,.35)' }}>
        Back to Explore
      </button>
    </div>
  )

  return (
    <div style={{ ...font, paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '0.5px solid #e5e7eb',
        display: 'flex', alignItems: 'center', gap: 12, background: '#fff' }}>
        <Link to="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: 20 }}>←</Link>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>Add a restaurant</div>
      </div>

      {/* Progress bar */}
      <div style={{ display: 'flex', padding: '14px 16px', gap: 6 }}>
        {[1, 2].map(s => (
          <div key={s} style={{ flex: 1, height: 4, borderRadius: 2,
            background: s <= step ? '#f57b46' : '#e5e7eb',
            transition: 'background .3s' }} />
        ))}
      </div>

      <div style={{ padding: '0 16px' }}>

        {/* Step 1 — Basic info */}
        {step === 1 && (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
              Basic info
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
              Fill in what you know — all fields except name and address are optional.
            </div>

            {[
              { field: 'name',    label: 'Restaurant name *', placeholder: 'Pizza Piazza',      required: true },
              { field: 'cuisine', label: 'Cuisine type',      placeholder: 'Italian · Pizza'                  },
              { field: 'address', label: 'Street address *',  placeholder: '142 Morris Ave',    required: true },
              { field: 'city',    label: 'City',              placeholder: 'Union'                            },
              { field: 'zip',     label: 'Zip code',          placeholder: '07083'                            },
              { field: 'phone',   label: 'Phone number',      placeholder: '(908) 555-1234'                   },
              { field: 'website', label: 'Website',           placeholder: 'pizzapiazza.com'                  },
              { field: 'hours',   label: 'Hours',             placeholder: '11am–10pm'                        },
            ].map(({ field, label, placeholder }) => (
              <div key={field} style={{ marginBottom: 14 }}>
                <div style={lbl}>{label}</div>
                <input
                  style={inp}
                  value={form[field]}
                  onChange={e => update(field, e.target.value)}
                  placeholder={placeholder}
                />
              </div>
            ))}

            {/* Emoji picker */}
            <div style={{ marginBottom: 24 }}>
              <div style={lbl}>Pick an icon</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {EMOJIS.map(e => (
                  <div key={e} onClick={() => update('emoji', e)}
                    style={{ width: 42, height: 42, borderRadius: 10, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, transition: 'all .15s',
                      border: form.emoji === e ? '2px solid #f57b46' : '2px solid #e5e7eb',
                      background: form.emoji === e ? '#fff3ee' : '#fff' }}>
                    {e}
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                if (!form.name || !form.address) {
                  setError('Please fill in the restaurant name and address')
                  return
                }
                setError(null)
                setStep(2)
              }}
              style={{ width: '100%', padding: 13, background: '#f57b46', border: 'none',
                borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', ...font, boxShadow: '0 4px 14px rgba(245,123,70,.3)' }}>
              Next →
            </button>

            {error && (
              <div style={{ color: '#ef4444', fontSize: 12, marginTop: 10,
                padding: '9px 12px', background: '#fef2f2', borderRadius: 8 }}>
                {error}
              </div>
            )}
          </>
        )}

        {/* Step 2 — Review & submit */}
        {step === 2 && (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
              Review & submit
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
              Does everything look right? Hit submit to add it to Little Foodies!
            </div>

            {/* Summary card */}
            <div style={{ background: '#f9fafb', border: '0.5px solid #e5e7eb',
              borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ height: 80, background: '#fff3ee',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>
                {form.emoji}
              </div>
              <div style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 2 }}>
                  {form.name}
                </div>
                {form.cuisine && (
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{form.cuisine}</div>
                )}
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  {form.address}{form.city ? ', ' + form.city : ''}{form.state ? ', ' + form.state : ''}
                  {form.zip ? ' ' + form.zip : ''}
                </div>
                {form.phone && (
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{form.phone}</div>
                )}
                {form.hours && (
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{form.hours}</div>
                )}
              </div>
            </div>

            {/* Points callout */}
            <div style={{ background: '#fefae8', border: '0.5px solid #fde9a0',
              borderRadius: 12, padding: '12px 14px', marginBottom: 20,
              display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 22 }}>🏅</span>
              <div style={{ fontSize: 12, color: '#854d0e', fontWeight: 600 }}>
                You'll earn 50 points for adding this restaurant!
              </div>
            </div>

            {error && (
              <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 14,
                padding: '9px 12px', background: '#fef2f2', borderRadius: 8 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setStep(1); setError(null) }}
                style={{ flex: 1, padding: 13, background: '#fff',
                  border: '1.5px solid #e5e7eb', borderRadius: 10,
                  color: '#6b7280', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', ...font }}>
                ← Back
              </button>
              <button onClick={handleSubmit} disabled={loading}
                style={{ flex: 2, padding: 13, background: '#f57b46', border: 'none',
                  borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', opacity: loading ? .6 : 1, ...font,
                  boxShadow: '0 4px 14px rgba(245,123,70,.3)' }}>
                {loading ? 'Submitting…' : 'Submit restaurant'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
