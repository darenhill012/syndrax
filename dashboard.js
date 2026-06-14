// dashboard.js — Syndrax web app. An extension-style dashboard that runs in the
// browser: sidebar + Workspace (script palette → jobs → log) + Accounts + plan
// gating. The Chrome EXTENSION is the sync/execution backend — scripts are
// dispatched to it via runtime messaging; this page is the front end for all 3
// plans (Business = this PC only, Growth/Enterprise unlock more).
import { getSession, signOut } from '/auth-cognito.js';
import { getStatus, openPortal, startCheckout } from '/billing.js';
import {
  getProfile, saveProfile, getMarketplaces, addMarketplaceAccount,
  removeMarketplaceAccount, getAudit, startTrial,
} from '/app-api.js';
import {
  PLAN_LABEL, PLAN_PRICE, PLAN_TAGLINE, PLAN_LIMITS,
  MARKETPLACES, marketplace, marketplaceLogo, eligibility, runAudit, nextPlan, isUnlimited,
} from '/plans.js';

// ── extension (sync backend) ─────────────────────────────────────────────────
const EXT_IDS = ['olhecndljgbocfkdejkcppadadmfiojo', 'mgapfpdkkihbeehfkgoajhealmgpnglo'];
const JOBS_KEY = 'syndrax_web_jobs_v1';

// ── icons (inline, lucide-ish) ───────────────────────────────────────────────
const P = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const ICONS = {
  home: `<svg viewBox="0 0 24 24" ${P}><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></svg>`,
  chart: `<svg viewBox="0 0 24 24" ${P}><path d="M3 3v18h18"/><path d="M7 14l3-4 3 3 5-7"/></svg>`,
  cash: `<svg viewBox="0 0 24 24" ${P}><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>`,
  rocket: `<svg viewBox="0 0 24 24" ${P}><path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2 0-2.8a2 2 0 0 0-3 0z"/><path d="M12 15l-3-3a22 22 0 0 1 8-10c2 0 4 2 4 4a22 22 0 0 1-9 9z"/><path d="M9 12H4s.5-3 2-4 5 0 5 0"/></svg>`,
  tag: `<svg viewBox="0 0 24 24" ${P}><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0l-7.8-7.8V3h9.8l8 8a2 2 0 0 1 0 2.4z"/><circle cx="7.5" cy="7.5" r="1.3"/></svg>`,
  briefcase: `<svg viewBox="0 0 24 24" ${P}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
  monitor: `<svg viewBox="0 0 24 24" ${P}><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`,
  users: `<svg viewBox="0 0 24 24" ${P}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" ${P}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>`,
  card: `<svg viewBox="0 0 24 24" ${P}><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>`,
  chevrons: `<svg viewBox="0 0 24 24" ${P}><path d="M11 17l-5-5 5-5M18 17l-5-5 5-5"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" ${P}><path d="M12 5v14M5 12h14"/></svg>`,
  x: `<svg viewBox="0 0 24 24" ${P}><path d="M18 6 6 18M6 6l12 12"/></svg>`,
  play: `<svg viewBox="0 0 24 24"><path d="M6 4l14 8-14 8z" fill="currentColor"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" ${P}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  upload: `<svg viewBox="0 0 24 24" ${P}><path d="M16 16l-4-4-4 4M12 12v9"/><path d="M20.4 18.6A5 5 0 0 0 18 9h-1.3A8 8 0 1 0 3 16.3"/></svg>`,
  package: `<svg viewBox="0 0 24 24" ${P}><path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="M3 7l9 5 9-5"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" ${P}><path d="M21 2v6h-6M3 22v-6h6"/><path d="M21 8a9 9 0 0 0-15-3L3 8M3 16a9 9 0 0 0 15 3l3-3"/></svg>`,
  crosshair: `<svg viewBox="0 0 24 24" ${P}><circle cx="12" cy="12" r="9"/><path d="M22 12h-4M6 12H2M12 6V2M12 22v-4"/></svg>`,
  wifi: `<svg viewBox="0 0 24 24" ${P}><path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01"/></svg>`,
};
const icon = (n) => ICONS[n] || '';

// ── helpers ───────────────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel, root = document) => root.querySelector(sel);
function loadJobs() { try { return JSON.parse(localStorage.getItem(JOBS_KEY)) || []; } catch { return []; } }
function saveJobs() { try { localStorage.setItem(JOBS_KEY, JSON.stringify(jobs.slice(0, 100))); } catch {} }
function timeAgo(t) { const s = Math.max(0, (Date.now() - t) / 1000 | 0); return s < 60 ? `${s}s ago` : s < 3600 ? `${s / 60 | 0}m ago` : `${s / 3600 | 0}h ago`; }

// ── state ───────────────────────────────────────────────────────────────────
const session = getSession();
if (!session) location.replace('/login');
let email = '';
try { email = JSON.parse(atob(session.idToken.split('.')[1])).email || ''; } catch {}

