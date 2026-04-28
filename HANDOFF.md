# stukh.in — передача контекста

Документ для продолжения работы в следующей сессии.

## Что это за проект

Персональный сайт-портфолио фотографа **Sasha Stukhin** (landscape photography).
Задача — **пересобрать с нуля на современном стеке**, повторяя 1:1 дизайн существующего сайта. Старая версия — статический экспорт Next.js + PHP-эндпоинты.

Исходников старой версии у пользователя нет, поэтому все визуальные решения мы воссоздаём по скриншотам билда + HTML/CSS из `(old)/`.

## Структура папок

```
/Users/alexnderstyukhin/Projects/stukh.in/
├── (old)/            ← старая версия (build + PHP), визуальный референс
│   ├── index.html, nature.html, city.html, order.html, 404.html
│   ├── _next/static/css/ ← ~80 старых CSS; ключевые файлы — 5c086d0f0f0505e5.css
│   │                      (главная), e075ed9968cdca74.css (nature/city),
│   │                      05d0c483b83f5ff5.css (order)
│   ├── images/       ← оригинальные ассеты
│   ├── nature.json, city.json ← данные галерей
│   └── check.php, info.php, request.php ← контакт-форма (пока не портирована)
├── src/
│   ├── app/          ← App Router: layout, page, nature/, city/, order/, not-found
│   ├── components/   ← 17 компонентов (см. ниже)
│   └── data/         ← nature.json (25 записей, но используем первые 21),
│                      city.json (7 записей)
├── public/
│   ├── images/       ← gallery/{nature,city}/{vertical,horizontal,zoomed},
│   │                   gallery/main/{desktop,mobile}, misc/, parallax/, order/
│   ├── fonts/        ← Rubik (не используется, подключён через Google Fonts)
│   ├── icons/        ← tg, inst, bm, picture (SVG)
│   └── favicon.ico
├── .claude/launch.json   ← preview-конфиги: stukhin-dev :3000, stukhin-prod :3000,
│                          stukhin-old :8080
├── package.json, tsconfig.json, next.config.mjs
└── HANDOFF.md
```

## Стек

- **Next.js 16.2.4** (App Router, Turbopack), **React 19.2.0**, **TypeScript**
- **CSS Modules**
- **Swiper 11** для галерей (loop включён)
- **Rubik** через Google Fonts

## Как запустить

```bash
cd /Users/alexnderstyukhin/Projects/stukh.in
npm run dev      # dev :3000
npm run build    # production build
npm run start    # production :3000
```

В Claude Code preview-тулзах:
- `preview_start stukhin-prod` — прод-сборка на 3000 (стабильно)
- `preview_start stukhin-dev` — dev на 3000 (Turbopack иногда тормозит прелоадер)

## Что сделано (полностью)

### Базовая инфраструктура
- Scaffolding Next.js + TS + CSS Modules
- AppShell обёртка: Cursor + Logo + Burger + MenuPopup
- Перенесены все ассеты (images, icons, fonts, JSON)
- Routing: `/`, `/nature`, `/city`, `/order`, `/not-found`

### Компоненты
- **Logo** — SVG-лого с правильным viewBox="0 0 110 85", позиция top-left, fill настраивается
- **Burger** — круглая кнопка с backdrop-blur, два line'а превращающиеся в крест
- **Menu / MenuPopup** — инлайн-меню + оверлей-попап с анимацией штрихов; ESC закрывает
- **Socials** — tg + inst, с анимированным подчёркиванием
- **Cursor** — кастомный курсор, shapes: default / hover / arrow-left / arrow-right / picture (для активной фотки в галерее); hidden на touch-устройствах
- **Preloader** — 1.8s показ + 0.4s fade, лого слева-сверху, "Loading..." с -webkit-box-reflect

### Главная (/)
- **HomeSlider** — кросс-фейд 4 фото из `gallery/main/desktop/`, автоплей 7s, dots с прогресс-заполнением, edge-click zones с arrow-курсором
- На десктопе (>=1025px): меню inline bottom-right, соцсети bottom-left, бургер скрыт
- На планшете/мобилке: бургер видимый, меню через MenuPopup

