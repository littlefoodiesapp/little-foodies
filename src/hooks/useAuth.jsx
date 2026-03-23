import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing session (also handles token in URL hash from email confirm)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for all auth changes including email confirmation
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)

        // When user confirms email, create/update their profile
        if (event === 'SIGNED_IN' && session?.user) {
          const u = session.user
          const meta = u.user_metadata || {}
          const { data: existing } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', u.id)
            .single()

          if (!existing) {
            await supabase.from('profiles').insert({
              id:           u.id,
              display_name: meta.display_name || meta.first_name || u.email?.split('@')[0],
              first_name:   meta.first_name || null,
              last_name:    meta.last_name  || null,
              zip:          meta.zip        || null,
              kids:         meta.kids       || null,
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