// Admin can preview each plan's dashboard live.
const ADMIN_EMAILS = ['olegperchatkin@gmail.com'];
const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase());
const PREVIEW_KEY = 'syndrax_admin_preview_plan';

let plan = 'none';        // effective plan (preview override for admin, else real)
let realPlan = 'none';    // the account's actual plan
let previewPlan = isAdmin ? (localStorage.getItem(PREVIEW_KEY) || null) : null;
let statusRow = { plan: 'none' };
let profile = {};
let accounts = [];
let jobs = loadJobs();
let activeTab = 'home';
let selectedJobId = null;
let railOpen = false;
let ext = window.SyndraxExt || { installed: false };
let configuring = null; // script key for modal
let connecting = null;  // marketplace id for connect modal

// ── plan gating ───────────────────────────────────────────────────────────────
function can(feature) {
  const l = PLAN_LIMITS[plan] || PLAN_LIMITS.none;
  if (feature === 'multiDevice') return l.maxDevices > 1;
  if (feature === 'team') return l.teamSeats > 1;
  return true;
}

const TABS = [
  { id: 'home', label: 'Home', icon: 'home', sec: 'Mission Control' },
  { id: 'workspace', label: 'Workspace', icon: 'rocket', sec: 'Mission Control' },
  { id: 'accounts', label: 'Accounts', icon: 'tag', sec: 'Mission Control' },
  { id: 'jobs', label: 'Jobs', icon: 'briefcase', sec: 'Operations' },
  { id: 'devices', label: 'Devices', icon: 'monitor', sec: 'Operations', feature: 'multiDevice' },
  { id: 'team', label: 'Team', icon: 'users', sec: 'Operations', feature: 'team' },
  { id: 'audit', label: 'Safety Audit', icon: 'shield', sec: 'Control' },
  { id: 'plan', label: 'Plan & Billing', icon: 'card', sec: 'Control' },
];

const SCRIPTS = [
  { key: 'bulklister', label: 'BulkLister', desc: 'Bulk-list ASINs to eBay', icon: 'upload', ready: true },
  { key: 'inventory', label: 'Inventory Sync', desc: 'Stock & lifecycle sync', icon: 'package', ready: false },
  { key: 'quicksync', label: 'Quick Sync', desc: 'Fast price/stock pass', icon: 'refresh', ready: false },
  { key: 'sniper', label: 'Sniper', desc: 'Targeted competitive lister', icon: 'crosshair', ready: false },
];

// ── boot ────────────────────────────────────────────────────────────────────
function applyPlan() { plan = (isAdmin && previewPlan) ? previewPlan : realPlan; }

async function boot() {
  try { statusRow = await getStatus(); realPlan = statusRow.plan || 'none'; } catch { realPlan = 'none'; }
  applyPlan();
  try { profile = await getProfile(); } catch { profile = {}; }
  if (!profile.onboarding_complete && realPlan === 'none' && !isAdmin) { location.replace('/onboarding'); return; }
  try { const mk = await getMarketplaces(); accounts = mk.accounts || []; } catch { accounts = []; }
  document.addEventListener('syndrax-ext', () => { ext = window.SyndraxExt || ext; renderShell(); });
  renderShell();
}

// ── shell ───────────────────────────────────────────────────────────────────
function renderShell() {
  const root = document.getElementById('dashRoot');
  const visibleTabs = TABS;
  const sections = [...new Set(visibleTabs.map(t => t.sec))];
  const planChip = `<span class="app-plan-chip plan-${plan}">${PLAN_LABEL[plan] || plan}</span>`;
  root.innerHTML = `
    <aside class="dash-rail${railOpen ? ' open' : ''}" id="rail">
      <div class="dash-rail-top">
        ${railOpen ? '<img class="dash-rail-logo" src="assets/TOPLOGO/BANNEREFFECT.png" alt="Syndrax">' : ''}
        <button class="dash-rail-toggle" id="railToggle" title="Toggle menu">${icon('chevrons')}</button>
      </div>
      ${sections.map(sec => `
        <div class="dash-sec">
          <div class="dash-sec-h">${sec}</div>
          ${visibleTabs.filter(t => t.sec === sec).map(navBtn).join('')}
        </div>`).join('')}
    </aside>
    <div class="dash-body">
      <header class="dash-top">
        <div><h2>${TABS.find(t => t.id === activeTab)?.label || ''}</h2><span class="sub" id="topSub"></span></div>
        <div class="dash-id">
          ${devicePill()}
          <span>${esc(email)}</span>
          ${planChip}
          <button class="app-signout" id="signOut">Sign out</button>
        </div>
      </header>
      ${isAdmin ? adminBar() : ''}
      <div class="auth-alert" id="appAlert" style="margin:12px 22px 0"></div>
      <main class="dash-content" id="content"></main>
    </div>`;

  $('#railToggle').onclick = () => { railOpen = !railOpen; renderShell(); };
  $('#signOut').onclick = () => { signOut(); location.href = '/login'; };
  if (isAdmin) {
    root.querySelectorAll('[data-pp]').forEach(b => b.onclick = () => {
      previewPlan = b.dataset.pp; localStorage.setItem(PREVIEW_KEY, previewPlan); applyPlan(); renderShell();
    });
    const reset = $('#ppReset');
    if (reset) reset.onclick = () => { previewPlan = null; localStorage.removeItem(PREVIEW_KEY); applyPlan(); renderShell(); };
  }
  root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { activeTab = b.dataset.tab; selectedJobId = null; renderShell(); });
  renderTab();
}

