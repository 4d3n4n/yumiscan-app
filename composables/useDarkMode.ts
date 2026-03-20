const STORAGE_KEY = 'yumiscan-theme'

export function useDarkMode() {
  const isDark = useState('dark-mode', () => false)

  const applyTheme = (dark: boolean) => {
    if (typeof document === 'undefined') return
    document.documentElement.classList.toggle('dark', dark)
  }

  const toggle = () => {
    isDark.value = !isDark.value
    applyTheme(isDark.value)
    try {
      localStorage.setItem(STORAGE_KEY, isDark.value ? 'dark' : 'light')
    } catch {}
  }

  const init = () => {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'dark') {
        isDark.value = true
      } else if (stored === 'light') {
        isDark.value = false
      } else {
        isDark.value = false
      }
    } catch {
      isDark.value = false
    }
    applyTheme(isDark.value)
  }

  return { isDark, toggle, init }
}
