import { useEffect, type ReactNode } from 'react'
import { useStore } from '@/stores/useStore'

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useStore((s) => s.settings.theme)

  useEffect(() => {
    const html = document.documentElement
    html.classList.remove('theme-apolline', 'theme-graphite', 'theme-sombre')
    html.classList.add(`theme-${theme}`)
  }, [theme])

  return <>{children}</>
}