function navBtn(t) {
  const locked = t.feature && !can(t.feature);
  return `<button class="dash-nav${activeTab === t.id ? ' active' : ''}" data-tab="${t.id}" title="${t.label}${locked ? ' (upgrade)' : ''}">
    ${icon(t.icon)}<span>${t.label}</span>${locked ? `<span class="lock">${icon('lock')}</span>` : ''}
  </button>`;
}

function adminBar() {
  return `<div class="admin-bar">
    <span class="ab-label">★ Admin preview</span>
    <div class="admin-seg">
      ${['business', 'growth', 'enterprise'].map(p => `<button data-pp="${p}" class="${plan === p && previewPlan ? 'on' : ''}">${PLAN_LABEL[p]}</button>`).join('')}
    </div>
    <span class="ab-note">real plan: ${PLAN_LABEL[realPlan]}${previewPlan ? ` · previewing ${PLAN_LABEL[plan]}` : ' · viewing your real plan'}</span>
    ${previewPlan ? '<button class="ab-reset" id="ppReset">exit preview</button>' : ''}
  </div>`;
}

function devicePill() {
  return ext.installed
    ? `<span class="relay-pill on">${icon('wifi')} This PC connected</span>`
    : `<span class="relay-pill off">${icon('monitor')} Extension not detected</span>`;
}

function showAlert(msg, type = 'error') { const el = $('#appAlert'); if (el) { el.textContent = msg; el.className = 'auth-alert ' + type; } }

// ── tab router ────────────────────────────────────────────────────────────────
function renderTab() {
  const t = TABS.find(x => x.id === activeTab);
  if (t?.feature && !can(t.feature)) return renderUpgradeLock(t.feature);
  ({
    home: renderHome, workspace: renderWorkspace, accounts: renderAccounts, jobs: renderJobsTab,
    devices: renderDevices, team: renderTeam, audit: renderAudit, plan: renderPlanTab,
  }[activeTab] || renderHome)();
}

function renderUpgradeLock(feature) {
  const np = nextPlan(plan);
  $('#content').innerHTML = `
    <div class="ws-empty" style="max-width:520px;margin:40px auto;padding:34px">
      <div style="width:46px;height:46px;border-radius:13px;border:1px solid rgba(34,211,238,.3);background:rgba(34,211,238,.1);display:flex;align-items:center;justify-content:center;color:#67e8f9">${icon('lock')}</div>
      <h3 style="color:#f1f5f9;font:700 16px var(--nav-font);margin:4px 0">A ${np ? PLAN_LABEL[np] : 'higher'} feature</h3>
      <p style="color:#94a3b8;font-size:13.5px;text-align:center;line-height:1.6;max-width:380px">Run on more devices and isolate each marketplace account on its own IP — that's how you scale without linked-account restrictions.</p>
      ${np ? `<button class="app-btn" id="lockUp">Upgrade to ${PLAN_LABEL[np]}</button>` : ''}
      <p style="color:#475569;font-size:11px">You're on ${PLAN_LABEL[plan]}.</p>
    </div>`;
  const b = $('#lockUp'); if (b) b.onclick = () => startCheckout(np).catch(e => showAlert(e.message));
}

// ── HOME / OVERVIEW ───────────────────────────────────────────────────────────
const fmt$ = (n) => '$' + Math.round(n).toLocaleString();

// Sample performance series, scaled by plan, until live sales sync is wired from
// the connected accounts. Clearly labelled "sample" in the UI.
function salesSeries() {
  const scale = { trial: 0.6, business: 1, growth: 2.6, enterprise: 6, none: 0.4 }[plan] || 1;
  const baseGross = [340, 420, 390, 520, 610, 560, 720, 880];
  const labels = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'];
  const gross = baseGross.map(v => Math.round(v * scale));
  const net = gross.map(v => Math.round(v * 0.42));
  return { labels, gross, net, grossTotal: gross.reduce((a, b) => a + b, 0), netTotal: net.reduce((a, b) => a + b, 0), sample: true };
}

