import { useEffect, useState } from 'react'

/** Re-renders every `ms` and returns the (skew-corrected) current time. */
export function useNow(ms = 1000, skew = 0) {
  const [now, setNow] = useState(() => Date.now() + skew)
  useEffect(() => {
    setNow(Date.now() + skew)
    const id = window.setInterval(() => setNow(Date.now() + skew), ms)
    return () => window.clearInterval(id)
  }, [ms, skew])
  return now
}
