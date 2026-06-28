import { useState, useEffect } from 'react'

export default function useDarkMode() {
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('whiteboard-dark-mode')
    if (stored !== null) return stored === 'true'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const root = document.documentElement
    if (darkMode) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('whiteboard-dark-mode', String(darkMode))
  }, [darkMode])

  const toggle = () => setDarkMode(d => !d)

  return { darkMode, toggle }
}