function areaChart(labels, sets) {
  const W = 760, H = 200, pl = 10, pr = 10, pt = 12, pb = 22;
  const max = Math.max(1, ...sets.flatMap(s => s.data));
  const n = labels.length;
  const x = i => pl + (i / (n - 1)) * (W - pl - pr);
  const y = v => pt + (1 - v / max) * (H - pt - pb);
  let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">`;
  for (let g = 0; g <= 3; g++) { const gy = pt + (g / 3) * (H - pt - pb); svg += `<line x1="${pl}" y1="${gy}" x2="${W - pr}" y2="${gy}" stroke="rgba(255,255,255,.06)"/>`; }
  sets.forEach(s => {
    const pts = s.data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    svg += `<polygon points="${pl},${H - pb} ${pts} ${W - pr},${H - pb}" fill="${s.color}" opacity="0.10"/>`;
    svg += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    s.data.forEach((v, i) => { svg += `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2.4" fill="${s.color}"/>`; });
  });
  labels.forEach((l, i) => { svg += `<text x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="9" fill="#475569">${l}</text>`; });
  return svg + '</svg>';
}

function stat(label, val, ic, dir, sub) {
  return `<div class="stat"><div class="s-label">${icon(ic)} ${label}</div><div class="s-val">${val}</div><div class="s-sub ${dir || ''}">${sub}</div></div>`;
}

function accountsStrip() {
  const connected = accounts.map(a => {
    const m = marketplace(a.marketplace);
    const logo = marketplaceLogo(a.marketplace) || `<span style="font:800 16px var(--nav-font);color:#fff">${(m?.name || '?')[0]}</span>`;
    return `<div class="acct-chip active"><span class="ac-logo neutral">${logo}</span><div><div class="ac-name">${esc(a.label || m?.name || a.marketplace)}</div><div class="ac-sub on">● active</div></div></div>`;
  }).join('');
  const have = new Set(accounts.map(a => a.marketplace));
  const adds = MARKETPLACES.filter(m => m.access !== 'source' && !have.has(m.id)).slice(0, 3).map(m => {
    const logo = marketplaceLogo(m.id) || `<span style="font:800 16px var(--nav-font);color:#67e8f9">${m.name[0]}</span>`;
    return `<div class="acct-chip add" data-connect="${m.id}"><span class="ac-logo">${logo}</span><div><div class="ac-name">${m.name}</div><div class="ac-sub">+ connect</div></div></div>`;
  }).join('');
  return (connected + adds) || '<p style="font-size:12px;color:#64748b">No accounts yet.</p>';
}

function renderHome() {
  $('#topSub').textContent = '';
  const content = $('#content');
  const incomplete = accounts.length === 0;
  const s = salesSeries();
  const activeAccts = accounts.length || ({ trial: 1, business: 1, growth: 3, enterprise: 8, none: 0 }[plan] || 0);
  const orders = Math.round(s.grossTotal / 42);
  const margin = s.grossTotal ? Math.round(s.netTotal / s.grossTotal * 100) : 0;

  content.innerHTML = `
    ${incomplete ? `<div class="setup-strip">
      <div class="ss-ico">${icon('rocket')}</div>
      <div style="flex:1"><div class="ss-title">Finish your setup</div><div class="ss-sub">Connect a marketplace to start listing and see your live net/gross here.</div></div>
      <button class="app-btn sm" data-connect="ebay">Connect eBay</button>
      <button class="app-btn ghost sm" data-setup="1">Setup guide</button>
    </div>` : ''}

    <div class="home-grid">
      ${stat('Gross (8 wk)', fmt$(s.grossTotal), 'cash', 'up', '↑ 12% vs prev')}
      ${stat('Net profit', fmt$(s.netTotal), 'cash', 'up', margin + '% margin')}
      ${stat('Orders', orders.toLocaleString(), 'briefcase', '', 'across your accounts')}
      ${stat('Active accounts', String(activeAccts), 'tag', '', PLAN_LABEL[plan])}
    </div>

    <div class="chart-card">
      <div class="chart-head">
        <h3>Performance ${s.sample ? '<span class="mk-badge soon" style="position:static;margin-left:6px">sample</span>' : ''}</h3>
        <div class="chart-legend"><span><i style="background:#22d3ee"></i>Gross</span><span><i style="background:#d946ef"></i>Net</span></div>
      </div>
      ${areaChart(s.labels, [{ name: 'Gross', color: '#22d3ee', data: s.gross }, { name: 'Net', color: '#d946ef', data: s.net }])}
      ${s.sample ? '<div style="font-size:11px;color:#475569;margin-top:6px">Sample numbers — your live net/gross appears here once your connected accounts sync.</div>' : ''}
    </div>

    <div class="panel">
      <div class="panel-h">Connected accounts <span class="link" data-go="accounts">manage →</span></div>
      <div class="acct-strip">${accountsStrip()}</div>
    </div>`;

  content.querySelectorAll('[data-connect]').forEach(b => b.onclick = () => { connecting = b.dataset.connect; openConnectModal(); });
  content.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { activeTab = b.dataset.go; renderShell(); });
  content.querySelectorAll('[data-setup]').forEach(b => b.onclick = () => { location.href = '/onboarding'; });
}

