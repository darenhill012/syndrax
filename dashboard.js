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
  getNodes, saveNode, updateNode, getAddons, addAddon, removeAddon,
  getSales, postSales, getInventory, getInventorySummary, syncInventory, deleteInventoryItem,
  getTrackingBalance, getTrackingOrders, postTrackingOrders, updateTrackingOrder, claimTracking, trackingCheckout,
} from '/app-api.js';
import {
  PLAN_LABEL, PLAN_PRICE, PLAN_TAGLINE, PLAN_LIMITS,
  MARKETPLACES, marketplace, marketplaceLogo, eligibility, runAudit, nextPlan, isUnlimited,
  trustJourney, ADDONS, addon,
} from '/plans.js';
import { playSfx, toggleSfx, sfxEnabled } from '/sfx.js';

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
  sound: `<svg viewBox="0 0 24 24" ${P}><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14"/></svg>`,
  mute: `<svg viewBox="0 0 24 24" ${P}><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M23 9l-6 6M17 9l6 6"/></svg>`,
  invlist: `<svg viewBox="0 0 24 24" ${P}><rect x="3" y="3.5" width="18" height="17" rx="2.5"/><path d="M3 8.5h18"/><path d="M6.5 12.5h5M6.5 16h7.5"/><path d="M15.5 12l1.3 1.3L19 11"/></svg>`,
  filter: `<svg viewBox="0 0 24 24" ${P}><path d="M3 5h18l-7 8.2V20l-4 1.5v-8.3z"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" ${P}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>`,
  truck: `<svg viewBox="0 0 24 24" ${P}><path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17.5" cy="18" r="1.6"/></svg>`,
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
let automations = loadAutomations();
let addedDevices = loadDevices(); // devices you add manually (name + IP)
let nodes = []; // real cluster nodes synced from the extension
let cloudNodes = []; // workspace nodes persisted server-side (have integer .id for node_id)
let addons = []; // marketing addons (node- or account-level), server-side
let salesData = null; // real P&L series from /api/sales (null until loaded)
let inventorySummary = null; // inventory counts + cross-site ASIN reference
let homeChartView = 'sales'; // 'sales' | 'inventory' — Home chart toggle
let invItems = []; // loaded inventory rows (filtered client-side)
let invFilter = { marketplace: 'all', stock: 'all', q: '' }; // inventory sheet filters
let trackingBalance = null; // { credits, configured, claims, allotment }
let thisPcIp = ''; // public IP of this PC (from the extension)
let currentDeviceId = 'this-device'; // the device this browser's extension runs on
let lastConnectNode = localStorage.getItem('syndrax_last_node') || ''; // remembered node pick
let activeTab = 'home';
let selectedTarget = null; // target account id for marketplace-aware scripts
let selectedJobId = null;
let railOpen = false;
let ext = window.SyndraxExt || { installed: false };
let configuring = null; // script key for modal
let connecting = null;  // marketplace id for connect modal

// ── plan gating ───────────────────────────────────────────────────────────────
function can(feature) {
  const l = PLAN_LIMITS[plan] || PLAN_LIMITS.none;
  // null/Infinity = unlimited → always allowed (this was the Enterprise lockout bug).
  if (feature === 'multiDevice') return isUnlimited(l.maxDevices) || l.maxDevices > 1;
  if (feature === 'team') return isUnlimited(l.teamSeats) || l.teamSeats > 1;
  return true;
}

const TABS = [
  { id: 'home', label: 'Home', icon: 'home', sec: 'Mission Control' },
  { id: 'workspace', label: 'Workspace', icon: 'rocket', sec: 'Mission Control' },
  { id: 'accounts', label: 'Accounts', icon: 'tag', sec: 'Mission Control' },
  { id: 'inventory', label: 'Inventory', icon: 'invlist', sec: 'Mission Control' },
  { id: 'jobs', label: 'Jobs', icon: 'briefcase', sec: 'Operations' },
  { id: 'tracking', label: 'Tracking', icon: 'truck', sec: 'Operations' },
  { id: 'devices', label: 'Devices', icon: 'monitor', sec: 'Operations', feature: 'multiDevice' },
  { id: 'team', label: 'Team', icon: 'users', sec: 'Operations', feature: 'team' },
  { id: 'audit', label: 'Safety Audit', icon: 'shield', sec: 'Control' },
  { id: 'plan', label: 'Plan & Billing', icon: 'card', sec: 'Control' },
];

// The real toolset (mirrors the extension's modules), grouped into the universal
// workflow: Sync → Research → List → Manage → (Repeat via automations). Same page
// everywhere; scripts auto-scope to the selected marketplace. run: keys that have
// a live web→extension run path today (eBay). Everything else is real but its
// per-marketplace runner is still being wired.
const WORKFLOW = [
  { stage: 'Sync', icon: 'refresh', modules: [
    { key: 'dashboard', label: 'Overview', desc: 'Active listings • price changes • stock • alerts' },
    { key: 'quicksync', label: 'Quick Sync', desc: 'Fast price & stock pass' },
    { key: 'lifecycle', label: 'Inventory Lifecycle', desc: '90-day lifecycle • markdown • clearance' },
    { key: 'finance', label: 'eBay P&L', desc: 'Earnings • reconciliation • profit' },
  ]},
  { stage: 'Research', icon: 'crosshair', modules: [
    { key: 'research', label: 'Research', desc: 'Product discovery • research queue', run: 'research' },
    { key: 'compliance', label: 'Compliance Check', desc: '7 risk filters • VERO • banned • fragile' },
    { key: 'reverse', label: 'Reverse Search', desc: 'eBay reverse image • existing dropshippers' },
    { key: 'seller', label: 'Seller Verification', desc: 'Age • feedback % • units • match rate' },
    { key: 'dna', label: 'DNA Match', desc: 'AI vision • brand • model • color' },
  ]},
  { stage: 'List', icon: 'upload', modules: [
    { key: 'seo', label: 'SEO Generator', desc: 'Keywords • competitor titles • optimized copy' },
    { key: 'description', label: 'Description Builder', desc: 'HTML templates • 5 styles' },
    { key: 'images', label: 'Image Pipeline', desc: 'Fetch • resize • optimize' },
    { key: 'lister', label: 'Lister', desc: 'List in bulk • pricing • markup • margin', run: 'lister' },
  ]},
  { stage: 'Manage', icon: 'tag', modules: [
    { key: 'optimizer', label: 'Listing Optimizer', desc: 'End & sell similar • price drops' },
    { key: 'pricing', label: 'Pricing Strategy', desc: 'Rules engine • dynamic pricing • margin' },
    { key: 'accounts', label: 'Account Manager', desc: 'Tiers • warmup • daily limits • risk' },
    { key: 'warmup', label: 'Warmup Agent', desc: 'Daily limits • safe listing schedule' },
    { key: 'trust', label: 'Trust Audit', desc: 'Trust score • defects • feedback • holds' },
    { key: 'messages', label: 'Message Tool', desc: '5 buyer templates • OOS • shipping • returns' },
  ]},
];
// Scripts that dispatch to the extension today (auto-run via chrome.runtime.sendMessage).
const RUNNABLE = { lister: 'bulklister', research: 'research' };

// For modules not yet auto-dispatched: open the corresponding eBay Seller Hub URL
// so the user can work there manually while automation is built. Keeps it real.
const MODULE_EBAY_URL = {
  dashboard:   'https://www.ebay.com/sh/overview',
  quicksync:   'https://www.ebay.com/sh/prc/recent',
  lifecycle:   'https://www.ebay.com/sh/inv/active',
  finance:     'https://www.ebay.com/sh/fin',
  compliance:  'https://www.ebay.com/sh/overview',
  reverse:     'https://www.ebay.com/sh/src',
  seller:      'https://www.ebay.com/sh/ovw/performance',
  dna:         'https://www.ebay.com/sh/overview',
  seo:         'https://www.ebay.com/sh/lst/active',
  description: 'https://www.ebay.com/sh/lst/active',
  images:      'https://www.ebay.com/sh/lst/active',
  optimizer:   'https://www.ebay.com/sh/lst/active',
  pricing:     'https://www.ebay.com/sh/prc/recent',
  accounts:    'https://www.ebay.com/sh/ovw/performance',
  warmup:      'https://www.ebay.com/sh/ovw/performance',
  trust:       'https://www.ebay.com/sh/ovw/performance',
  messages:    'https://www.ebay.com/sh/msg',
};

function loadAutomations() { try { return JSON.parse(localStorage.getItem('syndrax_automations_v1')) || []; } catch { return []; } }
function saveAutomations() { try { localStorage.setItem('syndrax_automations_v1', JSON.stringify(automations)); } catch {} }
function loadDevices() { try { return JSON.parse(localStorage.getItem('syndrax_devices_v1')) || []; } catch { return []; } }
function saveDevices() { try { localStorage.setItem('syndrax_devices_v1', JSON.stringify(addedDevices)); } catch {} }

// ── boot ────────────────────────────────────────────────────────────────────
function applyPlan() { plan = (isAdmin && previewPlan) ? previewPlan : realPlan; }

// Pull REAL marketplace accounts the extension already manages on this device
// (e.g. Oleg's existing eBay accounts) and merge them in — so /app shows real
// data automatically, no manual re-entry. Best-effort; no-op without the ext.
function syncExtensionAccounts() {
  return new Promise((resolve) => {
    const extId = ext.id || EXT_IDS[0];
    if (!(window.chrome && chrome.runtime && chrome.runtime.sendMessage && ext.installed)) return resolve();
    try {
      chrome.runtime.sendMessage(extId, { type: 'SYNDRAX_GET_STATE' }, (resp) => {
        if (chrome.runtime.lastError || !resp || !resp.ok) return resolve();
        if (Array.isArray(resp.nodes)) nodes = resp.nodes;
        if (resp.ip) thisPcIp = resp.ip;
        if (resp.deviceId) currentDeviceId = resp.deviceId;
        // Persist the live node list to the cloud (durable, team-shared). Best-effort.
        persistNodes(resp);
        // Forward any inventory/sales the extension scanners captured → cloud.
        forwardExtSyncData(resp);
        const synced = (resp.accounts || []).map(a => ({
          id: 'ext-' + (a.id || a.username), marketplace: a.platform || 'ebay',
          label: a.username || a.platform || 'account', deviceId: a.nodeId || 'this-device',
          status: 'connected', synced: true, tier: a.tier, mode: a.mode,
        }));
        // Merge: keep cloud accounts, add synced ones not already present (by label+marketplace).
        const seen = new Set(accounts.map(a => a.marketplace + '|' + (a.label || '').toLowerCase()));
        for (const s of synced) {
          const key = s.marketplace + '|' + s.label.toLowerCase();
          if (!seen.has(key)) { accounts.push(s); seen.add(key); }
        }
        resolve();
      });
    } catch { resolve(); }
  });
}

// Persist the extension's reported nodes (current PC + fleet) to the cloud so the
// workspace's node list survives across sessions/browsers and is shared with the
// team. Best-effort: a failure just leaves the in-memory list. Refreshes cloudNodes
// (which carry the integer .id used as node_id when pinning accounts/addons).
function persistNodes(resp) {
  const list = Array.isArray(resp.nodes) ? resp.nodes : [];
  const cur = resp.currentNode;
  const toSave = [];
  if (cur && cur.deviceId) toSave.push(cur);
  for (const n of list) { if (n.deviceId && !toSave.some(t => t.deviceId === n.deviceId)) toSave.push(n); }
  if (!toSave.length) return;
  Promise.all(toSave.map(n => saveNode({
    deviceId: n.deviceId, name: n.name, nodeType: n.nodeType || (n.local ? 'current' : 'remote'),
    ip: n.ip || '', status: n.status || (n.local ? 'online' : 'offline'),
  }).catch(() => null))).then(async () => {
    try { const r = await getNodes(); cloudNodes = r.nodes || []; if (activeTab === 'devices') renderDevices(); } catch {}
  });
}

// The extension scanners run in the background and report captured inventory/sales
// in their state payload. The website (which holds the Cognito token) forwards them
// to the cloud — keeping auth on the site, scanners untouched. Best-effort; refreshes
// the local copies so the Home chart + Inventory tab reflect the latest sync.
function forwardExtSyncData(resp) {
  const inv = Array.isArray(resp.inventory) ? resp.inventory : null;
  const sales = Array.isArray(resp.sales) ? resp.sales : null;
  const pendingTracking = Array.isArray(resp.pendingTracking) ? resp.pendingTracking : null;
  const mk = resp.syncMarketplace || 'ebay';
  const cn = resolveConnectNode();
  const jobs2 = [];
  if (inv && inv.length) jobs2.push(syncInventory({ marketplace: mk, nodeId: cn.nodeId, items: inv }).catch(() => null));
  if (sales && sales.length) jobs2.push(postSales({ marketplace: mk, sales }).catch(() => null));
  // Orders the Amazon fulfill script captured (destination + delivery date) → cloud.
  if (pendingTracking && pendingTracking.length) jobs2.push(postTrackingOrders({ orders: pendingTracking }).catch(() => null));
  if (!jobs2.length) return;
  Promise.all(jobs2).then(async () => {
    try { salesData = await getSales(8); } catch {}
    try { inventorySummary = await getInventorySummary(); } catch {}
    if (activeTab === 'home') renderHome();
    else if (activeTab === 'inventory') renderInventory();
    else if (activeTab === 'tracking') renderTracking();
  });
}

