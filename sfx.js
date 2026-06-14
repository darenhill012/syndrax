// sfx.js — tiny game-menu sound layer for the Syndrax app. All sounds are
// synthesized with the Web Audio API (no asset files, CSP-safe). Self-wires
// hover/press cues on interactive elements and exposes playSfx() + a mute toggle.
//
// Autoplay policy: the AudioContext is created/resumed on the first real user
// gesture. Muted state persists in localStorage ('syndrax_sfx').

const SFX_KEY = 'syndrax_sfx';
let enabled = localStorage.getItem(SFX_KEY) !== '0'; // default ON
let ctx = null;
let master = null;

function ensureCtx() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.5; // overall headroom; individual sounds stay subtle
  master.connect(ctx.destination);
  return ctx;
}

// One short tone with an attack/decay envelope.
function tone({ type = 'square', from = 440, to = from, dur = 0.06, gain = 0.05, delay = 0 }) {
  const c = ensureCtx(); if (!c || !master) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(master);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

const SOUNDS = {
  hover:   () => tone({ type: 'triangle', from: 1180, to: 1320, dur: 0.035, gain: 0.022 }),
  press:   () => { tone({ type: 'square', from: 300, to: 520, dur: 0.05, gain: 0.05 }); },
  nav:     () => { tone({ type: 'square', from: 420, to: 660, dur: 0.06, gain: 0.045 }); },
  confirm: () => { tone({ type: 'triangle', from: 660, to: 680, dur: 0.09, gain: 0.05 });
                   tone({ type: 'triangle', from: 990, to: 1020, dur: 0.11, gain: 0.05, delay: 0.085 }); },
  error:   () => { tone({ type: 'sawtooth', from: 200, to: 120, dur: 0.16, gain: 0.05 }); },
  toggle:  () => tone({ type: 'square', from: 540, to: 760, dur: 0.07, gain: 0.05 }),
};

export function playSfx(name) {
  if (!enabled) return;
  const fn = SOUNDS[name]; if (fn) { try { fn(); } catch {} }
}

export function sfxEnabled() { return enabled; }
export function setSfx(on) {
  enabled = !!on;
  localStorage.setItem(SFX_KEY, enabled ? '1' : '0');
  if (enabled) { ensureCtx(); playSfx('toggle'); }
}
export function toggleSfx() { setSfx(!enabled); return enabled; }

// ── Self-wiring: press on interactive controls, hover on cards/nav ────────────
const PRESS_SEL = 'button, a.app-btn, [data-tab], [data-connect], [data-mod], [data-target], .method-tab, .mk-tile, .acct-chip.add, .wf-acc, .script-card, .admin-seg button';
const HOVER_SEL = '.dash-nav, .script-card, .mk-tile, .acct-chip, .job-row, .trust-step, .wf-acc, .app-btn';
const NAV_SEL = '.dash-nav, [data-tab]';

let lastHover = 0;
let lastHoverEl = null;

if (typeof document !== 'undefined') {
  // Resume audio on first gesture (covers browsers that block until interaction).
  const wake = () => { ensureCtx(); window.removeEventListener('pointerdown', wake); };
  window.addEventListener('pointerdown', wake, { once: true });

  document.addEventListener('pointerdown', (e) => {
    if (!enabled) return;
    const el = e.target.closest && e.target.closest(PRESS_SEL);
    if (!el || el.disabled) return;
    playSfx(el.closest(NAV_SEL) ? 'nav' : 'press');
  }, true);

  document.addEventListener('pointerover', (e) => {
    if (!enabled) return;
    const el = e.target.closest && e.target.closest(HOVER_SEL);
    if (!el || el === lastHoverEl) return;
    const now = Date.now ? Date.now() : performance.now();
    if (now - lastHover < 45) return; // throttle rapid sweeps
    lastHover = now; lastHoverEl = el;
    playSfx('hover');
  }, true);
  document.addEventListener('pointerout', (e) => {
    const el = e.target.closest && e.target.closest(HOVER_SEL);
    if (el && el === lastHoverEl) lastHoverEl = null;
  }, true);
}

window.SyndraxSfx = { playSfx, toggleSfx, setSfx, sfxEnabled };