// ── WORKSPACE ─────────────────────────────────────────────────────────────────
function renderWorkspace() {
  $('#topSub').textContent = ext.installed ? '· running on this device' : '· install the extension to run jobs';
  const job = jobs.find(j => j.jobId === selectedJobId) || null;
  $('#content').innerHTML = `
    <div class="ws">
      <div class="ws-left">
        <div class="panel">
          <div class="panel-h">Run on device</div>
          <div class="dev-row sel">
            <span class="dev-dot ${ext.installed ? 'on' : 'off'}"></span>
            <span class="dev-name">This PC</span>
            <span class="dev-meta">${ext.installed ? 'Extension v' + (ext.version || '') : 'main workstation'}</span>
          </div>
          ${can('multiDevice') ? `<p style="font-size:11px;color:#64748b;margin-top:10px">Remote devices appear here via the extension relay.</p>` : `<p style="font-size:11px;color:#64748b;margin-top:10px">Business runs on this one device. Upgrade to add more.</p>`}
        </div>

        <div class="panel">
          <div class="panel-h">Scripts</div>
          <div class="script-grid">
            ${SCRIPTS.map(s => `
              <button class="script-card ${s.ready ? 'ready' : 'soon'}" data-script="${s.key}" ${s.ready ? '' : 'disabled'} title="${s.ready ? 'Run ' + s.label : 'Coming soon'}">
                ${icon(s.icon)}
                <span class="sc-name">${s.label}</span>
                <span class="sc-desc">${s.ready ? esc(s.desc) : 'coming soon'}</span>
              </button>`).join('')}
          </div>
        </div>

        <div class="panel" style="flex:1">
          <div class="panel-h">Jobs (${jobs.length}) ${jobs.length ? '<span class="link" id="clearJobs">clear</span>' : ''}</div>
          ${jobs.length === 0 ? `<p style="font-size:12px;color:#64748b">No jobs yet — pick a script above.</p>`
            : jobs.map(jobRow).join('')}
        </div>
      </div>

      <div class="ws-right">
        ${job ? jobDetail(job) : `<div class="ws-empty">${icon('briefcase')}<p style="font-size:13px">Select a job to see its progress and log</p></div>`}
      </div>
    </div>`;

  $('#content').querySelectorAll('[data-script]').forEach(b => b.onclick = () => { configuring = b.dataset.script; openScriptModal(); });
  $('#content').querySelectorAll('[data-job]').forEach(b => b.onclick = () => { selectedJobId = b.dataset.job; renderWorkspace(); });
  const cj = $('#clearJobs'); if (cj) cj.onclick = () => { jobs = []; saveJobs(); selectedJobId = null; renderWorkspace(); };
}

function jobRow(j) {
  const pct = j.progress && j.progress.total ? Math.round((j.progress.listed + j.progress.errors) / j.progress.total * 100) : 0;
  return `<button class="job-row ${selectedJobId === j.jobId ? 'sel' : ''}" data-job="${j.jobId}">
    <div class="job-top">
      <span class="job-title">${icon('briefcase')} ${esc(j.scriptLabel)} <span class="on">on ${esc(j.deviceName)}</span></span>
      <span class="jb ${j.status}">${j.status.toUpperCase()}</span>
    </div>
    <div class="job-sub"><span>${j.progress ? `${j.progress.listed}/${j.progress.total} listed` : esc(j.message || '—')}</span><span>${timeAgo(j.createdAt)}</span></div>
    ${j.progress && j.progress.total ? `<div class="job-bar"><i style="width:${pct}%"></i></div>` : ''}
  </button>`;
}

function jobDetail(j) {
  return `<div style="display:flex;flex-direction:column;gap:14px">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <h3 style="font:700 15px var(--nav-font);color:#f1f5f9;margin:0">${esc(j.scriptLabel)} on ${esc(j.deviceName)}</h3>
      <span class="jb ${j.status}">${j.status.toUpperCase()}</span>
    </div>
    <div class="job-log">
      <div class="panel-h" style="margin-bottom:8px">Job log</div>
      ${j.log.map(l => `<div class="ln"><span class="t">${new Date(l.t).toLocaleTimeString()}</span><span>${esc(l.text)}</span></div>`).join('')}
    </div>
  </div>`;
}

// ── job dispatch (to the extension = backend) ──────────────────────────────────
function dispatch(script, scriptLabel, args) {
  const jobId = 'job-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  const job = {
    jobId, script, scriptLabel, deviceName: 'This PC',
    status: 'dispatched', createdAt: Date.now(), updatedAt: Date.now(),
    progress: null, message: '', log: [{ t: Date.now(), text: 'dispatched to this device' }],
  };
  jobs.unshift(job); saveJobs(); selectedJobId = jobId; configuring = null; renderWorkspace();

  const extId = ext.id || EXT_IDS[0];
  if (window.chrome && chrome.runtime && chrome.runtime.sendMessage && ext.installed) {
    chrome.runtime.sendMessage(extId, { type: 'SYNDRAX_RUN', script, args, jobId }, (resp) => {
      if (chrome.runtime.lastError || !resp || !resp.ok) {
        patchJob(jobId, 'error', (resp && resp.error) || (chrome.runtime.lastError && 'extension unavailable') || 'extension did not accept the job');
      } else {
        patchJob(jobId, 'accepted', 'accepted — running in the Syndrax extension on this device');
      }
    });
  } else {
    patchJob(jobId, 'no-device', 'Install the Syndrax extension on this device to run jobs.');
  }
}