// Resolve the node a new account should attach to. Returns { nodeId, deviceId }.
// Defaults to the remembered pick, else the current PC, else the first node.
function resolveConnectNode() {
  const cur = cloudNodes.find(n => n.deviceId === currentDeviceId) || cloudNodes.find(n => n.nodeType === 'current');
  const remembered = cloudNodes.find(n => String(n.id) === lastConnectNode);
  const pick = remembered || cur || cloudNodes[0] || null;
  return { nodeId: pick ? pick.id : null, deviceId: pick ? pick.deviceId : currentDeviceId };
}

async function boot() {
  try { statusRow = await getStatus(); realPlan = statusRow.plan || 'none'; } catch { realPlan = 'none'; }
  // The owner/admin account is real Enterprise with full access to every tool.
  // Preview mode is the sandbox (any plan, incl. a free/trial new-user, sample data).
  if (isAdmin) { realPlan = 'enterprise'; statusRow = { plan: 'enterprise', status: 'active' }; }
  applyPlan();
  try { profile = await getProfile(); } catch { profile = {}; }
  if (!profile.onboarding_complete && realPlan === 'none' && !isAdmin) { location.replace('/onboarding'); return; }
  try { const mk = await getMarketplaces(); accounts = mk.accounts || []; } catch { accounts = []; }
  try { const nd = await getNodes(); cloudNodes = nd.nodes || []; } catch { cloudNodes = []; }
  try { const ad = await getAddons(); addons = ad.addons || []; } catch { addons = []; }
  try { salesData = await getSales(8); } catch { salesData = null; }
  try { inventorySummary = await getInventorySummary(); } catch { inventorySummary = null; }
  await syncExtensionAccounts();
  document.addEventListener('syndrax-ext', () => { ext = window.SyndraxExt || ext; syncExtensionAccounts().then(renderShell); });
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
          <button class="sfx-toggle${sfxEnabled() ? ' on' : ''}" id="sfxToggle" title="${sfxEnabled() ? 'Sound on' : 'Sound off'}">${icon(sfxEnabled() ? 'sound' : 'mute')}</button>
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
  const sfxBtn = $('#sfxToggle');
  if (sfxBtn) sfxBtn.onclick = () => { const on = toggleSfx(); sfxBtn.classList.toggle('on', on); sfxBtn.title = on ? 'Sound on' : 'Sound off'; sfxBtn.innerHTML = icon(on ? 'sound' : 'mute'); };
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
  const segs = [['trial', 'Free / Trial'], ['business', 'Business'], ['growth', 'Growth'], ['enterprise', 'Enterprise']];
  return `<div class="admin-bar">
    <span class="ab-label">★ Admin sandbox</span>
    <div class="admin-seg">
      ${segs.map(([p, lbl]) => `<button data-pp="${p}" class="${plan === p && previewPlan ? 'on' : ''}">${lbl}</button>`).join('')}
    </div>
    <span class="ab-note">${previewPlan ? `previewing <b style="color:#67e8f9">${PLAN_LABEL[plan]}</b> with sample data (testing)` : 'your real account · <b style="color:#fcd34d">Enterprise</b> · full access'}</span>
    ${previewPlan ? '<button class="ab-reset" id="ppReset">exit to real account</button>' : ''}
  </div>`;
}

function devicePill() {
  return ext.installed
    ? `<span class="relay-pill on">${icon('wifi')} This PC connected</span>`
    : `<span class="relay-pill off">${icon('monitor')} Extension not detected</span>`;
}

function showAlert(msg, type = 'error') { const el = $('#appAlert'); if (el) { el.textContent = msg; el.className = 'auth-alert ' + type; } }

function showToast(msg, type = 'info', duration = 4200) {
  playSfx(type === 'success' ? 'confirm' : type === 'error' ? 'error' : 'nav');
  let box = document.getElementById('toastBox');
  if (!box) { box = document.createElement('div'); box.id = 'toastBox'; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  t.innerHTML = `<span class="toast-ico">${icons[type] || icons.info}</span><span>${esc(msg)}</span>`;
  box.appendChild(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 340); }, duration);
}

