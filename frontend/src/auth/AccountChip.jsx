// Who you are, in the header. A guest gets a way in; a signed-in user gets a
// way out. Deliberately small — signing in is optional, so this must not read
// as the most important control on the page.
import { useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { useAuth } from "./useAuth.js";

export default function AccountChip() {
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  const configured = useAuth((s) => s.configured);
  const openPrompt = useAuth((s) => s.openPrompt);
  const signOut = useAuth((s) => s.signOut);
  const [menu, setMenu] = useState(false);

  // still asking the server, or the server has no sign-in configured at all
  if (status === "checking" || configured === false) return null;

  if (!user) {
    return (
      <button
        onClick={() => openPrompt("Your collection will be waiting on your account.")}
        className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-on-dark hover:bg-white/20"
      >
        <LogIn size={13} /> Sign in
      </button>
    );
  }

  const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setMenu((v) => !v)}
        aria-label={`Signed in as ${user.email}`}
        className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-white/10 text-xs font-bold text-on-dark hover:bg-white/20"
      >
        {user.picture
          ? <img src={user.picture} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          : initial}
      </button>

      {menu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
          <div className="absolute right-0 top-9 z-20 w-56 rounded-xl bg-elevated p-2 shadow-pop">
            <p className="truncate px-2 py-1 text-xs text-muted" title={user.email}>
              {user.email}
            </p>
            <button
              onClick={() => { setMenu(false); signOut(); }}
              className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-ink hover:bg-black/5"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