function patchJob(jobId, status, line) {
  const j = jobs.find(x => x.jobId === jobId); if (!j) return;
  j.status = status; j.updatedAt = Date.now(); j.message = line;
  j.log.push({ t: Date.now(), text: line });
  saveJobs(); if (activeTab === 'workspace') renderWorkspace();
}

// ── script config modal (BulkLister) ─────────────────────────────────────────
function openScriptModal() {
  if (configuring !== 'bulklister') { configuring = null; return; }
  const host = document.createElement('div');
  host.className = 'modal-bg'; host.id = 'scriptModal';
  host.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <h3>${icon('upload')} Run BulkLister on This PC</h3>
      <p class="modal-sub">Paste Amazon URLs or ASINs — the extension lists them to your connected eBay account.</p>
      <label>Amazon URLs or ASINs</label>
      <textarea id="bArgs" rows="5" placeholder="B00RW5OWLE&#10;https://amazon.com/dp/B0..." style="font-family:ui-monospace,monospace;font-size:12px"></textarea>
      <div class="modal-row">
        <div><label>Threads</label><input id="bThreads" type="number" value="3" min="1" max="30"></div>
        <div><label>Markup %</label><input id="bMarkup" type="number" value="100" min="10"></div>
        <div><label>Listing type</label><select id="bType"><option value="opti">Opti-List</option><option value="rival">Rival-List</option><option value="chat">Chat</option><option value="seo">SEO</option></select></div>
      </div>
      <div class="app-btn-row" style="margin-top:18px">
        <button class="app-btn" id="bRun">${icon('play')} Launch job</button>
        <button class="app-btn ghost" id="bCancel">Cancel</button>
      </div>
    </div>`;
  host.onclick = () => host.remove();
  document.body.appendChild(host);
  $('#bCancel', host).onclick = () => host.remove();
  $('#bRun', host).onclick = () => {
    const asins = $('#bArgs', host).value;
    const count = (asins.match(/\b[A-Z0-9]{10}\b/gi) || []).length;
    if (!count) { $('#bArgs', host).style.borderColor = '#f87171'; return; }
    const args = {
      asins, threads: +$('#bThreads', host).value || 3, markupPct: +$('#bMarkup', host).value || 100,
      listingType: $('#bType', host).value, minPrice: 0, maxPrice: 0, fbaOnly: false,
    };
    host.remove();
    dispatch('bulklister', 'BulkLister', args);
  };
}

// ── ACCOUNTS ──────────────────────────────────────────────────────────────────
function renderAccounts() {
  $('#topSub').textContent = `· ${accounts.length} connected`;
  const limit = PLAN_LIMITS[plan]?.maxAccountsPerMarketplace;
  const counts = {}; accounts.forEach(a => counts[a.marketplace] = (counts[a.marketplace] || 0) + 1);
  const audit = runAudit(buildAuditInput());

  $('#content').innerHTML = `
    ${audit.findings.length ? `<div class="audit warn" style="margin-bottom:16px">
      <div class="audit-head">⚠️ ${audit.findings.length} account-safety note${audit.findings.length === 1 ? '' : 's'}</div>
      ${audit.findings.map(f => `<div class="audit-finding"><div class="f-title">${esc(f.title)}</div><div class="f-detail">${esc(f.detail)}</div>${f.upgradeTo ? `<div class="app-btn-row"><button class="app-btn sm" data-up="${f.upgradeTo}">Upgrade to ${PLAN_LABEL[f.upgradeTo]}</button></div>` : ''}</div>`).join('')}
    </div>` : ''}
    <p style="color:#94a3b8;font-size:13px;margin-bottom:14px">Connect the marketplaces you sell on. The extension keeps each account on its own device/IP. ${isUnlimited(limit) ? 'Unlimited accounts.' : `Up to <b style="color:#cbd5e1">${limit}</b> account${limit === 1 ? '' : 's'} per marketplace on ${PLAN_LABEL[plan]}.`}</p>
    <div class="mk-grid big">${MARKETPLACES.map(m => acctTile(m, counts[m.id] || 0, limit)).join('')}</div>`;

  $('#content').querySelectorAll('[data-connect]').forEach(b => b.onclick = () => { connecting = b.dataset.connect; openConnectModal(); });
  $('#content').querySelectorAll('[data-up]').forEach(b => b.onclick = () => startCheckout(b.dataset.up).catch(e => showAlert(e.message)));
}

function acctTile(m, n, limit) {
  const logo = marketplaceLogo(m.id) || `<span style="font:800 18px var(--nav-font);color:#fff">${m.name[0]}</span>`;
  const over = !isUnlimited(limit) && n >= limit;
  const badge = m.access === 'gated' ? ['gated', 'Gated'] : m.status === 'live' ? ['live', 'Live'] : m.status === 'beta' ? ['beta', 'Beta'] : ['soon', 'Soon'];
  const canAdd = m.access !== 'source';
  return `<div class="mk-tile big${n ? ' selected' : ''}">
    <span class="mk-badge ${badge[0]}">${badge[1]}</span>
    ${n ? '<span class="mk-check">✓</span>' : ''}
    <span class="mk-chip neutral">${logo}</span>
    <div class="mk-name">${m.name}</div>
    ${n ? `<div class="mk-count" style="${over ? 'color:#fcd34d' : ''}">${n}${isUnlimited(limit) ? '' : ' / ' + limit} account${n === 1 ? '' : 's'}</div>` : ''}
    ${canAdd ? `<button class="app-btn sm ghost" data-connect="${m.id}" style="margin-top:8px" ${over ? 'disabled title="Plan limit reached — upgrade"' : ''}>${icon('plus')} ${n ? 'Add' : 'Connect'}</button>` : `<div class="mk-status">Sourcing</div>`}
  </div>`;
}

function openConnectModal() {
  const m = marketplace(connecting); if (!m) return;
  const elig = m.access === 'gated' ? eligibility(m.id, { ein: profile.ein }) : null;
  const host = document.createElement('div');
  host.className = 'modal-bg';
  host.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <h3><span class="mk-chip neutral" style="width:34px;height:34px;display:inline-flex;vertical-align:middle;margin-right:8px">${marketplaceLogo(m.id) || m.name[0]}</span> Connect ${esc(m.name)}</h3>
      ${elig && elig.status !== 'eligible' ? `<div class="eligibility" style="margin:12px 0">${esc(elig.message)}</div>`
        : `<p class="modal-sub">Add the account you sell on. Sign in to ${esc(m.name)} on this device and the extension drives it safely on your IP.</p>`}
      <label>Account name / username</label>
      <input id="cLabel" placeholder="e.g. my-store-name">
      <label>Store URL (optional)</label>
      <input id="cUrl" placeholder="https://${m.id}.com/usr/your-store">
      <div class="app-btn-row" style="margin-top:18px">
        <button class="app-btn" id="cAdd">Connect account</button>
        <button class="app-btn ghost" id="cCancel">Cancel</button>
      </div>
    </div>`;
  host.onclick = () => host.remove();
  document.body.appendChild(host);
  $('#cCancel', host).onclick = () => host.remove();
  $('#cAdd', host).onclick = async () => {
    const label = $('#cLabel', host).value.trim() || m.name;
    const url = $('#cUrl', host).value.trim();
    $('#cAdd', host).disabled = true; $('#cAdd', host).textContent = 'Connecting…';
    try {
      await addMarketplaceAccount({ marketplace: m.id, label, deviceId: 'this-device', url });
      const mk = await getMarketplaces(); accounts = mk.accounts || [];
      host.remove(); renderAccounts(); showAlert(`${m.name} account connected.`, 'success');
    } catch (e) { showAlert(e.message || 'Could not connect.'); host.remove(); }
  };
}

