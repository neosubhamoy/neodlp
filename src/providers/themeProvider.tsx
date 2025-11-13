import { createContext, useContext, useEffect, useState } from "react"

export type Theme = "dark" | "light" | "system"
export type ColorScheme = "default" | "blue" | "green" | "orange" | "red" | "rose" | "violet" | "yellow"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  defaultColorScheme?: ColorScheme
  themeStorageKey?: string
  colorSchemeStorageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  colorScheme: ColorScheme
  setTheme: (theme: Theme, colorScheme: ColorScheme) => void
}

const initialState: ThemeProviderState = {
  theme: "system",
  colorScheme: "default",
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = "system",
  defaultColorScheme = "default",
  themeStorageKey = "vite-ui-theme",
  colorSchemeStorageKey = "vite-ui-color-scheme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(themeStorageKey) as Theme) || defaultTheme
  )
  const [colorScheme, setColorScheme] = useState<ColorScheme>(
    () => (localStorage.getItem(colorSchemeStorageKey) as ColorScheme) || defaultColorScheme
  )

  useEffect(() => {
    const root = window.document.documentElement

    root.classList.remove("light", "dark", "blue", "blue-dark", "green", "green-dark", "orange", "orange-dark", "red", "red-dark", "rose", "rose-dark", "violet", "violet-dark", "yellow", "yellow-dark")

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? colorScheme === "default"
          ? "dark"
          : `${colorScheme}-dark`
        : colorScheme === "default"
          ? "light"
          : colorScheme

      root.classList.add(systemTheme)
      return
    }

    if (theme === "dark") {
      root.classList.add(colorScheme === "default" ? "dark" : `${colorScheme}-dark`)
      return
    }

    if (theme === "light") {
      root.classList.add(colorScheme === "default" ? "light" : colorScheme)
      return
    }
  }, [theme, colorScheme])

  const value = {
    theme,
    colorScheme,
    setTheme: (theme: Theme, colorScheme: ColorScheme) => {
      localStorage.setItem(themeStorageKey, theme)
      localStorage.setItem(colorSchemeStorageKey, colorScheme)
      setTheme(theme)
      setColorScheme(colorScheme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
