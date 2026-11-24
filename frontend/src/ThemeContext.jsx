import React, { createContext, useState, useEffect, useContext } from 'react';

export const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [themeMode, setThemeMode] = useState(localStorage.getItem('themeMode') || 'light');
  const [accentColor, setAccentColor] = useState(localStorage.getItem('accentColor') || 'blue');

  useEffect(() => {
    localStorage.setItem('themeMode', themeMode);
    localStorage.setItem('accentColor', accentColor);
    
    document.documentElement.setAttribute('data-theme', themeMode);
    document.documentElement.setAttribute('data-accent', accentColor);
  }, [themeMode, accentColor]);

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, accentColor, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
