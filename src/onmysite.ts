// 123go.taxi/onmysite/: the one-pager for restaurants, hotels and shops, in the
// visitor's language (same choice as the app, changed with 文A in the corner).

import '@fontsource/archivo/400.css';
import '@fontsource/archivo/700.css';
import '@fontsource/alfa-slab-one/400.css';
import '@fontsource/roboto-slab/cyrillic-900.css';
import './styles/main.css';
import { buildJourneyUrl } from './destination-url';
import { h } from './dom';
import { language, t } from './i18n';
import { PLACES } from './i18n/onmysite';
import { CARD_LANGUAGES } from './pages/business';
import { creditFooter } from './pages/common';
import { cornerButtons } from './pages/install';
import { qrDataUrl } from './qr';

const GUIDE_URL = 'https://github.com/Charles0xhorizonxyz/123gotaxi/blob/main/docs/ADD-TO-YOUR-WEBSITE.md';
/** The example card points at Galata Tower, so it works when tapped. */
const EXAMPLE = { stops: [{ lat: 41.02564, lon: 28.97417 }], label: 'Galata Kulesi' };

const p = PLACES[language];
document.documentElement.lang = language;
document.title = p.title;

const exampleUrl = buildJourneyUrl('https://123go.taxi', EXAMPLE);
const exampleQr = h('img', { width: '180', height: '180', alt: CARD_LANGUAGES[language].alt });
void qrDataUrl(exampleUrl).then((src) => (exampleQr.src = src));

document.querySelector<HTMLElement>('#app')!.replaceChildren(
  h(
    'header',
    { class: 'masthead' },
    h(
      'div',
      { class: 'masthead-row' },
      h(
        'a',
        { class: 'wordmark-link', href: '/', 'aria-label': p.backToApp },
        h(
          'span',
          { class: 'wordmark' },
          h('img', { src: '/logo.svg', alt: '', width: '56', height: '58' }),
          '123go.taxi',
        ),
      ),
    ),
    h('p', { class: 'tagline' }, t.tagline),
  ),
  h(
    'section',
    { class: 'places-hero' },
    h('h1', { class: 'places-headline' }, p.headline),
    h('p', { class: 'places-lede' }, p.lede),
    h(
      'figure',
      { class: 'places-example' },
      h('a', { class: 'business-card', href: exampleUrl, lang: language }, h('span', {}, CARD_LANGUAGES[language].text), exampleQr),
      h('figcaption', { class: 'hint' }, p.exampleCaption),
    ),
  ),
  h(
    'section',
    { class: 'block' },
    h('h2', {}, p.benefitsTitle),
    h(
      'ul',
      { class: 'places-benefits' },
      ...p.benefits.map((b) => h('li', {}, h('strong', {}, b.title), h('span', {}, b.text))),
    ),
  ),
  h(
    'section',
    { class: 'block' },
    h('h2', {}, p.howTitle),
    h('ol', { class: 'places-steps' }, ...p.steps.map((step) => h('li', {}, step))),
    h('p', { class: 'hint' }, p.printTip),
    h('a', { class: 'button go places-cta', href: '/' }, p.cta),
  ),
  h(
    'section',
    { class: 'block' },
    h('h2', {}, p.helpTitle),
    h('p', {}, p.helpText),
    h('a', { class: 'text-link places-guide', href: GUIDE_URL, rel: 'noopener', target: '_blank' }, p.guideLink),
  ),
  cornerButtons(),
  creditFooter(),
);
