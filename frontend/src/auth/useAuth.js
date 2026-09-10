// Who is signed in.
//
// The session is an HttpOnly cookie set by the backend, so this store never
// holds a token — it only mirrors what /auth/me says. That means page scripts
// (and anything injected into them) cannot read the credential.
//
// `status` is three-valued on purpose: "checking" is not "signed out". Treating
// them the same would flash the sign-in gate at an already-signed-in user on
// every reload.
import { create } from "zustand";
import { authConfig, fetchMe, postSignIn, postSignOut } from "../api.js";

export const useAuth = create((set, get) => ({
  status: "checking",       // "checking" | "in" | "out"
  user: null,
  // The sign-in ask is a dialog, not a wall: it opens where it earns itself
  // (the intro's second door, pressing Pack as a guest) and closes on success.
  promptOpen: false,
  promptReason: null,
  clientId: null,           // Google OAuth client id, from the backend
  configured: null,         // false when GOOGLE_CLIENT_ID is unset server-side
  error: null,

  hydrate: async () => {
    // both are cheap and independent — don't serialize them
    const [me, cfg] = await Promise.all([
      fetchMe().catch(() => ({ user: null })),
      authConfig().catch(() => ({ clientId: null, configured: false })),
    ]);
    set({
      user: me.user || null,
      status: me.user ? "in" : "out",
      clientId: cfg.clientId || null,
      configured: !!cfg.configured,
    });
  },

  // `credential` is the ID token Google Identity Services hands us. It goes
  // straight to the backend to be verified there — we never trust it here.
  signIn: async (credential) => {
    set({ error: null });
    try {
      const { user } = await postSignIn(credential);
      set({ user, status: "in" });
      return true;
    } catch (e) {
      set({ error: e?.message || "Sign-in failed", status: "out" });
      return false;
    }
  },

  openPrompt: (reason = null) => set({ promptOpen: true, promptReason: reason, error: null }),
  closePrompt: () => set({ promptOpen: false, promptReason: null }),

  signOut: async () => {
    await postSignOut().catch(() => {});
    set({ user: null, status: "out" });
  },
}));

if (typeof window !== "undefined") useAuth.getState().hydrate();
