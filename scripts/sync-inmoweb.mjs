#!/usr/bin/env node
/**
 * Sincronizador XML de Inmoweb → public/data/properties.json + páginas estáticas en public/propiedades/*.html
 *
 * - Lee el feed XML de Inmoweb (URL por defecto o env INMOWEB_FEED_URL, o archivo local con --file).
 * - NO descarga imágenes: conserva los enlaces directos ordenando la imagen principal primero.
 * - Actualiza public/data/properties.json de forma incremental y elimina bajas.
 * - Genera y actualiza automáticamente una página HTML por cada propiedad en public/propiedades/<slug>.html
 *   y elimina las páginas de inmuebles que ya no estén en el XML.
 * - Actualiza public/sitemap.xml.
 *
 * Uso:
 *   node scripts/sync-inmoweb.mjs
 *   node scripts/sync-inmoweb.mjs --file ./ruta/feed.xml
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const OUTPUT_PATH = path.join(PUBLIC_DIR, 'data', 'properties.json');
const FEATURED_OUTPUT_PATH = path.join(PUBLIC_DIR, 'data', 'featured.json');
const PAGES_DIR = path.join(PUBLIC_DIR, 'propiedades');
const SITEMAP_PATH = path.join(PUBLIC_DIR, 'sitemap.xml');

const DEFAULT_FEED_URL =
  'https://feed.inmoweb.es/?key=6037F691FBEBDCFBE371679D7EC26864B3E625FC';

// ============================================================================
// Utilidades ligeras de parseo XML y HTML
// ============================================================================

function decodeXmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .trim();
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

function parseAttributes(attrString) {
  const attrs = {};
  if (!attrString) return attrs;
  const regex = /([a-zA-Z0-9_:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = regex.exec(attrString)) !== null) {
    attrs[match[1]] = decodeXmlEntities(match[2] ?? match[3] ?? '');
  }
  return attrs;
}

function getTagBlock(xml, tagName) {
  const regex = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = regex.exec(xml);
  return match ? match[1] : '';
}

function getTagText(xml, tagName) {
  return decodeXmlEntities(getTagBlock(xml, tagName));
}

function getAllTags(xml, tagName) {
  const results = [];
  const regex = new RegExp(
    `<${tagName}(?:\\s([^>]*?))?\\s*(?:\\/>|>([\\s\\S]*?)<\\/${tagName}>)`,
    'gi'
  );
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const rawAttr = (match[1] || '').replace(/\/$/, '');
    results.push({
      attrs: parseAttributes(rawAttr),
      content: decodeXmlEntities(match[2] || ''),
      rawContent: match[2] || '',
    });
  }
  return results;
}

function parseDescriptions(descBlock) {
  const translations = {};
  if (!descBlock) return translations;

  const parts = descBlock.split(/(?=<descripcion\s+idioma=)/i);
  for (const part of parts) {
    const headerMatch = /<descripcion\s+idioma=["']([^"']+)["'][^>]*>([\s\S]*)/i.exec(part);
    if (!headerMatch) continue;
    const lang = headerMatch[1].toLowerCase().trim();
    const inner = headerMatch[2];
    const title = getTagText(inner, 'titulo');
    const description = getTagText(inner, 'descripcion');
    translations[lang] = { title, description };
  }
  return translations;
}

function parseEsDateToTimestamp(dateStr) {
  if (!dateStr) return 0;
  const m = /(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(dateStr);
  if (!m) return Date.parse(dateStr) || 0;
  const [, dd, mm, yyyy, hh = '00', min = '00'] = m;
  return new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00Z`).getTime() || 0;
}

function parseNumber(value) {
  if (value === undefined || value === null) return 0;
  const cleaned = String(value).replace(/[^\d.,-]/g, '').replace(',', '.');
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function formatPrice(price, operationKey) {
  if (!price || price <= 0) return 'Consultar';
  const formatted = new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: 0,
  }).format(Math.round(price));
  return operationKey === 'alquiler' ? `${formatted} €/mes` : `${formatted} €`;
}

function normalizeOperation(raw) {
  const lower = (raw || '').toLowerCase();
  if (lower.includes('alquil') || lower.includes('rent') || lower.includes('traspaso')) {
    return 'alquiler';
  }
  return 'venta';
}

// ============================================================================
// Transformación de cada <propiedad> de Inmoweb
// ============================================================================

function parsePropertyNode(propNode) {
  const xml = propNode.rawContent;
  const reference = getTagText(xml, 'referencia');
  const id = propNode.attrs.id || reference;
  if (!id) return null;

  const updatedAt = getTagText(xml, 'fecha_modificacion');
  const operation = getTagText(xml, 'operacion') || 'Venta';
  const operationKey = normalizeOperation(operation);
  const type = getTagText(xml, 'familia') || 'Inmueble';

  const price = parseNumber(getTagText(xml, 'precio'));
  const bedrooms = Math.round(parseNumber(getTagText(xml, 'dormitorios')));
  const bathrooms = Math.round(parseNumber(getTagText(xml, 'banos')));

  const supBlock = getTagBlock(xml, 'superficies');
  const area = Math.round(parseNumber(getTagText(supBlock, 'construida')));
  const usefulArea = Math.round(parseNumber(getTagText(supBlock, 'habitable')));
  const lotSize = Math.round(parseNumber(getTagText(supBlock, 'parcela')));

  const locBlock = getTagBlock(xml, 'localizacion');
  const zone = getTagText(locBlock, 'zona');
  const city = getTagText(locBlock, 'poblacion');
  const postalCode = getTagText(locBlock, 'cp');
  const province = getTagText(locBlock, 'provincia');
  const country = getTagText(locBlock, 'pais');
  const address = [zone, city, postalCode, province, country].filter(Boolean).join(', ');

  const descBlock = getTagBlock(xml, 'descripciones');
  const translations = parseDescriptions(descBlock);
  const primaryDesc = translations.es || Object.values(translations)[0] || { title: '', description: '' };
  const title = primaryDesc.title || `${type}${zone ? ` en ${zone}` : ''}` || reference;
  const description = primaryDesc.description || '';

  const carBlock = getTagBlock(xml, 'caracteristicas');
  const carNodes = getAllTags(carBlock, 'caracteristica');
  const carMap = new Map();
  for (const c of carNodes) {
    if (c.attrs.id) {
      carMap.set(c.attrs.id, c.content);
    }
  }

  const getSwitch = (key) => carMap.get(key) === '1';
  const vistasTxt = (carMap.get('vistas') || '').toLowerCase();
  const vistasAlMar = carMap.get('primera_linea') === '1' || vistasTxt.includes('mar');

  const features = {
    parking: getSwitch('parking'),
    ascensor: getSwitch('ascensor'),
    piscina: getSwitch('piscina'),
    balcon: getSwitch('balcon'),
    terraza: getSwitch('terraza'),
    vistasAlMar,
  };

  const yearBuilt = carMap.get('ano_construccion') || '';
  const yearRemodeled = carMap.get('ano_reforma') || '';

  const tagsBlock = getTagBlock(xml, 'etiquetas');
  const tags = getAllTags(tagsBlock, 'etiqueta')
    .map((t) => t.content)
    .filter(Boolean);
  const lowerTags = tags.map((t) => t.toLowerCase());
  const featured = lowerTags.includes('disponible') || lowerTags.includes('oferta');

  const imgBlock = getTagBlock(xml, 'imagenes');
  const imgNodes = getAllTags(imgBlock, 'imagen');
  const principalUrls = [];
  const secondaryUrls = [];

  for (const img of imgNodes) {
    const url = (img.attrs.url || img.content || '').trim();
    if (!url) continue;
    if (img.attrs.principal === '1') {
      principalUrls.push(url);
    } else {
      secondaryUrls.push(url);
    }
  }
  const images = Array.from(new Set([...principalUrls, ...secondaryUrls]));

  const refSlug = slugify(reference || id);
  const titleSlug = slugify(title).slice(0, 50);
  const slug = titleSlug ? `${refSlug}-${titleSlug}` : refSlug;

  return {
    id,
    reference: reference || id,
    slug,
    url: `propiedades/${slug}.html`,
    updatedAt,
    operation,
    operationKey,
    type,
    title,
    description,
    translations,
    price,
    priceFormatted: formatPrice(price, operationKey),
    bedrooms,
    bathrooms,
    area,
    usefulArea,
    lotSize,
    yearBuilt,
    yearRemodeled,
    location: {
      zone,
      city,
      postalCode,
      province,
      country,
      address,
    },
    features,
    tags,
    featured,
    images,
    image: images[0] || '',
  };
}

// ============================================================================
// Generador de páginas HTML estáticas individuales (1:1 con referencia)
// ============================================================================

function formatDescriptionParagraphs(text) {
  if (!text) {
    return '<p>Consulte con nuestro equipo para más información sobre este inmueble.</p>';
  }
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br />')}</p>`)
    .join('\n');
}

function buildPropertyPageHtml(prop, prevProp, nextProp) {
  const images = prop.images && prop.images.length ? prop.images : ['../assets/opt/fachada1.webp'];
  const backUrl = prop.operationKey === 'alquiler' ? '../alquile.html' : '../compre.html';
  const navPage = prop.operationKey === 'alquiler' ? 'alquile' : 'compre';
  const beds = prop.bedrooms || 0;
  const baths = prop.bathrooms || 0;
  const bedsLabel = beds === 1 ? 'Habitación' : 'Habitaciones';
  const bathsLabel = baths === 1 ? 'baño' : 'baños';
  const areaText = prop.area ? `${prop.area} m²` : prop.usefulArea ? `${prop.usefulArea} m²` : '—';
  const metaDesc = (prop.description || `${prop.title} en ${prop.location.city || 'Sitges'}`)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 155);

  const essentials = [
    prop.updatedAt ? ['single_updated', 'Actualizado', prop.updatedAt, null] : null,
    ['single_type', 'Tipo', prop.type, null],
    [
      'single_status',
      'Estado',
      prop.operation,
      prop.operationKey === 'alquiler' ? 'single_status_alquiler' : 'single_status_venta',
    ],
    beds ? ['single_bedrooms', 'Dormitorios', beds, null] : null,
    baths ? ['single_bathrooms', 'Baños', baths, null] : null,
    prop.area ? ['single_area', 'Sup. Construida', `${prop.area} m²`, null] : null,
    prop.yearBuilt ? ['single_year_built', 'Año de construcción', prop.yearBuilt, null] : null,
    ['single_reference', 'Referencia', prop.reference, null],
    prop.usefulArea ? ['single_useful_area', 'Sup. Útil', `${prop.usefulArea} m²`, null] : null,
    prop.lotSize ? ['single_lot_size', 'Sup. Parcela', `${prop.lotSize} m²`, null] : null,
  ].filter(Boolean);

  const featureTags = [
    ['vistasAlMar', 'feat_sea', 'Vistas al mar'],
    ['piscina', 'feat_pool', 'Piscina'],
    ['terraza', 'feat_terrace', 'Terraza'],
    ['balcon', 'feat_balcony', 'Balcón'],
    ['parking', 'feat_parking', 'Parking'],
    ['ascensor', 'feat_elevator', 'Ascensor'],
  ].filter(([k]) => prop.features && prop.features[k]);

  const neighborhoodLabel = prop.location.zone || prop.location.city || 'Sitges';

  const baseUrl = (process.env.SITE_URL || 'https://www.fincasmaricel.com').replace(/\/$/, '');
  const canonicalUrl = `${baseUrl}/${prop.url}`;
  const listingSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'RealEstateListing',
        name: prop.title,
        description: metaDesc,
        url: canonicalUrl,
        dateModified: prop.updatedAt || undefined,
        image: images.slice(0, 6),
        offers: {
          '@type': 'Offer',
          price: prop.price || undefined,
          priceCurrency: 'EUR',
          availability: 'https://schema.org/InStock',
          businessFunction:
            prop.operationKey === 'alquiler'
              ? 'http://purl.org/goodrelations/v1#LeaseOut'
              : 'http://purl.org/goodrelations/v1#Sell',
          seller: {
            '@type': 'RealEstateAgent',
            name: 'Fincas Maricel',
            telephone: '+34 938 94 32 47',
            email: 'comercial@fincasmaricel.com',
            url: baseUrl,
          },
        },
        about: {
          '@type': 'Residence',
          name: prop.title,
          numberOfRooms: prop.bedrooms || undefined,
          numberOfBathroomsTotal: prop.bathrooms || undefined,
          floorSize: prop.area
            ? { '@type': 'QuantitativeValue', value: prop.area, unitCode: 'MTK' }
            : undefined,
          address: {
            '@type': 'PostalAddress',
            addressLocality: prop.location.city || 'Sitges',
            addressRegion: prop.location.province || 'Barcelona',
            postalCode: prop.location.postalCode || '08870',
            addressCountry: prop.location.country || 'ES',
            streetAddress: prop.location.zone || undefined,
          },
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${baseUrl}/index.html` },
          {
            '@type': 'ListItem',
            position: 2,
            name: prop.operationKey === 'alquiler' ? 'Alquiler' : 'Compra',
            item: `${baseUrl}/${prop.operationKey === 'alquiler' ? 'alquile.html' : 'compre.html'}`,
          },
          { '@type': 'ListItem', position: 3, name: prop.title, item: canonicalUrl },
        ],
      },
    ],
  };

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(prop.title)} · Ref. ${escapeHtml(prop.reference)} · Fincas Maricel</title>
    <meta name="description" content="${escapeHtml(metaDesc)}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="icon" type="image/png" href="../assets/cropped-Icon-Circle-scaled-1.png" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Fincas Maricel" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:title" content="${escapeHtml(prop.title)} · ${escapeHtml(prop.priceFormatted)}" />
    <meta property="og:description" content="${escapeHtml(metaDesc)}" />
    <meta property="og:image" content="${escapeHtml(images[0])}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(prop.title)} · ${escapeHtml(prop.priceFormatted)}" />
    <meta name="twitter:description" content="${escapeHtml(metaDesc)}" />
    <meta name="twitter:image" content="${escapeHtml(images[0])}" />
    <script type="application/ld+json">${JSON.stringify(listingSchema)}</script>

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Montserrat:wght@300;400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="../css/styles.css" />
  </head>

  <body data-page="${navPage}" data-base-path="../">
    <div id="header-placeholder"></div>

    <main id="main-content">
      <!-- Hero secundario sin texto (solo imagen) -->
      <section class="page-hero" aria-hidden="true">
        <img src="../assets/opt/hero-secondary.webp" alt="" class="page-hero__bg" fetchpriority="high" />
        <div class="page-hero__overlay"></div>
      </section>

      <article class="single-property">
        <header class="single-property__top">
          <h1 class="single-property__main-title">${escapeHtml(prop.title)}</h1>

          <div class="single-property__pager">
            ${
              prevProp
                ? `<a href="${escapeHtml(prevProp.slug)}.html" class="single-property__pager-link">
                    <span class="single-property__pager-arrow" aria-hidden="true">&lsaquo;</span>
                    <span>
                      <small data-i18n="single_prev">ANTERIOR</small>
                      <strong>${escapeHtml(prevProp.title)}</strong>
                    </span>
                  </a>`
                : '<span></span>'
            }
            ${
              nextProp
                ? `<a href="${escapeHtml(nextProp.slug)}.html" class="single-property__pager-link single-property__pager-link--next">
                    <span>
                      <small data-i18n="single_next">SIGUIENTE</small>
                      <strong>${escapeHtml(nextProp.title)}</strong>
                    </span>
                    <span class="single-property__pager-arrow" aria-hidden="true">&rsaquo;</span>
                  </a>`
                : ''
            }
          </div>

          <nav class="single-property__breadcrumb" aria-label="Migas de pan">
            <a href="${backUrl}" class="single-property__back" id="single-back-link">&lsaquo; <span data-i18n="single_back">Regresar a los resultados de la búsqueda</span></a>
            <span class="single-property__crumb-trail">
              <a href="../index.html" id="single-home-link" data-i18n="nav_home">Inicio</a> &rsaquo; <span id="single-crumb-title">${escapeHtml(prop.title)}</span>
            </span>
          </nav>
        </header>

        <!-- Galería principal + tira de miniaturas -->
        <section class="single-gallery" aria-label="Galería de fotos">
          <div class="single-gallery__stage">
            <img
              src="${escapeHtml(images[0])}"
              alt="${escapeHtml(prop.title)}"
              id="single-gallery-main"
              class="single-gallery__main"
              onerror="this.onerror=null;this.src='../assets/opt/fachada1.webp';"
            />
            ${
              images.length > 1
                ? `<button type="button" class="property-gallery__nav property-gallery__nav--prev" id="sg-prev" aria-label="Foto anterior">&#8249;</button>
                   <button type="button" class="property-gallery__nav property-gallery__nav--next" id="sg-next" aria-label="Foto siguiente">&#8250;</button>`
                : ''
            }
            <span class="single-gallery__badge" id="sg-counter">1 / ${images.length}</span>
          </div>

          ${
            images.length > 1
              ? `<div class="single-gallery__thumbs" id="sg-thumbs">
                  ${images
                    .map(
                      (url, idx) => `<button type="button" class="single-gallery__thumb${idx === 0 ? ' is-active' : ''}" data-idx="${idx}" aria-label="Ver foto ${idx + 1}">
                        <img src="${escapeHtml(url)}" alt="" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='../assets/opt/fachada1.webp';" />
                      </button>`
                    )
                    .join('')}
                </div>`
              : ''
          }
        </section>

        <!-- Cabecera de precio y características rápidas -->
        <section class="single-summary">
          <p class="single-summary__type">${escapeHtml(prop.type)}</p>
          <div class="single-summary__row">
            <h2 class="single-summary__title">${escapeHtml(prop.title)}</h2>
            <p class="single-summary__price">${escapeHtml(prop.priceFormatted)}</p>
          </div>
          <div class="single-summary__specs">
            <span><strong>${beds}</strong> <span data-i18n="${beds === 1 ? 'bed_one' : 'bed_many'}">${bedsLabel}</span></span>
            <span><strong>${baths}</strong> <span data-i18n="${baths === 1 ? 'bath_one' : 'bath_many'}">${bathsLabel}</span></span>
            <span><strong>${escapeHtml(areaText)}</strong></span>
          </div>
        </section>

        <!-- Lo esencial -->
        <section class="single-block">
          <h3 class="single-block__heading" data-i18n="single_essentials">Lo esencial</h3>
          <div class="single-essentials">
            ${essentials
              .map(
                ([i18nKey, label, val, valI18nKey]) => `<div class="single-essentials__item">
                  <span class="single-essentials__label"><span data-i18n="${i18nKey}">${escapeHtml(label)}</span>:</span>
                  <strong class="single-essentials__val"${valI18nKey ? ` data-i18n="${valI18nKey}"` : ''}>${escapeHtml(val)}</strong>
                </div>`
              )
              .join('')}
          </div>
          ${
            featureTags.length
              ? `<ul class="property-features__list single-features-list">
                  ${featureTags.map(([, i18nKey, label]) => `<li data-i18n="${i18nKey}">${escapeHtml(label)}</li>`).join('')}
                </ul>`
              : ''
          }
        </section>

        <!-- Descripción con desplegable -->
        <section class="single-block">
          <h3 class="single-block__heading" data-i18n="single_description">Descripción</h3>
          <div class="single-description is-collapsed" id="single-description">
            ${formatDescriptionParagraphs(prop.description)}
          </div>
          <button type="button" class="single-description__toggle" id="single-description-toggle" aria-expanded="false">
            <span data-i18n="single_show_more">Mostrar toda la descripción</span> &#8964;
          </button>
        </section>

        <!-- Ubicación -->
        <section class="single-block">
          <h3 class="single-block__heading" data-i18n="single_location">Ubicación</h3>
          <div class="single-location">
            <p class="single-location__label" data-i18n="single_neighborhoods">Barrios</p>
            <p class="single-location__value">${escapeHtml(neighborhoodLabel)}${prop.location.city && prop.location.zone ? ` · ${escapeHtml(prop.location.city)}` : ''}</p>
          </div>
        </section>

        <!-- Caja centrada de consulta (1:1 captura) -->
        <section class="single-inquiry">
          <div class="single-inquiry__card">
            <h3 class="single-inquiry__title" data-i18n="single_inquiry_title">Consúltenos sobre esta propiedad:</h3>

            <form class="single-inquiry__form" id="single-inquiry-form" novalidate>
              <input type="text" name="website_hp" tabindex="-1" autocomplete="off" style="display:none" aria-hidden="true" />
              <input type="hidden" name="type" value="propiedad" />
              <input type="hidden" name="reference" value="${escapeHtml(prop.reference)}" />
              <input type="hidden" name="property_title" value="${escapeHtml(prop.title)}" />

              <label for="sq-name" data-i18n="single_form_name">Nombre*</label>
              <input type="text" id="sq-name" name="name" required />

              <label for="sq-email" data-i18n="single_form_email">Correo electrónico*</label>
              <input type="email" id="sq-email" name="email" required />

              <label for="sq-phone" data-i18n="single_form_phone">Teléfono</label>
              <input type="tel" id="sq-phone" name="phone" />

              <label for="sq-message" data-i18n="single_form_message">Mensaje*</label>
              <textarea id="sq-message" name="message" rows="4" required>Hola, quisiera más información sobre esta propiedad (Ref. ${escapeHtml(prop.reference)}).</textarea>

              <label class="single-inquiry__consent">
                <input type="checkbox" id="sq-privacy" required />
                <span><span data-i18n="single_form_consent_prefix">Estoy de acuerdo con las</span> <a href="../contacto.html#privacidad" data-i18n="single_form_consent_link">condiciones de uso y la política de privacidad</a></span>
              </label>

              <button type="submit" class="single-inquiry__submit" data-i18n="single_submit">SOLICITAR INFORMACIÓN</button>
              <p class="single-inquiry__feedback" id="sq-feedback" role="status" aria-live="polite"></p>
            </form>
          </div>
        </section>
      </article>
    </main>

    <div class="gallery-lightbox" id="gallery-lightbox" role="dialog" aria-modal="true" aria-label="Visor de imágenes" hidden>
      <button type="button" class="gallery-lightbox__close" id="lb-close" aria-label="Cerrar visor">&times;</button>
      <button type="button" class="gallery-lightbox__nav gallery-lightbox__nav--prev" id="lb-prev" aria-label="Foto anterior">&#8249;</button>
      <img src="" alt="${escapeHtml(prop.title)}" class="gallery-lightbox__img" id="lb-img" />
      <button type="button" class="gallery-lightbox__nav gallery-lightbox__nav--next" id="lb-next" aria-label="Foto siguiente">&#8250;</button>
      <span class="gallery-lightbox__counter" id="lb-counter"></span>
    </div>

    <div id="footer-placeholder"></div>

    <button type="button" class="scroll-top-btn" id="scroll-top-btn" aria-label="Volver arriba">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path d="M12 18V6M6 12l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <script src="../js/i18n.js"></script>
    <script src="../js/components.js"></script>
    <script src="../js/main.js"></script>
    <script>
      (function () {
        const images = ${JSON.stringify(images)};
        const propertyData = {
          title: ${JSON.stringify(prop.title)},
          description: ${JSON.stringify(prop.description)},
          translations: ${JSON.stringify(prop.translations || {})}
        };

        let current = 0;
        const mainImg = document.getElementById('single-gallery-main');
        const counter = document.getElementById('sg-counter');
        const thumbs = document.querySelectorAll('.single-gallery__thumb');
        const lightbox = document.getElementById('gallery-lightbox');
        const lbImg = document.getElementById('lb-img');
        const lbCounter = document.getElementById('lb-counter');

        function show(idx) {
          current = (idx + images.length) % images.length;
          if (mainImg) mainImg.src = images[current];
          if (counter) counter.textContent = (current + 1) + ' / ' + images.length;
          thumbs.forEach((t, i) => t.classList.toggle('is-active', i === current));
          if (lightbox && !lightbox.hidden && lbImg) {
            lbImg.src = images[current];
            if (lbCounter) lbCounter.textContent = (current + 1) + ' / ' + images.length;
          }
        }

        function openLightbox(idx) {
          if (!lightbox || !lbImg) return;
          if (typeof idx === 'number') current = (idx + images.length) % images.length;
          lbImg.src = images[current];
          if (lbCounter) lbCounter.textContent = (current + 1) + ' / ' + images.length;
          lightbox.hidden = false;
          document.body.style.overflow = 'hidden';
        }

        function closeLightbox() {
          if (!lightbox) return;
          lightbox.hidden = true;
          document.body.style.overflow = '';
        }

        mainImg?.addEventListener('click', () => openLightbox(current));
        document.getElementById('sg-prev')?.addEventListener('click', () => show(current - 1));
        document.getElementById('sg-next')?.addEventListener('click', () => show(current + 1));
        thumbs.forEach((t) => t.addEventListener('click', () => show(Number(t.dataset.idx || 0))));

        document.getElementById('lb-prev')?.addEventListener('click', (e) => { e.stopPropagation(); show(current - 1); });
        document.getElementById('lb-next')?.addEventListener('click', (e) => { e.stopPropagation(); show(current + 1); });
        document.getElementById('lb-close')?.addEventListener('click', closeLightbox);
        lightbox?.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });

        document.addEventListener('keydown', (e) => {
          if (!lightbox || lightbox.hidden) return;
          if (e.key === 'Escape') closeLightbox();
          else if (e.key === 'ArrowLeft') show(current - 1);
          else if (e.key === 'ArrowRight') show(current + 1);
        });

        let touchStartX = 0;
        lightbox?.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].clientX; }, { passive: true });
        lightbox?.addEventListener('touchend', (e) => {
          const dx = e.changedTouches[0].clientX - touchStartX;
          if (Math.abs(dx) > 45) show(dx < 0 ? current + 1 : current - 1);
        }, { passive: true });

        // Traducción dinámica de título, descripción, etiquetas y enlaces en el idioma elegido
        function applyPropertyLanguage() {
          if (!window.FincasI18n) return;
          window.FincasI18n.applyDomTranslations(document);
          const localized = window.FincasI18n.getPropertyText(propertyData);
          const h1 = document.querySelector('.single-property__main-title');
          const h2 = document.querySelector('.single-summary__title');
          const crumbTitle = document.getElementById('single-crumb-title');
          const descBox = document.getElementById('single-description');
          const msgArea = document.getElementById('sq-message');
          const backLink = document.getElementById('single-back-link');
          const homeLink = document.getElementById('single-home-link');

          if (h1 && localized.title) h1.textContent = localized.title;
          if (h2 && localized.title) h2.textContent = localized.title;
          if (crumbTitle && localized.title) crumbTitle.textContent = localized.title;
          if (descBox && localized.description) {
            descBox.innerHTML = localized.description
              .split(/\\n{2,}/)
              .map((p) => {
                const el = document.createElement('p');
                el.textContent = p;
                return el.outerHTML;
              })
              .join('');
          }
          if (msgArea && !msgArea.dataset.userEdited) {
            msgArea.value = window.FincasI18n
              .t('single_form_default_msg')
              .replace('{ref}', ${JSON.stringify(prop.reference)});
          }
          const folder = window.FincasI18n.getFolderForLang(window.FincasI18n.getLang());
          const prefix = folder ? '../' + folder + '/' : '../';
          if (backLink) backLink.setAttribute('href', prefix + '${prop.operationKey === 'alquiler' ? 'alquile.html' : 'compre.html'}');
          if (homeLink) homeLink.setAttribute('href', prefix + 'index.html');
        }
        document.getElementById('sq-message')?.addEventListener('input', (e) => {
          e.target.dataset.userEdited = '1';
        });
        document.addEventListener('language:changed', applyPropertyLanguage);
        applyPropertyLanguage();

        const desc = document.getElementById('single-description');
        const descBtn = document.getElementById('single-description-toggle');
        if (desc && descBtn) {
          descBtn.addEventListener('click', () => {
            const expanded = descBtn.getAttribute('aria-expanded') === 'true';
            descBtn.setAttribute('aria-expanded', String(!expanded));
            desc.classList.toggle('is-collapsed', expanded);
            const moreTxt = window.FincasI18n ? window.FincasI18n.t('single_show_more') : 'Mostrar toda la descripción';
            const lessTxt = window.FincasI18n ? window.FincasI18n.t('single_show_less') : 'Mostrar menos';
            descBtn.innerHTML = expanded ? moreTxt + ' &#8964;' : lessTxt + ' &#8963;';
          });
        }

        const form = document.getElementById('single-inquiry-form');
        const fb = document.getElementById('sq-feedback');
        if (form && fb) {
          form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('sq-name')?.value.trim();
            const email = document.getElementById('sq-email')?.value.trim();
            const msg = document.getElementById('sq-message')?.value.trim();
            const priv = document.getElementById('sq-privacy')?.checked;
            if (!name || !email || !msg || !priv) {
              fb.textContent = 'Por favor, completa los campos obligatorios y acepta la privacidad.';
              fb.className = 'single-inquiry__feedback is-error';
              return;
            }
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;
            fb.textContent = 'Enviando...';
            fb.className = 'single-inquiry__feedback';
            try {
              const res = await fetch('../send-mail.php', { method: 'POST', body: new FormData(form) });
              const data = await res.json();
              if (res.ok && data.success) {
                fb.textContent = '¡Solicitud enviada! Nuestro equipo te responderá muy pronto.';
                fb.className = 'single-inquiry__feedback is-success';
                form.reset();
              } else {
                throw new Error(data.message || 'No se pudo enviar la solicitud.');
              }
            } catch (err) {
              fb.textContent = err.message || 'Error al enviar la solicitud.';
              fb.className = 'single-inquiry__feedback is-error';
            } finally {
              if (submitBtn) submitBtn.disabled = false;
            }
          });
        }
      })();
    </script>
  </body>
</html>
`;
}

function writeFeaturedJson(properties) {
  const featuredList = properties.filter((p) => p.featured);
  const pool = featuredList.length ? featuredList : properties;
  const slim = pool.slice(0, 12).map((p) => {
    const slimTranslations = {};
    for (const [lang, obj] of Object.entries(p.translations || {})) {
      if (obj && obj.title) slimTranslations[lang] = { title: obj.title };
    }
    return {
      id: p.id,
      reference: p.reference,
      url: p.url,
      type: p.type,
      title: p.title,
      translations: slimTranslations,
      priceFormatted: p.priceFormatted,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      area: p.area,
      usefulArea: p.usefulArea,
      location: { zone: p.location?.zone || '', city: p.location?.city || '' },
      image: p.image,
      images: (p.images || []).slice(0, 5),
      featured: p.featured,
    };
  });
  fs.writeFileSync(
    FEATURED_OUTPUT_PATH,
    JSON.stringify({ lastSync: new Date().toISOString(), properties: slim }),
    'utf-8'
  );
}

function syncPropertyPages(properties) {
  writeFeaturedJson(properties);
  fs.mkdirSync(PAGES_DIR, { recursive: true });

  // Agrupar por operación para navegación Anterior / Siguiente coherente
  const byOp = {
    venta: properties.filter((p) => p.operationKey === 'venta'),
    alquiler: properties.filter((p) => p.operationKey === 'alquiler'),
  };

  const validFiles = new Set();
  let written = 0;

  for (const list of Object.values(byOp)) {
    for (let i = 0; i < list.length; i += 1) {
      const prop = list[i];
      const prevProp = i > 0 ? list[i - 1] : null;
      const nextProp = i < list.length - 1 ? list[i + 1] : null;
      const filename = `${prop.slug}.html`;
      validFiles.add(filename);

      const filePath = path.join(PAGES_DIR, filename);
      const html = buildPropertyPageHtml(prop, prevProp, nextProp);
      fs.writeFileSync(filePath, html, 'utf-8');
      written += 1;
    }
  }

  // Eliminar páginas HTML de propiedades dadas de baja
  let deleted = 0;
  for (const existingFile of fs.readdirSync(PAGES_DIR)) {
    if (existingFile.endsWith('.html') && !validFiles.has(existingFile)) {
      fs.unlinkSync(path.join(PAGES_DIR, existingFile));
      deleted += 1;
    }
  }

  // Actualizar sitemap.xml incluyendo todas las carpetas de idioma (/cat, /en, /fr, /zh, /ru) y propiedades
  const baseUrl = (process.env.SITE_URL || 'https://www.fincasmaricel.com').replace(/\/$/, '');
  const staticPages = ['index.html', 'nosotros.html', 'venda.html', 'compre.html', 'alquile.html', 'contacto.html'];
  const langFolders = ['', 'cat', 'en', 'fr', 'zh', 'ru'];
  const staticUrls = [];
  for (const folder of langFolders) {
    for (const page of staticPages) {
      staticUrls.push(`  <url><loc>${baseUrl}/${folder ? `${folder}/` : ''}${page}</loc></url>`);
    }
  }
  const urls = [
    ...staticUrls,
    ...properties.map((p) => `  <url><loc>${baseUrl}/${p.url}</loc></url>`),
  ];
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  fs.writeFileSync(SITEMAP_PATH, sitemapXml, 'utf-8');

  return { written, deleted };
}

// ============================================================================
// Lectura, diff incremental y guardado
// ============================================================================

async function fetchXmlText() {
  const fileArgIndex = process.argv.indexOf('--file');
  if (fileArgIndex !== -1 && process.argv[fileArgIndex + 1]) {
    const localPath = path.resolve(process.argv[fileArgIndex + 1]);
    console.log(`[sync-inmoweb] Leyendo XML local: ${localPath}`);
    return fs.readFileSync(localPath, 'utf-8');
  }

  const feedUrl = process.env.INMOWEB_FEED_URL || DEFAULT_FEED_URL;
  console.log(`[sync-inmoweb] Descargando feed XML de Inmoweb...`);
  const response = await fetch(feedUrl, {
    headers: { 'User-Agent': 'FincasMaricel-InmowebSync/1.0' },
  });

  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status} al descargar el feed XML.`);
  }
  return await response.text();
}

function loadExistingStore() {
  if (!fs.existsSync(OUTPUT_PATH)) {
    return new Map();
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
    const list = Array.isArray(parsed.properties) ? parsed.properties : [];
    return new Map(list.map((item) => [String(item.id), item]));
  } catch {
    return new Map();
  }
}

async function run() {
  let xmlText = '';
  try {
    xmlText = await fetchXmlText();
  } catch (err) {
    if (fs.existsSync(OUTPUT_PATH)) {
      console.warn(`[sync-inmoweb] Aviso: no se pudo descargar el feed (${err.message}). Usando caché local de properties.json.`);
      const cached = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
      const list = Array.isArray(cached.properties) ? cached.properties : [];
      const pageStats = syncPropertyPages(list);
      console.log(`[sync-inmoweb] Páginas regeneradas desde caché: ${pageStats.written}`);
      return;
    }
    throw err;
  }

  const propNodes = getAllTags(xmlText, 'propiedad');

  if (!propNodes.length) {
    throw new Error('El XML no contiene nodos <propiedad> válidos.');
  }

  const existingMap = loadExistingStore();
  const nextProperties = [];
  const seenIds = new Set();

  let added = 0;
  let updated = 0;
  let unchanged = 0;

  for (const node of propNodes) {
    const parsed = parsePropertyNode(node);
    if (!parsed) continue;

    const key = String(parsed.id);
    seenIds.add(key);

    const prev = existingMap.get(key);
    if (!prev) {
      added += 1;
      nextProperties.push(parsed);
    } else if (
      (parsed.updatedAt && prev.updatedAt !== parsed.updatedAt) ||
      prev.price !== parsed.price ||
      prev.description !== parsed.description ||
      prev.slug !== parsed.slug ||
      prev.images?.length !== parsed.images.length ||
      prev.featured !== parsed.featured
    ) {
      updated += 1;
      nextProperties.push(parsed);
    } else {
      unchanged += 1;
      nextProperties.push(prev);
    }
  }

  let removed = 0;
  for (const oldId of existingMap.keys()) {
    if (!seenIds.has(oldId)) {
      removed += 1;
    }
  }

  // Ordenar por más nuevo (ID descendente, luego fecha de modificación)
  nextProperties.sort((a, b) => {
    const idDiff = (Number(b.id) || 0) - (Number(a.id) || 0);
    if (idDiff !== 0) return idDiff;
    return parseEsDateToTimestamp(b.updatedAt) - parseEsDateToTimestamp(a.updatedAt);
  });

  const payload = {
    lastSync: new Date().toISOString(),
    source: 'inmoweb-xml',
    total: nextProperties.length,
    counts: {
      venta: nextProperties.filter((p) => p.operationKey === 'venta').length,
      alquiler: nextProperties.filter((p) => p.operationKey === 'alquiler').length,
      featured: nextProperties.filter((p) => p.featured).length,
    },
    properties: nextProperties,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  const tempPath = `${OUTPUT_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf-8');
  fs.renameSync(tempPath, OUTPUT_PATH);

  const pageStats = syncPropertyPages(nextProperties);

  console.log(
    `[sync-inmoweb] Completado: ${payload.total} propiedades (${payload.counts.venta} venta, ${payload.counts.alquiler} alquiler, ${payload.counts.featured} destacadas).`
  );
  console.log(
    `[sync-inmoweb] JSON Diff -> +${added} nuevas, ~${updated} actualizadas, =${unchanged} sin cambios, -${removed} eliminadas.`
  );
  console.log(
    `[sync-inmoweb] Páginas HTML -> ${pageStats.written} generadas/actualizadas en public/propiedades/, ${pageStats.deleted} eliminadas.`
  );
}

run().catch((err) => {
  console.error('[sync-inmoweb] Error:', err.message);
  process.exit(1);
});
