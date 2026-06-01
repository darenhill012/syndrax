// Dark mode — default dark, restore light only if explicitly saved
(function() {
  if (localStorage.getItem('theme') === 'light') {
    document.documentElement.classList.remove('dark');
  }
})();

function initThemeToggle() {
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
  });
}

// Navbar scroll effect
const navbar = document.getElementById('navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });
}

// Hamburger / mobile menu
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
const mobileMenuClose = document.getElementById('mobileMenuClose');

function openMobileMenu() {
  mobileMenu.classList.add('open');
  hamburger.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeMobileMenu() {
  mobileMenu.classList.remove('open');
  hamburger.classList.remove('open');
  document.body.style.overflow = '';
}

if (hamburger && mobileMenu) {
  hamburger.addEventListener('click', () => {
    if (mobileMenu.classList.contains('open')) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  });

  if (mobileMenuClose) {
    mobileMenuClose.addEventListener('click', closeMobileMenu);
  }

  mobileMenu.addEventListener('click', (e) => {
    if (e.target === mobileMenu) closeMobileMenu();
  });

  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeMobileMenu);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileMenu.classList.contains('open')) {
      closeMobileMenu();
    }
  });
}

// Fade-up on scroll
const fadeEls = document.querySelectorAll('.fade-up');
if (fadeEls.length) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  fadeEls.forEach(el => observer.observe(el));
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

initThemeToggle();

// Cursor glow effect — cyan tint, full page
if (window.matchMedia('(pointer: fine)').matches) {
  const cursor = document.createElement('div');
  cursor.style.cssText = `
    position:fixed;pointer-events:none;z-index:9999;
    width:500px;height:500px;border-radius:50%;
    background:radial-gradient(circle, rgba(0,207,255,0.07) 0%, transparent 65%);
    transform:translate(-50%,-50%);transition:left 0.12s ease,top 0.12s ease;
    left:-300px;top:-300px;
  `;
  document.body.appendChild(cursor);
  document.addEventListener('mousemove', e => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  });
}

// ===================== HERO AUTOPLAY ENGINE =====================

const HERO_STATES = [
  {
    node: 'shopify',
    icon: 'assets/icons/marketplaces/shopify.svg',
    title: 'Shopify Automation',
    status: 'Syncing',
    tasks: [
      'AI generated product title',
      'Pricing rule created',
      'Inventory sync active',
      'Marketing feed prepared',
    ],
    complete: 'Shopify sync complete',
    result: 'Storefront automation synced',
    metric: 'Catalog Health +12',
  },
  {
    node: 'amazon',
    icon: 'assets/icons/marketplaces/amazon.svg',
    title: 'Amazon Automation',
    status: 'Syncing',
    tasks: [
      'Buy box margin checked',
      'Competitor price scanned',
      'Inventory quantity matched',
      'Listing data optimized',
    ],
    complete: 'Amazon sync complete',
    result: 'Amazon channel updated',
    metric: 'Margin +18%',
  },
  {
    node: 'walmart',
    icon: 'assets/icons/marketplaces/walmart.svg',
    title: 'Walmart Protection',
    status: 'Protecting',
    tasks: [
      'Stock level checked',
      'OOS item paused',
      'Safety buffer applied',
      'Marketplace rule verified',
    ],
    complete: 'Walmart sync complete',
    result: 'Protection active',
    metric: 'Oversell Blocked',
  },
  {
    node: 'etsy',
    icon: 'assets/icons/marketplaces/etsy.svg',
    title: 'Etsy Listing Flow',
    status: 'Optimizing',
    tasks: [
      'Keywords improved',
      'Photos mapped',
      'Description cleaned',
      'Tags prepared',
    ],
    complete: 'Etsy sync complete',
    result: 'Listing optimized',
    metric: 'SEO Score +24',
  },
  {
    node: 'tiktok',
    icon: 'assets/icons/marketplaces/tiktok.svg',
    title: 'TikTok Shop Feed',
    status: 'Publishing',
    tasks: [
      'Product feed formatted',
      'Creative hook generated',
      'Price checked',
      'Stock synced',
    ],
    complete: 'TikTok feed live',
    result: 'Social commerce ready',
    metric: 'Feed Clean',
  },
  {
    node: 'ebay',
    icon: 'assets/icons/marketplaces/ebay.svg',
    title: 'eBay Listing Sync',
    status: 'Syncing',
    tasks: [
      'Listing title cleaned',
      'Item specifics mapped',
      'Price compared',
      'Inventory quantity synced',
    ],
    complete: 'eBay listing updated',
    result: 'Marketplace listing synced',
    metric: 'Listing Score +31',
  },
  {
    node: 'google',
    icon: 'assets/icons/marketplaces/google.svg',
    title: 'Google Merchant Feed',
    status: 'Validating',
    tasks: [
      'Product taxonomy fixed',
      'Missing fields repaired',
      'Feed errors checked',
      'Product data validated',
    ],
    complete: 'Merchant feed synced',
    result: 'Google feed ready',
    metric: 'Feed Errors 0',
  },
  {
    node: 'facebook',
    icon: 'assets/icons/marketplaces/facebook.svg',
    title: 'Facebook Catalog Sync',
    status: 'Syncing',
    tasks: [
      'Catalog fields cleaned',
      'Image set checked',
      'Variant data matched',
      'Audience signal prepared',
    ],
    complete: 'Catalog sync complete',
    result: 'Meta catalog synced',
    metric: 'Ads Feed Ready',
  },
  {
    node: 'woocommerce',
    icon: 'assets/icons/marketplaces/woocommerce.svg',
    title: 'WooCommerce Sync',
    status: 'Syncing',
    tasks: [
      'Catalog scanned',
      'Price updated',
      'Inventory matched',
      'Product rules applied',
    ],
    complete: 'WooCommerce sync complete',
    result: 'Store catalog synced',
    metric: 'Price Rule Live',
  },
];

