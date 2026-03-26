import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const font = { fontFamily: "'Montserrat', sans-serif" }
const inp = {
  width: '100%', padding: '12px 14px', border: '1.5px solid #e5e7eb',
  borderRadius: 10, fontSize: 13, boxSizing: 'border-box',
  outline: 'none', fontFamily: "'Montserrat', sans-serif",
  background: '#fafafa', color: '#111827'
}
const lbl = {
  fontSize: 11, fontWeight: 600, color: '#374151',
  textTransform: 'uppercase', letterSpacing: '.05em',
  fontFamily: "'Montserrat', sans-serif", marginBottom: 4, display: 'block'
}

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [success, setSuccess]     = useState(false)
  // If we're on this page, we got here via PASSWORD_RECOVERY event in App.jsx
  // So we can show the form immediately. Also keep listener as fallback.
  const [validToken, setValidToken] = useState(true)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setValidToken(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleReset() {
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }

    setLoading(true)
    setError(null)

    const { error: updateErr } = await supabase.auth.updateUser({ password })
    if (updateErr) { setError(updateErr.message); setLoading(false); return }

    setSuccess(true)
    setLoading(false)

    // Sign out and redirect to login after 2 seconds
    setTimeout(async () => {
      await supabase.auth.signOut()
      navigate('/login')
    }, 2000)
  }

  if (success) return (
    <div style={{ ...font, minHeight: '100vh', background: '#f9fafb',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '40px 28px',
        textAlign: 'center', maxWidth: 380, width: '100%',
        boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
          Password updated!
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.7 }}>
          Your password has been reset. Redirecting you to sign in…
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ ...font, minHeight: '100vh', background: '#f9fafb',
      display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #fde8dc 0%, #fde0f0 100%)',
        padding: '36px 24px 28px', textAlign: 'center' }}>
        <img src="/favicon-192x192.png" alt="Little Foodies"
          style={{ height: 72, width: 'auto', marginBottom: 12 }} />
        <p style={{ margin: 0, fontSize: 13, color: '#c2410c', fontWeight: 500 }}>
          Because every family deserves a great meal out.
        </p>
      </div>

      <div style={{ flex: 1, padding: '32px 20px', maxWidth: 480,
        width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        {!validToken ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
              Verifying your reset link…
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
              If nothing happens, your link may have expired.{' '}
              <button onClick={() => navigate('/login')}
                style={{ background: 'none', border: 'none', color: '#f57b46',
                  fontWeight: 600, cursor: 'pointer', fontSize: 13, ...font }}>
                Request a new one
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
              Choose a new password 🔑
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 24, lineHeight: 1.6 }}>
              Pick something memorable — at least 6 characters.
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>New password</label>
              <input style={inp} type="password" value={password}
                onChange={e => { setPassword(e.target.value); setError(null) }}
                placeholder="At least 6 characters"
                autoComplete="new-password" />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Confirm password</label>
              <input style={inp} type="password" value={confirm}
                onChange={e => { setConfirm(e.target.value); setError(null) }}
                placeholder="Same password again"
                autoComplete="new-password"
                onKeyDown={e => e.key === 'Enter' && handleReset()} />
            </div>

            {/* Password match indicator */}
            {confirm.length > 0 && (
              <div style={{ fontSize: 12, marginBottom: 16, fontWeight: 600,
                color: password === confirm ? '#00a994' : '#ef4444' }}>
                {password === confirm ? '✓ Passwords match' : '✗ Passwords do not match'}
              </div>
            )}

            {error && (
              <div style={{ padding: '10px 14px', background: '#fef2f2',
                border: '0.5px solid #fecaca', borderRadius: 10,
                fontSize: 12, color: '#dc2626', marginBottom: 16 }}>
                {error}
              </div>
            )}

            <button onClick={handleReset} disabled={loading}
              style={{ width: '100%', padding: '14px 0', background: '#f57b46',
                border: 'none', borderRadius: 12, color: '#fff', fontSize: 14,
                fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? .6 : 1, ...font,
                boxShadow: '0 4px 14px rgba(245,123,70,.35)' }}>
              {loading ? 'Updating…' : 'Set new password'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
