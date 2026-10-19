import './styles/main.css';
import { getLanguage, pickLanguage, setLanguage, t } from './i18n';

function render(): void {
  document.documentElement.lang = getLanguage();
  const app = document.querySelector<HTMLElement>('#app');
  if (!app) return;

  const langButton = document.createElement('button');
  langButton.type = 'button';
  langButton.className = 'lang-switch';
  langButton.textContent = t('lang.switch');
  langButton.addEventListener('click', () => {
    setLanguage(getLanguage() === 'tr' ? 'en' : 'tr');
    render();
  });

  const header = document.createElement('header');
  const title = document.createElement('h1');
  title.textContent = 'gogogo.rodeo';
  const tagline = document.createElement('p');
  tagline.className = 'tagline';
  tagline.textContent = t('app.tagline');
  header.append(title, tagline);

  const status = document.createElement('p');
  status.textContent = t('app.comingSoon');

  const footer = document.createElement('footer');
  footer.textContent = t('app.slogan');

  app.replaceChildren(langButton, header, status, footer);
}

setLanguage(pickLanguage(navigator.languages ?? [navigator.language]));
render();
