import { create } from 'zustand'

interface ThemeState {
  theme: 'light' | 'dark'
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeState>((set) => {
  // Initialize from local storage or default to light
  const storedTheme = localStorage.getItem('theme-mode') as 'light' | 'dark' | null
  const initialTheme = storedTheme || 'light'
  
  if (initialTheme === 'dark') {
    document.documentElement.classList.add('dark')
  }

  return {
    theme: initialTheme,
    toggleTheme: () => set((state) => {
      const newTheme = state.theme === 'light' ? 'dark' : 'light'
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      localStorage.setItem('theme-mode', newTheme)
      return { theme: newTheme }
    }),
  }
})
