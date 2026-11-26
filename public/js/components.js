/**
 * Cargador de componentes HTML externos (Header y Footer)
 * Permite reutilizar components/header.html y components/footer.html en todas las páginas.
 */
(function () {
  async function loadComponent(containerId, url) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`No se pudo cargar ${url} (${response.status})`);
      }
      container.innerHTML = await response.text();
      return container;
    } catch (error) {
      console.error(`[components.js] Error cargando ${url}:`, error);
      return null;
    }
  }

  function initHeader(headerRoot) {
    if (!headerRoot) return;

    const siteHeader = headerRoot.querySelector('#site-header');
    const heroSection = document.querySelector('.hero');
    const pageHeroSection = document.querySelector('.page-hero');

    // Cambiar cabecera a barra blanca sticky horizontal al salir del Hero
    if (siteHeader) {
      if (heroSection) {
        const updateStickyState = () => {
          const triggerPoint = heroSection.offsetHeight - 90;
          siteHeader.classList.toggle('is-sticky', window.scrollY >= triggerPoint);
        };
        window.addEventListener('scroll', updateStickyState, { passive: true });
        window.addEventListener('resize', updateStickyState);
        updateStickyState();
      } else if (pageHeroSection) {
        siteHeader.classList.add('site-header--inner');
        const updateInnerSticky = () => {
          const triggerPoint = pageHeroSection.offsetHeight - 80;
          siteHeader.classList.toggle('is-sticky', window.scrollY >= triggerPoint);
        };
        window.addEventListener('scroll', updateInnerSticky, { passive: true });
        window.addEventListener('resize', updateInnerSticky);
        updateInnerSticky();
      } else {
        siteHeader.classList.add('is-sticky');
      }
    }

    // Marcar enlace activo según data-page en <body>
    const activePage = document.body.dataset.page || 'inicio';
    const navLinks = headerRoot.querySelectorAll('.main-nav__link');
    navLinks.forEach((link) => {
      if (link.dataset.nav === activePage) {
        link.classList.add('is-active');
        link.setAttribute('aria-current', 'page');
      }
    });

    // Menú móvil
    const navToggle = headerRoot.querySelector('#nav-toggle');
    const mainNav = headerRoot.querySelector('#main-nav');
    if (navToggle && mainNav) {
      navToggle.addEventListener('click', () => {
        const expanded = navToggle.getAttribute('aria-expanded') === 'true';
        navToggle.setAttribute('aria-expanded', String(!expanded));
        navToggle.classList.toggle('is-open', !expanded);
        mainNav.classList.toggle('is-open', !expanded);
      });

      mainNav.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => {
          navToggle.setAttribute('aria-expanded', 'false');
          navToggle.classList.remove('is-open');
          mainNav.classList.remove('is-open');
        });
      });
    }

    // Selector de idioma
    const langSwitcher = headerRoot.querySelector('#lang-switcher');
    const langBtn = headerRoot.querySelector('#lang-switcher-btn');
    const langMenu = headerRoot.querySelector('#lang-switcher-menu');
    const currentCode = headerRoot.querySelector('#lang-current-code');
    const currentFlag = headerRoot.querySelector('#lang-current-flag');

    if (langSwitcher && langBtn && langMenu) {
      const closeLangMenu = () => {
        langSwitcher.classList.remove('is-open');
        langBtn.setAttribute('aria-expanded', 'false');
      };

      langBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        const isOpen = langSwitcher.classList.toggle('is-open');
        langBtn.setAttribute('aria-expanded', String(isOpen));
      });

      const syncLangUI = (lang) => {
        const targetBtn = langMenu.querySelector(`.lang-switcher__option[data-lang="${lang}"]`);
        if (!targetBtn) return;
        const optionFlag = targetBtn.querySelector('.lang-switcher__flag');
        if (currentCode) currentCode.textContent = lang;
        if (currentFlag && optionFlag) currentFlag.innerHTML = optionFlag.innerHTML;
        langMenu.querySelectorAll('.lang-switcher__option').forEach((btn) => {
          btn.classList.toggle('is-selected', btn === targetBtn);
          btn.closest('li')?.setAttribute('aria-selected', String(btn === targetBtn));
        });
      };

      if (window.FincasI18n) {
        syncLangUI(window.FincasI18n.getLang());
      }

      langMenu.querySelectorAll('.lang-switcher__option').forEach((option) => {
        option.addEventListener('click', () => {
          const lang = (option.dataset.lang || 'ES').toUpperCase();
          syncLangUI(lang);
          if (window.FincasI18n) {
            window.FincasI18n.setLang(lang);
          } else {
            document.documentElement.lang = lang.toLowerCase();
          }
          closeLangMenu();

          // Redirigir a la carpeta de idioma correspondiente (/cat/, /en/, /fr/, /zh/, /ru/ o raíz para ES)
          const path = window.location.pathname;
          if (!path.includes('/propiedades/')) {
            const folder = window.FincasI18n ? window.FincasI18n.getFolderForLang(lang) : '';
            const basePath = document.body.dataset.basePath || '';
            const pageFile = path.split('/').pop() || 'index.html';
            const cleanFile = pageFile.endsWith('.html') ? pageFile : 'index.html';
            const targetUrl = folder ? `${basePath}${folder}/${cleanFile}` : `${basePath}${cleanFile}`;
            if (targetUrl && targetUrl !== cleanFile) {
              window.location.href = targetUrl;
            }
          }
        });
      });

      document.addEventListener('click', (event) => {
        if (!langSwitcher.contains(event.target)) {
          closeLangMenu();
        }
      });

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          closeLangMenu();
        }
      });
    }
  }

  function initFooter(footerRoot) {
    if (!footerRoot) return;

    // Carga perezosa real del iframe de Google Maps solo al acercarse al footer
    const mapFrame = footerRoot.querySelector('.footer-map__frame[data-map-src]');
    if (mapFrame) {
      const mountMap = () => {
        if (mapFrame.querySelector('iframe')) return;
        const iframe = document.createElement('iframe');
        iframe.title = 'Ubicación de Fincas Maricel en Sitges';
        iframe.src = mapFrame.dataset.mapSrc;
        iframe.loading = 'lazy';
        iframe.referrerPolicy = 'no-referrer-when-downgrade';
        iframe.allowFullscreen = true;
        mapFrame.appendChild(iframe);
      };

      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver(
          (entries) => {
            if (entries.some((e) => e.isIntersecting)) {
              mountMap();
              io.disconnect();
            }
          },
          { rootMargin: '250px' }
        );
        io.observe(mapFrame);
      } else {
        mountMap();
      }
    }

    // Acordeón de información básica RGPD
    const gdprToggle = footerRoot.querySelector('#gdpr-toggle');
    const gdprPanel = footerRoot.querySelector('#gdpr-panel');
    if (gdprToggle && gdprPanel) {
      gdprToggle.addEventListener('click', () => {
        const expanded = gdprToggle.getAttribute('aria-expanded') === 'true';
        gdprToggle.setAttribute('aria-expanded', String(!expanded));
        gdprPanel.hidden = expanded;
        const plus = gdprToggle.querySelector('.footer-gdpr__plus');
        if (plus) plus.textContent = expanded ? '+' : '−';
      });
    }

    // Validación básica del formulario de newsletter
    const form = footerRoot.querySelector('#newsletter-form');
    const emailInput = footerRoot.querySelector('#newsletter-email');
    const privacyInput = footerRoot.querySelector('#newsletter-privacy');
    const feedback = footerRoot.querySelector('#newsletter-feedback');

    if (form && emailInput && privacyInput && feedback) {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = emailInput.value.trim();

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          feedback.textContent = 'Por favor, introduce un correo electrónico válido.';
          feedback.className = 'footer-newsletter__feedback is-error';
          emailInput.focus();
          return;
        }

        if (!privacyInput.checked) {
          feedback.textContent = 'Debes aceptar la Política de Privacidad para suscribirte.';
          feedback.className = 'footer-newsletter__feedback is-error';
          privacyInput.focus();
          return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        const basePath = document.body.dataset.basePath || '';
        const formData = new FormData(form);
        formData.set('type', 'newsletter');

        if (submitBtn) submitBtn.disabled = true;
        feedback.textContent = 'Enviando...';
        feedback.className = 'footer-newsletter__feedback';

        try {
          const res = await fetch(`${basePath}send-mail.php`, {
            method: 'POST',
            body: formData,
          });
          const data = await res.json();
          if (res.ok && data.success) {
            feedback.textContent = '¡Gracias por suscribirte! Te mantendremos informado.';
            feedback.className = 'footer-newsletter__feedback is-success';
            form.reset();
          } else {
            throw new Error(data.message || 'Error al enviar.');
          }
        } catch (err) {
          feedback.textContent = err.message || 'No se pudo completar la suscripción.';
          feedback.className = 'footer-newsletter__feedback is-error';
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }
  }

  function prefixRelativePaths(root, basePath) {
    if (!root || !basePath) return;
    const isLangFolder = Boolean(document.body.dataset.lang && document.body.dataset.lang !== 'ES');

    root.querySelectorAll('[href], [src]').forEach((el) => {
      ['href', 'src'].forEach((attr) => {
        const val = el.getAttribute(attr);
        if (
          !val ||
          val.startsWith('http://') ||
          val.startsWith('https://') ||
          val.startsWith('#') ||
          val.startsWith('mailto:') ||
          val.startsWith('tel:') ||
          val.startsWith('data:') ||
          val.startsWith('/') ||
          val.startsWith('../')
        ) {
          return;
        }
        // Dentro de /cat, /en, /fr, /zh, /ru los enlaces .html se quedan en la carpeta de idioma actual
        if (isLangFolder && attr === 'href' && val.endsWith('.html')) {
          return;
        }
        el.setAttribute(attr, `${basePath}${val}`);
      });
    });
  }

  async function bootComponents() {
    const basePath = document.body.dataset.basePath || '';
    const [headerRoot, footerRoot] = await Promise.all([
      loadComponent('header-placeholder', `${basePath}components/header.html`),
      loadComponent('footer-placeholder', `${basePath}components/footer.html`),
    ]);

    prefixRelativePaths(headerRoot, basePath);
    prefixRelativePaths(footerRoot, basePath);

    initHeader(headerRoot);
    initFooter(footerRoot);
    document.dispatchEvent(new CustomEvent('components:loaded'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootComponents);
  } else {
    bootComponents();
  }
})();

