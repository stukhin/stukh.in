# Бумажный остров → главная stukh.in

Задача: сделать 3D-остров (бумажная топографическая модель) главной страницей stukh.in, `/`.
Остальные страницы сайта (`/nature`, `/city`, `/order`, `/blog`, 404) не трогаем.
Сайт — Next.js на Vercel, выкладка автоматическая при push в `main`.

Остров — готовая статическая сборка: один HTML плюс ассеты. Её собрали в отдельной сессии Claude. Внутри ничего не переписывать и не пересобирать.

## 1. Что уже лежит в репозитории (не закоммичено)

Все файлы положены в `public/` в том виде, в каком они нужны на сайте:

```
public/island.html               страница острова (минифицирована, ~410 КБ)
public/rooms.js                  «комнаты» внутри зданий (галерея, офис, лаборатория, кафе)
public/js/GLTFLoader.js          загрузчик моделей three.js r128
public/js/DRACOLoader.js
public/js/draco/draco_wasm_wrapper.js   декодер Draco (WebAssembly, основной)
public/js/draco/draco_decoder.wasm
public/js/draco/draco_decoder.js        декодер Draco (asm.js, запасной для браузеров без WebAssembly)
public/models/city_c2.glb        модель города (основная, грузится через fetch)
public/models/city_c2.js         та же модель в base64: запасной вариант, если .glb не отдаётся
public/models/toys.js            машинки
public/models/heroes.js          паром и остановки
public/img/ph/*.jpg              фото для галерей внутри зданий
public/img/int_*.jpg, i41.jpg, i44.jpg, img/logos/*.png
```

three.js r128 грузится с cdnjs (`https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`), это нормально.

## 2. Что сделать

### 2.1 Отдать остров по адресу `/`

В `next.config.mjs` добавить rewrite, который срабатывает раньше страниц приложения:

```js
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  turbopack: { root },
  async rewrites() {
    return {
      beforeFiles: [{ source: "/", destination: "/island.html" }],
    };
  },
};
```

Старую главную (`src/app/page.tsx`) не удалять: после правила она просто не показывается.
Откат — убрать это правило.

Важно: внутри `island.html` все пути относительные (`models/…`, `js/…`, `img/…`, `rooms.js`). Поэтому страница должна открываться именно с корня `/`. Если когда-нибудь переносить её в подпапку, нужно добавить в `<head>` тег `<base href="/папка/">`.

### 2.2 Кэш для тяжёлых файлов (желательно)

У файлов нет хэша в имени, поэтому кэш умеренный, на сутки:

```js
  async headers() {
    return [
      { source: "/models/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=86400" }] },
      { source: "/js/draco/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800" }] },
    ];
  },
```

### 2.3 Проверить локально

1. `npm run dev`, открыть `http://localhost:3000/`.
2. Сначала появляется лоудер: бумажная модель острова собирается слоями. Потом проявляется 3D-остров.
3. В DevTools → Network не должно быть ответов 404. Должны загрузиться:
   - `city_c2.glb` с кодом 200 (запасной `city_c2.js` при этом не грузится);
   - `draco_wasm_wrapper.js` и `draco_decoder.wasm` с кодом 200.
4. В консоли не должно быть ошибок.
5. Проверить остальные страницы: `/nature`, `/city`, `/order` открываются как раньше.
6. Мобильная эмуляция (iPhone):
   - вверху слева белый логотип;
   - справа кнопка погоды и кнопка пульта, обе раскрываются с анимацией;
   - внизу меню мест;
   - один палец двигает карту, щипок двумя пальцами зумит, поворот двумя пальцами вращает остров.
7. `npm run build` проходит без ошибок.

### 2.4 Выложить

Закоммитить изменения в `public/` и `next.config.mjs` одним коммитом, например «Island as the home page», и запушить в `main`.
Vercel выложит сам. После выкладки открыть https://stukh.in и повторить проверки из 2.3 (Network: `.glb` и `.wasm` с кодом 200).

## 3. Не делать

- Не минифицировать и не трогать `island.html` и `rooms.js`: они приходят готовыми и будут заменяться новыми версиями целиком.
- Не переименовывать `models/`, `js/`, `img/`: пути зашиты в странице.
- Не удалять `models/city_c2.js` и `js/draco/draco_decoder.js`: это запасные варианты.
- Не прогонять картинки через `next/image`: они грузятся напрямую.
- Не коммитить папки `blender/` и `.claude/` (рабочие исходники и настройки, на сайт не идут). Коммитить только `public/img`, `public/js`, `public/models`, `public/island.html`, `public/rooms.js`, `next.config.mjs` и, по желанию, этот файл.

## 4. Открытые вопросы к Саше

- Логотип на острове сейчас ведёт на `https://stukh.in`, то есть на ту же главную. Если нужно, поменять в `public/island.html` значение `href="https://stukh.in"` у элемента `id="logo"` на нужный адрес (например `/nature`).

## 5. Обновления в будущем

Новые версии острова будут приходить такой же папкой `public/…`. Обновление = заменить файлы, проверить по пункту 2.3, закоммитить, запушить.
