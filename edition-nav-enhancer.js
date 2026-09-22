/**
 * BHARAT EPHEMERIS OBSERVATORY — UNIFIED EDITION NAV ENHANCER (edition-nav-enhancer.js)
 * Automatically builds or enhances the navigation header across all Observatory pages.
 * 100% Offline Compatible | Active Tab Detection | PWA Install Button | Live Status Monitoring
 * APEX Hardened Version - Safe DOM Dereferencing & Accessible ARIA Controls
 */

(function() {
    'use strict';

    let deferredPrompt = null;

    // Listen for PWA installation prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        showPWAInstallButtons();
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        hidePWAInstallButtons();
        console.log('[BE Observatory] PWA installed successfully.');
    });

    window.installPWA = async function() {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`[BE Observatory] PWA install prompt outcome: ${outcome}`);
        deferredPrompt = null;
        hidePWAInstallButtons();
    };

    function showPWAInstallButtons() {
        const btns = document.querySelectorAll('.pwa-install-btn');
        btns.forEach(btn => {
            btn.style.display = 'inline-flex';
        });
    }

    function hidePWAInstallButtons() {
        const btns = document.querySelectorAll('.pwa-install-btn');
        btns.forEach(btn => {
            btn.style.display = 'none';
        });
    }

    function updateNetworkStatus() {
        const isOnline = navigator.onLine;
        const statusPills = document.querySelectorAll('.status-pill-network');
        statusPills.forEach(pill => {
            if (isOnline) {
                pill.classList.remove('offline');
                pill.classList.add('online');
                pill.innerHTML = '<span class="dot-indicator"></span> 100% OFFLINE READY';
            } else {
                pill.classList.remove('online');
                pill.classList.add('offline');
                pill.innerHTML = '<span class="dot-indicator" style="background:#ff5555;"></span> OFFLINE MODE (LOCAL DATA)';
            }
        });
    }

    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    function initEditionNav() {
        if (!document.body) return;
        const currentPath = window.location.pathname.toLowerCase();
        
        const navPages = [
            { name: 'HOME', href: 'index.html', icon: '🌌' },
            { name: 'MUSEUM', href: 'museum.html', icon: '🏛️' },
            { name: 'LIBRARY', href: 'library.html', icon: '📚' },
            { name: 'PANCHANG', href: 'panchang.html', icon: '📜' },
            { name: 'ENGINE', href: 'shunyabheda.html', icon: '⚛️' },
            { name: 'DASHBOARD', href: 'shoonya_sovereign_dashboard.html', icon: '👑' }
        ];

        let bharatNav = document.querySelector('.bharat-nav');
        if (bharatNav) {
            // Synchronize active states in existing .bharat-nav
            const links = bharatNav.querySelectorAll('.bharat-links a');
            links.forEach(link => {
                const href = link.getAttribute('href') || '';
                const isActive = (href && currentPath.endsWith(href)) || 
                                 (href === 'index.html' && (currentPath.endsWith('/') || currentPath === '' || currentPath.endsWith('index.html')));
                if (isActive) {
                    link.classList.add('active');
                    link.setAttribute('aria-current', 'page');
                } else {
                    link.classList.remove('active');
                    link.removeAttribute('aria-current');
                }
            });

            // Attach PWA / status indicator into .bharat-nav if not present
            if (!bharatNav.querySelector('.header-right-meta')) {
                const rightMeta = document.createElement('div');
                rightMeta.className = 'header-right-meta';
                rightMeta.style.cssText = 'display:flex;align-items:center;gap:0.6rem;margin-left:auto;';
                rightMeta.innerHTML = `
                    <div class="status-pill status-pill-network online">
                        <span class="dot-indicator"></span> 100% OFFLINE READY
                    </div>
                    <button class="btn btn-gold pwa-install-btn" style="display:none;" onclick="window.installPWA()">
                        📲 Install PWA
                    </button>
                `;
                bharatNav.appendChild(rightMeta);
            }
            updateNetworkStatus();
            return;
        }

        // Fallback for pages without .bharat-nav:
        let headerBar = document.querySelector('.header-bar');
        if (!headerBar) {
            headerBar = document.createElement('header');
            headerBar.className = 'header-bar';
            document.body.insertBefore(headerBar, document.body.firstChild);
        }

        if (!headerBar.querySelector('.beo-badge')) {
            headerBar.innerHTML = `
                <div class="header-left">
                    <a href="index.html" class="beo-badge" aria-label="Bharat Ephemeris Home">
                        <span class="beo-logo-symbol">☉</span>
                        <span class="beo-logo-text">BHARAT EPHEMERIS</span>
                    </a>
                    <h1 class="header-title" id="page-heading-title">Observatory Suite</h1>
                </div>
                <div class="header-right">
                    <div class="status-pill status-pill-network online">
                        <span class="dot-indicator"></span> 100% OFFLINE READY
                    </div>
                    <button class="btn btn-gold pwa-install-btn" style="display:none;" onclick="window.installPWA()">
                        📲 Install PWA
                    </button>
                </div>
            `;
        }

        let navBar = document.querySelector('.nav-tab-bar');
        if (!navBar) {
            navBar = document.createElement('nav');
            navBar.className = 'nav-tab-bar';
            navBar.setAttribute('aria-label', 'Observatory Navigation');
            headerBar.parentNode.insertBefore(navBar, headerBar.nextSibling);
        }

        let navHTML = '';
        navPages.forEach(page => {
            const isActive = currentPath.endsWith(page.href) || 
                             (page.href === 'index.html' && (currentPath.endsWith('/') || currentPath === ''));
            const activeClass = isActive ? 'nav-tab active' : 'nav-tab';
            const ariaAttr = isActive ? 'aria-current="page"' : '';
            navHTML += `
                <a href="${page.href}" class="${activeClass}" ${ariaAttr}>
                    <span>${page.icon}</span>
                    <span>${page.name}</span>
                </a>
            `;
        });
        navBar.innerHTML = navHTML;
        updateNetworkStatus();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initEditionNav);
    } else {
        initEditionNav();
    }
})();

