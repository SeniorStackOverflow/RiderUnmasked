# 🛡️ Rider Unmasked: Glovo Rider Security Audit

![Android Target](https://img.shields.io/badge/Android_Target-API_35-3DDC84?style=for-the-badge&logo=android)
![Frida](https://img.shields.io/badge/Frida-17.9.1-f54254?style=for-the-badge)
![Reverse Engineering](https://img.shields.io/badge/Reverse-Engineering-1E2329?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Completed-success?style=for-the-badge)

> **⚠️ Disclaimer (Отказ от ответственности):** > Данный проект и все предоставленные материалы созданы **исключительно в образовательных и исследовательских целях**. Автор не несет ответственности за любое неправомерное использование информации. Данные не содержат PII (Personal Identifiable Information) реальных пользователей.

## 📌 О проекте

**Rider Unmasked** — это интерактивный дашборд с результатами глубокого статического и динамического анализа (Reverse Engineering) мобильного приложения Glovo Rider (v4.2614.1). 

В рамках аудита была проанализирована архитектура приложения (29,540+ классов), сетевое взаимодействие, а также успешно осуществлен обход эшелонированной защиты корпоративного уровня (Incognia Anti-Fraud, Android Key Attestation, in-memory DEX).

🔗 **[Посмотреть интерактивный отчет (GitHub Pages)](ссылка_на_твой_github_pages)**

## 🔬 Основные находки (Key Findings)

В ходе анализа были выявлены и продемонстрированы следующие критические архитектурные особенности и уязвимости:

* **🚨 Auth & Network API:** Полное отсутствие Certificate Pinning для собственного API. В качестве идентификатора устройства (`device_token`) используется FCM-токен, не привязанный к аппаратному хранилищу ключей (Keystore).
* **🛡️ Defeating Incognia (IAL403):** * Успешный обход аппаратной аттестации Android (Key Attestation) через блокировку генерации ключей (`t2p.Y()`).
  * Спуфинг UUID устройства (`installationId`) для сброса серверного кэша профиля.
  * Блокировка переходов стейт-машины Incognia SDK в состояния ошибки (`VzJ/G5R`).
* **🔑 Hardcoded Secrets:** Выявление слабой криптографии (XOR-63) для скрытия токенов Mapbox, а также компрометация `rider_scheduling_key`, позволяющая формировать валидные вызовы JS Bridge. Утечка Sentry DSN и ключей Google API в plaintext.
* **📍 Architecture & Tracking:** Обнаружена теневая отправка телеметрии и GPS-координат в сторонний сервис `Sentiance`, а также использование корейского провайдера `Naver` для просчета маршрутов вместо заявленного Mapbox.

## 🛠 Инструменты (Tech Stack)

* **Динамический анализ:** Frida (v17.9.1), кастомные JS-скрипты, внедрение Frida Gadget.
* **Статический анализ:** JADX, Ghidra (для `libe2ca.so`).
* **Упаковка / Патчинг:** Apktool, LIEF (модификация ELF заголовков `DT_NEEDED`), ручной патчинг smali, Zipalign.
* **Презентация:** HTML5, CSS3, Vanilla JavaScript.

## 🚀 Как запустить локально

Отчет представляет собой статичную веб-страницу (Single Page Application) без зависимостей от сторонних библиотек.

1. Склонируйте репозиторий:
   ```bash
   git clone [https://github.com/ТВОЙ_НИК/glovo-audit.git](https://github.com/ТВОЙ_НИК/glovo-audit.git)
