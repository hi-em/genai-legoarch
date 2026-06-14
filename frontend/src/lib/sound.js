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

// Module-level rate-limit so a repeating trigger (a drag, a fast double-tap)
// can't machine-gun the clicky `snap`. Only `snap` is gated — the one-shot
// payoff sounds below always land.
let _lastSnap = 0;
function snapGate(minMs = 45) {
  const t = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (t - _lastSnap < minMs) return false;
  _lastSnap = t;
  return true;
}

// a two-tick "snap" — like two bricks clicking together
export function playSnap() {
  if (muted() || !snapGate()) return;
  try { const a = ac(); const t = a.currentTime; blip(430, t, 0.05); blip(700, t + 0.045, 0.05); } catch {}
}

// a rising "pop" — for adding to the shelf
export function playPop() {
  if (muted()) return;
  try { const a = ac(); const t = a.currentTime; blip(540, t, 0.05, 0.07); blip(900, t + 0.06, 0.09, 0.06); } catch {}
}

// a warm rising C–E–G arpeggio (sine) — the "set complete" payoff at the
// reveal. Distinct from the clicky snap on purpose: this is the one moment the
// whole app builds toward, so it gets its own, gentler voice.
export function playReveal() {
  if (muted()) return;
  try {
    const a = ac(); const t = a.currentTime;
    blip(523.25, t, 0.14, 0.06, "sine");
    blip(659.25, t + 0.10, 0.16, 0.06, "sine");
    blip(783.99, t + 0.22, 0.30, 0.07, "sine");
  } catch {}
}

// a bright rising third — you called the set right (CallSheet scorecard)
export function playWin() {
  if (muted()) return;
  try { const a = ac(); const t = a.currentTime; blip(660, t, 0.08, 0.06, "sine"); blip(990, t + 0.08, 0.18, 0.06, "sine"); } catch {}
}

// a soft descending blip — missed the call. Gentle triangle, never a buzzer:
// a live demo wants a wink, not an alarm.
export function playLose() {
  if (muted()) return;
  try { const a = ac(); const t = a.currentTime; blip(392, t, 0.10, 0.05, "triangle"); blip(311, t + 0.09, 0.18, 0.05, "triangle"); } catch {}
}