// SVG coordinate lookup for each node (matches the SVG viewBox connector endpoints)
const NODE_SVG_COORDS = {
  shopify:     { x: 300, y:  56 },
  amazon:      { x: 520, y: 120 },
  walmart:     { x: 564, y: 300 },
  etsy:        { x: 520, y: 480 },
  tiktok:      { x: 300, y: 544 },
  ebay:        { x:  80, y: 480 },
  google:      { x:  36, y: 300 },
  facebook:    { x:  80, y: 120 },
  woocommerce: { x: 160, y:  56 },
};

const ORB_CENTER = { x: 300, y: 300 };

function initHeroAutoplay() {
  const dashTitle    = document.getElementById('heroDashTitle');
  const dashIcon     = document.getElementById('heroDashIcon');
  const dashStatus   = document.getElementById('heroDashStatus');
  const dashTasks    = document.getElementById('heroDashTasks');
  const dashResult   = document.getElementById('heroDashResult');
  const dashProgress = document.getElementById('heroDashProgress');
  const dataDot      = document.getElementById('heroDataDot');
  const metricAnchor = document.getElementById('heroMetricAnchor');
  const orbLines     = document.getElementById('heroOrbLines');
  const cursorLight  = document.getElementById('heroCursorLight');

  if (!dashTitle || !dataDot) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let currentIdx = 0;
  let dotAnimFrame = null;
  let metricTimeout = null;

  // Cursor light on hero-right
  const heroRight = document.querySelector('.hero-right');
  if (heroRight && cursorLight && window.matchMedia('(pointer: fine)').matches) {
    heroRight.addEventListener('mousemove', e => {
      const rect = heroRight.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width  * 100).toFixed(1) + '%';
      const py = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1) + '%';
      cursorLight.style.setProperty('--cursor-x', px);
      cursorLight.style.setProperty('--cursor-y', py);
    }, { passive: true });
  }

  function buildTasks(state) {
    dashTasks.innerHTML = '';
    state.tasks.forEach(t => {
      const row = document.createElement('div');
      row.className = 'hero-dash-task';
      row.innerHTML = `<span class="hero-dash-task-dot"></span><span>${t}</span>`;
      dashTasks.appendChild(row);
    });
    const last = document.createElement('div');
    last.className = 'hero-dash-task hero-dash-task--complete';
    last.innerHTML = `<span class="hero-dash-task-dot hero-dash-task-dot--done"></span><span>${state.complete}</span>`;
    dashTasks.appendChild(last);
  }

  function clearActiveNode() {
    document.querySelectorAll('.hero-node--active').forEach(n => n.classList.remove('hero-node--active'));
  }

  function clearActiveConnector() {
    if (!orbLines) return;
    orbLines.querySelectorAll('.hero-cn--active').forEach(l => l.classList.remove('hero-cn--active'));
  }

  function activateNode(nodeKey) {
    const node = document.querySelector(`.hero-node[data-node="${nodeKey}"]`);
    if (node) node.classList.add('hero-node--active');
  }

  function activateConnector(nodeKey) {
    if (!orbLines) return;
    const cn = orbLines.querySelector(`.hero-cn[data-cn="${nodeKey}"]`);
    if (cn) cn.classList.add('hero-cn--active');
  }

  function showMetricChip(text) {
    if (metricAnchor) metricAnchor.innerHTML = '';
    if (metricTimeout) clearTimeout(metricTimeout);
    const chip = document.createElement('div');
    chip.className = 'hero-metric-chip';
    chip.textContent = text;
    if (metricAnchor) metricAnchor.appendChild(chip);
    metricTimeout = setTimeout(() => {
      if (metricAnchor) metricAnchor.innerHTML = '';
    }, 3000);
  }

  function animateDataDot(nodeKey, onComplete) {
    if (reducedMotion || !orbLines || !dataDot) {
      onComplete && onComplete();
      return;
    }
    const target = NODE_SVG_COORDS[nodeKey];
    if (!target) { onComplete && onComplete(); return; }

    const dx = target.x - ORB_CENTER.x;
    const dy = target.y - ORB_CENTER.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const duration = 900; // ms
    let startTime = null;

    if (dotAnimFrame) cancelAnimationFrame(dotAnimFrame);
    dataDot.setAttribute('opacity', '1');

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      dataDot.setAttribute('cx', ORB_CENTER.x + dx * eased);
      dataDot.setAttribute('cy', ORB_CENTER.y + dy * eased);

      if (progress < 1) {
        dotAnimFrame = requestAnimationFrame(step);
      } else {
        dataDot.setAttribute('opacity', '0');
        dotAnimFrame = null;
        onComplete && onComplete();
      }
    }
    dotAnimFrame = requestAnimationFrame(step);
  }

  function applyState(idx) {
    const state = HERO_STATES[idx];

    // Update dashboard content
    dashIcon.src = state.icon;
    dashIcon.alt = state.node;
    dashTitle.textContent = state.title;
    dashStatus.textContent = state.status;
    buildTasks(state);
    dashResult.textContent = state.result;

    // Reset and animate progress bar
    dashProgress.style.transition = 'none';
    dashProgress.style.width = '0%';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        dashProgress.style.transition = 'width 3.2s linear';
        dashProgress.style.width = '100%';
      });
    });

    // Clear previous active state
    clearActiveNode();
    clearActiveConnector();

    // Animate data dot, then activate node + connector + metric
    animateDataDot(state.node, () => {
      activateNode(state.node);
      activateConnector(state.node);
      showMetricChip(state.metric);
    });
  }

  // Initial state
  applyState(currentIdx);

  // Autoplay cycle every 3.6 seconds
  setInterval(() => {
    currentIdx = (currentIdx + 1) % HERO_STATES.length;
    applyState(currentIdx);
  }, 3600);
}

