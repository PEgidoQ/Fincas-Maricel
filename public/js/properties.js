/**
 * Constructor y renderizador de propiedades para:
 * - Inicio (carrusel #featured-properties-track)
 * - Compre y Alquile (catálogo #properties-catalog-grid con buscador por referencia y filtros)
 */
(function () {
  function getBasePath() {
    return document.body?.dataset?.basePath || '';
  }

  function getFallbackImage() {
    return `${getBasePath()}assets/opt/fachada1.webp`;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function tr(key, fallback) {
    return window.FincasI18n ? window.FincasI18n.t(key) : fallback;
  }

  function getPropLocalized(item) {
    if (window.FincasI18n) return window.FincasI18n.getPropertyText(item);
    return { title: item.title || '', description: item.description || '' };
  }

  function createCardMarkup(item) {
    const ref = item.reference || item.id || '';
    const basePath = getBasePath();
    const fallbackImg = getFallbackImage();
    const detailUrl = item.url ? `${basePath}${item.url}` : `${basePath}propiedad.html?ref=${encodeURIComponent(ref)}`;
    const { title } = getPropLocalized(item);
    const primaryImage = item.image || (item.images && item.images[0]) || fallbackImg;
    const totalDots = Math.min((item.images && item.images.length) || 1, 5);
    const areaText = item.area ? `${item.area} m²` : item.usefulArea ? `${item.usefulArea} m²` : '—';
    const zoneLabel = item.location?.zone || item.location?.city || '';
    const footerLabel = [item.type, zoneLabel].filter(Boolean).join(' · ');

    const dotsMarkup =
      totalDots > 1
        ? `<div class="property-card__dots" aria-hidden="true">
            ${Array.from({ length: totalDots }, (_, i) => `<span class="property-card__dot${i === 0 ? ' is-active' : ''}"></span>`).join('')}
          </div>`
        : '';

    return `
      <article class="property-card" data-ref="${escapeHtml(ref)}">
        <a href="${detailUrl}" class="property-card__media" aria-label="${escapeHtml(title)}">
          <img
            src="${escapeHtml(primaryImage)}"
            alt="${escapeHtml(title)}"
            class="property-card__img"
            loading="lazy"
            decoding="async"
            onerror="this.onerror=null;this.src='${fallbackImg}';"
          />
          ${dotsMarkup}
        </a>

        <div class="property-card__body">
          <h3 class="property-card__title">
            <a href="${detailUrl}">${escapeHtml(title)}</a>
          </h3>
          <p class="property-card__ref"><strong>${escapeHtml(tr('card_ref', 'Referencia:'))}</strong> ${escapeHtml(ref)}</p>
          <p class="property-card__price">${escapeHtml(item.priceFormatted || 'Consultar')}</p>

          <div class="property-card__specs">
            <span class="property-card__spec" title="Habitaciones">
              <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                <path fill="currentColor" d="M7 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9a4 4 0 0 0-4-4z" />
              </svg>
              <span>${item.bedrooms || 0} hab.</span>
            </span>
            <span class="property-card__spec" title="Baños">
              <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                <path fill="currentColor" d="M7 7a2 2 0 1 1 4 0v1H7V7zm13 5H4V6a3 3 0 0 1 6 0h2a5 5 0 0 0-10 0v6H1v2h1v3a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-3h1v-2h-3z" />
              </svg>
              <span>${item.bathrooms || 0} ${escapeHtml((item.bathrooms || 0) === 1 ? tr('bath_one', 'baño') : tr('bath_many', 'baños'))}</span>
            </span>
            <span class="property-card__spec" title="Superficie construida">
              <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                <path fill="currentColor" d="M3 3h18v18H3V3zm2 2v14h14V5H5zm2 2h3v2H7V7zm0 4h5v2H7v-2z" />
              </svg>
              <span>${escapeHtml(areaText)}</span>
            </span>
          </div>

          <div class="property-card__footer">${escapeHtml(footerLabel || item.type || '')}</div>
        </div>
      </article>
    `;
  }

  function createListCardMarkup(item) {
    const ref = item.reference || item.id || '';
    const basePath = getBasePath();
    const fallbackImg = getFallbackImage();
    const detailUrl = item.url ? `${basePath}${item.url}` : `${basePath}propiedad.html?ref=${encodeURIComponent(ref)}`;
    const { title, description } = getPropLocalized(item);
    const primaryImage = item.image || (item.images && item.images[0]) || fallbackImg;
    const totalDots = Math.min((item.images && item.images.length) || 1, 5);
    const areaText = item.area ? `${item.area} m²` : item.usefulArea ? `${item.usefulArea} m²` : '—';
    const beds = item.bedrooms || 0;
    const baths = item.bathrooms || 0;
    const bedsLabel = beds === 1 ? tr('bed_one', 'Habitación') : tr('bed_many', 'Habitaciones');
    const bathsLabel = baths === 1 ? tr('bath_one', 'baño') : tr('bath_many', 'baños');
    const excerpt = (description || '').replace(/\s+/g, ' ').trim();

    const dotsMarkup =
      totalDots > 1
        ? `<div class="property-card__dots" aria-hidden="true">
            ${Array.from({ length: totalDots }, (_, i) => `<span class="property-card__dot${i === 0 ? ' is-active' : ''}"></span>`).join('')}
          </div>`
        : '';

    return `
      <article class="property-list-card" data-ref="${escapeHtml(ref)}">
        <a href="${detailUrl}" class="property-list-card__media" aria-label="${escapeHtml(title)}">
          <img
            src="${escapeHtml(primaryImage)}"
            alt="${escapeHtml(title)}"
            class="property-card__img"
            loading="lazy"
            decoding="async"
            onerror="this.onerror=null;this.src='${fallbackImg}';"
          />
          ${dotsMarkup}
        </a>

        <div class="property-list-card__body">
          <div class="property-list-card__top">
            <h3 class="property-list-card__title">
              <a href="${detailUrl}">${escapeHtml(title)}</a>
            </h3>
            <p class="property-list-card__price">${escapeHtml(item.priceFormatted || 'Consultar')}</p>
          </div>

          <p class="property-list-card__ref"><strong>${escapeHtml(tr('card_ref', 'Referencia:'))}</strong> ${escapeHtml(ref)}</p>

          <p class="property-list-card__excerpt">${escapeHtml(excerpt)}</p>

          <div class="property-list-card__specs">
            <span class="property-list-card__spec">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path fill="currentColor" d="M7 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9a4 4 0 0 0-4-4z" />
              </svg>
              <span><strong>${beds}</strong> ${escapeHtml(bedsLabel)}</span>
            </span>
            <span class="property-list-card__spec">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path fill="currentColor" d="M7 7a2 2 0 1 1 4 0v1H7V7zm13 5H4V6a3 3 0 0 1 6 0h2a5 5 0 0 0-10 0v6H1v2h1v3a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-3h1v-2h-3z" />
              </svg>
              <span><strong>${baths}</strong> ${escapeHtml(bathsLabel)}</span>
            </span>
            <span class="property-list-card__spec">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path fill="currentColor" d="M3 3h18v18H3V3zm2 2v14h14V5H5zm2 2h3v2H7V7zm0 4h5v2H7v-2z" />
              </svg>
              <span><strong>${escapeHtml(areaText)}</strong></span>
            </span>
          </div>

          <div class="property-list-card__footer">${escapeHtml(item.type || '')}</div>
        </div>
      </article>
    `;
  }

  // ==========================================================================
  // 1) CARRUSEL DE DESTACADOS EN INICIO
  // ==========================================================================

  function initHomeCarousel(properties) {
    const track = document.getElementById('featured-properties-track');
    if (!track) return;

    const prevBtn = document.getElementById('properties-prev');
    const nextBtn = document.getElementById('properties-next');

    let items = Array.isArray(properties) ? properties : [];
    let currentIndex = 0;

    function getVisibleCount() {
      if (window.innerWidth <= 768) return 1;
      if (window.innerWidth <= 960) return 2;
      return 3;
    }

    function renderSlice() {
      if (!items.length) {
        track.innerHTML =
          '<p class="catalog-empty">No hay propiedades sincronizadas todavía. Ejecuta <code>npm run sync</code> para importar el feed XML de Inmoweb.</p>';
        return;
      }

      const visibleCount = Math.min(getVisibleCount(), items.length);
      const visible = [];
      for (let i = 0; i < visibleCount; i += 1) {
        visible.push(items[(currentIndex + i) % items.length]);
      }
      track.innerHTML = visible.map(createCardMarkup).join('');
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (!items.length) return;
        currentIndex = (currentIndex - 1 + items.length) % items.length;
        renderSlice();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (!items.length) return;
        currentIndex = (currentIndex + 1) % items.length;
        renderSlice();
      });
    }

    window.addEventListener('resize', renderSlice);
    document.addEventListener('language:changed', renderSlice);
    renderSlice();

    window.FincasProperties = {
      render(nextList) {
        items = Array.isArray(nextList) ? nextList : [];
        currentIndex = 0;
        renderSlice();
      },
    };
  }

  // ==========================================================================
  // 2) CATÁLOGO COMPLETO CON BUSCADOR DE REFERENCIA Y FILTROS (COMPRE / ALQUILE)
  // ==========================================================================

  function initCatalogPage() {
    const grid = document.getElementById('properties-catalog-grid');
    if (!grid || !window.PropertiesStore) return;

    const operation = grid.dataset.operation || '';
    const opKey = operation === 'alquiler' ? 'op_alquiler' : 'op_venta';
    const opHeading = tr(opKey, operation === 'alquiler' ? 'ALQUILER' : 'COMPRA');
    const { types, zones } = window.PropertiesStore.getFacets(operation);
    let viewMode = 'list'; // Vista horizontal por defecto (1:1 con referencia)

    // Inyectar barra de búsqueda por ubicación o referencia y filtros
    const filtersEl = document.createElement('div');
    filtersEl.className = 'catalog-filters';
    filtersEl.innerHTML = `
      <form class="catalog-filters__form" id="catalog-filters-form" autocomplete="off">
        <div class="catalog-filters__row catalog-filters__row--5">
          <div class="catalog-filters__group">
            <label for="filter-ref" data-i18n="filter_loc_ref">${escapeHtml(tr('filter_loc_ref', 'Ubicación o referencia'))}</label>
            <input type="search" id="filter-ref" data-i18n-placeholder="filter_loc_ref_ph" placeholder="${escapeHtml(tr('filter_loc_ref_ph', 'Ej. Sitges, Vinyet, ATC2553-3...'))}" />
          </div>

          <div class="catalog-filters__group">
            <label for="filter-type" data-i18n="filter_type">${escapeHtml(tr('filter_type', 'Tipo de inmueble'))}</label>
            <select id="filter-type">
              <option value="" data-i18n="filter_all_types">${escapeHtml(tr('filter_all_types', 'Todos los tipos'))}</option>
              ${types.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')}
            </select>
          </div>

          <div class="catalog-filters__group">
            <label for="filter-zone" data-i18n="filter_zone">${escapeHtml(tr('filter_zone', 'Zona'))}</label>
            <select id="filter-zone">
              <option value="" data-i18n="filter_all_zones">${escapeHtml(tr('filter_all_zones', 'Todas las zonas'))}</option>
              ${zones.map((z) => `<option value="${escapeHtml(z)}">${escapeHtml(z)}</option>`).join('')}
            </select>
          </div>

          <div class="catalog-filters__group">
            <label for="filter-bedrooms" data-i18n="filter_bedrooms">${escapeHtml(tr('filter_bedrooms', 'Habitaciones'))}</label>
            <select id="filter-bedrooms">
              <option value="0" data-i18n="filter_any">${escapeHtml(tr('filter_any', 'Cualquiera'))}</option>
              <option value="1">1+</option>
              <option value="2">2+</option>
              <option value="3">3+</option>
              <option value="4">4+</option>
            </select>
          </div>

          <div class="catalog-filters__group">
            <label for="filter-max-price" data-i18n="filter_max_price">${escapeHtml(tr('filter_max_price', 'Precio máx. (€)'))}</label>
            <input type="number" id="filter-max-price" min="0" step="10000" data-i18n-placeholder="filter_no_limit" placeholder="${escapeHtml(tr('filter_no_limit', 'Sin límite'))}" />
          </div>
        </div>

        <div class="catalog-filters__bottom">
          <div class="catalog-filters__checks">
            <label><input type="checkbox" data-feat="vistasAlMar" /> <span data-i18n="feat_sea">${escapeHtml(tr('feat_sea', 'Vistas al mar'))}</span></label>
            <label><input type="checkbox" data-feat="piscina" /> <span data-i18n="feat_pool">${escapeHtml(tr('feat_pool', 'Piscina'))}</span></label>
            <label><input type="checkbox" data-feat="terraza" /> <span data-i18n="feat_terrace">${escapeHtml(tr('feat_terrace', 'Terraza'))}</span></label>
            <label><input type="checkbox" data-feat="parking" /> <span data-i18n="feat_parking">${escapeHtml(tr('feat_parking', 'Parking'))}</span></label>
            <label><input type="checkbox" data-feat="ascensor" /> <span data-i18n="feat_elevator">${escapeHtml(tr('feat_elevator', 'Ascensor'))}</span></label>
          </div>

          <button type="button" class="catalog-filters__reset" id="catalog-reset" data-i18n="filter_reset">${escapeHtml(tr('filter_reset', 'Limpiar filtros'))}</button>
        </div>
      </form>
    `;

    // Barra superior de resultados + ordenar + selector vista lista/grid (1:1 captura)
    const toolbarEl = document.createElement('div');
    toolbarEl.className = 'catalog-toolbar';
    toolbarEl.innerHTML = `
      <div class="catalog-toolbar__left">
        <span class="catalog-toolbar__op" data-i18n="${opKey}">${escapeHtml(opHeading)}</span>
        <span class="catalog-toolbar__count" id="catalog-count"></span>
      </div>

      <div class="catalog-toolbar__right">
        <label for="filter-sort" class="catalog-toolbar__sort-label" data-i18n="sort_label">${escapeHtml(tr('sort_label', 'Ordenar por'))}</label>
        <select id="filter-sort" class="catalog-toolbar__sort">
          <option value="newest" selected data-i18n="sort_newest">${escapeHtml(tr('sort_newest', 'El más nuevo'))}</option>
          <option value="price_asc" data-i18n="sort_price_asc">${escapeHtml(tr('sort_price_asc', 'Precio: menor a mayor'))}</option>
          <option value="price_desc" data-i18n="sort_price_desc">${escapeHtml(tr('sort_price_desc', 'Precio: mayor a menor'))}</option>
          <option value="area_desc" data-i18n="sort_area_desc">${escapeHtml(tr('sort_area_desc', 'Mayor superficie'))}</option>
          <option value="featured" data-i18n="sort_featured">${escapeHtml(tr('sort_featured', 'Destacados'))}</option>
        </select>

        <div class="catalog-toolbar__views" role="group" aria-label="Cambiar vista">
          <button type="button" class="catalog-view-btn" data-view="grid" title="Vista cuadrícula" aria-label="Vista cuadrícula">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path fill="none" stroke="currentColor" stroke-width="1.8" d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
            </svg>
          </button>
          <button type="button" class="catalog-view-btn is-active" data-view="list" title="Vista lista" aria-label="Vista lista">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    `;

    grid.parentNode.insertBefore(filtersEl, grid);
    grid.parentNode.insertBefore(toolbarEl, grid);

    const refInput = filtersEl.querySelector('#filter-ref');
    const typeSelect = filtersEl.querySelector('#filter-type');
    const zoneSelect = filtersEl.querySelector('#filter-zone');
    const bedSelect = filtersEl.querySelector('#filter-bedrooms');
    const maxPriceInput = filtersEl.querySelector('#filter-max-price');
    const checkInputs = filtersEl.querySelectorAll('[data-feat]');
    const resetBtn = filtersEl.querySelector('#catalog-reset');

    const sortSelect = toolbarEl.querySelector('#filter-sort');
    const countEl = toolbarEl.querySelector('#catalog-count');
    const viewBtns = toolbarEl.querySelectorAll('.catalog-view-btn');

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('ref')) {
      refInput.value = urlParams.get('ref');
    }

    function applyFilters() {
      const features = {};
      checkInputs.forEach((cb) => {
        if (cb.checked) features[cb.dataset.feat] = true;
      });

      const results = window.PropertiesStore.filter({
        operation,
        reference: refInput.value,
        type: typeSelect.value,
        zone: zoneSelect.value,
        minBedrooms: Number(bedSelect.value || 0),
        maxPrice: Number(maxPriceInput.value || 0),
        features,
        sort: sortSelect.value,
      });

      if (countEl) {
        const resWord = results.length === 1 ? tr('results_one', 'resultado') : tr('results_many', 'resultados');
        countEl.textContent = `${results.length} ${resWord}`;
      }

      grid.className = viewMode === 'list' ? 'catalog-list' : 'catalog-grid';

      if (!results.length) {
        grid.innerHTML = `<p class="catalog-empty">${escapeHtml(tr('no_results', 'No se encontraron propiedades con los filtros seleccionados.'))}</p>`;
        return;
      }

      grid.innerHTML = results
        .map(viewMode === 'list' ? createListCardMarkup : createCardMarkup)
        .join('');
    }

    viewBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        viewMode = btn.dataset.view || 'list';
        viewBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
        applyFilters();
      });
    });

    [refInput, maxPriceInput].forEach((el) => el.addEventListener('input', applyFilters));
    [typeSelect, zoneSelect, bedSelect, sortSelect].forEach((el) =>
      el.addEventListener('change', applyFilters)
    );
    checkInputs.forEach((cb) => cb.addEventListener('change', applyFilters));

    resetBtn.addEventListener('click', () => {
      refInput.value = '';
      typeSelect.value = '';
      zoneSelect.value = '';
      bedSelect.value = '0';
      maxPriceInput.value = '';
      sortSelect.value = 'newest';
      checkInputs.forEach((cb) => {
        cb.checked = false;
      });
      applyFilters();
    });

    document.addEventListener('language:changed', applyFilters);
    applyFilters();
  }

  // ==========================================================================
  // Arranque automático
  // ==========================================================================

  async function boot() {
    if (!window.PropertiesStore) return;

    if (document.getElementById('featured-properties-track')) {
      const featured = await window.PropertiesStore.loadFeatured();
      initHomeCarousel(featured);
    }

    if (document.getElementById('properties-catalog-grid')) {
      await window.PropertiesStore.load();
      initCatalogPage();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
