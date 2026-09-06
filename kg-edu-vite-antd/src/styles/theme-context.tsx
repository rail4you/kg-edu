import React, { createContext, useContext, useEffect } from "react";
import { portalThemeColors } from "@/styles/portal-theme";

export type ThemeMode = "portal";

interface ThemeContextType {
  mode: ThemeMode;
  colors: typeof portalThemeColors;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: "portal",
  colors: portalThemeColors,
  toggleTheme: () => {},
  setTheme: () => {},
});

const THEME_STORAGE_KEY = "kg-edu-theme-mode";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mode: ThemeMode = "portal";
  const colors = portalThemeColors;

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {}
    document.body.setAttribute("data-theme", mode);
  }, [mode]);

  return (
    <ThemeContext.Provider
      value={{
        mode,
        colors,
        toggleTheme: () => {},
        setTheme: () => {},
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { portalThemeColors };