// ── BHARAT EPHEMERIS EDITION NAV ENHANCER MODULE EXPORT ──
(function() {
    'use strict';
    
    const initialFontScale = parseFloat(typeof localStorage !== 'undefined' ? localStorage.getItem('be_reader_font_scale') : '1.0') || 1.0;

    const EditionNavEnhancer = {
        fontScale: initialFontScale,

        setFontScale: function(scale) {
            this.fontScale = parseFloat(scale) || 1.0;
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('be_reader_font_scale', String(this.fontScale));
            }
            const readerBody = typeof document !== 'undefined' ? document.getElementById('readerBody') : null;
            if (readerBody) {
                readerBody.style.fontSize = (this.fontScale * 0.95).toFixed(2) + 'rem';
            }
            return this.fontScale;
        },

        adjustFontScale: function(delta) {
            const newScale = Math.max(0.7, Math.min(2.0, this.fontScale + delta));
            return this.setFontScale(newScale);
        },

        renderKaTeX: function(latex) {
            if (!latex) return '';
            let out = String(latex);
            // Strip \text{...} first so nested braces don't break \frac regex
            out = out.replace(/\\text\{([^}]+)\}/g, '$1');
            // Convert \frac{num}{den}
            out = out.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, function(_, num, den) {
                return `<span class="katex-frac"><span class="katex-num">${num}</span><span class="katex-den">${den}</span></span>`;
            });
            // Convert \sqrt{expr}
            out = out.replace(/\\sqrt\{([^}]+)\}/g, function(_, expr) {
                return `<span class="katex-sqrt">√<span class="katex-sqrt-line">${expr}</span></span>`;
            });
            // Convert common LaTeX symbols
            out = out.replace(/\\pi/g, 'π')
                     .replace(/\\approx/g, '≈')
                     .replace(/\\quad/g, ' ')
                     .replace(/\\theta/g, 'θ')
                     .replace(/\\le/g, '≤')
                     .replace(/\\ge/g, '≥')
                     .replace(/\\phi/g, 'φ')
                     .replace(/\\times/g, '×')
                     .replace(/\\text\{([^}]+)\}/g, '$1');
            return out;
        },

        updateReadingProgress: function() {
            if (typeof document === 'undefined') return 0;
            const readerModal = document.getElementById('readerModal');
            const readerBody = document.getElementById('readerBody');
            const progressBar = document.getElementById('reading-progress-bar');
            const badge = document.getElementById('readerProgressBadge');

            if (!readerModal || !readerBody || !readerModal.classList.contains('open')) return 0;

            const scrollableHeight = readerBody.scrollHeight - readerBody.clientHeight;
            const pct = scrollableHeight > 0 ? Math.min(100, Math.max(0, Math.round((readerBody.scrollTop / scrollableHeight) * 100))) : 0;

            if (progressBar) progressBar.style.width = pct + '%';
            if (badge) badge.textContent = pct + '% read';

            if (typeof localStorage !== 'undefined') {
                const bookKey = typeof window !== 'undefined' ? window.currentBookKey : 'surya';
                const chapterIndex = typeof window !== 'undefined' ? window.currentChapterIndex : 0;
                localStorage.setItem('be_reading_progress', JSON.stringify({ bookKey, chapterIndex, progress: pct }));
            }
            return pct;
        },

        exportJSON: function(bookKey, chapterIndex) {
            if (typeof window === 'undefined' || typeof document === 'undefined') return;
            const corpus = window.granthaCorpus || {};
            let payload = {};
            let filename = '';

            if (bookKey === 'bundle') {
                payload = { title: 'Complete Deca Grantha Collector Bundle', corpus };
                filename = 'Complete_Deca_Grantha_Collector_Bundle.json';
            } else if (chapterIndex !== undefined && corpus[bookKey] && corpus[bookKey].chapters[chapterIndex]) {
                payload = { bookKey, chapterIndex, chapter: corpus[bookKey].chapters[chapterIndex] };
                filename = `${bookKey}_ch${chapterIndex + 1}_dataset.json`;
            } else if (corpus[bookKey]) {
                payload = { bookKey, book: corpus[bookKey] };
                filename = `${bookKey}_full_dataset.json`;
            } else {
                return;
            }

            const jsonStr = JSON.stringify(payload, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        },

        copyDeepLink: function(anchor) {
            if (typeof window === 'undefined' || !navigator.clipboard) return;
            const url = window.location.href.split('#')[0] + '#' + anchor;
            navigator.clipboard.writeText(url);
        }
    };

    window.EditionNavEnhancer = EditionNavEnhancer;
})();
