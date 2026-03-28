import { createContext, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Theme as AppTheme } from "@shared/schema";

type Theme = "light" | "dark";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  appTheme: AppTheme | null;
  isLoadingAppTheme: boolean;
};

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(
  undefined
);

export function ThemeProvider({
  children,
  defaultTheme = "light",
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("theme") as Theme) || defaultTheme
  );
  const [location] = useLocation();

  const scope = (() => {
    if (location === "/") return "homepage_only";
    if (location.startsWith("/dashboard")) return "dashboard";
    return "site_full";
  })();

  const { data: appTheme, isLoading: isLoadingAppTheme } = useQuery<AppTheme | null>({
    queryKey: ["/api/themes/active", scope],
    queryFn: async () => {
      const res = await fetch(`/api/themes/active?scope=${scope}`);
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60000,
    refetchInterval: 60000,
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!appTheme) return;

    const root = document.documentElement;

    if (appTheme.tokens?.colors) {
      Object.entries(appTheme.tokens.colors).forEach(([key, value]) => {
        // Apply theme-specific variables
        root.style.setProperty(`--theme-${key}`, value);
        
        // Apply mode-specific colors to base variables
        const suffix = theme === 'dark' ? '-dark' : '-light';
        if (key.endsWith(suffix)) {
          // Extract base variable name (e.g., "background-dark" -> "background")
          const baseKey = key.replace(suffix, '');
          root.style.setProperty(`--${baseKey}`, value);
        } else if (!key.includes('-light') && !key.includes('-dark')) {
          // If no suffix, apply to base variable
          root.style.setProperty(`--${key}`, value);
        }
      });
    }

    if (appTheme.tokens?.fonts) {
      Object.entries(appTheme.tokens.fonts).forEach(([key, value]) => {
        root.style.setProperty(`--theme-font-${key}`, value);
        root.style.setProperty(`--font-${key}`, value);
      });
    }

    if (appTheme.tokens?.spacing) {
      Object.entries(appTheme.tokens.spacing).forEach(([key, value]) => {
        root.style.setProperty(`--theme-space-${key}`, value);
      });
    }

    if (appTheme.tokens?.borderRadius) {
      Object.entries(appTheme.tokens.borderRadius).forEach(([key, value]) => {
        root.style.setProperty(`--theme-radius-${key}`, value);
      });
    }

    if (appTheme.assets?.favicon) {
      const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (favicon) {
        favicon.href = appTheme.assets.favicon;
      }
    }
  }, [appTheme, theme]);

  return (
    <ThemeProviderContext.Provider value={{ theme, setTheme, appTheme: appTheme || null, isLoadingAppTheme }}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};