// ── JOBS / DEVICES / TEAM / AUDIT / PLAN ──────────────────────────────────────
function renderJobsTab() {
  $('#topSub').textContent = `· ${jobs.length} total`;
  $('#content').innerHTML = jobs.length === 0
    ? `<div class="ws-empty" style="margin-top:40px">${icon('briefcase')}<p>No jobs yet — run a script from the Workspace.</p></div>`
    : `<div style="max-width:680px">${jobs.map(jobRow).join('')}</div>`;
  $('#content').querySelectorAll('[data-job]').forEach(b => b.onclick = () => { selectedJobId = b.dataset.job; activeTab = 'workspace'; renderShell(); });
}

function renderDevices() {
  $('#topSub').textContent = '';
  $('#content').innerHTML = `
    <div style="max-width:560px"><div class="panel">
      <div class="panel-h">Your devices</div>
      <div class="dev-row sel"><span class="dev-dot ${ext.installed ? 'on' : 'off'}"></span><span class="dev-name">This PC</span><span class="dev-meta">${ext.installed ? 'connected' : 'extension not detected'}</span></div>
      <p style="font-size:12px;color:#64748b;margin-top:12px">Add another device by installing the Syndrax extension on it and signing in with this account. Each device gets its own IP so accounts stay isolated.</p>
    </div></div>`;
}

function renderTeam() {
  $('#topSub').textContent = '';
  $('#content').innerHTML = `<div style="max-width:560px"><div class="panel"><div class="panel-h">Team</div><p style="font-size:13px;color:#94a3b8">Invite teammates to your workspace. Seats included on your plan: <b style="color:#cbd5e1">${PLAN_LIMITS[plan].teamSeats === null ? 'Unlimited' : PLAN_LIMITS[plan].teamSeats}</b>.</p><div class="app-btn-row"><button class="app-btn sm" id="invite">Invite a teammate</button></div></div></div>`;
  $('#invite').onclick = () => showAlert('Team invites open in the extension Team panel for now.', 'success');
}

