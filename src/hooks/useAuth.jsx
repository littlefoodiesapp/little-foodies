import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Only treat as logged in if email is confirmed
      const u = session?.user ?? null
      setUser(u?.email_confirmed_at ? u : null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const u = session?.user ?? null

        // Only allow confirmed users through
        if (u && !u.email_confirmed_at) {
          setUser(null)
          setLoading(false)
          return
        }

        setUser(u)
        setLoading(false)

        // When user confirms email, create their profile
        if (event === 'SIGNED_IN' && u) {
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
