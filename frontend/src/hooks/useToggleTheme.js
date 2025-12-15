import { useState, useEffect, useRef } from "react";

export const useThemeToggle = () => {
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      return true;
    } else if (savedTheme === "light") {
      return false;
    } else {
      // No saved theme, check system preference
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
  });

  const isInitialMount = useRef(true);

  useEffect(() => {
    // Apply theme to DOM immediately on mount
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // Only write to localStorage after initial mount to avoid overwriting
    if (isInitialMount.current) {
      isInitialMount.current = false;
      // Sync initial state to localStorage if not already set
      if (!localStorage.getItem("theme")) {
        localStorage.setItem("theme", darkMode ? "dark" : "light");
      }
    } else {
      // Update localStorage when theme changes after initial mount
      localStorage.setItem("theme", darkMode ? "dark" : "light");
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return { darkMode, toggleDarkMode };
};
