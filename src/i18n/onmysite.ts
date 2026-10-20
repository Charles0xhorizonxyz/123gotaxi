// Words of the "for places" one-pager (123go.taxi/onmysite/), in the site's six languages.

import type { Language } from './index';

export interface PlacesStrings {
  title: string;
  headline: string;
  lede: string;
  exampleCaption: string;
  benefitsTitle: string;
  benefits: { title: string; text: string }[];
  howTitle: string;
  steps: string[];
  printTip: string;
  helpTitle: string;
  helpText: string;
  guideLink: string;
  cta: string;
  backToApp: string;
}

export const PLACES: Record<Language, PlacesStrings> = {
  en: {
    title: '123go.taxi for restaurants, hotels and shops',
    headline: 'Bring your guests to your door by taxi',
    lede: 'Put a 123go.taxi card on your website. Guests show its QR to the taxi driver, and the route to your door starts in the driver’s own navigation app.',
    exampleCaption: 'A card as it looks on a website. Tap it on a phone, or scan it from a computer.',
    benefitsTitle: 'What it brings you',
    benefits: [
      { title: 'Guests arrive at the right door', text: 'No more phone calls to explain the way, no lost drivers, no wrong entrance.' },
      { title: 'Any driver, any app', text: 'Google Maps, Yandex, Waze, Apple Maps or any other. Drivers install nothing.' },
      { title: 'Any language', text: 'The driver reads a map, not your address. The card itself comes in six languages.' },
      { title: 'Free, no account, nothing collected', text: 'Open source. We never see your guests, nor where they go.' },
    ],
    howTitle: 'How to add it, in two minutes',
    steps: [
      'Open 123go.taxi, type your address and pick it from the list. Check that the address shown is your door.',
      'Tap “Put it on your website”, type your place’s name and choose the card’s language.',
      'Tap “Copy the code” and paste it on your Contact or Getting here page.',
    ],
    printTip: 'You can also download the QR and print it on menus, business cards, flyers or your door.',
    helpTitle: 'Someone else looks after your website?',
    helpText: 'Send them this page, or ask an AI assistant: the step-by-step guide below is written so it can do it exactly.',
    guideLink: 'Step-by-step guide (for web designers and AI assistants)',
    cta: 'Make your card',
    backToApp: 'Back to 123go.taxi',
  },
  fr: {
    title: '123go.taxi pour les restaurants, hôtels et commerces',
    headline: 'Amenez vos clients jusqu’à votre porte en taxi',
    lede: 'Ajoutez une carte 123go.taxi à votre site. Vos clients montrent son QR au chauffeur, et l’itinéraire jusqu’à votre porte démarre dans sa propre appli de navigation.',
    exampleCaption: 'Une carte telle qu’elle apparaît sur un site. Touchez-la sur un téléphone, ou scannez-la depuis un ordinateur.',
    benefitsTitle: 'Ce que ça vous apporte',
    benefits: [
      { title: 'Vos clients arrivent à la bonne porte', text: 'Plus d’appels pour expliquer le chemin, plus de chauffeurs perdus ni de mauvaise entrée.' },
      { title: 'Tous les chauffeurs, toutes les applis', text: 'Google Maps, Yandex, Waze, Plans ou une autre. Les chauffeurs n’installent rien.' },
      { title: 'Toutes les langues', text: 'Le chauffeur lit une carte, pas votre adresse. La carte existe elle-même en six langues.' },
      { title: 'Gratuit, sans compte, rien n’est collecté', text: 'Open source. Nous ne voyons jamais vos clients, ni où ils vont.' },
    ],
    howTitle: 'L’ajouter en deux minutes',
    steps: [
      'Ouvrez 123go.taxi, tapez votre adresse et choisissez-la dans la liste. Vérifiez que l’adresse affichée est bien votre porte.',
      'Touchez « Le mettre sur votre site », tapez le nom de votre établissement et choisissez la langue de la carte.',
      'Touchez « Copier le code » et collez-le sur votre page Contact ou Accès.',
    ],
    printTip: 'Vous pouvez aussi télécharger le QR et l’imprimer sur vos menus, cartes de visite, flyers ou votre porte.',
    helpTitle: 'Quelqu’un d’autre s’occupe de votre site ?',
    helpText: 'Envoyez-lui cette page, ou demandez à un assistant IA : le guide pas à pas ci-dessous est écrit pour qu’il le fasse exactement.',
    guideLink: 'Guide pas à pas (pour webdesigners et assistants IA, en anglais)',
    cta: 'Créer votre carte',
    backToApp: 'Retour à 123go.taxi',
  },
  tr: {
    title: 'Restoranlar, oteller ve dükkânlar için 123go.taxi',
    headline: 'Misafirlerinizi taksiyle kapınıza kadar getirin',
    lede: 'Web sitenize bir 123go.taxi kartı ekleyin. Misafirleriniz QR kodu taksi şoförüne gösterir ve kapınıza giden rota şoförün kendi navigasyon uygulamasında başlar.',
    exampleCaption: 'Bir web sitesinde görünen kart. Telefonda dokunun ya da bilgisayardan okutun.',
    benefitsTitle: 'Size ne kazandırır',
    benefits: [
      { title: 'Misafirler doğru kapıya gelir', text: 'Yol tarif etmek için telefon yok, kaybolan şoför yok, yanlış giriş yok.' },
      { title: 'Her şoför, her uygulama', text: 'Google Haritalar, Yandex, Waze, Apple Haritalar ya da başka biri. Şoför hiçbir şey yüklemez.' },
      { title: 'Her dil', text: 'Şoför adresinizi değil, haritayı okur. Kartın kendisi de altı dilde.' },
      { title: 'Ücretsiz, hesap yok, veri toplanmaz', text: 'Açık kaynak. Misafirlerinizi ve nereye gittiklerini asla görmeyiz.' },
    ],
    howTitle: 'İki dakikada nasıl eklenir',
    steps: [
      '123go.taxi’yi açın, adresinizi yazın ve listeden seçin. Gösterilen adresin kapınız olduğunu kontrol edin.',
      '“Web sitenize ekleyin”e dokunun, işletmenizin adını yazın ve kartın dilini seçin.',
      '“Kodu kopyala”ya dokunun ve İletişim ya da Ulaşım sayfanıza yapıştırın.',
    ],
    printTip: 'QR’ı indirip menülere, kartvizitlere, el ilanlarına ya da kapınıza da basabilirsiniz.',
    helpTitle: 'Web sitenizle başkası mı ilgileniyor?',
    helpText: 'Bu sayfayı ona gönderin ya da bir yapay zekâ asistanına sorun: aşağıdaki adım adım kılavuz, onun tam olarak uygulayabileceği şekilde yazıldı.',
    guideLink: 'Adım adım kılavuz (web tasarımcıları ve yapay zekâ asistanları için, İngilizce)',
    cta: 'Kartınızı oluşturun',
    backToApp: '123go.taxi’ye dön',
  },
  de: {
    title: '123go.taxi für Restaurants, Hotels und Geschäfte',
    headline: 'Bringen Sie Ihre Gäste mit dem Taxi bis vor die Tür',
    lede: 'Setzen Sie eine 123go.taxi-Karte auf Ihre Website. Gäste zeigen ihren QR dem Taxifahrer, und die Route zu Ihrer Tür startet in seiner eigenen Navigations-App.',
    exampleCaption: 'So sieht eine Karte auf einer Website aus. Am Telefon antippen oder vom Computer aus scannen.',
    benefitsTitle: 'Was es Ihnen bringt',
    benefits: [
      { title: 'Gäste kommen an der richtigen Tür an', text: 'Keine Anrufe mehr, um den Weg zu erklären, keine verirrten Fahrer, kein falscher Eingang.' },
      { title: 'Jeder Fahrer, jede App', text: 'Google Maps, Yandex, Waze, Apple Karten oder eine andere. Fahrer installieren nichts.' },
      { title: 'Jede Sprache', text: 'Der Fahrer liest eine Karte, nicht Ihre Adresse. Die Karte selbst gibt es in sechs Sprachen.' },
      { title: 'Kostenlos, ohne Konto, nichts wird gesammelt', text: 'Open Source. Wir sehen nie Ihre Gäste, noch wohin sie fahren.' },
    ],
    howTitle: 'In zwei Minuten eingebaut',
    steps: [
      'Öffnen Sie 123go.taxi, geben Sie Ihre Adresse ein und wählen Sie sie in der Liste. Prüfen Sie, dass die angezeigte Adresse Ihre Tür ist.',
      'Tippen Sie auf „Auf Ihre Website stellen“, geben Sie den Namen Ihres Hauses ein und wählen Sie die Sprache der Karte.',
      'Tippen Sie auf „Code kopieren“ und fügen Sie ihn auf Ihrer Kontakt- oder Anfahrtsseite ein.',
    ],
    printTip: 'Sie können den QR auch herunterladen und auf Speisekarten, Visitenkarten, Flyer oder Ihre Tür drucken.',
    helpTitle: 'Jemand anderes betreut Ihre Website?',
    helpText: 'Schicken Sie ihm diese Seite oder fragen Sie einen KI-Assistenten: Die Schritt-für-Schritt-Anleitung unten ist so geschrieben, dass er es genau umsetzen kann.',
    guideLink: 'Schritt-für-Schritt-Anleitung (für Webdesigner und KI-Assistenten, auf Englisch)',
    cta: 'Ihre Karte erstellen',
    backToApp: 'Zurück zu 123go.taxi',
  },
  es: {
    title: '123go.taxi para restaurantes, hoteles y tiendas',
    headline: 'Trae a tus clientes en taxi hasta tu puerta',
    lede: 'Pon una tarjeta de 123go.taxi en tu web. Tus clientes muestran su QR al taxista, y la ruta hasta tu puerta empieza en la propia app de navegación del conductor.',
    exampleCaption: 'Una tarjeta tal como se ve en una web. Tócala en el teléfono o escanéala desde un ordenador.',
    benefitsTitle: 'Lo que te aporta',
    benefits: [
      { title: 'Tus clientes llegan a la puerta correcta', text: 'Se acabaron las llamadas para explicar el camino, los conductores perdidos y las entradas equivocadas.' },
      { title: 'Cualquier conductor, cualquier app', text: 'Google Maps, Yandex, Waze, Apple Mapas u otra. Los conductores no instalan nada.' },
      { title: 'Cualquier idioma', text: 'El conductor lee un mapa, no tu dirección. La tarjeta está en seis idiomas.' },
      { title: 'Gratis, sin cuenta, sin recoger datos', text: 'Código abierto. Nunca vemos a tus clientes ni adónde van.' },
    ],
    howTitle: 'Cómo añadirla en dos minutos',
    steps: [
      'Abre 123go.taxi, escribe tu dirección y elígela en la lista. Comprueba que la dirección que aparece es tu puerta.',
      'Toca «Ponerlo en tu web», escribe el nombre de tu local y elige el idioma de la tarjeta.',
      'Toca «Copiar el código» y pégalo en tu página de Contacto o Cómo llegar.',
    ],
    printTip: 'También puedes descargar el QR e imprimirlo en cartas, tarjetas de visita, folletos o en tu puerta.',
    helpTitle: '¿Otra persona se ocupa de tu web?',
    helpText: 'Envíale esta página, o pídeselo a un asistente de IA: la guía paso a paso de abajo está escrita para que pueda hacerlo exactamente.',
    guideLink: 'Guía paso a paso (para diseñadores web y asistentes de IA, en inglés)',
    cta: 'Crea tu tarjeta',
    backToApp: 'Volver a 123go.taxi',
  },
  ru: {
    title: '123go.taxi для ресторанов, отелей и магазинов',
    headline: 'Пусть гости приезжают на такси прямо к вашей двери',
    lede: 'Разместите карточку 123go.taxi на своём сайте. Гости показывают её QR водителю такси, и маршрут до вашей двери запускается в его собственном навигаторе.',
    exampleCaption: 'Так карточка выглядит на сайте. На телефоне на неё нажимают, с компьютера сканируют.',
    benefitsTitle: 'Что это вам даёт',
    benefits: [
      { title: 'Гости приезжают к нужной двери', text: 'Больше никаких звонков с объяснением дороги, заблудившихся водителей и не того входа.' },
      { title: 'Любой водитель, любое приложение', text: 'Google Карты, Яндекс, Waze, Apple Карты или другое. Водителю ничего не нужно устанавливать.' },
      { title: 'Любой язык', text: 'Водитель читает карту, а не ваш адрес. Сама карточка есть на шести языках.' },
      { title: 'Бесплатно, без регистрации, без сбора данных', text: 'Открытый код. Мы никогда не видим ваших гостей и то, куда они едут.' },
    ],
    howTitle: 'Как добавить за две минуты',
    steps: [
      'Откройте 123go.taxi, введите свой адрес и выберите его в списке. Проверьте, что показанный адрес — это ваша дверь.',
      'Нажмите «Разместить на вашем сайте», введите название заведения и выберите язык карточки.',
      'Нажмите «Скопировать код» и вставьте его на страницу «Контакты» или «Как добраться».',
    ],
    printTip: 'QR можно также скачать и напечатать на меню, визитках, листовках или на двери.',
    helpTitle: 'Сайтом занимается кто-то другой?',
    helpText: 'Отправьте ему эту страницу или попросите ИИ-ассистента: пошаговое руководство ниже написано так, чтобы он мог выполнить всё точно.',
    guideLink: 'Пошаговое руководство (для веб-дизайнеров и ИИ-ассистентов, на английском)',
    cta: 'Создать карточку',
    backToApp: 'Назад в 123go.taxi',
  },
};
