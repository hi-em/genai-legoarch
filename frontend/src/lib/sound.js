// Tiny synthesized UI sounds (Web Audio) — no audio assets needed.
// Respects a persisted mute flag (see useUI in state/store.js).
let ctx;
function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}
function muted() {
  try { return localStorage.getItem("lEgoarCh.muted") === "1"; } catch { return false; }
}
function blip(freq, t0, dur, gain = 0.07, type = "square") {
  const a = ac();
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur);
}

// a two-tick "snap" — like two bricks clicking together
export function playSnap() {
  if (muted()) return;
  try { const a = ac(); const t = a.currentTime; blip(430, t, 0.05); blip(700, t + 0.045, 0.05); } catch {}
}

// a rising "pop" — for adding to the shelf
export function playPop() {
  if (muted()) return;
  try { const a = ac(); const t = a.currentTime; blip(540, t, 0.05, 0.07); blip(900, t + 0.06, 0.09, 0.06); } catch {}
}