### Галереи Nature / City
- **GallerySlider** с Swiper: centeredSlides + slidesPerView="auto" + **loop**
- Центральная фотка в рамке (`picture_frame.png` / `picture_frame_w.png`) с тенью (`picture_bg`)
- Боковые фотки scale(0.53), grayscale, opacity 0.5
- Название + локация под центральной фоткой (fade-in на смену)
- Edge-click zones с arrow-left/arrow-right курсором + стрелками клавиатуры
- Range-slider (progress) внизу для прямой навигации
- Клик по активной фотке открывает **GalleryModal**
- **Nature**: dark theme (`bg_nature.jpg`), burger bg `#3C3C3C` + line `#FFFFFF`
- **City**: light theme (`bg_city.jpg`), бургер тёмный, рамка белая
- В `/nature` обрезаем до первых 21 item'а (столько есть картинок); в `/city` все 7

### GalleryModal
- Fullscreen оверлей на `#141414`, fade-in + scale-in picture
- Close-button (чёрный круг с крестом), vertical / horizontal переключатель
- ESC закрывает; фолбек на vertical при отсутствии horizontal

### Order (/order)
- **Parallax hero** из 5 PNG-слоёв (`parallax/1-5.png`) + bg. Горизонтальный сдвиг от мыши (back медленнее, front быстрее) + вертикальный сдвиг от скролла (эффект глубины)
- **OrderMenu**: якорные ссылки prints / shoot / touch с синими подчёркиваниями; **fade-out после 400px скролла**
- **Три OrderSection** с чередующимся reverse layout: текст слева (или справа) + **Prints** (коллаж из 3 поляроидов с ротацией)
- **ButtonUp** — fixed кнопка "наверх" появляется после 600px скролла
- Градиентный overlay на мобилке над hero'ем для читаемости

### 404 (not-found)
- Переделан под стиль сайта: dark bg с bg_nature.jpg overlay, Rubik, крупное "404", подзаголовок, "return to main" с underline-анимацией

## Известные нюансы

1. `nature.json` содержит 25 записей, но фотографий только 21 (баг из оригинала). В `src/app/nature/page.tsx` используем `natureData.slice(0, 21)`.
2. В `public/fonts/` лежат woff2 Rubik, но фактически шрифт грузится с Google Fonts. Можно убрать локальные, но не критично.
3. Dev-сервер (Turbopack) иногда не запускает таймеры прелоадера сразу; на прод-сборке всё работает стабильно.
4. Preview-сервер `stukhin-old` в launch.json ссылается на путь `~/Documents/Projects/stukh.in/(old)` — реальный путь в `~/Projects/stukh.in/(old)`. Поправить если пригодится.
5. PHP-эндпоинты (`check.php`, `info.php`, `request.php`) из старой версии отвечали за контакт-форму. На новом сайте формы пока нет (контакт через Telegram).

## Если захочется расширить

- **Контакт-форма** — добавить `/api/contact` Route Handler, заменить ссылку "Contact me" на модалку с формой
- **Загрузка ассетов** — перевести изображения галерей на `next/image` (сейчас обычные `<img>`); даст lazy-loading и blur-placeholder
- **SEO** — добавить per-page `metadata.description`, OG-теги с превью фото
- **Аналитика** — не подключена
- **Переключатель ru/en** — текст на сайте в основном русский (цены) + английский (заголовки); сейчас один язык

## Полезные ссылки по коду

- Цвета темы: см. `src/app/{nature,city,order}/*.module.css`
- Типографика: `globals.css` + `Menu.module.css` (font-size:20/25px, letter-spacing:-0.03em)
- Breakpoints: **1025px+** (desktop), **598-1024px** (tablet), **<=597px** (mobile)
- Все интерактивные элементы получают `cursor: none` в `globals.css` (работает только на десктопе)
