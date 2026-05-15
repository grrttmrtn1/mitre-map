import { createContext, useCallback, useContext, useState } from 'react';

type Theme = 'light' | 'dark';

function readInitialTheme(): Theme {
  const stored = localStorage.getItem('mitremap_theme');
  return stored === 'light' ? 'light' : 'dark';
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem('mitremap_theme', theme);
}

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'dark',
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const initial = readInitialTheme();
    applyTheme(initial);
    return initial;
  });

  const toggle = useCallback(() => {
    setTheme(prev => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
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
