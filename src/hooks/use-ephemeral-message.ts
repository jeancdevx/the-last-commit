import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

export function useEphemeralMessage(defaultDurationMs = 5000) {
  const [message, setMessage] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)

  const show = useCallback(
    (text: string, durationMs = defaultDurationMs) => {
      setMessage(text)

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }

      timerRef.current = window.setTimeout(() => {
        setMessage(null)
        timerRef.current = null
      }, durationMs)
    },
    [defaultDurationMs]
  )

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }

    setMessage(null)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
    }
  }, [])

  return { message, show, clear }
}
