import { useState, useEffect, createContext, useContext, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

// Cache user and profile at module level so they survive navigation
let cachedUser    = undefined // undefined = unknown, null = logged out
export let cachedProfile = null // profile cache shared across all pages

export function setCachedProfile(p) { cachedProfile = p }

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(cachedUser)
  // Only show loading spinner on very first load when we have no cached user at all
  const [loading, setLoading] = useState(cachedUser === undefined)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null
      const confirmed = u?.email_confirmed_at ? u : null
      cachedUser = confirmed
      setUser(confirmed)
      setLoading(false)

      // Fetch and cache profile on session restore
      if (confirmed) {
        const { data: existing } = await supabase
          .from('profiles').select('*').eq('id', confirmed.id).single()
        if (!existing) {
          const meta = confirmed.user_metadata || {}
          const newProfile = {
            id:           confirmed.id,
            email:        confirmed.email || null,
            display_name: meta.display_name || meta.first_name || confirmed.email?.split('@')[0],
            first_name:   meta.first_name || null,
            last_name:    meta.last_name  || null,
            account_type: meta.account_type || 'family',
            points:       0,
          }
          await supabase.from('profiles').insert(newProfile).catch(() => {})
          cachedProfile = newProfile
        } else {
          if (!existing.display_name) {
            const meta = confirmed.user_metadata || {}
            const fix = {
              display_name: meta.display_name || meta.first_name || confirmed.email?.split('@')[0],
              email: confirmed.email || null,
            }
            await supabase.from('profiles').update(fix).eq('id', confirmed.id).catch(() => {})
            cachedProfile = { ...existing, ...fix }
          } else {
            cachedProfile = existing
          }
        }
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const u = session?.user ?? null

        if (event === 'SIGNED_OUT') {
          cachedUser = null
          setUser(null)
          setLoading(false)
          return
        }

        if (event === 'PASSWORD_RECOVERY') {
          cachedUser = u
          setUser(u)
          setLoading(false)
          return
        }

        if (u && !u.email_confirmed_at) {
          await supabase.auth.signOut()
          cachedUser = null
          setUser(null)
          setLoading(false)
          return
        }

        cachedUser = u
        setUser(u)
        // Never set loading=true here — just silently update the user
        // This prevents the app from showing loading screens when coming back from background
        setLoading(false)

        if (event === 'SIGNED_IN' && u?.email_confirmed_at) {
          const meta = u.user_metadata || {}
          const { data: existing } = await supabase
            .from('profiles').select('id').eq('id', u.id).single()
          if (!existing) {
            await supabase.from('profiles').insert({
              id:           u.id,
              email:        u.email || null,
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

    // Only refresh session if tab was hidden for more than 10 minutes
    // This prevents unnecessary re-renders on quick tab switches
    let hiddenAt = null
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
      } else if (document.visibilityState === 'visible' && cachedUser !== undefined) {
        const hiddenMs = hiddenAt ? Date.now() - hiddenAt : 0
        if (hiddenMs > 10 * 60 * 1000) {
          // Only refresh session after 10+ minutes in background
          supabase.auth.getSession().then(({ data: { session } }) => {
            const u = session?.user ?? null
            const confirmed = u?.email_confirmed_at ? u : null
            if (confirmed?.id !== cachedUser?.id) {
              cachedUser = confirmed
              setUser(confirmed)
            }
          })
        }
        hiddenAt = null
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  async function logout() {
    cachedUser = null
    cachedProfile = null
    window.__lf_clear_profile_cache = true
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