// Init after DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { initHeroAutoplay(); initHeroRail(); });
} else {
  initHeroAutoplay();
  initHeroRail();
}

// ===================== HERO ROBOT RAIL =====================
function initHeroRail() {
  const rail     = document.getElementById('heroRail');
  const robot    = document.getElementById('railRobot');
  const track    = rail && rail.querySelector('.hero-rail-track');
  if (!rail || !robot || !track) return;

  // Respect prefers-reduced-motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const bubbleLeft      = document.getElementById('railBubbleLeft');
  const bubbleLeftIcon  = document.getElementById('railBubbleLeftIcon');
  const bubbleLeftText  = document.getElementById('railBubbleLeftText');
  const bubbleRight     = document.getElementById('railBubbleRight');
  const bubbleRightIcon = document.getElementById('railBubbleRightIcon');
  const bubbleRightText = document.getElementById('railBubbleRightText');
  const radarRings      = robot.querySelectorAll('.hero-rail-radar-ring');

  // Bubble sequences: [icon path, label]
  const LEFT_BUBBLES = [
    ['assets/svg/robot3.svg',      'AI Ready'],
    ['assets/svg/think.svg',       'Analyzing'],
    ['assets/svg/ecom.svg',        'Sync Init'],
    ['assets/svg/robot3.svg',      'Queued'],
    ['assets/svg/think.svg',       'Optimizing'],
  ];
  const RIGHT_BUBBLES = [
    ['assets/svg/money.svg',       'Price Live'],
    ['assets/svg/shopify.svg',     'Listed'],
    ['assets/svg/amazon.svg',      'Synced'],
    ['assets/svg/review.svg',      'SEO Fixed'],
    ['assets/svg/happy.svg',       'Stock OK'],
    ['assets/svg/email.svg',       'Feed Clean'],
    ['assets/svg/speaker.svg',     'Margin Up'],
    ['assets/svg/ebay.svg',        'eBay Live'],
    ['assets/svg/ecom.svg',        'Store Ready'],
  ];

  let leftIdx  = 0;
  let rightIdx = 0;

  function ease(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  function getNodeX(side) {
    const nodeEl = rail.querySelector(side === 'left' ? '.hero-rail-node--left' : '.hero-rail-node--right');
    const trackRect = track.getBoundingClientRect();
    const nodeRect  = nodeEl.getBoundingClientRect();
    return (nodeRect.left + nodeRect.width / 2) - trackRect.left;
  }

  function popBubble(bubbleEl, iconEl, textEl, pool, idxRef) {
    const [src, label] = pool[idxRef % pool.length];
    iconEl.src = src;
    textEl.textContent = label;
    bubbleEl.classList.remove('pop');
    void bubbleEl.offsetWidth;
    bubbleEl.classList.add('pop');
    return idxRef + 1;
  }

  function triggerArrival() {
    // Green strobe flash
    robot.classList.remove('strobe');
    void robot.offsetWidth;
    robot.classList.add('strobe');
    robot.addEventListener('animationend', () => robot.classList.remove('strobe'), { once: true });

    // Radar rings — staggered via CSS delay, just re-trigger
    radarRings.forEach(ring => {
      ring.classList.remove('ping');
      void ring.offsetWidth;
      ring.classList.add('ping');
      ring.addEventListener('animationend', () => ring.classList.remove('ping'), { once: true });
    });
  }

  function travel(fromSide, duration, onDone) {
    const fromX = getNodeX(fromSide);
    const toX   = getNodeX(fromSide === 'left' ? 'right' : 'left');
    const start = performance.now();

    if (fromSide === 'left') {
      robot.classList.remove('flipped');
    } else {
      robot.classList.add('flipped');
    }

    function step(now) {
      const elapsed = now - start;
      const raw = Math.min(elapsed / duration, 1);
      const t   = ease(raw);
      robot.style.left = (fromX + (toX - fromX) * t) + 'px';
      if (raw < 1) {
        requestAnimationFrame(step);
      } else {
        robot.style.left = toX + 'px';
        triggerArrival();
        onDone && onDone();
      }
    }
    requestAnimationFrame(step);
  }

  function runCycle() {
    // Phase 1: pause at left, pop left bubble, then travel right
    setTimeout(() => {
      leftIdx = popBubble(bubbleLeft, bubbleLeftIcon, bubbleLeftText, LEFT_BUBBLES, leftIdx);
    }, 400);

    setTimeout(() => {
      travel('left', 3200, () => {
        // Phase 2: arrived right, pop right bubble, pause, then return
        rightIdx = popBubble(bubbleRight, bubbleRightIcon, bubbleRightText, RIGHT_BUBBLES, rightIdx);

        setTimeout(() => {
          travel('right', 3200, () => {
            // Back at left — small pause then repeat
            setTimeout(runCycle, 700);
          });
        }, 1600);
      });
    }, 1200);
  }

  // Position robot at left node initially
  robot.style.left = getNodeX('left') + 'px';

  // Recalculate on resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      robot.style.left = getNodeX('left') + 'px';
    }, 100);
  }, { passive: true });

  // Kick off after a short delay so layout is settled
  setTimeout(runCycle, 800);
}
