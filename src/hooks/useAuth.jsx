import { useState, useEffect, createContext, useContext, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(undefined) // undefined = still loading, null = not logged in
  const [loading, setLoading] = useState(true)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    // Get initial session fast
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u?.email_confirmed_at ? u : null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const u = session?.user ?? null

        if (event === 'SIGNED_OUT') {
          setUser(null)
          setLoading(false)
          return
        }

        if (event === 'PASSWORD_RECOVERY') {
          setUser(u)
          setLoading(false)
          return
        }

        // Block unconfirmed users
        if (u && !u.email_confirmed_at) {
          await supabase.auth.signOut()
          setUser(null)
          setLoading(false)
          return
        }

        setUser(u)
        setLoading(false)

        // Create profile on first confirmed sign in
        if (event === 'SIGNED_IN' && u?.email_confirmed_at) {
          const meta = u.user_metadata || {}
          const { data: existing } = await supabase
            .from('profiles').select('id').eq('id', u.id).single()
          if (!existing) {
            await supabase.from('profiles').insert({
              id:           u.id,
              display_name: meta.display_name || meta.first_name || u.email?.split('@')[0],
              first_name:   meta.first_name || null,
              last_name:    meta.last_name  || null,
              zip:          meta.zip        || null,
              kids:         meta.kids       || null,
              account_type: meta.account_type || 'family',
              points:       0,
            })
          }
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, logout, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
