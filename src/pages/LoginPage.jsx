import { useState } from 'react'
import { signIn, signUp, signInWithGoogle } from '../lib/api'

export default function LoginPage() {
  const [mode, setMode]       = useState('signin')  // 'signin' | 'signup'
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [name, setName]       = useState('')
  const [error, setError]     = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError(null)
    const { error } = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password, name)
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: 380, margin: '60px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 6 }}>
        {mode === 'signin' ? 'Welcome back' : 'Join Little Foodies'}
      </h1>
      <p style={{ color: '#6b7280', marginBottom: 24, fontSize: 14 }}>
        {mode === 'signin' ? 'Sign in to your account' : 'Create a free account'}
      </p>

      <button onClick={signInWithGoogle}
        style={{ width: '100%', padding: '11px 0', marginBottom: 16, border: '1px solid #d1d5db',
          borderRadius: 8, fontSize: 14, cursor: 'pointer', background: '#fff' }}>
        Continue with Google
      </button>

      <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, marginBottom: 16 }}>or</div>

      <form onSubmit={handleSubmit}>
        {mode === 'signup' && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Sarah M." required
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }} />
          </div>
        )}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@email.com" required
            style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" required
            style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }} />
        </div>
        {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <button type="submit" disabled={loading}
          style={{ width: '100%', padding: 12, background: '#f57b46', border: 'none',
            borderRadius: 8, fontSize: 14, fontWeight: 500, color: '#fff', cursor: 'pointer' }}>
          {loading ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#6b7280' }}>
        {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
        <button onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          style={{ color: '#f57b46', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
          {mode === 'signin' ? 'Sign up' : 'Sign in'}
        </button>
      </p>
    </div>
  )
}
