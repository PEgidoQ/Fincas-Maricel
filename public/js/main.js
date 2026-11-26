/**
 * Interacciones globales de la página de inicio:
 * - Botón flotante de volver arriba
 * - Barra de consentimiento de cookies
 */
(function () {
  function initScrollTop() {
    const btn = document.getElementById('scroll-top-btn');
    if (!btn) return;

    const toggleVisibility = () => {
      btn.classList.toggle('is-visible', window.scrollY > 360);
    };

    window.addEventListener('scroll', toggleVisibility, { passive: true });
    toggleVisibility();

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function initCookieBar() {
    const bar = document.getElementById('cookie-bar');
    if (!bar) return;

    const STORAGE_KEY = 'fincas_maricel_cookie_consent';
    if (localStorage.getItem(STORAGE_KEY)) {
      bar.hidden = true;
      return;
    }

    bar.querySelectorAll('[data-cookie-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.cookieAction;
        if (action === 'accept' || action === 'reject') {
          localStorage.setItem(STORAGE_KEY, action);
        }
        bar.hidden = true;
      });
    });
  }

  function initDeferredHeroVideo() {
    const video = document.getElementById('hero-video');
    if (!video || !video.dataset.src) return;

    // En móvil o ahorro de datos mantenemos el póster WebP ultraligero para máximo rendimiento
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn && conn.saveData) return;
    if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) return;

    let loaded = false;
    const loadVideo = () => {
      if (loaded) return;
      loaded = true;
      video.src = video.dataset.src;
      video.addEventListener(
        'canplay',
        () => {
          video.classList.add('is-ready');
        },
        { once: true }
      );
      video.load();
    };

    // Cargar vídeo en escritorio al primer gesto del usuario o tras 3.5s en reposo (sin penalizar LCP/Speed Index)
    ['pointermove', 'scroll', 'keydown'].forEach((evt) => {
      window.addEventListener(evt, loadVideo, { once: true, passive: true });
    });
    window.addEventListener('load', () => setTimeout(loadVideo, 3500), { once: true });
  }

  function init() {
    initScrollTop();
    initCookieBar();
    initDeferredHeroVideo();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