function buildAuditInput() {
  const accountsByMarketplace = {}, accountsPerDevice = {};
  accounts.forEach(a => {
    accountsByMarketplace[a.marketplace] = (accountsByMarketplace[a.marketplace] || 0) + 1;
    const d = a.deviceId || 'this-device'; accountsPerDevice[d] = (accountsPerDevice[d] || 0) + 1;
  });
  const devices = [...new Set(accounts.map(a => a.deviceId || 'this-device'))].map(id => ({ id, name: id === 'this-device' ? 'This device' : id }));
  return { plan, accountsByMarketplace, accountsPerDevice, devices };
}

async function renderAudit() {
  $('#topSub').textContent = '';
  let audit = null; try { audit = await getAudit(); } catch {}
  if (!audit) audit = runAudit(buildAuditInput());
  const ok = audit.level === 'ok';
  $('#content').innerHTML = `<div style="max-width:680px"><div class="audit ${ok ? 'ok' : 'warn'}">
    <div class="audit-head">${ok ? '✓ You’re running safely' : '⚠️ ' + audit.findings.length + ' to review'}</div>
    ${ok ? `<div class="audit-finding"><div class="f-detail">Your accounts are within safe limits for ${PLAN_LABEL[plan]}. Syndrax keeps each account isolated on its own device/IP to avoid linked-account restrictions.</div></div>`
        : audit.findings.map(f => `<div class="audit-finding"><div class="f-title">${esc(f.title)}</div><div class="f-detail">${esc(f.detail)}</div>${f.upgradeTo ? `<div class="app-btn-row"><button class="app-btn sm" data-up="${f.upgradeTo}">Upgrade to ${PLAN_LABEL[f.upgradeTo]}</button></div>` : ''}</div>`).join('')}
  </div></div>`;
  $('#content').querySelectorAll('[data-up]').forEach(b => b.onclick = () => startCheckout(b.dataset.up).catch(e => showAlert(e.message)));
}

function renderPlanTab() {
  $('#topSub').textContent = '';
  const s = statusRow;
  let trialNote = '';
  if (s.trial_ends_at) {
    const days = Math.max(0, Math.ceil((new Date(s.trial_ends_at) - Date.now()) / 86400000));
    trialNote = `<div class="plan-meta">Free trial — ${days} day${days === 1 ? '' : 's'} left (ends ${new Date(s.trial_ends_at).toLocaleDateString()})</div>`;
  } else if (s.current_period_end) {
    trialNote = `<div class="plan-meta">Renews ${new Date(s.current_period_end).toLocaleDateString()}</div>`;
  }
  const np = nextPlan(plan);
  $('#content').innerHTML = `
    <div class="app-grid"><section class="app-card">
      <div class="card-kicker">Current plan</div>
      <div class="plan-name">${PLAN_LABEL[plan]}${PLAN_PRICE[plan] ? ' — ' + PLAN_PRICE[plan] : ''}</div>
      ${trialNote}
      <p class="muted" style="margin-top:8px">${PLAN_TAGLINE[plan] || ''}</p>
      <div class="app-btn-row" id="planBtns"></div>
    </section>
    <section class="app-card"><div class="card-kicker">Compare</div>
      ${['business', 'growth', 'enterprise'].map(p => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)"><span style="font-weight:${p === plan ? 700 : 500};color:${p === plan ? '#7fe3ff' : 'var(--text)'}">${PLAN_LABEL[p]}</span><span style="color:var(--text-gray)">${PLAN_PRICE[p]}</span></div>`).join('')}
      <a class="app-btn ghost sm" href="/pricing" style="margin-top:12px">Full comparison</a>
    </section></div>`;
  const btns = $('#planBtns');
  if (plan === 'none') {
    btns.appendChild(mkBtn('Start 14-day free trial', async (b) => { b.disabled = true; b.textContent = 'Starting…'; try { await startTrial(); location.reload(); } catch (e) { showAlert(e.message); } }));
  } else if (plan === 'trial') {
    if (np) btns.appendChild(mkBtn(`Upgrade to ${PLAN_LABEL[np]}`, () => startCheckout(np).catch(e => showAlert(e.message))));
    btns.appendChild(mkBtn('Compare plans', () => location.href = '/pricing', 'ghost'));
  } else {
    btns.appendChild(mkBtn('Manage billing', () => openPortal().catch(e => showAlert(e.message)), 'ghost'));
    if (np) btns.appendChild(mkBtn(`Upgrade to ${PLAN_LABEL[np]}`, () => startCheckout(np).catch(e => showAlert(e.message))));
  }
}

function mkBtn(label, onClick, variant) {
  const b = document.createElement('button');
  b.className = 'app-btn' + (variant === 'ghost' ? ' ghost' : '') + ' sm';
  b.textContent = label; b.onclick = () => onClick(b);
  return b;
}

boot();
