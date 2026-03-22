import { useState, useEffect } from 'react'
import { getRestaurants } from '../lib/api'

export function useRestaurants(filters = {}) {
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await getRestaurants(filters)
      if (error) setError(error)
      else setRestaurants(data || [])
      setLoading(false)
    }
    load()
  }, [JSON.stringify(filters)])

  return { restaurants, loading, error, setRestaurants }
}
