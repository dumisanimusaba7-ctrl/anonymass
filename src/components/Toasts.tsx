import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

interface Toast {
  id: number
  text: string
  tone: 'info' | 'error'
}

const ToastContext = createContext<(text: string, tone?: Toast['tone']) => void>(() => {})

export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const next = useRef(0)

  const push = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = ++next.current
    setToasts((t) => [...t.filter((x) => x.text !== text).slice(-2), { id, text, tone }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 4200 : 2600)
  }, [])

  const value = useMemo(() => push, [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={`animate-pop max-w-sm rounded-xl px-4 py-3 text-center text-sm font-bold shadow-xl ${
              t.tone === 'error' ? 'bg-danger text-ink' : 'bg-bone text-ink'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
