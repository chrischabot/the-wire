import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeName = "twitter" | "vega" | "nova" | "maia" | "lyra" | "mira";

export interface Theme {
  name: ThemeName;
  display: string;
  desc: string;
}

export const THEMES: Theme[] = [
  { name: "twitter", display: "Twitter", desc: "Pure black, blue accent" },
  { name: "vega", display: "Vega", desc: "Classic shadcn slate" },
  { name: "nova", display: "Nova", desc: "Compact & efficient" },
  { name: "maia", display: "Maia", desc: "Soft & rounded" },
  { name: "lyra", display: "Lyra", desc: "Boxy & monospace" },
  { name: "mira", display: "Mira", desc: "Ultra dense" },
];

interface ThemeState {
  current: ThemeName;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      current: "maia",
      setTheme: (theme) => {
        document.documentElement.setAttribute("data-theme", theme);
        set({ current: theme });
      },
      toggleTheme: () => {
        const currentIndex = THEMES.findIndex((t) => t.name === get().current);
        const nextIndex = (currentIndex + 1) % THEMES.length;
        const nextTheme = THEMES[nextIndex].name;
        document.documentElement.setAttribute("data-theme", nextTheme);
        set({ current: nextTheme });
      },
    }),
    {
      name: "the_wire_theme",
      onRehydrateStorage: () => (state) => {
        if (state?.current) {
          document.documentElement.setAttribute("data-theme", state.current);
        }
      },
    },
  ),
);
