import { useState, useEffect, useRef } from 'react'
import { getRestaurants } from '../lib/api'

// Module-level cache so data survives navigation
let cachedData = null

export function useRestaurants(filters = {}) {
  const [restaurants, setRestaurants] = useState(cachedData || [])
  const [loading, setLoading]         = useState(!cachedData)
  const [error, setError]             = useState(null)
  const filterKey = JSON.stringify(filters)
  const cancelRef = useRef(false)

  useEffect(() => {
    cancelRef.current = false

    // Use cache if available and no specific filters
    if (cachedData && Object.keys(filters).length === 0) {
      setRestaurants(cachedData)
      setLoading(false)
      return
    }

    let timeout = setTimeout(() => {
      if (!cancelRef.current) setLoading(false)
    }, 8000)

    async function load() {
      setLoading(true)
      try {
        const { data, error } = await getRestaurants(filters)
        if (cancelRef.current) return
        if (error) {
          setError(error)
        } else {
          const list = data || []
          if (Object.keys(filters).length === 0) cachedData = list
          setRestaurants(list)
        }
      } catch (e) {
        if (!cancelRef.current) setError(e)
      } finally {
        if (!cancelRef.current) setLoading(false)
        clearTimeout(timeout)
      }
    }

    load()
    return () => { cancelRef.current = true; clearTimeout(timeout) }
  }, [filterKey])

  return { restaurants, loading, error, setRestaurants }
}
