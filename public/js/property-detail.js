/**
 * Renderizador de la ficha individual de propiedad (propiedad.html?ref=...)
 * Consume los enlaces directos de imágenes almacenados en data/properties.json.
 */
(function () {
  const FALLBACK_IMAGE = 'assets/fachada1.jpg';

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDescription(text) {
    if (!text) return '<p>Consulte con nuestro equipo para más información sobre este inmueble.</p>';
    return text
      .split(/\n{2,}/)
      .map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br />')}</p>`)
      .join('');
  }

  async function initDetail() {
    const root = document.getElementById('property-detail-root');
    if (!root || !window.PropertiesStore) return;

    await window.PropertiesStore.load();

    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') || params.get('id') || '';
    const prop = window.PropertiesStore.getByIdOrRef(ref);

    if (!prop) {
      root.innerHTML = `
        <div class="property-not-found">
          <h1>Inmueble no encontrado</h1>
          <p>La referencia solicitada no está disponible actualmente o ha sido retirada.</p>
          <a href="compre.html" class="btn-outline-dark">Ver propiedades en venta</a>
        </div>
      `;
      return;
    }

    document.title = `${prop.title} · Ref. ${prop.reference} · Fincas Maricel`;
    const backUrl = prop.operationKey === 'alquiler' ? 'alquile.html' : 'compre.html';
    const backLabel = prop.operationKey === 'alquiler' ? 'Volver a Alquileres' : 'Volver a Propiedades en Venta';
    const images = prop.images && prop.images.length ? prop.images : [FALLBACK_IMAGE];

    const featureLabels = [
      ['vistasAlMar', 'Vistas al mar'],
      ['piscina', 'Piscina'],
      ['terraza', 'Terraza'],
      ['balcon', 'Balcón'],
      ['parking', 'Parking'],
      ['ascensor', 'Ascensor'],
    ].filter(([key]) => prop.features && prop.features[key]);

    const specs = [
      prop.bedrooms ? ['Habitaciones', prop.bedrooms] : null,
      prop.bathrooms ? ['Baños', prop.bathrooms] : null,
      prop.area ? ['Sup. Construida', `${prop.area} m²`] : null,
      prop.usefulArea ? ['Sup. Útil', `${prop.usefulArea} m²`] : null,
      prop.lotSize ? ['Sup. Parcela', `${prop.lotSize} m²`] : null,
      prop.yearBuilt ? ['Año construcción', prop.yearBuilt] : null,
      prop.yearRemodeled ? ['Año reforma', prop.yearRemodeled] : null,
    ].filter(Boolean);

    root.innerHTML = `
      <div class="property-detail__top">
        <a href="${backUrl}" class="property-detail__back">&larr; ${backLabel}</a>
        <span class="property-detail__ref">Referencia: <strong>${escapeHtml(prop.reference)}</strong></span>
      </div>

      <div class="property-detail__header">
        <div>
          <div class="property-detail__badges">
            <span class="property-badge property-badge--op">${escapeHtml(prop.operation)}</span>
            <span class="property-badge">${escapeHtml(prop.type)}</span>
          </div>
          <h1 class="property-detail__title">${escapeHtml(prop.title)}</h1>
          ${prop.location?.address ? `<p class="property-detail__address">${escapeHtml(prop.location.address)}</p>` : ''}
        </div>
        <div class="property-detail__price">${escapeHtml(prop.priceFormatted)}</div>
      </div>

      <div class="property-gallery">
        <div class="property-gallery__stage">
          <img
            src="${escapeHtml(images[0])}"
            alt="${escapeHtml(prop.title)}"
            id="gallery-main-img"
            class="property-gallery__main"
            onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}';"
          />
          ${
            images.length > 1
              ? `
            <button type="button" class="property-gallery__nav property-gallery__nav--prev" id="gallery-prev" aria-label="Foto anterior">&#8249;</button>
            <button type="button" class="property-gallery__nav property-gallery__nav--next" id="gallery-next" aria-label="Foto siguiente">&#8250;</button>
            <span class="property-gallery__counter" id="gallery-counter">1 / ${images.length}</span>
          `
              : ''
          }
        </div>
        ${
          images.length > 1
            ? `
          <div class="property-gallery__thumbs" id="gallery-thumbs">
            ${images
              .map(
                (url, idx) => `
              <button type="button" class="property-gallery__thumb${idx === 0 ? ' is-active' : ''}" data-idx="${idx}" aria-label="Ver foto ${idx + 1}">
                <img src="${escapeHtml(url)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}';" />
              </button>`
              )
              .join('')}
          </div>
        `
            : ''
        }
      </div>

      <div class="property-detail__layout">
        <div class="property-detail__main">
          ${
            specs.length
              ? `
            <div class="property-specs-grid">
              ${specs
                .map(
                  ([label, val]) => `
                <div class="property-spec-box">
                  <span class="property-spec-box__label">${escapeHtml(label)}</span>
                  <strong class="property-spec-box__val">${escapeHtml(val)}</strong>
                </div>`
                )
                .join('')}
            </div>
          `
              : ''
          }

          ${
            featureLabels.length
              ? `
            <div class="property-features">
              <h2>Características destacadas</h2>
              <ul class="property-features__list">
                ${featureLabels.map(([, label]) => `<li>${escapeHtml(label)}</li>`).join('')}
              </ul>
            </div>
          `
              : ''
          }

          <div class="property-description">
            <h2>Descripción</h2>
            <div class="property-description__body">${formatDescription(prop.description)}</div>
          </div>
        </div>

        <aside class="property-detail__sidebar">
          <div class="property-inquiry-card">
            <h3>Solicitar información</h3>
            <p class="property-inquiry-card__ref">Inmueble Ref. ${escapeHtml(prop.reference)}</p>

            <div class="property-inquiry-card__direct">
              <a href="tel:+34938943247">+34 938 94 32 47</a>
              <a href="mailto:comercial@fincasmaricel.com?subject=${encodeURIComponent(`Consulta Ref. ${prop.reference}`)}">comercial@fincasmaricel.com</a>
            </div>

            <form id="property-inquiry-form" class="modal-form" novalidate>
              <input type="text" id="inq-name" placeholder="Nombre completo *" required />
              <input type="email" id="inq-email" placeholder="Correo electrónico *" required />
              <input type="tel" id="inq-phone" placeholder="Teléfono *" required />
              <textarea id="inq-msg" rows="4">Hola, me gustaría recibir más información sobre el inmueble con referencia ${escapeHtml(prop.reference)}.</textarea>
              <label class="modal-form__consent">
                <input type="checkbox" id="inq-privacy" required />
                <span>Acepto la <a href="#privacidad">Política de Privacidad</a>.</span>
              </label>
              <button type="submit" class="modal-form__submit">Solicitar información</button>
              <p class="modal-form__feedback" id="inq-feedback" role="status"></p>
            </form>
          </div>
        </aside>
      </div>
    `;

    // Interacción galería
    if (images.length > 1) {
      let current = 0;
      const mainImg = document.getElementById('gallery-main-img');
      const counter = document.getElementById('gallery-counter');
      const thumbs = root.querySelectorAll('.property-gallery__thumb');

      const showImage = (idx) => {
        current = (idx + images.length) % images.length;
        if (mainImg) mainImg.src = images[current];
        if (counter) counter.textContent = `${current + 1} / ${images.length}`;
        thumbs.forEach((t, i) => t.classList.toggle('is-active', i === current));
      };

      document.getElementById('gallery-prev')?.addEventListener('click', () => showImage(current - 1));
      document.getElementById('gallery-next')?.addEventListener('click', () => showImage(current + 1));
      thumbs.forEach((t) => {
        t.addEventListener('click', () => showImage(Number(t.dataset.idx || 0)));
      });
    }

    // Formulario de consulta
    const form = document.getElementById('property-inquiry-form');
    const feedback = document.getElementById('inq-feedback');
    if (form && feedback) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('inq-name')?.value.trim();
        const email = document.getElementById('inq-email')?.value.trim();
        const phone = document.getElementById('inq-phone')?.value.trim();
        const privacy = document.getElementById('inq-privacy')?.checked;

        if (!name || !email || !phone || !privacy) {
          feedback.textContent = 'Por favor, completa los campos obligatorios y acepta la privacidad.';
          feedback.className = 'modal-form__feedback is-error';
          return;
        }
        feedback.textContent = '¡Consulta enviada! Un asesor de Fincas Maricel te contactará pronto.';
        feedback.className = 'modal-form__feedback is-success';
        form.reset();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDetail);
  } else {
    initDetail();
  }
})();