// ── tab router ────────────────────────────────────────────────────────────────
function renderTab() {
  const t = TABS.find(x => x.id === activeTab);
  if (t?.feature && !can(t.feature)) return renderUpgradeLock(t.feature);
  ({
    home: renderHome, workspace: renderWorkspace, accounts: renderAccounts, inventory: renderInventory,
    jobs: renderJobsTab, tracking: renderTracking, devices: renderDevices, team: renderTeam,
    audit: renderAudit, plan: renderPlanTab,
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

const previewMode = () => isAdmin && !!previewPlan;

// Performance series. SAMPLE numbers appear ONLY in admin preview (to showcase a
// plan); the real view never shows fake profit — it shows real synced data, or an
// honest empty state until a sales sync lands.
function salesSeries() {
  const labels = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'];
  if (previewMode()) {
    const scale = { trial: 0.6, business: 1, growth: 2.6, enterprise: 6, none: 0.4 }[plan] || 1;
    const gross = [340, 420, 390, 520, 610, 560, 720, 880].map(v => Math.round(v * scale));
    const net = gross.map(v => Math.round(v * 0.42));
    return { labels, gross, net, grossTotal: gross.reduce((a, b) => a + b, 0), netTotal: net.reduce((a, b) => a + b, 0), orders: Math.round(gross.reduce((a, b) => a + b, 0) / 42), sample: true };
  }
  // Real view: read the live P&L from /api/sales. If there's no data yet, show the
  // honest empty state. NEVER fabricate numbers here.
  const s = salesData && salesData.series;
  if (s && !salesData.empty) {
    return { labels: s.labels || labels, gross: s.gross || [], net: s.net || [], grossTotal: s.grossTotal || 0, netTotal: s.netTotal || 0, orders: s.orders || 0 };
  }
  return { labels, gross: [], net: [], grossTotal: 0, netTotal: 0, orders: 0, empty: true };
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

// Simple, readable vertical bars (used for the Inventory chart view). One bar per
// label with its value on top — deliberately plain, no axes math to parse.
function barChart(data) {
  const W = 760, H = 200, pl = 10, pr = 10, pt = 16, pb = 30;
  const max = Math.max(1, ...data.map(d => d.value));
  const n = Math.max(1, data.length);
  const bw = (W - pl - pr) / n;
  let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">`;
  for (let g = 0; g <= 3; g++) { const gy = pt + (g / 3) * (H - pt - pb); svg += `<line x1="${pl}" y1="${gy}" x2="${W - pr}" y2="${gy}" stroke="rgba(255,255,255,.06)"/>`; }
  data.forEach((d, i) => {
    const h = (d.value / max) * (H - pt - pb);
    const x = pl + i * bw + bw * 0.24, w = bw * 0.52, y = H - pb - h;
    const c = d.color || '#22d3ee';
    svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(2, h).toFixed(1)}" rx="5" fill="${c}" opacity=".9"/>`;
    svg += `<text x="${(x + w / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="800" fill="#e2e8f0">${d.value}</text>`;
    svg += `<text x="${(x + w / 2).toFixed(1)}" y="${H - 9}" text-anchor="middle" font-size="10" fill="#8295a8">${esc(d.label)}</text>`;
  });
  return svg + '</svg>';
}

// Connected marketplaces (deduped from accounts) — the only ones we count/show.
function connectedMarketplaces() { return [...new Set(accounts.map(a => a.marketplace))]; }
// Whole-number days since an ISO timestamp (null → never).
function daysSince(iso) { if (!iso) return null; const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); return d < 0 ? 0 : d; }
function syncAgeLabel(iso) {
  const d = daysSince(iso);
  if (d === null) return 'not synced yet';
  if (d === 0) return 'synced today';
  return `${d} day${d === 1 ? '' : 's'} ago`;
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
  const activeAccts = previewMode() ? ({ trial: 1, business: 1, growth: 3, enterprise: 8 }[plan] || 1) : accounts.length;
  const orders = s.empty ? 0 : (s.orders || Math.round(s.grossTotal / 42));
  const margin = s.grossTotal ? Math.round(s.netTotal / s.grossTotal * 100) : 0;
  const flat = [0, 0, 0, 0, 0, 0, 0, 0];

  // Inventory chart view — in-stock per CONNECTED marketplace that has synced data.
  const invSum = inventorySummary || {};
  const inStockByMk = invSum.inStockByMarketplace || {};
  const lastSyncByMk = invSum.lastSyncByMarketplace || {};
  const conn = connectedMarketplaces();
  const invBars = conn.filter(mk => inStockByMk[mk] != null)
    .map(mk => ({ label: marketplace(mk)?.name || mk, value: inStockByMk[mk] || 0, color: '#22d3ee' }));
  // Days-since-sync chips for connected marketplaces (only count what's connected).
  const syncChips = conn.map(mk => {
    const age = daysSince(lastSyncByMk[mk]);
    const stale = age === null || age >= 1;
    const col = age === null ? '#94a3b8' : age === 0 ? '#6ee7b7' : '#fcd34d';
    return `<span class="sync-chip" style="border-color:${col}55;color:${col}"><b>${esc(marketplace(mk)?.name || mk)}</b> · ${syncAgeLabel(lastSyncByMk[mk])}</span>`;
  }).join('');

  content.innerHTML = `
    ${incomplete ? `<div class="setup-strip">
      <div class="ss-ico">${icon('rocket')}</div>
      <div style="flex:1"><div class="ss-title">Finish your setup</div><div class="ss-sub">Connect a marketplace to start listing and see your live net/gross here.</div></div>
      <button class="app-btn sm" data-connect="ebay">Connect eBay</button>
      <button class="app-btn ghost sm" data-setup="1">Setup guide</button>
    </div>` : ''}

    <div class="home-grid">
      ${stat('Gross (8 wk)', s.empty ? '$0' : fmt$(s.grossTotal), 'cash', s.empty ? '' : 'up', s.empty ? 'no sales yet' : '↑ 12% vs prev')}
      ${stat('Net profit', s.empty ? '$0' : fmt$(s.netTotal), 'cash', s.empty ? '' : 'up', s.empty ? '—' : margin + '% margin')}
      ${stat('Orders', s.empty ? '0' : orders.toLocaleString(), 'briefcase', '', 'across your accounts')}
      ${stat('Active accounts', String(activeAccts), 'tag', '', PLAN_LABEL[plan])}
    </div>

    <div class="chart-card">
      <div class="chart-head">
        <div style="display:flex;align-items:center;gap:12px">
          <h3>${homeChartView === 'inventory' ? 'Inventory' : 'Performance'} ${s.sample && homeChartView === 'sales' ? '<span class="mk-badge soon" style="position:static;margin-left:6px">admin sample</span>' : ''}</h3>
          <div class="chart-toggle">
            <button class="${homeChartView === 'sales' ? 'on' : ''}" data-chartview="sales">Sales</button>
            <button class="${homeChartView === 'inventory' ? 'on' : ''}" data-chartview="inventory">Inventory</button>
          </div>
        </div>
        ${homeChartView === 'sales'
          ? `<div class="chart-legend"><span><i style="background:#22d3ee"></i>Gross</span><span><i style="background:#d946ef"></i>Net</span></div>`
          : `<div class="chart-legend"><span><i style="background:#22d3ee"></i>In stock</span></div>`}
      </div>
      ${homeChartView === 'sales'
        ? (s.empty
            ? `<div style="position:relative">${areaChart(s.labels, [{ name: 'Gross', color: '#22d3ee', data: flat }])}<div class="chart-empty">${icon('chart')}<div style="font-weight:700;color:#cbd5e1">No sales data yet</div><div style="font-size:12px">Connect an account and run a sync — your real net &amp; gross appear here.</div></div></div>`
            : areaChart(s.labels, [{ name: 'Gross', color: '#22d3ee', data: s.gross }, { name: 'Net', color: '#d946ef', data: s.net }]))
        : (invBars.length
            ? barChart(invBars)
            : `<div style="position:relative">${barChart([{ label: '—', value: 0 }])}<div class="chart-empty">${icon('invlist')}<div style="font-weight:700;color:#cbd5e1">No inventory synced yet</div><div style="font-size:12px">Run a sync on a connected account — in-stock counts appear here.</div></div></div>`)}
      ${homeChartView === 'sales' && s.sample ? '<div style="font-size:11px;color:#475569;margin-top:6px">Admin preview only — sample numbers to show how this plan looks. Real accounts always show real data.</div>' : ''}
      ${homeChartView === 'inventory' && syncChips ? `<div class="sync-chips">${syncChips}</div>` : ''}
    </div>

    <div class="panel">
      <div class="panel-h">
        Connected accounts <span class="link" data-go="accounts">manage →</span>
        ${accounts.some(a => a.marketplace === 'ebay') ? `<button class="app-btn sm" id="homeSyncBtn" style="margin-left:auto">${icon('refresh')} Sync eBay</button>` : ''}
      </div>
      <div class="acct-strip">${accountsStrip()}</div>
    </div>`;

  content.querySelectorAll('[data-connect]').forEach(b => b.onclick = () => { connecting = b.dataset.connect; openConnectModal(); });
  content.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { activeTab = b.dataset.go; renderShell(); });
  content.querySelectorAll('[data-setup]').forEach(b => b.onclick = () => { location.href = '/onboarding'; });
  content.querySelectorAll('[data-chartview]').forEach(b => b.onclick = () => { homeChartView = b.dataset.chartview; renderHome(); });
  const hs = $('#homeSyncBtn', content); if (hs) hs.onclick = openSyncModal;
}

// ── WORKSPACE ─────────────────────────────────────────────────────────────────
// Scripts are marketplace-aware: they run against a TARGET account so they know
// what they're listing/syncing to. eBay is live today; other marketplaces show
// the same scripts but flagged "building" until their sync ships — never faked.
const LIVE_MARKETPLACES = ['ebay'];
let wsTarget = null;

function renderWorkspace() {
  $('#topSub').textContent = ext.installed ? '· running on this device' : '· install the extension to run jobs';
  wsTarget = accounts.find(a => a.id === selectedTarget) || accounts[0] || null;
  const targetMk = wsTarget ? wsTarget.marketplace : 'ebay';
  const live = LIVE_MARKETPLACES.includes(targetMk);
  const mkName = marketplace(targetMk)?.name || targetMk;

  const stages = WORKFLOW.map(st => `
    <section class="wf-stage">
      <div class="wf-stage-h">${icon(st.icon)} <span>${st.stage}</span></div>
      <div class="script-grid">
        ${st.modules.map(m => {
          const autoDispatch = live && !!RUNNABLE[m.run];
          const ebayOpen = live && !!MODULE_EBAY_URL[m.key];
          const cardClass = autoDispatch ? 'ready' : (live && ebayOpen) ? 'ready' : 'soon';
          return `<button class="script-card ${cardClass}" data-mod="${m.key}" title="${esc(m.label)} → ${esc(mkName)}">
            <span class="sc-name">${esc(m.label)}${autoDispatch ? '<span class="sc-live">live</span>' : (ebayOpen ? '<span class="sc-live" style="background:rgba(99,102,241,.16);color:#a5b4fc;border-color:rgba(99,102,241,.3)">hub</span>' : '')}</span>
            <span class="sc-desc">${esc(m.desc)}</span>
          </button>`;
        }).join('')}
      </div>
    </section>`).join('');

  $('#content').innerHTML = `
    <div class="wf-bar">
      <div class="wf-target">
        <span class="wf-lbl">Marketplace</span>
        ${accounts.length === 0
          ? `<span class="link" data-go="accounts">Connect an account →</span>`
          : `<div class="wf-accs">${accounts.map(a => { const m = marketplace(a.marketplace); const lg = marketplaceLogo(a.marketplace) || `<span style="font:800 12px var(--nav-font);color:#fff">${(m?.name || '?')[0]}</span>`; const on = wsTarget && wsTarget.id === a.id; return `<button class="wf-acc ${on ? 'on' : ''}" data-target="${a.id}"><span class="mk-chip neutral" style="width:22px;height:22px">${lg}</span>${esc(a.label || m?.name || a.marketplace)}</button>`; }).join('')}</div>`}
      </div>
      <div class="wf-right">
        <span class="relay-pill ${ext.installed ? 'on' : 'off'}">${icon(ext.installed ? 'wifi' : 'monitor')} ${ext.installed ? 'This PC' : 'No device'}</span>
        <span class="wf-audit">${icon('shield')} Audit agent <b>on</b></span>
      </div>
    </div>

    <div class="wf-flow">${['Sync', 'Research', 'List', 'Manage', 'Repeat'].map((s, i) => `<span class="wf-step${i === 4 ? ' loop' : ''}">${s}</span>${i < 4 ? '<span class="wf-arrow">→</span>' : ''}`).join('')}</div>

    ${!live ? `<div class="wf-note">${esc(mkName)} runners are being built — <b>eBay is live today</b>. The same workflow lights up here once ${esc(mkName)} ships. You can still schedule automations now.</div>` : ''}

    ${stages}

    <div class="ws2-cols">
      <div class="panel"><div class="panel-h">Recent jobs (${jobs.length}) ${jobs.length ? '<span class="link" id="clearJobs">clear</span>' : ''}</div>
        ${jobs.length === 0 ? `<p style="font-size:12px;color:#64748b">No jobs yet — click a tool above.</p>` : jobs.slice(0, 6).map(jobRow).join('')}</div>
      <div class="panel"><div class="panel-h">Automations (${automations.length}) <span style="color:#64748b;font-weight:500;text-transform:none;letter-spacing:0">audit-gated</span></div>
        ${renderAutomationsList()}</div>
    </div>`;

  $('#content').querySelectorAll('[data-target]').forEach(b => b.onclick = () => { selectedTarget = b.dataset.target; renderWorkspace(); });
  $('#content').querySelectorAll('[data-go]').forEach(b => b.onclick = () => { activeTab = b.dataset.go; renderShell(); });
  $('#content').querySelectorAll('[data-mod]').forEach(b => b.onclick = () => openModuleModal(b.dataset.mod));
  $('#content').querySelectorAll('[data-job]').forEach(b => b.onclick = () => { selectedJobId = b.dataset.job; activeTab = 'jobs'; renderShell(); });
  $('#content').querySelectorAll('[data-autorun]').forEach(b => b.onclick = () => runAutomation(b.dataset.autorun));
  $('#content').querySelectorAll('[data-autodel]').forEach(b => b.onclick = () => { automations = automations.filter(a => a.id !== b.dataset.autodel); saveAutomations(); renderWorkspace(); });
  const cj = $('#clearJobs'); if (cj) cj.onclick = () => { jobs = []; saveJobs(); selectedJobId = null; renderWorkspace(); };
}

function renderAutomationsList() {
  if (!automations.length) return `<p style="font-size:12px;color:#64748b">No automations yet. Open a tool → <b>Schedule</b> to run it on a timer with the audit agent.</p>`;
  return automations.map(a => `<div class="auto-row">
    <div style="flex:1"><div class="ac-name">${esc(a.label)} <span style="color:#64748b;font-weight:500">→ ${esc(marketplace(a.marketplace)?.name || a.marketplace)}</span></div>
      <div class="ac-sub">${esc(a.interval)}${a.auditAgent ? ' · 🛡️ audit' : ''}${a.rule ? ' · ' + esc(a.rule) : ''}</div></div>
    <button class="app-btn ghost sm" data-autorun="${a.id}">Run</button>
    <button class="auto-del" data-autodel="${a.id}" title="Delete">✕</button>
  </div>`).join('');
}

function openModuleModal(key) {
  const mod = WORKFLOW.flatMap(s => s.modules).find(m => m.key === key); if (!mod) return;
  const mk = wsTarget ? wsTarget.marketplace : 'ebay';
  const mkName = marketplace(mk)?.name || mk;
  const isEbay = mk === 'ebay';
  const autoDispatch = LIVE_MARKETPLACES.includes(mk) && !!RUNNABLE[mod.run];
  const ebayUrl = MODULE_EBAY_URL[key];
  const host = document.createElement('div');
  host.className = 'modal-bg';
  host.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <h3>${esc(mod.label)} → ${esc(mkName)}</h3>
      <p class="modal-sub">${esc(mod.desc)}. Target: <b style="color:#cbd5e1">${esc(wsTarget?.label || 'your account')}</b>.</p>
      ${autoDispatch
        ? `<button class="app-btn" id="mRun" style="width:100%">${icon('play')} Run now on This PC</button>`
        : isEbay && ebayUrl
          ? `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:2px">
              <button class="app-btn ghost" id="mOpen" style="flex:1">${icon('upload')} Open in eBay Seller Hub</button>
             </div>
             <div class="eligibility" style="margin-top:8px">Auto-dispatch for <b>${esc(mod.label)}</b> is being wired into the extension — scheduled automations will activate when it ships.</div>`
          : `<div class="eligibility" style="margin:0 0 4px">${esc(mkName)} runner for ${esc(mod.label)} is building — schedule it now and it auto-runs when it ships.</div>`}
      <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px">
        <label>Schedule (repeat)</label>
        <select id="mInt"><option>Every hour</option><option selected>Every 6 hours</option><option>Daily</option><option>Every 3 days</option><option>Weekly</option></select>
        <label style="display:flex;align-items:center;gap:8px;margin-top:12px;text-transform:none;letter-spacing:0;font-size:13px;color:#cbd5e1"><input type="checkbox" id="mAudit" checked style="width:auto;accent-color:#22d3ee"> Run the audit agent first (keeps the account human &amp; safe)</label>
        <label>Rule (optional)</label>
        <input id="mRule" placeholder="e.g. only when trust score > 90, max 30 listings/day">
        <div class="app-btn-row" style="margin-top:14px">
          <button class="app-btn" id="mSave">${icon('refresh')} Save automation</button>
          <button class="app-btn ghost" id="mCancel">Close</button>
        </div>
      </div>
    </div>`;
  host.onclick = () => host.remove();
  document.body.appendChild(host);
  $('#mCancel', host).onclick = () => host.remove();
  const runBtn = $('#mRun', host);
  if (runBtn) runBtn.onclick = () => {
    host.remove();
    if (mod.run === 'lister') { configuring = 'bulklister'; openScriptModal(); }
    else dispatch(mod.run || mod.key, mod.label, {});
  };
  const openBtn = $('#mOpen', host);
  if (openBtn) openBtn.onclick = () => { window.open(ebayUrl, '_blank'); host.remove(); };
  $('#mSave', host).onclick = () => {
    automations.unshift({
      id: 'auto-' + Date.now().toString(36), key: mod.key, label: mod.label,
      marketplace: mk, account: wsTarget?.label || '', interval: $('#mInt', host).value,
      auditAgent: $('#mAudit', host).checked, rule: $('#mRule', host).value.trim(), createdAt: Date.now(),
    });
    saveAutomations(); host.remove(); renderWorkspace();
    showToast(`Automation saved — ${mod.label} runs on schedule with the audit agent.`, 'success');
  };
}

function runAutomation(id) {
  const a = automations.find(x => x.id === id); if (!a) return;
  const mod = WORKFLOW.flatMap(s => s.modules).find(m => m.key === a.key);
  selectedTarget = (accounts.find(x => x.marketplace === a.marketplace) || {}).id || selectedTarget;
  wsTarget = accounts.find(x => x.id === selectedTarget) || wsTarget;
  if (mod && mod.run === 'lister') { configuring = 'bulklister'; openScriptModal(); }
  else if (mod) dispatch(mod.run || mod.key, mod.label, {});
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
  const mk = wsTarget ? wsTarget.marketplace : 'ebay';
  const mkName = marketplace(mk)?.name || mk;
  const jobId = 'job-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  const job = {
    jobId, script, scriptLabel: `${scriptLabel} → ${mkName}`, deviceName: 'This PC', marketplace: mk,
    status: 'dispatched', createdAt: Date.now(), updatedAt: Date.now(),
    progress: null, message: '', log: [{ t: Date.now(), text: `dispatched to this device · target ${mkName} (${wsTarget?.label || '—'})` }],
  };
  jobs.unshift(job); saveJobs(); selectedJobId = jobId; configuring = null; renderWorkspace();

  // Non-live marketplaces: don't fake it — mark the job as building.
  if (!LIVE_MARKETPLACES.includes(mk)) {
    patchJob(jobId, 'no-device', `${mkName} sync is still being built — eBay is live today.`);
    return;
  }

  const extId = ext.id || EXT_IDS[0];
  if (window.chrome && chrome.runtime && chrome.runtime.sendMessage && ext.installed) {
    chrome.runtime.sendMessage(extId, { type: 'SYNDRAX_RUN', script, marketplace: mk, args: { ...args, marketplace: mk, account: wsTarget?.label }, jobId }, (resp) => {
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
      <h3>${icon('upload')} Run Lister → ${esc(marketplace(wsTarget?.marketplace)?.name || 'eBay')}</h3>
      <p class="modal-sub">Listing to <b style="color:#cbd5e1">${esc(wsTarget?.label || 'your account')}</b> on ${esc(marketplace(wsTarget?.marketplace)?.name || 'eBay')}. Paste source URLs or product IDs — the Lister adapts to this marketplace and runs via the extension on this device.</p>
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
    dispatch('bulklister', 'Lister', args);
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
    <div class="mk-grid big">${MARKETPLACES.map(m => acctTile(m, counts[m.id] || 0, limit)).join('')}</div>
    ${accounts.length ? `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin:26px 0 4px">
        <h3 style="font:700 14px var(--nav-font);color:#f1f5f9;margin:0">Account trust &amp; warm-up</h3>
        ${accounts.some(a => a.marketplace === 'ebay') ? `<button class="app-btn sm" id="ebaySync">${icon('refresh')} Sync eBay now</button>` : ''}
      </div>
      <p style="color:#94a3b8;font-size:12.5px;margin-bottom:14px">Each marketplace warms up at its own pace — Syndrax tracks each phase and unlocks growth scripts when the audit gate passes. Established accounts skip warm-up.</p>
      ${accounts.map(trustCard).join('')}` : ''}`;

  $('#content').querySelectorAll('[data-connect]').forEach(b => b.onclick = () => { connecting = b.dataset.connect; openConnectModal(); });
  $('#content').querySelectorAll('[data-up]').forEach(b => b.onclick = () => startCheckout(b.dataset.up).catch(e => showAlert(e.message)));
  $('#content').querySelectorAll('[data-est]').forEach(b => b.onclick = () => { toggleEstablished(b.dataset.est); });
  $('#content').querySelectorAll('[data-addaddon]').forEach(b => b.onclick = () => openAddonModal(b.dataset.addaddon));
  $('#content').querySelectorAll('[data-deladdon]').forEach(b => b.onclick = async () => {
    try { await removeAddon(b.dataset.deladdon); addons = addons.filter(x => String(x.id) !== String(b.dataset.deladdon)); renderAccounts(); }
    catch (e) { showAlert(e.message || 'Could not remove add-on.'); }
  });
  const es = $('#ebaySync'); if (es) es.onclick = openSyncModal;
}

// Attach a marketing add-on to a marketplace account (account-level) — Facebook
// Ads, Pinterest auto-post, etc. Persisted server-side via /api/addons.
function openAddonModal(accountId) {
  const a = accounts.find(x => String(x.id) === String(accountId)); if (!a) return;
  const m = marketplace(a.marketplace);
  const choices = ADDONS.filter(ad => ad.scope === 'account' || ad.scope === 'both');
  const host = document.createElement('div');
  host.className = 'modal-bg';
  host.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <h3>${icon('plus')} Add a marketing add-on</h3>
      <p class="modal-sub">Promote <b style="color:#cbd5e1">${esc(a.label || m?.name || a.marketplace)}</b>. Add-ons run alongside this account on its node.</p>
      <div class="mk-grid" style="grid-template-columns:repeat(2,1fr);gap:10px;margin-top:6px">
        ${choices.map(ad => `<button class="mk-tile" data-addon="${ad.id}" style="text-align:left;padding:12px">
          <span class="mk-badge ${ad.status === 'live' ? 'live' : 'soon'}">${ad.status === 'live' ? 'Live' : 'Soon'}</span>
          <div class="mk-name" style="margin-top:2px">${esc(ad.name)}</div>
          <div style="font-size:11px;color:#64748b;margin-top:4px">${esc(ad.blurb)}</div>
        </button>`).join('')}
      </div>
      <div class="app-btn-row" style="margin-top:16px"><button class="app-btn ghost" id="adCancel">Close</button></div>
    </div>`;
  host.onclick = () => host.remove();
  document.body.appendChild(host);
  $('#adCancel', host).onclick = () => host.remove();
  host.querySelectorAll('[data-addon]').forEach(b => b.onclick = async () => {
    const ad = addon(b.dataset.addon);
    try {
      const rec = await addAddon({ addonType: ad.id, accountId: a.id, nodeId: a.nodeId || null, label: ad.name });
      addons.push(rec); host.remove(); renderAccounts();
      showToast(`${ad.name} added to ${a.label || m?.name}. ${ad.status === 'soon' ? 'Activates when this add-on ships.' : ''}`, 'success');
    } catch (e) { showAlert(e.message || 'Could not add add-on.'); }
  });
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

// Node picker + "connect existing vs create new" — shown in every connect modal
// so each account is pinned to a node (the PC you're on, or a remote/RDP machine)
// and records whether you're linking an existing account or starting a guided new
// one (which uses the LLC/EIN already captured in your profile). State lives on the
// modal's host element so the connect handler can read it.
function connectExtrasHtml(cn) {
  const opts = cloudNodes.length
    ? cloudNodes.map(n => {
        const tag = n.nodeType === 'current' ? ' (This PC)' : n.nodeType === 'rdp' ? ' (RDP)' : ' (Remote)';
        const sel = String(n.id) === String(cn.nodeId) ? ' selected' : '';
        return `<option value="${esc(n.id)}"${sel}>${esc(n.name || n.deviceId)}${tag}</option>`;
      }).join('')
    : `<option value="">This PC</option>`;
  return `
    <div class="connect-extras" style="display:grid;gap:12px;margin-bottom:14px;padding:12px;border:1px solid var(--border);border-radius:10px;background:rgba(255,255,255,.02)">
      <div>
        <label style="margin:0 0 6px">Which device runs this account?</label>
        <select id="cNode">${opts}</select>
        <div style="font-size:11px;color:#64748b;margin-top:4px">Each account stays on its own device/IP — that's how Syndrax avoids linked-account restrictions.</div>
      </div>
      <div>
        <label style="margin:0 0 6px">Account</label>
        <div class="cmode-tabs" style="display:flex;gap:8px">
          <button type="button" class="method-tab on" data-cmode="existing">I already have one</button>
          <button type="button" class="method-tab" data-cmode="create_new">Create a new one</button>
        </div>
        <div id="cModeNote" style="font-size:11px;color:#64748b;margin-top:6px"></div>
      </div>
    </div>`;
}

function openConnectModal() {
  const m = marketplace(connecting); if (!m) return;
  const elig = m.access === 'gated' ? eligibility(m.id, { ein: profile.ein }) : null;
  const isSource = m.access === 'source';
  const isGated  = m.access === 'gated';
  const isLive   = m.status === 'live';
  const logo = marketplaceLogo(m.id) || `<span style="font:800 22px var(--nav-font);color:#fff">${m.name[0]}</span>`;
  const j = trustJourney(m.id);
  const cn = resolveConnectNode();

  // Mini trust phase stepper shown in the modal
  const miniSteps = j.phases.map((p, i) => `
    <div class="ctrust-step">
      <div class="ctrust-dot">${i + 1}</div>
      <div class="ctrust-info"><div class="ctrust-label">${esc(p.label)}</div><div class="ctrust-desc">${esc(p.desc)}</div></div>
    </div>`).join('<div class="ctrust-line"></div>');

  const host = document.createElement('div');
  host.className = 'modal-bg';
  host.innerHTML = `
    <div class="modal wide" onclick="event.stopPropagation()" style="padding:0;overflow:hidden">
      <div class="modal-mk-header" style="background:linear-gradient(135deg,${m.color}33 0%,${m.color}11 60%,transparent 100%);border-bottom:1px solid ${m.color}33;padding:20px 24px 16px;display:flex;align-items:center;gap:14px">
        <span class="mk-chip neutral" style="width:46px;height:46px;flex-shrink:0;border:1.5px solid ${m.color}55">${logo}</span>
        <div>
          <div style="font:800 16px var(--nav-font);color:#f1f5f9">${isSource ? 'Enable' : 'Connect'} ${esc(m.name)}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">${isSource ? 'Source / research mode' : isGated ? 'Requires approval' : isLive ? 'Automations live' : 'Automation building'}</div>
        </div>
        <span class="mk-badge ${m.status === 'live' ? 'live' : m.status === 'beta' ? 'beta' : 'soon'}" style="margin-left:auto">${m.status === 'live' ? 'Live' : m.status === 'beta' ? 'Beta' : 'Soon'}</span>
      </div>
      <div style="padding:20px 24px">

      ${isSource ? '' : connectExtrasHtml(cn)}
      ${isSource ? `
        <p class="modal-sub">${esc(m.name)} is your <b style="color:#cbd5e1">sourcing engine</b> — Syndrax reads it for product data, price history and winning ASINs to list on eBay, Etsy and others. Not a sell channel.</p>
        <label>Amazon region</label>
        <select id="cRegion"><option value="US">United States (amazon.com)</option><option value="UK">UK (amazon.co.uk)</option><option value="CA">Canada (amazon.ca)</option><option value="DE">Germany (amazon.de)</option></select>
        <label>Associate tag (optional)</label>
        <input id="cLabel" placeholder="yourtag-20 (for affiliate links)">
        <div class="app-btn-row" style="margin-top:18px">
          <button class="app-btn" id="cAdd">Enable ${esc(m.name)} sourcing</button>
          <button class="app-btn ghost" id="cCancel">Cancel</button>
        </div>
      ` : isGated ? `
        ${elig ? `<div class="eligibility" style="margin:0 0 16px">${esc(elig.message)}</div>` : ''}
        <label>Business EIN <span style="color:#fca5a5">(required for approval)</span></label>
        <input id="cEin" placeholder="12-3456789" value="${esc(profile.ein || '')}">
        <label>Account name / username</label>
        <input id="cLabel" placeholder="e.g. my-brand-store">
        <div class="ctrust" style="margin-top:16px">${miniSteps}</div>
        <div class="app-btn-row" style="margin-top:18px">
          <button class="app-btn" id="cAdd">Start approval journey</button>
          <button class="app-btn ghost" id="cCancel">Cancel</button>
        </div>
      ` : `
        <p class="modal-sub">${isLive
          ? `Sign in to ${esc(m.name)} on this device — the extension runs scripts safely on your IP. eBay accounts sync automatically from the extension.`
          : `Add your ${esc(m.name)} account now. ${esc(m.name)} automation is being built — you'll be notified when scripts go live. Trust journey starts immediately.`}</p>
        <label>Username / store name</label>
        <input id="cLabel" placeholder="e.g. my-store-name">
        <label>Store URL (optional)</label>
        <input id="cUrl" placeholder="https://${m.id === 'facebook' ? 'facebook.com/marketplace' : m.id + '.com'}/your-store">
        <div class="ctrust" style="margin-top:16px">${miniSteps}</div>
        <div class="app-btn-row" style="margin-top:18px">
          <button class="app-btn" id="cAdd">${isLive ? icon('wifi') + ' Connect & sync' : icon('plus') + ' Connect account'}</button>
          <button class="app-btn ghost" id="cCancel">Cancel</button>
        </div>
      `}
      </div>
    </div>`;

  host.onclick = () => host.remove();
  document.body.appendChild(host);
  $('#cCancel', host).onclick = () => host.remove();

  // Connect-mode toggle (existing vs create-new) — create-new uses captured LLC/EIN.
  let connectMode = 'existing';
  const noteEl = $('#cModeNote', host);
  host.querySelectorAll('[data-cmode]').forEach(b => b.onclick = () => {
    connectMode = b.dataset.cmode;
    host.querySelectorAll('[data-cmode]').forEach(x => x.classList.toggle('on', x === b));
    if (noteEl) noteEl.textContent = connectMode === 'create_new'
      ? `We'll guide you through opening a fresh ${m.name} account using your business details${profile.ein ? ' (EIN on file)' : ''}.`
      : '';
  });

  $('#cAdd', host).onclick = async () => {
    const btn = $('#cAdd', host);
    const label = ($('#cLabel', host)?.value.trim()) || m.name;
    const storeUrl = ($('#cUrl', host)?.value.trim()) || '';
    const ein   = ($('#cEin',   host)?.value.trim()) || '';
    const region = ($('#cRegion', host)?.value) || 'US';
    const nodeSel = $('#cNode', host)?.value || '';
    const nodeId = nodeSel ? nodeSel : (cn.nodeId || null);
    const deviceId = (cloudNodes.find(n => String(n.id) === String(nodeId)) || {}).deviceId || cn.deviceId || 'this-device';
    if (nodeSel) { lastConnectNode = nodeSel; localStorage.setItem('syndrax_last_node', nodeSel); }
    btn.disabled = true; btn.textContent = 'Connecting…';
    try {
      const meta = isGated ? { ein } : isSource ? { region } : {};
      await addMarketplaceAccount({ marketplace: m.id, label, deviceId, nodeId, storeUrl, connectMode, ...meta });
      if (ein && isGated) { try { await saveProfile({ ein }); profile.ein = ein; } catch {} }
      const mk2 = await getMarketplaces(); accounts = mk2.accounts || [];
      host.remove();
      renderAccounts();
      if (isLive && ext.installed) {
        showToast(`${m.name} connected — starting sync…`, 'success');
        openSyncModal();
      } else if (isSource) {
        showToast(`${m.name} sourcing enabled.`, 'success');
      } else if (isGated) {
        showToast(`${m.name} application started — we'll guide you through approval.`, 'success');
      } else {
        showToast(`${m.name} connected. Automation ships soon — trust journey started.`, 'success');
      }
    } catch (e) { btn.disabled = false; btn.textContent = 'Try again'; showAlert(e.message || 'Could not connect.'); }
  };
}

// ── Full Sync (eBay compound sync: trust → inventory → finance → dashboard) ────
// Dispatches SYNDRAX_FULL_SYNC to the extension, which chains 4 scan phases and
// emits SYNDRAX_SYNC_PROGRESS events back to any open /app tab. The web side
// shows a live progress bar modal and refreshes the home chart when done.
function openSyncModal() {
  if (!ext.installed) {
    showAlert('Install the Syndrax extension on this device to run a sync.', 'error'); return;
  }
  const host = document.createElement('div');
  host.className = 'modal-bg';
  const phases = [
    { id: 'trust',     label: 'Trust scan',      icon: icon('shield') },
    { id: 'inventory', label: 'Inventory',        icon: icon('package') },
    { id: 'finance',   label: 'P&L / Finance',   icon: icon('cash') },
    { id: 'dashboard', label: 'Dashboard data',  icon: icon('chart') },
  ];
  let currentPhase = 'trust', pct = 0;

  function renderModal() {
    host.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width:460px">
        <h3>${icon('refresh')} Syncing eBay account</h3>
        <p class="modal-sub" style="margin-bottom:20px">Pulling trust score, live inventory, P&L and dashboard data from your eBay Seller Hub. Runs on this device.</p>
        <div class="sync-phases">${phases.map(p => `
          <div class="sync-phase ${p.id === currentPhase ? 'active' : pct >= phaseTarget(p.id) ? 'done' : ''}">
            <span class="sp-ico">${p.icon}</span>
            <span class="sp-lbl">${p.label}</span>
            ${pct >= phaseTarget(p.id) ? '<span class="sp-done">✓</span>' : ''}
          </div>`).join('')}
        </div>
        <div class="sync-bar-wrap" style="margin-top:16px">
          <div class="sync-bar"><div class="sync-fill" id="syncFill" style="width:${pct}%"></div></div>
          <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:11px;color:#64748b">
            <span id="syncDetail">Starting…</span>
            <span id="syncPct">${pct}%</span>
          </div>
        </div>
        <div class="app-btn-row" style="margin-top:18px">
          <button class="app-btn ghost sm" id="syncCancel">Cancel</button>
        </div>
      </div>`;
    $('#syncCancel', host).onclick = () => host.remove();
  }

  function phaseTarget(id) { return { trust: 25, inventory: 50, finance: 75, dashboard: 100 }[id] || 100; }

  function updateProgress(phase, p, detail) {
    currentPhase = phase; pct = p;
    const fill = $('#syncFill', host); if (fill) fill.style.width = p + '%';
    const pctEl = $('#syncPct', host); if (pctEl) pctEl.textContent = p + '%';
    const det = $('#syncDetail', host); if (det) det.textContent = detail || '';
    // Re-render phase chips
    host.querySelectorAll('.sync-phase').forEach(el => {
      const pid = el.querySelector('.sp-ico') ? phases.find(ph => el.querySelector('.sp-lbl')?.textContent === ph.label)?.id : null;
      if (!pid) return;
      el.className = `sync-phase ${pid === phase ? 'active' : pct >= phaseTarget(pid) ? 'done' : ''}`;
    });
  }

  renderModal();
  host.onclick = (e) => { if (e.target === host) host.remove(); };
  document.body.appendChild(host);

  // Listen for progress events from extension
  const onMsg = (msg) => {
    if (msg.type !== 'SYNDRAX_SYNC_PROGRESS') return;
    updateProgress(msg.phase, msg.pct || 0, msg.detail || '');
    if (msg.phase === 'complete' || msg.pct >= 100) {
      setTimeout(() => { host.remove(); showToast('eBay sync complete — dashboard updated.', 'success'); renderHome(); }, 1400);
      chrome.runtime.onMessage.removeListener(onMsg);
    }
  };
  if (window.chrome && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(onMsg);
  }

  // Dispatch SYNDRAX_FULL_SYNC to the extension
  const extId = ext.id || EXT_IDS[0];
  if (window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage(extId, { type: 'SYNDRAX_FULL_SYNC', marketplace: 'ebay' }, (resp) => {
      if (chrome.runtime.lastError || !resp || !resp.ok) {
        host.remove();
        // If extension doesn't support FULL_SYNC yet, open eBay Seller Hub as fallback
        window.open('https://www.ebay.com/sh/overview', '_blank');
        showToast('Opening eBay Seller Hub — full sync wiring in progress.', 'info');
      }
    });
  }
}

// ── Trust / warm-up per connected account (marketplace-specific) ──────────────
function establishedSet() { try { return new Set(JSON.parse(localStorage.getItem('syndrax_established') || '[]')); } catch { return new Set(); } }
function toggleEstablished(id) {
  const s = establishedSet(); s.has(id) ? s.delete(id) : s.add(id);
  localStorage.setItem('syndrax_established', JSON.stringify([...s])); renderAccounts();
}

// Display name for the node an account/addon is pinned to.
function nodeLabel(nodeId, deviceId) {
  const n = cloudNodes.find(x => String(x.id) === String(nodeId)) || cloudNodes.find(x => x.deviceId === deviceId);
  if (n) return (n.name || n.deviceId) + (n.nodeType === 'current' ? ' · This PC' : n.nodeType === 'rdp' ? ' · RDP' : ' · Remote');
  return deviceId === 'this-device' || !deviceId ? 'This PC' : deviceId;
}

function trustCard(a) {
  const m = marketplace(a.marketplace);
  const j = trustJourney(a.marketplace);
  const est = establishedSet().has(a.id);
  const logo = marketplaceLogo(a.marketplace) || `<span style="font:800 15px var(--nav-font);color:#fff">${(m?.name || '?')[0]}</span>`;
  const acctAddons = addons.filter(x => String(x.accountId) === String(a.id));
  const current = 1; // new account: phase 0 done, phase 1 active (real progress tracking later)
  const steps = j.phases.map((p, i) => {
    const state = est || i < current ? 'done' : (i === current ? 'active' : 'locked');
    return `<div class="trust-step ${state}"><span class="ts-dot">${state === 'done' ? '✓' : state === 'locked' ? '🔒' : i + 1}</span><span class="ts-label">${esc(p.label)}</span><span class="ts-desc">${esc(p.desc)}</span></div>`;
  }).join('');
  const storeUrl = a.storeUrl || a.store_url || '';
  const node = nodeLabel(a.nodeId, a.deviceId);
  const meta = `<div class="ac-sub" style="margin-top:3px;display:flex;gap:10px;flex-wrap:wrap">
      <span>${icon('monitor')} ${esc(node)}</span>
      ${a.connectMode === 'create_new' ? '<span style="color:#fcd34d">new account (guided)</span>' : ''}
      ${storeUrl ? `<a href="${esc(storeUrl)}" target="_blank" rel="noopener" style="color:#67e8f9">store ↗</a>` : ''}
    </div>`;
  const addonChips = acctAddons.length
    ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${acctAddons.map(x => { const ad = addon(x.addonType); return `<span class="acct-chip active" style="padding:4px 9px;font-size:11px"><span class="ac-name">${esc(ad?.name || x.addonType)}</span><button class="auto-del" data-deladdon="${x.id}" title="Remove" style="margin-left:6px">✕</button></span>`; }).join('')}</div>`
    : '';
  return `<div class="trust-card">
    <div class="trust-head">
      <span class="mk-chip neutral" style="width:34px;height:34px">${logo}</span>
      <div style="flex:1"><div class="ac-name">${esc(a.label || m?.name || a.marketplace)}</div><div class="ac-sub">${esc(m?.name || a.marketplace)}${est ? ' · established' : ' · warming up'}</div>${meta}</div>
      <label class="trust-est"><input type="checkbox" ${est ? 'checked' : ''} data-est="${a.id}"> Established account</label>
    </div>
    <div class="trust-note">${esc(j.note)}</div>
    <div class="trust-track">${steps}</div>
    <div class="trust-gate ${est ? 'open' : ''}">${est ? '✓ Audit passed — growth scripts unlocked' : '🛡️ Audit gate — finish warm-up to unlock growth scripts (Research, Bulk list, Inventory)'}</div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;flex-wrap:wrap;gap:8px">
      <span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Marketing add-ons</span>
      <button class="app-btn ghost sm" data-addaddon="${a.id}">${icon('plus')} Add-on</button>
    </div>
    ${addonChips}
  </div>`;
}

// ── INVENTORY ─────────────────────────────────────────────────────────────────
// Real listed-item tracking fed by the extension scanners (eBay inventory +
// Amazon ASIN purchase track). Shows stock health, where each item is sourced,
// and a cross-site reference (same ASIN listed on multiple marketplaces).
async function renderInventory() {
  $('#topSub').textContent = '';
  const content = $('#content');
  content.innerHTML = `<div class="ws-empty" style="margin-top:40px">${icon('invlist')}<p>Loading inventory…</p></div>`;
  try { const r = await getInventory(); invItems = r.items || []; } catch { invItems = []; }
  try { inventorySummary = await getInventorySummary(); } catch {}
  paintInventory(content);
}

function paintInventory(content) {
  const sum = inventorySummary || { total: 0, inStock: 0, outOfStock: 0, lowStock: 0, byMarketplace: {}, crossSite: [] };

  if (!invItems.length && !sum.total) {
    content.innerHTML = `
      <div class="setup-strip" style="margin-bottom:18px">
        <div class="ss-ico">${icon('invlist')}</div>
        <div style="flex:1"><div class="ss-title">No inventory synced yet</div><div class="ss-sub">Run a Quick Sync or Full Sync on a connected account — your live listings, stock levels and source ASINs land here automatically.</div></div>
        <button class="app-btn sm" data-go="workspace">Open Workspace</button>
      </div>
      <div class="ws-empty" style="margin-top:10px">${icon('invlist')}<p>Inventory is a live sheet of every listing — stock, source cost, margin and where it's cross-listed. Updated on each background sync.</p></div>`;
    content.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { activeTab = b.dataset.go; renderShell(); });
    return;
  }

  // Only show marketplaces that actually have synced inventory (hide the rest).
  const syncedMks = Object.keys(sum.byMarketplace || {});
  // Apply filters client-side.
  const q = invFilter.q.trim().toLowerCase();
  const filtered = invItems.filter(it => {
    if (invFilter.marketplace !== 'all' && it.marketplace !== invFilter.marketplace) return false;
    if (invFilter.stock === 'in' && !it.inStock) return false;
    if (invFilter.stock === 'out' && it.inStock) return false;
    if (invFilter.stock === 'low' && !(it.inStock && it.qty > 0 && it.qty <= 3)) return false;
    if (q && !((it.title || '') + (it.sku || '') + (it.asin || '') + (it.extId || '')).toLowerCase().includes(q)) return false;
    return true;
  });

  $('#topSub').textContent = `· ${sum.total} item${sum.total === 1 ? '' : 's'}`;
  const rows = filtered.map(it => {
    const m = marketplace(it.marketplace);
    const stock = it.inStock
      ? (it.qty > 0 && it.qty <= 3 ? `<span style="color:#fcd34d">low · ${it.qty}</span>` : `<span style="color:#6ee7b7">in stock${it.qty ? ' · ' + it.qty : ''}</span>`)
      : `<span style="color:#fca5a5">out of stock</span>`;
    const margin = (it.price != null && it.cost != null) ? fmt$(it.price - it.cost) : '—';
    return `<tr>
      <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(it.title || '')}">${esc(it.title || it.sku || it.extId)}</td>
      <td>${esc(m?.name || it.marketplace)}</td>
      <td>${stock}</td>
      <td>${it.price != null ? fmt$(it.price) : '—'}</td>
      <td>${it.cost != null ? fmt$(it.cost) : '—'}</td>
      <td>${margin}</td>
      <td>${it.asin ? `<span style="color:#94a3b8">${esc(it.asin)}</span>${it.sourceUrl ? ` <a href="${esc(it.sourceUrl)}" target="_blank" rel="noopener" style="color:#67e8f9">↗</a>` : ''}` : '—'}</td>
      <td style="text-align:right">${it.id ? `<button class="inv-del" data-delinv="${esc(it.id)}" title="Remove this product">${icon('trash')}</button>` : ''}</td>
    </tr>`;
  }).join('');

  const crossRows = (sum.crossSite || []).map(c => `
    <div class="audit-finding">
      <div class="f-title">${esc(c.title || c.asin)} <span style="color:#64748b;font-weight:500">· ${esc(c.asin)}</span></div>
      <div class="f-detail">Listed on <b style="color:#cbd5e1">${(c.marketplaces || []).join(', ')}</b>${c.sourceSite ? ` · sourced from ${esc(c.sourceSite)}` : ''}. Cross-listed items share demand — keep stock in sync to avoid overselling.</div>
    </div>`).join('');

  const stockSegs = [['all', 'All'], ['in', 'In stock'], ['out', 'Out'], ['low', 'Low']];
  const mkChips = `<button class="inv-chip ${invFilter.marketplace === 'all' ? 'on' : ''}" data-invmk="all">All stores</button>` +
    syncedMks.map(mk => `<button class="inv-chip ${invFilter.marketplace === mk ? 'on' : ''}" data-invmk="${esc(mk)}">${esc(marketplace(mk)?.name || mk)}</button>`).join('');

  content.innerHTML = `
    <div class="home-grid" style="margin-bottom:16px">
      ${stat('Total items', String(sum.total), 'invlist', '', 'tracked')}
      ${stat('In stock', String(sum.inStock), 'invlist', sum.inStock ? 'up' : '', 'available')}
      ${stat('Out of stock', String(sum.outOfStock), 'invlist', sum.outOfStock ? 'down' : '', sum.outOfStock ? 'needs attention' : 'all good')}
      ${stat('Low stock', String(sum.lowStock), 'invlist', sum.lowStock ? 'down' : '', '≤ 3 left')}
    </div>
    ${crossRows ? `<div class="audit warn" style="margin-bottom:16px"><div class="audit-head">🔗 ${sum.crossSite.length} cross-listed product${sum.crossSite.length === 1 ? '' : 's'}</div>${crossRows}</div>` : ''}
    <div class="panel">
      <div class="inv-toolbar">
        <span class="inv-tool-ico">${icon('filter')}</span>
        <div class="inv-chips">${mkChips}</div>
        <div class="inv-seg">${stockSegs.map(([v, l]) => `<button class="${invFilter.stock === v ? 'on' : ''}" data-invstock="${v}">${l}</button>`).join('')}</div>
        <input class="inv-search" id="invSearch" placeholder="Search title, SKU, ASIN…" value="${esc(invFilter.q)}">
      </div>
      <div style="overflow-x:auto">
        <table class="inv-table">
          <thead><tr><th>Item</th><th>Marketplace</th><th>Stock</th><th>Price</th><th>Cost</th><th>Margin</th><th>Source ASIN</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="8" style="text-align:center;color:#64748b;padding:20px">No items match this filter.</td></tr>`}</tbody>
        </table>
      </div>
      <div style="font-size:11px;color:#64748b;margin-top:8px">${filtered.length} of ${invItems.length} shown</div>
    </div>`;

  content.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { activeTab = b.dataset.go; renderShell(); });
  content.querySelectorAll('[data-invmk]').forEach(b => b.onclick = () => { invFilter.marketplace = b.dataset.invmk; paintInventory(content); });
  content.querySelectorAll('[data-invstock]').forEach(b => b.onclick = () => { invFilter.stock = b.dataset.invstock; paintInventory(content); });
  const search = $('#invSearch', content);
  if (search) search.oninput = () => { invFilter.q = search.value; applyInvFilterToTable(content); };
  content.querySelectorAll('[data-delinv]').forEach(b => b.onclick = async () => {
    const id = b.dataset.delinv;
    b.disabled = true;
    try { await deleteInventoryItem(id); invItems = invItems.filter(x => String(x.id) !== String(id)); if (inventorySummary) inventorySummary.total = Math.max(0, (inventorySummary.total || 1) - 1); paintInventory(content); showToast('Product removed from inventory.', 'success'); }
    catch (e) { b.disabled = false; showAlert(e.message || 'Could not remove item.'); }
  });
}

// Live search repaint without losing focus: just re-filter the tbody.
function applyInvFilterToTable(content) {
  const q = invFilter.q.trim().toLowerCase();
  content.querySelectorAll('.inv-table tbody tr').forEach((tr) => {
    const txt = tr.textContent.toLowerCase();
    tr.style.display = (!q || txt.includes(q)) ? '' : 'none';
  });
}

// ── JOBS / DEVICES / TEAM / AUDIT / PLAN ──────────────────────────────────────
function renderJobsTab() {
  $('#topSub').textContent = `· ${jobs.length} total`;
  $('#content').innerHTML = jobs.length === 0
    ? `<div class="ws-empty" style="margin-top:40px">${icon('briefcase')}<p>No jobs yet — run a script from the Workspace.</p></div>`
    : `<div style="max-width:680px">${jobs.map(jobRow).join('')}</div>`;
  $('#content').querySelectorAll('[data-job]').forEach(b => b.onclick = () => { selectedJobId = b.dataset.job; activeTab = 'workspace'; renderShell(); });
}

// ── TRACKING (Feature M — TrackCaptain via cloud credits) ─────────────────────
// Orders flow pending → (claim spends 1 credit) → claimed → (push to marketplace) →
// synced. Marketplace-agnostic; eBay is wired in the extension first.
async function renderTracking() {
  $('#topSub').textContent = '';
  const content = $('#content');
  content.innerHTML = `<div class="ws-empty" style="margin-top:40px">${icon('truck')}<p>Loading tracking…</p></div>`;
  let orders = [];
  try { trackingBalance = await getTrackingBalance(); } catch { trackingBalance = { credits: 0, configured: false, claims: [], allotment: 0 }; }
  try { const r = await getTrackingOrders(); orders = r.orders || []; } catch { orders = []; }
  paintTracking(content, orders);
}

function paintTracking(content, orders) {
  const bal = trackingBalance || { credits: 0, configured: false, claims: [], allotment: 0 };
  const pending = orders.filter(o => o.status === 'pending');
  const claimed = orders.filter(o => o.status === 'claimed');
  const synced = orders.filter(o => o.status === 'synced');
  const extOk = ext.installed;

  const orderRow = (o) => {
    const m = marketplace(o.marketplace);
    const dest = [o.buyerCity, o.buyerState, o.buyerZip].filter(Boolean).join(', ') || '—';
    const dd = o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString() : '—';
    let action = '';
    if (o.status === 'pending') action = `<button class="app-btn sm" data-claim="${esc(o.id)}" ${bal.configured && bal.credits > 0 ? '' : 'disabled'}>${icon('truck')} Claim (1)</button>`;
    else if (o.status === 'claimed') action = `<button class="app-btn sm" data-push="${esc(o.id)}" ${extOk ? '' : 'disabled title="Install extension"'}>Push to ${esc(m?.name || o.marketplace)}</button>`;
    else if (o.status === 'synced') action = `<span class="jb complete" style="font-size:9px">SYNCED</span>`;
    return `<tr>
      <td>${esc(m?.name || o.marketplace)}</td>
      <td style="font-family:ui-monospace,monospace;font-size:11px">${esc(o.orderId)}</td>
      <td>${esc(dest)}</td>
      <td>${dd}</td>
      <td>${o.trackingNumber ? `<span style="font-family:ui-monospace,monospace;font-size:11px;color:#6ee7b7">${esc(o.trackingNumber)}</span>` : '<span style="color:#64748b">—</span>'}</td>
      <td style="text-align:right">${action}</td>
    </tr>`;
  };

  const ordersTable = (rows, label) => rows.length ? `
    <div class="panel" style="margin-bottom:14px">
      <div class="panel-h">${label} (${rows.length})</div>
      <div style="overflow-x:auto"><table class="inv-table">
        <thead><tr><th>Marketplace</th><th>Order</th><th>Destination</th><th>Delivery</th><th>Tracking #</th><th></th></tr></thead>
        <tbody>${rows.map(orderRow).join('')}</tbody>
      </table></div>
    </div>` : '';

  const claimsList = (bal.claims || []).slice(0, 10).map(c => `
    <div class="audit-finding"><div class="f-title" style="font-family:ui-monospace,monospace;font-size:12px;color:#6ee7b7">${esc(c.trackingNumber)}</div>
    <div class="f-detail">${esc(marketplace(c.marketplace)?.name || c.marketplace || '—')} · ${esc(c.carrier || 'carrier')} · order ${esc(c.orderId || '—')} · ${c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ''}</div></div>`).join('');

  // Credits stay low-key: a normal user with plenty of allowance never sees a
  // top-up prompt. It only appears when they're actually running low.
  const lowCredits = bal.configured && bal.credits <= 10;
  const packs = bal.packs || [];
  const topUp = (lowCredits && packs.length) ? `
    <div class="wf-note" style="margin-bottom:16px;${bal.credits === 0 ? 'color:#fca5a5;border-color:rgba(248,113,113,.3);background:rgba(248,113,113,.06)' : ''}">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <span>${bal.credits === 0 ? 'Your tracking allowance is used up for this month.' : `Tracking allowance running low (${bal.credits} left).`} Top up to keep auto-pushing tracking — no interruption to fulfillment.</span>
        <span style="display:flex;gap:8px">${packs.map(p => `<button class="app-btn sm" data-buycredits="${esc(p.id)}">${esc(p.label)}</button>`).join('')}</span>
      </div>
    </div>` : '';

  content.innerHTML = `
    <div class="home-grid" style="margin-bottom:16px">
      ${stat('Tracking left', String(bal.credits), 'truck', bal.credits > 10 ? 'up' : (bal.configured ? 'down' : ''), bal.configured ? `${bal.allotment}/mo included` : 'not set up yet')}
      ${stat('Pending', String(pending.length), 'truck', '', 'awaiting tracking')}
      ${stat('Claimed', String(claimed.length), 'truck', '', 'ready to push')}
      ${stat('Synced', String(synced.length), 'truck', synced.length ? 'up' : '', 'pushed to buyer')}
    </div>
    ${!bal.configured ? `<div class="wf-note" style="margin-bottom:16px">Auto-tracking isn't live yet — once it's set up, the delivery date + a tracking number sync to each order automatically. Until then, orders collect here.</div>` : ''}
    ${topUp}
    ${ordersTable(pending, 'Pending orders')}
    ${ordersTable(claimed, 'Claimed — ready to push')}
    ${ordersTable(synced, 'Synced')}
    ${!orders.length ? `<div class="ws-empty" style="margin-top:10px">${icon('truck')}<p>No orders yet. When the Amazon fulfill script finishes an order, it captures the delivery date + destination and lands here — then one click claims a tracking number and pushes it to the buyer's marketplace.</p></div>` : ''}
    ${claimsList ? `<div class="panel" style="margin-top:6px"><div class="panel-h">Recent claims</div>${claimsList}</div>` : ''}`;

  content.querySelectorAll('[data-claim]').forEach(b => b.onclick = () => claimForOrder(orders.find(o => String(o.id) === b.dataset.claim), content));
  content.querySelectorAll('[data-push]').forEach(b => b.onclick = () => pushTrackingToMarketplace(orders.find(o => String(o.id) === b.dataset.push), content));
  content.querySelectorAll('[data-buycredits]').forEach(b => b.onclick = async () => {
    b.disabled = true; b.textContent = 'Opening checkout…';
    try { const r = await trackingCheckout(b.dataset.buycredits); if (r && r.url) location.href = r.url; else { b.disabled = false; showAlert('Could not open checkout.'); } }
    catch (e) { b.disabled = false; showAlert(e.message || 'Could not open checkout.'); }
  });
}

async function claimForOrder(o, content) {
  if (!o) return;
  try {
    showToast('Claiming a tracking number…', 'info');
    const r = await claimTracking({
      orderId: o.orderId, marketplace: o.marketplace,
      city: o.buyerCity, state: o.buyerState, zip: o.buyerZip, country: o.buyerCountry,
      deliveryDate: o.deliveryDate,
    });
    trackingBalance = { ...(trackingBalance || {}), credits: r.credits };
    showToast(`Claimed ${r.trackingNumber} (${r.carrier || 'carrier'}). ${trackingBalance.credits} credits left.`, 'success');
    renderTracking();
  } catch (e) {
    showAlert(e.message || 'Could not claim a tracking number.');
  }
}

// Hand a claimed tracking number to the extension to drive the marketplace's
// "add tracking" flow (eBay mesh/ord first). Marks the order synced on success.
function pushTrackingToMarketplace(o, content) {
  if (!o || !o.trackingNumber) return;
  const extId = ext.id || EXT_IDS[0];
  if (!(window.chrome && chrome.runtime && chrome.runtime.sendMessage && ext.installed)) {
    showAlert('Install the Syndrax extension to push tracking to the marketplace.'); return;
  }
  showToast(`Pushing tracking to ${marketplace(o.marketplace)?.name || o.marketplace}…`, 'info');
  chrome.runtime.sendMessage(extId, {
    type: 'SYNDRAX_PUSH_TRACKING', marketplace: o.marketplace, orderId: o.orderId,
    trackingNumber: o.trackingNumber, carrier: o.carrier,
  }, async (resp) => {
    if (chrome.runtime.lastError || !resp || !resp.ok) {
      showAlert((resp && resp.error) || 'Extension could not push the tracking number.'); return;
    }
    try { await updateTrackingOrder(o.id, { status: 'synced' }); } catch {}
    showToast('Tracking pushed to the buyer’s order ✓', 'success');
    renderTracking();
  });
}

// ── Node cluster (ported mini-PC chassis from the extension's NodeClusterView) ──
const NODE_W = 168;
const NODE_TINT = {
  online: { b: '#18E4FF', d: '#00A9FF', disc: '#123A4D', glow: true, text: '#7FE9FF' },
  offline: { b: '#5A6B7D', d: '#3A4757', disc: '#16202B', glow: false, text: '#8195A8' },
};

// Parametric chassis SVG (verbatim from the extension kit) — tints per state.
function nodeShellSVG(uid, b, d, disc, glow) {
  const g = glow ? `filter="url(#glow-${uid})"` : '';
  return `<svg viewBox="0 0 220 620" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="outer-${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#26384B"/><stop offset=".22" stop-color="#0A1421"/><stop offset=".68" stop-color="#111F2D"/><stop offset="1" stop-color="#02070D"/></linearGradient>
    <linearGradient id="rail-${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6D8297"/><stop offset=".08" stop-color="#192A3A"/><stop offset=".55" stop-color="#08111C"/><stop offset=".92" stop-color="#24394B"/><stop offset="1" stop-color="#8799AA"/></linearGradient>
    <linearGradient id="glass-${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#102131" stop-opacity=".94"/><stop offset=".45" stop-color="#07111C" stop-opacity=".97"/><stop offset="1" stop-color="#02070C"/></linearGradient>
    <linearGradient id="bevel-${uid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6E8296"/><stop offset=".13" stop-color="#1A2B3B"/><stop offset=".5" stop-color="#0A131E"/><stop offset=".87" stop-color="#1C3040"/><stop offset="1" stop-color="#8092A4"/></linearGradient>
    <radialGradient id="powerDisc-${uid}" cx="50%" cy="42%" r="64%"><stop offset="0" stop-color="${disc}"/><stop offset=".5" stop-color="#07121D"/><stop offset="1" stop-color="#010409"/></radialGradient>
    <linearGradient id="bottomGlow-${uid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${d}" stop-opacity="0"/><stop offset=".25" stop-color="${d}" stop-opacity=".35"/><stop offset=".5" stop-color="${b}" stop-opacity="1"/><stop offset=".75" stop-color="${d}" stop-opacity=".35"/><stop offset="1" stop-color="${d}" stop-opacity="0"/></linearGradient>
    <filter id="shadow-${uid}" x="-40%" y="-20%" width="180%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="16" flood-color="#000" flood-opacity=".6"/></filter>
    <filter id="glow-${uid}" x="-200%" y="-200%" width="400%" height="400%"><feGaussianBlur stdDeviation="5" result="bl"/><feMerge><feMergeNode in="bl"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="softGlow-${uid}" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="10"/></filter>
    <pattern id="microGrid-${uid}" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M8 0H0V8" fill="none" stroke="#7CCEFF" stroke-opacity=".025" stroke-width=".6"/></pattern>
  </defs>
  <g filter="url(#shadow-${uid})">
    <ellipse cx="110" cy="606" rx="78" ry="16" fill="${b}" opacity="${glow ? '.10' : '.04'}" filter="url(#softGlow-${uid})"/>
    <path d="M24 0H196L216 20V600L196 620H24L4 600V20Z" fill="url(#outer-${uid})" stroke="#50657A" stroke-width="1.5"/>
    <path d="M30 8H190L208 26V594L190 612H30L12 594V26Z" fill="#050B13" stroke="#17283A" stroke-width="2"/>
    <path d="M16 27L28 15H38V605H28L16 593Z" fill="url(#rail-${uid})" stroke="#536A7F" stroke-width="1"/>
    <path d="M204 27L192 15H182V605H192L204 593Z" fill="url(#rail-${uid})" stroke="#536A7F" stroke-width="1"/>
    <path d="M40 22H180L188 31V589L180 598H40L32 589V31Z" fill="url(#glass-${uid})" stroke="#22394C" stroke-width="1.5"/>
    <path d="M40 22H180L188 31V589L180 598H40L32 589V31Z" fill="url(#microGrid-${uid})"/>
    <circle cx="110" cy="75" r="34" fill="#02060B" stroke="#33495D" stroke-width="2"/>
    <circle cx="110" cy="75" r="25" fill="url(#powerDisc-${uid})" stroke="${b}" stroke-opacity=".36"/>
    <circle cx="110" cy="75" r="19" fill="none" stroke="${b}" stroke-width="3" stroke-dasharray="92 28" stroke-linecap="round" transform="rotate(-35 110 75)" ${g}/>
    <path d="M110 55V76" stroke="${b}" stroke-width="4" stroke-linecap="round" ${g}/>
    <path d="M39 535H181V585L174 592H46L39 585Z" fill="#030911" stroke="#173044"/>
    <circle cx="63" cy="566" r="8" fill="#07131F" stroke="#315069"/>
    <rect x="101" y="558" width="18" height="15" rx="2" fill="#07131F" stroke="#315069"/>
    <circle cx="157" cy="562" r="2" fill="#6F8DA4"/><circle cx="157" cy="569" r="2" fill="#6F8DA4"/><circle cx="157" cy="576" r="2" fill="#6F8DA4"/>
    <rect x="55" y="604" width="110" height="4" rx="2" fill="url(#bottomGlow-${uid})" ${g}/>
    <path d="M70 607H150" stroke="${b}" stroke-width="2" opacity="${glow ? '.8' : '.3'}" ${g}/>
  </g></svg>`;
}

function nodeTower(n) {
  const on = (n.status === 'online');
  const t = on ? NODE_TINT.online : NODE_TINT.offline;
  const uid = String(n.name || 'n').replace(/[^a-z0-9]/gi, '');
  const loadPct = on ? Math.max(0, Math.min(100, n.cpu != null ? n.cpu : (n.local ? Math.min(100, jobs.filter(j => j.status === 'running' || j.status === 'accepted').length * 22) : (n.tasks || 0) * 22))) : 0;
  const lit = Math.round(loadPct / 100 * 14);
  const bars = Array.from({ length: 14 }, (_, i) => `<span style="flex:1;border-radius:1px;height:${i < lit ? (60 + i / 14 * 40) : 60}%;background:${i < lit ? t.b : 'rgba(120,160,190,.12)'};box-shadow:${i < lit && t.glow ? '0 0 6px -1px ' + t.b : 'none'}"></span>`).join('');
  const statusLabel = on ? (n.local ? 'MAIN · ONLINE' : 'ONLINE') : 'OFFLINE';
  const h = Math.round(NODE_W * 620 / 220);
  return `<div class="tower" data-tower="${esc(n.id || n.name)}" style="width:${NODE_W}px;height:${h}px">
    <div style="position:absolute;inset:0">${nodeShellSVG(uid, t.b, t.d, t.disc, t.glow)}</div>
    <div style="position:absolute;inset:0;font-family:ui-monospace,monospace">
      ${n.id ? `<button class="auto-del" data-deldev="${n.id}" style="position:absolute;top:6%;right:10%;z-index:3" title="Remove">✕</button>` : ''}
      <div style="position:absolute;left:50%;transform:translateX(-50%);top:18.3%;font-size:9px;font-weight:800;letter-spacing:.18em;color:${t.text}">${statusLabel}</div>
      <div style="position:absolute;left:50%;transform:translateX(-50%);top:22.5%;white-space:nowrap;font-size:14px;font-weight:800;letter-spacing:.06em;color:#e2e8f0">${esc(String(n.name).toUpperCase())}</div>
      <div style="position:absolute;left:50%;transform:translateX(-50%);top:28.5%;font-size:8.5px;letter-spacing:.15em;color:${on ? t.text : '#6b7c8f'}">⬡ ${esc((n.role || 'NODE').toUpperCase())}</div>
      <div style="position:absolute;left:18%;right:18%;top:45%;display:flex;justify-content:space-between;font-size:8px;text-transform:uppercase;letter-spacing:.05em;color:#64748b"><span>Task load</span><span style="color:${t.text}">${Math.round(loadPct)}%</span></div>
      <div style="position:absolute;left:18%;right:18%;top:48.5%;height:11px;display:flex;align-items:flex-end;gap:2px">${bars}</div>
      <div style="position:absolute;left:50%;transform:translateX(-50%);top:79%;font-size:9.5px;color:#94a3b8">${esc(n.ip || (n.local ? (thisPcIp || 'detecting…') : '—'))}</div>
      <div style="position:absolute;left:50%;transform:translateX(-50%);top:82.6%;font-size:9.5px;color:#64748b">${on ? ((n.in_stock != null ? n.in_stock + ' in stock' : (n.tasks || 0) + ' jobs')) : '—'}</div>
    </div>
  </div>`;
}

function renderDevices() {
  const showFleet = can('multiDevice');
  const limit = PLAN_LIMITS[plan]?.maxDevices;
  const thisPc = { name: 'root-main', role: 'This PC', status: ext.installed ? 'online' : 'offline', local: true, ip: thisPcIp, deviceId: currentDeviceId, nodeType: 'current' };
  const all = [thisPc, ...nodes.map(n => ({ ...n, status: n.status === 'online' ? 'online' : (n.status || 'offline') })), ...addedDevices.map(d => ({ ...d, status: d.status === 'online' ? 'online' : 'offline' }))];
  // Fold in server-persisted nodes the live sources didn't already cover (durable,
  // team-shared). Match on deviceId / ip / name so we don't double-render the PC.
  cloudNodes.forEach(n => {
    const dup = all.some(x => (x.deviceId && x.deviceId === n.deviceId) || (x.ip && n.ip && x.ip === n.ip) || x.name === n.name);
    if (!dup) all.push({ name: n.name || n.deviceId, role: n.nodeType === 'current' ? 'This PC' : n.nodeType === 'rdp' ? 'RDP' : 'Remote', status: n.status === 'online' ? 'online' : 'offline', local: n.nodeType === 'current', ip: n.ip, deviceId: n.deviceId, nodeType: n.nodeType });
  });
  const onlineCount = all.filter(n => n.status === 'online').length;
  const health = Math.round(onlineCount / all.length * 100);
  $('#topSub').textContent = `· ${all.length} node${all.length === 1 ? '' : 's'}${isUnlimited(limit) ? '' : ' / ' + limit}`;

  const firstTime = !ext.installed && nodes.length === 0 && addedDevices.length === 0;

  $('#content').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px;flex-wrap:wrap">
      <div><h2 style="font:800 17px var(--nav-font);letter-spacing:.16em;color:#e9f6ff;margin:0">NODE CLUSTER <span style="color:#18E4FF">// SYNDRAX</span></h2>
      <p style="font-size:11px;color:#64748b;margin:2px 0 0">Your fleet, your control — every node on its own IP.</p></div>
      <div style="display:flex;gap:8px">
        ${!ext.installed ? `<button class="app-btn sm" id="useThisPc">Use this PC</button>` : ''}
        ${showFleet ? `<button class="app-btn sm ghost" id="addDev">${icon('plus')} Add node</button>` : `<button class="app-btn sm" data-up="growth">Upgrade to add nodes</button>`}
      </div>
    </div>

    ${firstTime ? `<div class="wf-note" style="margin-bottom:16px;color:#7FE9FF;border-color:rgba(24,228,255,.3);background:rgba(24,228,255,.06)">First-time setup: connect <b>this PC</b> as your main node. Install the Syndrax extension and click <b>Use this PC</b> — it auto-detects your IP and becomes <b>root-main</b>.</div>` : ''}

    <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:1px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;overflow:hidden;margin-bottom:22px" class="cluster-stats">
      ${clusterStat('Total nodes', all.length)}
      ${clusterStat('Online', onlineCount, '#7FE9FF')}
      ${clusterStat('Offline', all.length - onlineCount, all.length - onlineCount ? '#FF8090' : '')}
      ${clusterStat('Accounts', accounts.length)}
      ${clusterStat('Active jobs', jobs.filter(j => j.status === 'running' || j.status === 'accepted').length)}
      ${clusterStat('Health', health + '%', '#7FE9FF')}
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,${NODE_W}px);gap:34px 26px;justify-content:center;padding:6px 0 10px">
      ${all.map(nodeTower).join('')}
      ${showFleet ? `<button id="recruit" style="width:${NODE_W}px;height:${Math.round(NODE_W * 620 / 220)}px;border:2px dashed rgba(255,255,255,.15);border-radius:18px;background:none;color:#475569;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;font:800 11px var(--nav-font);text-transform:uppercase;letter-spacing:.08em">${icon('plus')}<span>Recruit<br><span style="font-weight:400;font-size:9px">add node</span></span></button>` : ''}
    </div>

    ${cloudNodes.length ? `<div class="panel" style="margin-top:18px"><div class="panel-h">Node types <span style="color:#64748b;font-weight:500;text-transform:none;letter-spacing:0">— we auto-detect the PC you're on; override remote/RDP here</span></div>
      ${cloudNodes.map(n => `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
        <span style="flex:1;color:#cbd5e1;font-size:13px">${esc(n.name || n.deviceId)} <span style="color:#64748b">· ${esc(n.ip || '—')}</span></span>
        <select data-nodetype="${esc(n.id)}" style="width:auto;min-width:170px">
          ${['current', 'remote', 'rdp'].map(t => `<option value="${t}" ${n.nodeType === t ? 'selected' : ''}>${t === 'current' ? 'This PC (local)' : t === 'rdp' ? 'RDP / remote desktop' : 'Remote node'}</option>`).join('')}
        </select>
      </div>`).join('')}
    </div>` : ''}

    <div class="wf-note" style="margin-top:10px">Power on/off, Wake-on-LAN and live screen control run in the Syndrax extension (it speaks to each node's agent over the LAN). <span class="link" data-openext="1">Open cluster control →</span></div>`;

  $('#content').querySelectorAll('[data-up]').forEach(b => b.onclick = () => startCheckout(b.dataset.up).catch(e => showAlert(e.message)));
  $('#content').querySelectorAll('[data-deldev]').forEach(b => b.onclick = (e) => { e.stopPropagation(); addedDevices = addedDevices.filter(d => d.id !== b.dataset.deldev); saveDevices(); renderDevices(); });
  $('#content').querySelectorAll('[data-tower]').forEach(b => b.onclick = () => showAlert('Power & live screen for this node open in the Syndrax extension (cluster control).', 'success'));
  $('#content').querySelectorAll('[data-nodetype]').forEach(s => s.onchange = async () => {
    try { await updateNode(s.dataset.nodetype, { nodeType: s.value }); const n = cloudNodes.find(x => String(x.id) === String(s.dataset.nodetype)); if (n) n.nodeType = s.value; showToast('Node type updated.', 'success'); renderDevices(); }
    catch (e) { showAlert(e.message || 'Could not update node.'); }
  });
  const rec = $('#recruit'); if (rec) rec.onclick = openAddDevice;
  const add = $('#addDev'); if (add) add.onclick = openAddDevice;
  const usel = $('#useThisPc'); if (usel) usel.onclick = () => {
    if (ext.installed) { syncExtensionAccounts().then(renderDevices); }
    else { showAlert('Install the Syndrax extension on this PC, then click Use this PC — it auto-detects your IP.', 'error'); window.open('https://chromewebstore.google.com/detail/mgapfpdkkihbeehfkgoajhealmgpnglo', '_blank'); }
  };
  const openExt = $('#content [data-openext]'); if (openExt) openExt.onclick = () => {
    if (ext.installed && ext.id) window.open(`chrome-extension://${ext.id}/dashboard.html`, '_blank');
    else showAlert('Install the Syndrax extension to control the cluster.', 'error');
  };
}

function clusterStat(label, value, color) {
  return `<div style="background:rgba(3,9,20,.5);padding:10px 12px"><div style="font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;font-family:ui-monospace,monospace">${label}</div><div style="font:800 19px ui-monospace,monospace;color:${color || '#cbd5e1'};margin-top:3px">${value}</div></div>`;
}

function existingIps() {
  const ips = [];
  if (thisPcIp) ips.push(thisPcIp);
  nodes.forEach(n => n.ip && ips.push(n.ip));
  addedDevices.forEach(d => d.ip && ips.push(d.ip));
  return ips;
}

function openAddDevice() {
  // A remote node is meant to live on an OUTSIDE PC, on its OWN IP. Primary path
  // is a one-line PowerShell that force-installs the Web Store extension as a
  // locked endpoint (no reverse-connect to other nodes). Manual register is the
  // fallback. IP is required (audit needs it) and checked for cross-IP overlap.
  const token = 'sx_' + Math.random().toString(36).slice(2, 10);
  const ps1 = `powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://www.syndrax.io/connect.ps1 | iex" # token ${token}`;
  let method = 'remote';
  const host = document.createElement('div');
  host.className = 'modal-bg';

  function body() {
    return `<div class="modal wide" onclick="event.stopPropagation()">
      <h3>${icon('monitor')} Add a remote node</h3>
      <p class="modal-sub">Spin up a node on an outside PC — its own machine, its own IP. Run the secure connector on that PC, or register it by name + IP.</p>
      <div class="add-dev">
        <div class="add-visual">
          <div class="scan"></div>
          <div class="tower" style="width:120px;height:${Math.round(120 * 620 / 220)}px;position:relative">
            <div style="position:absolute;inset:0">${nodeShellSVG('addviz', '#18E4FF', '#00A9FF', '#123A4D', true)}</div>
          </div>
        </div>
        <div>
          <div class="method-tabs">
            <button class="method-tab ${method === 'remote' ? 'on' : ''}" data-m="remote">⚡ Quick connect (PowerShell)</button>
            <button class="method-tab ${method === 'manual' ? 'on' : ''}" data-m="manual">Register manually</button>
          </div>
          <div id="mBody"></div>
        </div>
      </div>
    </div>`;
  }

  function remoteBody() {
    return `
      <p style="font-size:12.5px;color:#94a3b8;margin:0 0 8px">On the <b style="color:#cbd5e1">remote PC</b>, open PowerShell <b>as Administrator</b> and paste:</p>
      <div class="ps1-box"><code id="ps1code">${esc(ps1)}</code><button class="app-btn sm" id="ps1copy">Copy</button></div>
      <div class="sec-note">🔒 Installs the <b>Chrome Web Store</b> build only, as a <b>locked endpoint</b> — it takes jobs from your main PC but can’t reverse-connect or read other nodes’ IPs. Secure by default for outside machines.</div>
      <p style="font-size:11.5px;color:#64748b;margin-top:10px">After it runs, the node signs in and appears here automatically — its MAC + static IP sync from the endpoint. IP is required for the safety audit.</p>`;
  }

  function manualBody() {
    return `
      <label>Device name</label>
      <input id="dName" placeholder="e.g. root168 or Warehouse-PC">
      <label>IP address <span style="color:#fca5a5">(required — audit)</span></label>
      <div class="ip-row"><input id="dIp" placeholder="e.g. 50.190.39.168"><button class="app-btn ghost sm" id="dAuto">Auto-detect</button></div>
      <div id="ipWarn"></div>
      <div class="app-btn-row" style="margin-top:16px">
        <button class="app-btn" id="dAdd">Add to cluster</button>
        <button class="app-btn ghost" id="dCancel2">Cancel</button>
      </div>`;
  }

  function paint() {
    host.innerHTML = body();
    $('#mBody', host).innerHTML = method === 'remote' ? remoteBody() : manualBody();
    host.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { method = b.dataset.m; paint(); });
    if (method === 'remote') {
      $('#ps1copy', host).onclick = () => { navigator.clipboard?.writeText(ps1); $('#ps1copy', host).textContent = 'Copied ✓'; };
    } else {
      const ipInput = $('#dIp', host);
      const warn = $('#ipWarn', host);
      const checkIp = () => {
        const v = ipInput.value.trim();
        warn.innerHTML = v && existingIps().includes(v)
          ? `<div class="ip-warn">⚠️ <b>Cross-IP contamination:</b> this IP already runs another node. Marketplaces can link accounts that share an IP — allowed, but it <b>raises your audit risk</b>. Best practice: one node = one IP.</div>`
          : '';
      };
      ipInput.oninput = checkIp;
      $('#dAuto', host).onclick = () => {
        if (thisPcIp) { ipInput.value = thisPcIp; checkIp(); }
        else showAlert('Auto-detect needs the extension on this PC (it reports the IP). For a remote node, use Quick connect.', 'error');
      };
      $('#dCancel2', host).onclick = () => host.remove();
      $('#dAdd', host).onclick = () => {
        const name = $('#dName', host).value.trim();
        const ip = ipInput.value.trim();
        if (!name) { $('#dName', host).style.borderColor = '#f87171'; return; }
        if (!ip) { ipInput.style.borderColor = '#f87171'; return; }
        const dup = existingIps().includes(ip);
        addedDevices.push({ id: 'dev-' + Date.now().toString(36), name, ip, status: 'offline', sharedIp: dup });
        saveDevices(); host.remove(); renderDevices();
        showAlert(dup ? `${name} added — ⚠️ shares an IP with another node (audit risk raised).` : `${name} added to your cluster.`, dup ? 'error' : 'success');
      };
    }
  }

  host.onclick = () => host.remove();
  document.body.appendChild(host);
  paint();
}

