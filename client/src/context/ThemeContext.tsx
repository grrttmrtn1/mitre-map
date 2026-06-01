import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
export type Density = 'compact' | 'comfortable' | 'spacious';

function readInitialTheme(): Theme {
  const stored = localStorage.getItem('mitremap_theme');
  return stored === 'light' ? 'light' : 'dark';
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem('mitremap_theme', theme);
}

function readInitialDensity(): Density {
  const stored = localStorage.getItem('table_density');
  if (stored === 'compact' || stored === 'comfortable' || stored === 'spacious') return stored;
  return 'comfortable';
}

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
  density: Density;
  setDensity: (d: Density) => void;
}>({
  theme: 'dark',
  toggle: () => {},
  density: 'comfortable',
  setDensity: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const initial = readInitialTheme();
    applyTheme(initial);
    return initial;
  });

  const [density, setDensityState] = useState<Density>(readInitialDensity);

  useEffect(() => {
    document.documentElement.setAttribute('data-density', density);
    localStorage.setItem('table_density', density);
  }, [density]);

  const toggle = useCallback(() => {
    setTheme(prev => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      return next;
    });
  }, []);

  const setDensity = useCallback((d: Density) => {
    setDensityState(d);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle, density, setDensity }}>
      {/* Wrapper carries the dark class directly in the React tree so
          Tailwind's :is(.dark *) selectors match without depending on an
          effect to mutate <html>. `contents` makes the div layout-inert. */}
      <div className={theme === 'dark' ? 'dark contents' : 'contents'}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
