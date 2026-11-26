/**
 * PropertiesStore — Lectura, caché en memoria y filtrado de propiedades desde data/properties.json
 */
(function () {
  function getDataUrl() {
    const basePath = document.body?.dataset?.basePath || '';
    return `${basePath}data/properties.json`;
  }

  let cache = null;
  let loadPromise = null;

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  async function load(forceRefresh = false) {
    if (cache && !forceRefresh) return cache;
    if (loadPromise && !forceRefresh) return loadPromise;

    loadPromise = fetch(`${getDataUrl()}?v=${Date.now()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        cache = {
          lastSync: data.lastSync || null,
          total: data.total || 0,
          counts: data.counts || { venta: 0, alquiler: 0, featured: 0 },
          properties: Array.isArray(data.properties) ? data.properties : [],
        };
        return cache;
      })
      .catch((err) => {
        console.warn('[PropertiesStore] No se pudo cargar data/properties.json:', err.message);
        cache = {
          lastSync: null,
          total: 0,
          counts: { venta: 0, alquiler: 0, featured: 0 },
          properties: [],
        };
        return cache;
      })
      .finally(() => {
        loadPromise = null;
      });

    return loadPromise;
  }

  function getAll() {
    return cache ? cache.properties : [];
  }

  function getFeatured(limit = 9) {
    const all = getAll();
    const featured = all.filter((p) => p.featured);
    const pool = featured.length ? featured : all;
    return limit ? pool.slice(0, limit) : pool;
  }

  function getByIdOrRef(refOrId) {
    const target = normalizeText(refOrId);
    if (!target) return null;
    return (
      getAll().find(
        (p) => normalizeText(p.reference) === target || normalizeText(p.id) === target
      ) || null
    );
  }

  function getFacets(operationKey) {
    const list = operationKey
      ? getAll().filter((p) => p.operationKey === operationKey)
      : getAll();

    const types = Array.from(new Set(list.map((p) => p.type).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'es')
    );
    const zones = Array.from(
      new Set(list.map((p) => p.location?.zone || p.location?.city).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, 'es'));

    return { types, zones };
  }

  function parseEsDate(dateStr) {
    if (!dateStr) return 0;
    const m = /(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(dateStr);
    if (!m) return Date.parse(dateStr) || 0;
    const [, dd, mm, yyyy, hh = '00', min = '00'] = m;
    return new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00Z`).getTime() || 0;
  }

  function sortNewestFirst(a, b) {
    const idDiff = (Number(b.id) || 0) - (Number(a.id) || 0);
    if (idDiff !== 0) return idDiff;
    return parseEsDate(b.updatedAt) - parseEsDate(a.updatedAt);
  }

  function filter(criteria = {}) {
    const {
      operation = '',
      reference = '',
      type = '',
      zone = '',
      minBedrooms = 0,
      maxPrice = 0,
      features = {},
      sort = 'newest',
    } = criteria;

    const searchTerms = normalizeText(reference)
      .split(/\s+/)
      .filter(Boolean);
    const typeNeedle = normalizeText(type);
    const zoneNeedle = normalizeText(zone);

    let list = getAll().filter((p) => {
      if (operation && p.operationKey !== operation) return false;

      if (searchTerms.length) {
        const haystack = normalizeText(
          [
            p.reference,
            p.id,
            p.location?.zone,
            p.location?.city,
            p.location?.province,
            p.location?.postalCode,
            p.location?.address,
          ].join(' ')
        );
        if (!searchTerms.every((term) => haystack.includes(term))) {
          return false;
        }
      }

      if (typeNeedle && normalizeText(p.type) !== typeNeedle) return false;

      if (zoneNeedle) {
        const pZone = normalizeText(p.location?.zone || p.location?.city);
        if (pZone !== zoneNeedle) return false;
      }

      if (minBedrooms > 0 && (p.bedrooms || 0) < minBedrooms) return false;
      if (maxPrice > 0 && p.price > 0 && p.price > maxPrice) return false;

      for (const [featKey, required] of Object.entries(features || {})) {
        if (required && !p.features?.[featKey]) return false;
      }

      return true;
    });

    list = [...list];
    switch (sort) {
      case 'price_asc':
        list.sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
        break;
      case 'price_desc':
        list.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case 'area_desc':
        list.sort((a, b) => (b.area || 0) - (a.area || 0));
        break;
      case 'featured':
        list.sort((a, b) => {
          if (a.featured !== b.featured) return a.featured ? -1 : 1;
          return sortNewestFirst(a, b);
        });
        break;
      case 'newest':
      case 'recent':
      default:
        list.sort(sortNewestFirst);
        break;
    }

    return list;
  }

  function getFeaturedUrl() {
    const basePath = document.body?.dataset?.basePath || '';
    return `${basePath}data/featured.json`;
  }

  let featuredCache = null;

  async function loadFeatured() {
    if (featuredCache) return featuredCache;
    try {
      const res = await fetch(getFeaturedUrl());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      featuredCache = Array.isArray(data.properties) ? data.properties : [];
      return featuredCache;
    } catch {
      await load();
      featuredCache = getFeatured(12);
      return featuredCache;
    }
  }

  window.PropertiesStore = {
    load,
    loadFeatured,
    getAll,
    getFeatured,
    getByIdOrRef,
    getFacets,
    filter,
  };
})();