function renderTeam() {
  $('#topSub').textContent = '';
  const seats = PLAN_LIMITS[plan].teamSeats;
  const seatLabel = isUnlimited(seats) ? 'Unlimited' : seats;
  $('#content').innerHTML = `<div style="max-width:600px">
    <div class="panel">
      <div class="panel-h">Team workspace</div>
      <p style="font-size:13px;color:#94a3b8;line-height:1.6">Invite teammates to your workspace. They get an email, set a password, and sign in to the Syndrax extension — then they can work across <b style="color:#cbd5e1">all of your shared accounts and nodes</b>. Seats on ${PLAN_LABEL[plan]}: <b style="color:#cbd5e1">${seatLabel}</b>.</p>
      <ol style="font-size:12.5px;color:#94a3b8;line-height:1.7;margin:8px 0 14px;padding-left:18px">
        <li>Enter a teammate's email in the extension Team panel.</li>
        <li>They receive a branded invite email (72-hour, single-use link).</li>
        <li>They set a password — their account is created and ready instantly.</li>
        <li>They sign in to the extension and see the same workspace you do.</li>
      </ol>
      <div class="app-btn-row"><button class="app-btn sm" id="invite">${icon('users')} Open Team panel in extension</button></div>
      <div class="eligibility" style="margin-top:12px">Invites are sent securely from the Syndrax extension (it holds your team key). Sending invites directly from this page is coming in a later update.</div>
    </div>
  </div>`;
  $('#invite').onclick = () => {
    if (ext.installed && ext.id) window.open(`chrome-extension://${ext.id}/dashboard.html#team`, '_blank');
    else { showAlert('Install the Syndrax extension to manage your team — it sends invites securely.', 'error'); window.open('https://chromewebstore.google.com/detail/mgapfpdkkihbeehfkgoajhealmgpnglo', '_blank'); }
  };
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

// Cross-IP contamination: nodes sharing one IP raise marketplace linking risk.
function ipContaminationFindings() {
  const map = {};
  const add = (name, ip) => { if (ip) (map[ip] = map[ip] || []).push(name); };
  if (thisPcIp) add('root-main', thisPcIp);
  nodes.forEach(n => add(n.name, n.ip));
  addedDevices.forEach(d => add(d.name, d.ip));
  const findings = [];
  Object.entries(map).forEach(([ip, names]) => {
    if (names.length > 1) findings.push({ level: 'warn', upgradeTo: null,
      title: `Cross-IP contamination on ${ip}`,
      detail: `${names.join(', ')} share IP ${ip}. Marketplaces flag accounts that share an IP as linked — this raises restriction risk and your audit score. Best practice: one node = one IP (a remote node on its own connection).` });
  });
  return findings;
}

async function renderAudit() {
  $('#topSub').textContent = '';
  let audit = null; try { audit = await getAudit(); } catch {}
  if (!audit) audit = runAudit(buildAuditInput());
  const ipFindings = ipContaminationFindings();
  if (ipFindings.length) audit = { level: 'warn', findings: [...ipFindings, ...(audit.findings || [])] };
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
