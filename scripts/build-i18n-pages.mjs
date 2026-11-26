#!/usr/bin/env node
/**
 * Generador multi-idioma + SEO técnico y AI SEO (JSON-LD, hreflang, Open Graph)
 *
 * - Inyecta metadatos SEO + hreflang + Schema.org RealEstateAgent en las páginas raíz (ES).
 * - Genera automáticamente las carpetas de idioma en public/:
 *     /cat/ (Català)
 *     /en/  (English)
 *     /fr/  (Français)
 *     /zh/  (简体中文)
 *     /ru/  (Русский)
 *   con rutas relativas corregidas (../assets, ../css, ../js, ../send-mail.php),
 *   data-base-path="../" y textos principales traducidos.
 *
 * Uso:
 *   node scripts/build-i18n-pages.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const SITE_URL = (process.env.SITE_URL || 'https://www.fincasmaricel.com').replace(/\/$/, '');

const PAGES = ['index.html', 'nosotros.html', 'venda.html', 'compre.html', 'alquile.html', 'contacto.html'];

const LANGS = [
  { code: 'ES', folder: '', htmlLang: 'es', hreflang: 'es', ogLocale: 'es_ES' },
  { code: 'CA', folder: 'cat', htmlLang: 'ca', hreflang: 'ca', ogLocale: 'ca_ES' },
  { code: 'EN', folder: 'en', htmlLang: 'en', hreflang: 'en', ogLocale: 'en_GB' },
  { code: 'FR', folder: 'fr', htmlLang: 'fr', hreflang: 'fr', ogLocale: 'fr_FR' },
  { code: 'ZH', folder: 'zh', htmlLang: 'zh-Hans', hreflang: 'zh-Hans', ogLocale: 'zh_CN' },
  { code: 'RU', folder: 'ru', htmlLang: 'ru', hreflang: 'ru', ogLocale: 'ru_RU' },
];

const SEO_META = {
  'index.html': {
    ES: {
      title: 'Fincas Maricel · Inmobiliaria en Sitges desde 1979 | Alto Standing',
      desc: 'Inmobiliaria de referencia en Sitges desde 1979. Especialistas en villas con vistas al mar, áticos, casas de alto standing, compra, venta y alquiler en Sitges.',
    },
    CA: {
      title: 'Fincas Maricel · Immobiliària a Sitges des de 1979 | Alt Standing',
      desc: 'Immobiliària de referència a Sitges des de 1979. Especialistes en viles amb vistes al mar, àtics, compra, venda i lloguer a Sitges.',
    },
    EN: {
      title: 'Fincas Maricel · Luxury Real Estate Agency in Sitges since 1979',
      desc: 'Leading real estate agency in Sitges since 1979. Specialists in luxury villas with sea views, penthouses, buying, selling and renting in Sitges, Barcelona.',
    },
    FR: {
      title: 'Fincas Maricel · Agence Immobilière de Prestige à Sitges depuis 1979',
      desc: 'Agence immobilière de référence à Sitges depuis 1979. Spécialistes des villas vue mer, penthouses, achat, vente et location à Sitges.',
    },
    ZH: {
      title: 'Fincas Maricel · 西班牙锡切斯(Sitges)高端房产中介 · 始于1979年',
      desc: '自1979年起扎根巴塞罗那锡切斯(Sitges)的知名房产机构，专注海景别墅、高端公寓买卖、租赁与免费房产评估。',
    },
    RU: {
      title: 'Fincas Maricel · Элитная недвижимость в Ситжесе с 1979 года',
      desc: 'Ведущее агентство недвижимости в Ситжесе с 1979 года. Виллы с видом на море, пентхаусы, покупка, продажа и аренда в Ситжесе, Барселона.',
    },
  },
  'nosotros.html': {
    ES: {
      title: 'Sobre Nosotros · Fincas Maricel Sitges desde 1979',
      desc: 'Honestidad, constancia y profesionalidad. Más de 45 años asesorando en compraventa y alquiler de inmuebles en Sitges. API 4120 · AICAT 13671.',
    },
    CA: {
      title: 'Sobre Nosaltres · Fincas Maricel Sitges des de 1979',
      desc: 'Honestedat, constància i professionalitat. Més de 45 anys assessorant en compravenda i lloguer d’immobles a Sitges. API 4120 · AICAT 13671.',
    },
    EN: {
      title: 'About Us · Fincas Maricel Real Estate Sitges since 1979',
      desc: 'Honesty, consistency and professionalism. Over 45 years advising buyers and sellers in Sitges. Licensed API 4120 · AICAT 13671.',
    },
    FR: {
      title: 'À Propos · Fincas Maricel Immobilier Sitges depuis 1979',
      desc: 'Honnêteté, constance et professionnalisme. Plus de 45 ans d’expertise immobilière à Sitges. API 4120 · AICAT 13671.',
    },
    ZH: {
      title: '关于我们 · Fincas Maricel 锡切斯房产机构（始于1979年）',
      desc: '诚信、专业、稳健。超过45年锡切斯高端房产买卖与租赁经验，官方认证 API 4120 · AICAT 13671。',
    },
    RU: {
      title: 'О нас · Агентство недвижимости Fincas Maricel в Ситжесе с 1979 года',
      desc: 'Честность, постоянство и профессионализм. Более 45 лет опыта на рынке недвижимости Ситжеса. API 4120 · AICAT 13671.',
    },
  },
  'venda.html': {
    ES: {
      title: 'Venda su Propiedad en Sitges · Tasación Gratuita | Fincas Maricel',
      desc: 'Solicite una valoración gratuita y confidencial de su vivienda en Sitges. Más de 45 años maximizando el valor de venta con presencia internacional.',
    },
    CA: {
      title: 'Vengui la seva Propietat a Sitges · Taxació Gratuïta | Fincas Maricel',
      desc: 'Sol·liciti una valoració gratuïta i confidencial del seu habitatge a Sitges amb el nostre equip d’especialistes.',
    },
    EN: {
      title: 'Sell Your Property in Sitges · Free Valuation | Fincas Maricel',
      desc: 'Request a free, confidential market valuation for your home in Sitges. Over 45 years of local expertise and international portal exposure.',
    },
    FR: {
      title: 'Vendez Votre Propriété à Sitges · Estimation Gratuite | Fincas Maricel',
      desc: 'Demandez une estimation gratuite et confidentielle de votre bien immobilier à Sitges avec nos spécialistes.',
    },
    ZH: {
      title: '出售您在锡切斯的房产 · 免费评估 | Fincas Maricel',
      desc: '申请免费、保密的锡切斯房产市场评估。超过45年本地经验与国际房产平台推广。',
    },
    RU: {
      title: 'Продать недвижимость в Ситжесе · Бесплатная оценка | Fincas Maricel',
      desc: 'Закажите бесплатную конфиденциальную оценку вашей недвижимости в Ситжесе у экспертов Fincas Maricel.',
    },
  },
  'compre.html': {
    ES: {
      title: 'Propiedades en Venta en Sitges · Casas, Villas y Áticos | Fincas Maricel',
      desc: 'Explore nuestro catálogo actualizado de viviendas en venta en Sitges: villas con vistas al mar, áticos, pisos en el centro, Vinyet y Terramar.',
    },
    CA: {
      title: 'Propietats en Venda a Sitges · Cases, Viles i Àtics | Fincas Maricel',
      desc: 'Explori el nostre catàleg actualitzat d’habitatges en venda a Sitges: viles amb vistes al mar, àtics i pisos exclusius.',
    },
    EN: {
      title: 'Properties for Sale in Sitges · Villas, Penthouses & Homes | Fincas Maricel',
      desc: 'Browse our updated catalog of properties for sale in Sitges: sea-view villas, penthouses, and exclusive apartments.',
    },
    FR: {
      title: 'Biens à Vendre à Sitges · Villas, Penthouses et Appartements | Fincas Maricel',
      desc: 'Découvrez notre catalogue actualisé de propriétés à vendre à Sitges : villas vue mer, penthouses et appartements de standing.',
    },
    ZH: {
      title: '锡切斯(Sitges)在售房源 · 别墅、顶层复式与公寓 | Fincas Maricel',
      desc: '浏览锡切斯最新在售房源：海景别墅、顶层公寓与市中心精选住宅。',
    },
    RU: {
      title: 'Недвижимость на продажу в Ситжесе · Виллы и пентхаусы | Fincas Maricel',
      desc: 'Актуальный каталог недвижимости на продажу в Ситжесе: виллы с видом на море, пентхаусы и элитные квартиры.',
    },
  },
  'alquile.html': {
    ES: {
      title: 'Propiedades en Alquiler en Sitges · Pisos y Locales | Fincas Maricel',
      desc: 'Descubra pisos, casas y locales comerciales en alquiler en Sitges con asesoramiento transparente y profesional desde 1979.',
    },
    CA: {
      title: 'Propietats en Lloguer a Sitges · Pisos i Locals | Fincas Maricel',
      desc: 'Descobriu pisos, cases i locals comercials en lloguer a Sitges amb assessorament transparent des de 1979.',
    },
    EN: {
      title: 'Properties for Rent in Sitges · Apartments & Commercial | Fincas Maricel',
      desc: 'Find apartments, homes and commercial spaces for rent in Sitges with trusted local guidance since 1979.',
    },
    FR: {
      title: 'Biens à Louer à Sitges · Appartements et Locaux | Fincas Maricel',
      desc: 'Découvrez nos appartements, maisons et locaux commerciaux à louer à Sitges avec un accompagnement transparent.',
    },
    ZH: {
      title: '锡切斯(Sitges)出租房源 · 公寓与商铺 | Fincas Maricel',
      desc: '查找锡切斯优质出租公寓、住宅与商铺，享受自1979年以来的专业透明服务。',
    },
    RU: {
      title: 'Аренда недвижимости в Ситжесе · Квартиры и коммерция | Fincas Maricel',
      desc: 'Актуальные квартиры, дома и коммерческие помещения в аренду в Ситжесе от Fincas Maricel.',
    },
  },
  'contacto.html': {
    ES: {
      title: 'Contacto · Fincas Maricel Sitges | Plaça Cap de la Vila, 2',
      desc: 'Contacte con nuestro equipo de especialistas inmobiliarios en Sitges. Tel: +34 938 94 32 47 · comercial@fincasmaricel.com.',
    },
    CA: {
      title: 'Contacte · Fincas Maricel Sitges | Plaça Cap de la Vila, 2',
      desc: 'Contacti amb el nostre equip d’especialistes immobiliaris a Sitges. Tel: +34 938 94 32 47 · comercial@fincasmaricel.com.',
    },
    EN: {
      title: 'Contact Us · Fincas Maricel Sitges | Plaça Cap de la Vila, 2',
      desc: 'Speak with our real estate specialists in Sitges. Phone: +34 938 94 32 47 · comercial@fincasmaricel.com.',
    },
    FR: {
      title: 'Contact · Fincas Maricel Sitges | Plaça Cap de la Vila, 2',
      desc: 'Parlez avec notre équipe de spécialistes immobiliers à Sitges. Tél : +34 938 94 32 47 · comercial@fincasmaricel.com.',
    },
    ZH: {
      title: '联系我们 · Fincas Maricel 锡切斯办公室',
      desc: '联系我们在锡切斯的专业房产顾问团队。电话：+34 938 94 32 47 · comercial@fincasmaricel.com。',
    },
    RU: {
      title: 'Контакты · Fincas Maricel Ситжес | Plaça Cap de la Vila, 2',
      desc: 'Свяжитесь с нашей командой экспертов по недвижимости в Ситжесе. Тел.: +34 938 94 32 47 · comercial@fincasmaricel.com.',
    },
  },
};

// Traducciones clave de encabezados visibles en las páginas estáticas
const TEXT_REPLACEMENTS = {
  CA: [
    ['Sobre Nosotros', 'Sobre Nosaltres'],
    ['Venda su Propiedad', 'Vengui la seva Propietat'],
    ['Propiedades en Venta', 'Propietats en Venda'],
    ['Propiedades en Alquiler', 'Propietats en Lloguer'],
    ['Contacte Con Nosotros', 'Contacti Amb Nosaltres'],
    ['Habla con nuestro equipo de especialistas', 'Parli amb el nostre equip d’especialistes'],
    ['¿ESTÁS PENSANDO EN VENDER TU CASA?', 'ESTÀ PENSANT A VENDRE CASA SEVA?'],
    ['Solicitar valoración', 'Sol·licitar valoració'],
    ['Descubra nuestra selección de inmuebles y encuentre lo ideal para usted.', 'Descobriu la nostra selecció d’immobles i trobi l’ideal per a vostè.'],
    ['Ver Propiedades en Venta', 'Veure Propietats en Venda'],
    ['¿BUSCAS UN PISO O LOCAL EN ALQUILER?', 'BUSCA UN PIS O LOCAL EN LLOGUER?'],
    ['Ver Alquileres Disponibles', 'Veure Lloguers Disponibles'],
    ['Nuestros portales inmobiliarios', 'Els nostres portals immobiliaris'],
    ['Quiero mi tasación gratuita', 'Vull la meva taxació gratuïta'],
    ['Enviar mensaje', 'Enviar missatge'],
  ],
  EN: [
    ['Sobre Nosotros', 'About Us'],
    ['Venda su Propiedad', 'Sell Your Property'],
    ['Propiedades en Venta', 'Properties for Sale'],
    ['Propiedades en Alquiler', 'Properties for Rent'],
    ['Contacte Con Nosotros', 'Contact Us'],
    ['Habla con nuestro equipo de especialistas', 'Speak with our team of specialists'],
    ['¿ESTÁS PENSANDO EN VENDER TU CASA?', 'THINKING ABOUT SELLING YOUR HOME?'],
    ['Solicitar valoración', 'Request a valuation'],
    ['Descubra nuestra selección de inmuebles y encuentre lo ideal para usted.', 'Discover our curated selection of properties and find your ideal home.'],
    ['Ver Propiedades en Venta', 'View Properties for Sale'],
    ['¿BUSCAS UN PISO O LOCAL EN ALQUILER?', 'LOOKING FOR AN APARTMENT OR COMMERCIAL SPACE TO RENT?'],
    ['Ver Alquileres Disponibles', 'View Available Rentals'],
    ['Nuestros portales inmobiliarios', 'Our real estate portals'],
    ['Quiero mi tasación gratuita', 'Request my free valuation'],
    ['Enviar mensaje', 'Send message'],
  ],
  FR: [
    ['Sobre Nosotros', 'À Propos de Nous'],
    ['Venda su Propiedad', 'Vendez Votre Propriété'],
    ['Propiedades en Venta', 'Propriétés à Vendre'],
    ['Propiedades en Alquiler', 'Propriétés à Louer'],
    ['Contacte Con Nosotros', 'Contactez-Nous'],
    ['Habla con nuestro equipo de especialistas', 'Parlez avec notre équipe de spécialistes'],
    ['¿ESTÁS PENSANDO EN VENDER TU CASA?', 'VOUS ENVISAGEZ DE VENDRE VOTRE MAISON ?'],
    ['Solicitar valoración', 'Demander une estimation'],
    ['Descubra nuestra selección de inmuebles y encuentre lo ideal para usted.', 'Découvrez notre sélection de biens immobiliers et trouvez votre idéal.'],
    ['Ver Propiedades en Venta', 'Voir les Biens à Vendre'],
    ['¿BUSCAS UN PISO O LOCAL EN ALQUILER?', 'VOUS CHERCHEZ UN APPARTEMENT OU LOCAL À LOUER ?'],
    ['Ver Alquileres Disponibles', 'Voir les Locations Disponibles'],
    ['Nuestros portales inmobiliarios', 'Nos portails immobiliers'],
    ['Quiero mi tasación gratuita', 'Demander mon estimation gratuite'],
    ['Enviar mensaje', 'Envoyer le message'],
  ],
  ZH: [
    ['Sobre Nosotros', '关于我们'],
    ['Venda su Propiedad', '出售您的房产'],
    ['Propiedades en Venta', '在售精选房源'],
    ['Propiedades en Alquiler', '出租精选房源'],
    ['Contacte Con Nosotros', '联系我们'],
    ['Habla con nuestro equipo de especialistas', '与我们的专业顾问团队联系'],
    ['¿ESTÁS PENSANDO EN VENDER TU CASA?', '正在考虑出售您的房产吗？'],
    ['Solicitar valoración', '申请免费评估'],
    ['Descubra nuestra selección de inmuebles y encuentre lo ideal para usted.', '探索我们精选的锡切斯优质房源，找到您的理想居所。'],
    ['Ver Propiedades en Venta', '查看在售房源'],
    ['¿BUSCAS UN PISO O LOCAL EN ALQUILER?', '正在寻找出租公寓或商铺吗？'],
    ['Ver Alquileres Disponibles', '查看出租房源'],
    ['Nuestros portales inmobiliarios', '合作房产平台'],
    ['Quiero mi tasación gratuita', '获取免费房产评估'],
    ['Enviar mensaje', '发送消息'],
  ],
  RU: [
    ['Sobre Nosotros', 'О нас'],
    ['Venda su Propiedad', 'Продать недвижимость'],
    ['Propiedades en Venta', 'Недвижимость на продажу'],
    ['Propiedades en Alquiler', 'Аренда недвижимости'],
    ['Contacte Con Nosotros', 'Связаться с нами'],
    ['Habla con nuestro equipo de especialistas', 'Поговорите с нашей командой специалистов'],
    ['¿ESTÁS PENSANDO EN VENDER TU CASA?', 'ПЛАНИРУЕТЕ ПРОДАТЬ СВОЙ ДОМ?'],
    ['Solicitar valoración', 'Запросить оценку'],
    ['Descubra nuestra selección de inmuebles y encuentre lo ideal para usted.', 'Откройте для себя нашу коллекцию недвижимости в Ситжесе.'],
    ['Ver Propiedades en Venta', 'Смотреть объекты на продажу'],
    ['¿BUSCAS UN PISO O LOCAL EN ALQUILER?', 'ИЩЕТЕ КВАРТИРУ ИЛИ ПОМЕЩЕНИЕ В АРЕНДУ?'],
    ['Ver Alquileres Disponibles', 'Смотреть аренду'],
    ['Nuestros portales inmobiliarios', 'Наши порталы недвижимости'],
    ['Quiero mi tasación gratuita', 'Получить бесплатную оценку'],
    ['Enviar mensaje', 'Отправить сообщение'],
  ],
};

function buildOrgSchema(canonicalUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: 'Fincas Maricel',
    legalName: 'Fincas Maricel, S.L.',
    url: canonicalUrl,
    logo: `${SITE_URL}/assets/opt/hero-poster.webp`,
    image: `${SITE_URL}/assets/opt/fachada1.webp`,
    foundingDate: '1979',
    telephone: '+34 938 94 32 47',
    email: 'comercial@fincasmaricel.com',
    taxID: 'ESB08933012',
    priceRange: '€€€',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Plaça Cap de la Vila, 2',
      addressLocality: 'Sitges',
      addressRegion: 'Barcelona',
      postalCode: '08870',
      addressCountry: 'ES',
    },
    areaServed: ['Sitges', 'Garraf', 'Sant Pere de Ribes', 'Vilanova i la Geltrú', 'Calafell'],
    knowsLanguage: ['es', 'ca', 'en', 'fr', 'zh', 'ru'],
    memberOf: [
      { '@type': 'Organization', name: 'API · Col·legis i Associació d’Agents Immobiliaris (API 4120)' },
      { '@type': 'Organization', name: 'AICAT · Registre d’Agents Immobiliaris de Catalunya (13671)' },
    ],
  };
}

function buildSeoBlock(pageName, langObj) {
  const meta = SEO_META[pageName][langObj.code];
  const urlFor = (l) => (l.folder ? `${SITE_URL}/${l.folder}/${pageName}` : `${SITE_URL}/${pageName}`);
  const canonical = urlFor(langObj);
  const hreflangs = LANGS.map(
    (l) => `    <link rel="alternate" hreflang="${l.hreflang}" href="${urlFor(l)}" />`
  ).join('\n');
  const xDefault = `    <link rel="alternate" hreflang="x-default" href="${urlFor(LANGS[0])}" />`;
  const schemaJson = JSON.stringify(buildOrgSchema(canonical));

  return `<!-- SEO:START -->
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="canonical" href="${canonical}" />
${hreflangs}
${xDefault}
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Fincas Maricel" />
    <meta property="og:locale" content="${langObj.ogLocale}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:title" content="${meta.title}" />
    <meta property="og:description" content="${meta.desc}" />
    <meta property="og:image" content="${SITE_URL}/assets/opt/hero-poster.webp" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${meta.title}" />
    <meta name="twitter:description" content="${meta.desc}" />
    <meta name="twitter:image" content="${SITE_URL}/assets/opt/hero-poster.webp" />
    <script type="application/ld+json">${schemaJson}</script>
    <!-- SEO:END -->`;
}

function injectSeo(html, pageName, langObj) {
  const meta = SEO_META[pageName][langObj.code];
  let out = html
    .replace(/<html\s+lang="[^"]*">/i, `<html lang="${langObj.htmlLang}">`)
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${meta.title}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[\s\S]*?"\s*\/>/i,
      `<meta name="description" content="${meta.desc}" />`
    );

  // Limpiar bloque SEO previo si existe
  out = out.replace(/<!-- SEO:START -->[\s\S]*?<!-- SEO:END -->\s*/g, '');
  const faviconTag = '<link rel="icon" type="image/png" href="assets/cropped-Icon-Circle-scaled-1.png" />';
  if (!out.includes('cropped-Icon-Circle-scaled-1.png')) {
    out = out.replace(/<\/head>/i, `    ${faviconTag}\n  </head>`);
  }
  const seoBlock = buildSeoBlock(pageName, langObj);
  out = out.replace(/<\/head>/i, `    ${seoBlock}\n  </head>`);
  return out;
}

