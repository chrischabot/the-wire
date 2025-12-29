import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface User {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  isAdmin?: boolean;
  email?: string;
}

export type LinkStatus = "unknown" | "linked" | "needs_handle";

interface AuthState {
  token: string | null;
  user: User | null;
  linkStatus: LinkStatus;
  setAuth: (token: string, user: User) => void;
  setUser: (user: User) => void;
  setLinkStatus: (status: LinkStatus) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      linkStatus: "unknown",
      setAuth: (token, user) => set({ token, user, linkStatus: "linked" }),
      setUser: (user) => set({ user, linkStatus: "linked" }),
      setLinkStatus: (linkStatus) => set({ linkStatus }),
      logout: () => set({ token: null, user: null, linkStatus: "unknown" }),
      isAuthenticated: () => !!get().user || !!get().token,
    }),
    { name: "the-wire-auth" },
  ),
);
