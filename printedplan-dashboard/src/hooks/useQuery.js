import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Tiny data-fetching hook: runs `fetcher` (returns a Supabase query result
 * `{ data, error }`), exposes data/loading/error and a `reload()`.
 */
export function useQuery(fetcher, deps = []) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const versionRef = useRef(0)

  const reload = useCallback(async () => {
    const version = ++versionRef.current
    setLoading(true)
    try {
      const result = await fetcher()
      if (version !== versionRef.current) return
      if (result?.error) {
        setError(result.error)
      } else {
        setError(null)
        setData(result?.data ?? null)
      }
    } catch (e) {
      if (version === versionRef.current) setError(e)
    } finally {
      if (version === versionRef.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    reload()
  }, [reload])

  return { data, error, loading, reload, setData }
}
