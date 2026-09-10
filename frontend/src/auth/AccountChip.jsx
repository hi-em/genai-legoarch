// Who you are, in the header. A guest gets a way in; a signed-in user gets a
// way out. Deliberately small — signing in is optional, so this must not read
// as the most important control on the page.
import { useState } from "react";
import { LogIn, LogOut, Trash2 } from "lucide-react";
import { useAuth } from "./useAuth.js";
import { useCollection } from "../state/store.js";
import { toast } from "../components/ui/index.js";

export default function AccountChip() {
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  const configured = useAuth((s) => s.configured);
  const openPrompt = useAuth((s) => s.openPrompt);
  const signOut = useAuth((s) => s.signOut);
  const deleteAccount = useAuth((s) => s.deleteAccount);
  const [menu, setMenu] = useState(false);
  // Deletion is irreversible, so the menu item ARMS it and a second, explicitly
  // different click confirms — no native confirm() dialog, and no single
  // misclick that erases someone's collection.
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  const closeMenu = () => { setMenu(false); setArmed(false); };

  async function onDelete() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await deleteAccount();
      useCollection.getState().reset();
      closeMenu();
      toast.success(
        "Account deleted",
        res?.sets ? `Your account and ${res.sets} saved ${res.sets === 1 ? "set" : "sets"} are gone.`
                  : "Your account and everything on it are gone."
      );
    } catch {
      toast.error("Couldn't delete your account", "Nothing was removed — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

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
          <div className="fixed inset-0 z-10" onClick={closeMenu} />
          <div className="absolute right-0 top-9 z-20 w-64 rounded-xl bg-elevated p-2 shadow-pop">
            <p className="truncate px-2 py-1 text-xs text-muted" title={user.email}>
              {user.email}
            </p>
            <button
              onClick={() => { closeMenu(); signOut(); }}
              className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-ink hover:bg-black/5"
            >
              <LogOut size={14} /> Sign out
            </button>

            <div className="my-1 border-t border-black/10" />

            {!armed ? (
              <button
                onClick={() => setArmed(true)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-brand-red hover:bg-brand-red/10"
              >
                <Trash2 size={14} /> Delete my account
              </button>
            ) : (
              <div className="rounded-lg bg-brand-red/10 p-2">
                <p className="text-xs leading-snug text-ink">
                  This erases your account and every set on your shelf. It cannot be undone.
                </p>
                <div className="mt-2 flex gap-1.5">
                  <button
                    onClick={onDelete}
                    disabled={busy}
                    className="flex-1 rounded-lg bg-brand-red px-2 py-1.5 text-xs font-bold text-white hover:brightness-105 disabled:opacity-50"
                  >
                    {busy ? "Deleting…" : "Delete everything"}
                  </button>
                  <button
                    onClick={() => setArmed(false)}
                    className="rounded-lg px-2 py-1.5 text-xs font-semibold text-ink hover:bg-black/5"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
