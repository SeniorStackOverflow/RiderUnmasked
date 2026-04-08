<div align="center">

# 🔍 RIDER UNMASKED

### Глубокий реверс-инжиниринг и аудит безопасности

**Glovo Rider Android App** · `com.logistics.rider.glovo` · v4.2614.1 (build 1210)

---

*29 540 классов. 26 уязвимостей. 0 официальных заявлений.*

---

![Static Badge](https://img.shields.io/badge/Platform-Android%209--15-3DDC84?style=flat-square&logo=android&logoColor=white)
![Static Badge](https://img.shields.io/badge/Findings-26%20vulnerabilities-FF2D55?style=flat-square)
![Static Badge](https://img.shields.io/badge/Critical-2-FF2D55?style=flat-square)
![Static Badge](https://img.shields.io/badge/High-9-FF6B35?style=flat-square)
![Static Badge](https://img.shields.io/badge/Built%20with-HTML%20%2F%20CSS%20%2F%20JS-FFD100?style=flat-square)
![Static Badge](https://img.shields.io/badge/No%20framework-Zero%20deps-00D68F?style=flat-square)

</div>

---

## 🎯 О проекте

**Rider Unmasked** — это интерактивный веб-сайт, визуализирующий результаты полного технического аудита мобильного приложения Glovo Rider. Каждый байт отчёта превращён в живую, анимированную страницу: архитектурные диаграммы, схемы API-потоков, карты уязвимостей и многое другое.

> Исследование проводилось в **образовательных целях** методами статического и динамического анализа с использованием JADX, Frida и сетевого перехвата трафика.

---

## 🗂️ Структура проекта

```
RiderUnmasked/
│
├── 📄 index.html                 ← Главная страница (900 строк чистого HTML)
│
├── 🎨 css/
│   ├── tokens.css                ← Дизайн-токены: цвета, шрифты, отступы
│   ├── base.css                  ← Сброс стилей, типографика, утилиты
│   ├── layout.css                ← Сетка, навигация, hero-секция, адаптив
│   ├── components.css            ← Карточки, таблицы, диаграммы, фильтры
│   └── animations.css            ← Keyframes, scroll-reveal анимации
│
├── ⚡ js/
│   ├── scroll.js                 ← IntersectionObserver: reveal + активная nav
│   └── app.js                    ← Фильтр уязвимостей + анимированные счётчики
│
└── 📋 glovo-rider-analysis.md    ← Исходный отчёт аудита (источник данных)
```

---

## 🚀 Быстрый старт

Сайт не требует сборки, npm или каких-либо зависимостей. Просто открой файл:

```bash
# Linux
xdg-open index.html

# macOS
open index.html

# Или через локальный сервер (рекомендуется для Google Fonts)
python3 -m http.server 8080
# → Открой http://localhost:8080
```

---

## 📖 Содержание аудита

Сайт охватывает **9 глубоких технических разделов** на основе реального кода приложения:

### 🏗️ Архитектура приложения
Двойная пакетная структура: **легаси** `com.foodora.courier` сосуществует с **современной** `com.roadrunner` (Clean Architecture). XAPK-бандл из 3 APK-файлов, 29 540 Java/Kotlin классов, поддержка HuaweiMobileServices параллельно с Google Play Services.

### 🔐 Система аутентификации
Полный разбор всех flow: **Login → 2FA (SMS/TOTP) → Magic Link → Biometrics → Nafath** (Saudi national ID). JWT с раздельными access/refresh токенами, механизм автоматического обновления сессии.

### 🛡️ Защита и обнаружение
**17 техник** root/tamper-detection: проверки файловых путей, root-приложений, `Build.TAGS`, эмулятора, `su`-бинарников, отладчика, Frida-порта 27042, нативных JNI через `libfoo.so`. Всё — **в режиме молчания**: результаты уходят в Firebase Crashlytics и Incognia, приложение никогда не падает и не предупреждает пользователя.

### 📍 Слежение за местоположением
**Два независимых слоя** GPS-трекинга: нативный Glovo через `rider_status` endpoint + **Sentiance SDK** с интервалом обновления 500 мс и автоперезапуском. Incognia SDK собирает данные о железе, сети, установленных приложениях, настройках доступности и сенсорах.

### 📦 Машина состояний доставки
8 состояний заказа: `DISPATCHED → COURIER_NOTIFIED → ACCEPTED → NEAR_PICKUP → PICKED_UP → LEFT_PICKUP → NEAR_DROPOFF → DELIVERED` с полной документацией API-вызовов на каждом переходе.

### ⚡ Real-time коммуникации
**Socket.IO v3** как основной канал + FCM/HMS push как fallback. Экспоненциальный backoff при реконнекте: `1s → 2s → 4s → 8s → 16s → 32s → stop`.

### 🗺️ Mapbox и маршрутизация
Маршруты строятся через **Naver API**, а не Mapbox Directions. Mapbox используется только для рендеринга карты. Токен обфусцирован через **XOR-63**.

### 💳 Кошелёк и платежи
Server-driven UI компоненты, cashout flow, COD-сверка. Критическая деталь: **Room DB не зашифрована**, финансовые данные хранятся в открытом виде.

### 🔴 Уязвимости (26 находок)

| Критичность | Кол-во | Примеры |
|:-----------:|:------:|---------|
| 🔴 Critical | 2 | Незашифрованное хранилище финансовых данных, обходимый Device Token |
| 🟠 High | 9 | XOR-обфускация ключей, токены в логах, отсутствие certificate pinning |
| 🟡 Medium | 11 | Hardcoded endpoints, избыточные разрешения, слабый backoff |
| 🟢 Low | 4 | Информационные утечки, устаревшие зависимости |

---

## 🛠️ Технический стек сайта

| Технология | Применение |
|------------|-----------|
| **Vanilla HTML5** | Семантическая разметка, без фреймворков |
| **CSS Custom Properties** | Единая система дизайн-токенов |
| **CSS Grid + Clamp** | Адаптив от 320px без media-query костылей |
| **IntersectionObserver** | Scroll-reveal анимации и активная nav |
| **RequestAnimationFrame** | Плавные счётчики статистики |
| **Google Fonts** | Bebas Neue · Syne · JetBrains Mono · DM Sans |

### ✨ Интересные решения

- **`min-width: 0`** на grid-детях — устраняет переполнение текста в сетках
- **CSS custom property `--w`** — data-driven ширины для backoff-диаграммы без inline JS
- **`card.hidden = !show`** — семантический toggle для фильтрации вместо `style.display`
- **`clamp(3.2rem, 12vw, 10rem)`** — hero-заголовок не ломает верстку на 320px экранах

---

## ⚠️ Дисклеймер

Всё исследование проведено в **образовательных целях**. Данные получены из публично доступного APK методами статического анализа. Никакие production-системы не затрагивались. Уязвимости задокументированы для повышения осведомлённости о безопасности мобильных приложений.

---

<div align="center">

**`com.logistics.rider.glovo`** · **`com.foodora.courier`** · **`com.roadrunner`**

*Сделано с 🔬 и здоровым параноидальным интересом к тому, что происходит внутри.*

</div>
