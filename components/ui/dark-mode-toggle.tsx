// components/ui/dark-mode-toggle.tsx
'use client';
import { useState, useEffect } from 'react';

export function useDarkMode() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('h1-dark-mode');
    if (stored === 'true') { setDark(true); document.documentElement.classList.add('dark'); }
    else if (stored === null && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDark(true); document.documentElement.classList.add('dark');
    }
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    if (next) { document.documentElement.classList.add('dark'); localStorage.setItem('h1-dark-mode', 'true'); }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('h1-dark-mode', 'false'); }
  };

  return { dark, toggle };
}

export function DarkModeToggle() {
  const { dark, toggle } = useDarkMode();
  return (
    <button onClick={toggle} title={dark ? 'Light mode' : 'Dark mode (night shift)'}
      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
      {dark ? '☀️' : '🌙'}
    </button>
  );
}
