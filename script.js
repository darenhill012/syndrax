/**
 * Syndrax LLC - Enterprise Website
 */
document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.getElementById('navbar');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navLinks = document.getElementById('navLinks');
    const fadeElements = document.querySelectorAll('.fade-in');
    const contactForm = document.getElementById('contactForm');
    const typingText = document.getElementById('typingText');

    // Typing Animation
    if (typingText) {
        const text = "Enterprise Technology. Engineered for Scale.";
        let i = 0;
        const typeWriter = () => {
            if (i < text.length) {
                typingText.textContent += text.charAt(i);
                i++;
                setTimeout(typeWriter, 50);
            }
        };
        setTimeout(typeWriter, 500);
    }

    // Navbar scroll
    const handleScroll = () => {
        if (window.scrollY > 50) navbar?.classList.add('scrolled');
        else navbar?.classList.remove('scrolled');
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll();

    // Mobile menu
    if (mobileMenuBtn && navLinks) {
        mobileMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            mobileMenuBtn.classList.toggle('active');
            navLinks.classList.toggle('active');
            document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
        });
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mobileMenuBtn.classList.remove('active');
                navLinks.classList.remove('active');
                document.body.style.overflow = '';
            });
        });
        document.addEventListener('click', (e) => {
            if (!navbar?.contains(e.target) && navLinks.classList.contains('active')) {
                mobileMenuBtn.classList.remove('active');
                navLinks.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }

    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const id = this.getAttribute('href');
            if (id === '#' || id === '') return;
            const el = document.querySelector(id);
            if (el) {
                e.preventDefault();
                const offset = navbar ? navbar.offsetHeight : 0;
                window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - offset, behavior: 'smooth' });
            }
        });
    });

    // Fade-in observer
    if (fadeElements.length > 0) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
        }, { rootMargin: '0px 0px -50px 0px', threshold: 0.1 });
        fadeElements.forEach(el => observer.observe(el));
    }

    // Contact form
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(contactForm);
            if (!fd.get('name') || !fd.get('email') || !fd.get('message')) {
                showNotification('Please fill in all required fields.', 'error'); return;
            }
            const btn = contactForm.querySelector('button[type="submit"]');
            const orig = btn.textContent;
            btn.textContent = 'Sending...'; btn.disabled = true;
            await new Promise(r => setTimeout(r, 1500));
            showNotification('Thank you! We\'ll respond within 24-48 hours.', 'success');
            contactForm.reset(); btn.textContent = orig; btn.disabled = false;
        });
    }

    function showNotification(msg, type) {
        document.querySelector('.notification')?.remove();
        const n = document.createElement('div');
        n.className = `notification notification-${type}`;
        n.innerHTML = `<span>${msg}</span><button class="notification-close">&times;</button>`;
        n.style.cssText = `position:fixed;bottom:30px;right:30px;max-width:400px;padding:18px 48px 18px 24px;background:${type==='success'?'#10b981':'#ef4444'};color:#fff;border-radius:12px;font-family:Inter,sans-serif;font-size:.95rem;font-weight:500;box-shadow:0 8px 30px rgba(0,0,0,.3);z-index:9999;animation:slideIn .4s ease`;
        const close = n.querySelector('.notification-close');
        close.style.cssText = 'position:absolute;top:50%;right:16px;transform:translateY(-50%);background:none;border:none;color:#fff;font-size:24px;cursor:pointer;';
        close.onclick = () => { n.style.animation = 'slideOut .3s ease forwards'; setTimeout(() => n.remove(), 300); };
        if (!document.getElementById('notif-style')) {
            const s = document.createElement('style'); s.id = 'notif-style';
            s.textContent = '@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes slideOut{from{transform:translateX(0);opacity:1}to{transform:translateX(100%);opacity:0}}';
            document.head.appendChild(s);
        }
        document.body.appendChild(n);
        setTimeout(() => { n.style.animation = 'slideOut .3s ease forwards'; setTimeout(() => n.remove(), 300); }, 6000);
    }

    // Active nav highlight
    const page = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links > li > a').forEach(link => {
        const href = link.getAttribute('href');
        if (href === page || (page === '' && href === 'index.html')) link.classList.add('active');
    });

    console.log('%c⚡ Syndrax LLC', 'font-size:24px;font-weight:bold;color:#3b82f6');
});