function localizeSubfolderHtml(baseHtml, pageName, langObj) {
  let out = injectSeo(baseHtml, pageName, langObj);

  // Añadir data-lang y data-base-path="../" en <body>
  out = out.replace(/<body([^>]*)>/i, (_, attrs) => {
    const clean = attrs
      .replace(/\s*data-lang="[^"]*"/gi, '')
      .replace(/\s*data-base-path="[^"]*"/gi, '');
    return `<body${clean} data-lang="${langObj.code}" data-base-path="../">`;
  });

  // Reescribir rutas compartidas hacia la raíz (../css, ../js, ../assets, ../send-mail.php)
  out = out
    .replace(/href="css\//g, 'href="../css/')
    .replace(/href="assets\//g, 'href="../assets/')
    .replace(/src="js\//g, 'src="../js/')
    .replace(/src="assets\//g, 'src="../assets/')
    .replace(/data-src="assets\//g, 'data-src="../assets/')
    .replace(/srcset="assets\//g, 'srcset="../assets/')
    .replace(/imagesrcset="assets\//g, 'imagesrcset="../assets/')
    .replace(/, assets\//g, ', ../assets/')
    .replace(/poster="assets\//g, 'poster="../assets/')
    .replace(/fetch\('send-mail\.php'/g, "fetch('../send-mail.php'");

  // Aplicar traducciones de encabezados y CTAs
  const pairs = TEXT_REPLACEMENTS[langObj.code] || [];
  for (const [esText, trText] of pairs) {
    out = out.split(esText).join(trText);
  }

  return out;
}

function run() {
  let generatedCount = 0;

  for (const pageName of PAGES) {
    const srcPath = path.join(PUBLIC_DIR, pageName);
    if (!fs.existsSync(srcPath)) continue;

    const rawHtml = fs.readFileSync(srcPath, 'utf-8');

    // 1. Inyectar SEO + hreflang + Schema.org en la página raíz (ES)
    const rootWithSeo = injectSeo(rawHtml, pageName, LANGS[0]);
    fs.writeFileSync(srcPath, rootWithSeo, 'utf-8');

    // 2. Generar versiones en /cat, /en, /fr, /zh, /ru
    for (const langObj of LANGS.slice(1)) {
      const langDir = path.join(PUBLIC_DIR, langObj.folder);
      fs.mkdirSync(langDir, { recursive: true });
      const localized = localizeSubfolderHtml(rootWithSeo, pageName, langObj);
      fs.writeFileSync(path.join(langDir, pageName), localized, 'utf-8');
      generatedCount += 1;
    }
  }

  console.log(
    `[build-i18n] SEO inyectado en ${PAGES.length} páginas ES y generadas ${generatedCount} páginas localizadas en /cat, /en, /fr, /zh y /ru.`
  );
}

run();

