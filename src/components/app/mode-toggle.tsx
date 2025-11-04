import { useEffect, useState } from "react";

export function DarkModeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Toggle theme
  const toggleDarkMode = () => {
    setIsAnimating(true);
    const html = document.documentElement;
    const next = !isDark;
    html.classList.toggle("dark", next);
    setIsDark(next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setTimeout(() => setIsAnimating(false), 300);
  };

  // Init from localStorage or prefers-color-scheme
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const shouldUseDark = stored === "dark" || (!stored && prefersDark);
    document.documentElement.classList.toggle("dark", shouldUseDark);
    setIsDark(shouldUseDark);
  }, []);

  return (
    <div className="relative">
      <button
        onClick={toggleDarkMode}
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label="Toggle dark mode"
        tabIndex={0}
        className={`
          relative inline-flex items-center w-11 h-6 rounded-full p-0
          bg-zinc-300 dark:bg-zinc-700
          border border-transparent
          transition-colors duration-300 ease-out
          appearance-none
          focus:outline-none focus:ring-0 focus:ring-offset-0
          hover:scale-[1.02] active:scale-[0.98]
        `}
        style={{
          WebkitTapHighlightColor: "transparent",
          transition: "all 300ms ease",
        }}
      >
        {/* Thumb */}
        <div
          className="w-5 h-5 bg-white dark:bg-zinc-100 rounded-full shadow-sm transform transition-all duration-300 ease-out relative"
          style={{
            transform: `translateX(${isDark ? "20px" : "0"}) ${isAnimating ? "scale(0.95)" : "scale(1)"}`,
          }}
        >
          {/* Icons (fade/rotate/scale) */}
          <div
            className="absolute inset-0 flex items-center justify-center transition-opacity duration-200 ease-out"
            style={{
              opacity: isDark ? 0 : 1,
              transform: `rotate(${isDark ? "180deg" : "0"}) scale(${isDark ? 0 : 1})`,
              transition: "all 200ms ease-out",
            }}
          >
            <svg
              className="w-3 h-3 text-gray-600 dark:text-gray-600"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div
            className="absolute inset-0 flex items-center justify-center transition-opacity duration-200 ease-out"
            style={{
              opacity: isDark ? 1 : 0,
              transform: `rotate(${isDark ? 0 : -180}deg) scale(${isDark ? 1 : 0})`,
              transition: "all 200ms ease-out",
            }}
          >
            <svg
              className="w-3 h-3 text-gray-600 dark:text-gray-600"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          </div>
        </div>
      </button>
    </div>
  );
}
