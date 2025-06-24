# Настройка VK ID для SubBoard

## Шаг 1: Создание VK приложения

1. Перейдите на [VK для разработчиков](https://id.vk.com/about/business/go)
2. Нажмите "Создать приложение"
3. Выберите "Web-приложение"

## Шаг 2: Настройка домена и redirect URL

В форме настройки укажите:

### Базовый домен:
```
localhost
```

### Доверенный Redirect URL:
```
https://localhost:3000/auth/vk/callback
```

## Шаг 3: Получение App ID

После создания приложения скопируйте **App ID** из настроек.

## Шаг 4: Обновление кода

Замените `YOUR_VK_APP_ID` в файле `index.html` на ваш реальный App ID:

**⚠️ Важно:** VK требует HTTPS для redirect URL. Мы настроили Vite для работы с HTTPS на localhost.

```html
<script src="https://unpkg.com/@vkid/sdk@2.4.0/dist/index.umd.js" 
        onload="window.VKIDSDK.Config.init({ 
          app: 12345678, // Ваш App ID
          redirectUrl: 'https://localhost:3000/auth/vk/callback' 
        });"></script>
```

## Шаг 5: Для продакшена

Когда будете деплоить на реальный домен, добавьте его в настройки VK приложения:

### Базовый домен:
```
yourdomain.com
```

### Доверенный Redirect URL:
```
https://yourdomain.com/auth/vk/callback
```

И обновите код соответственно.

## ⚡ Запуск с HTTPS

Теперь запускайте фронтенд командой:
```bash
npm run dev
```

Vite автоматически создаст самоподписанный SSL сертификат и запустится на `https://localhost:3000`.

**Первый запуск:** Браузер покажет предупреждение о небезопасном соединении - это нормально для разработки. Нажмите "Дополнительно" → "Перейти на localhost" для продолжения.

## 🔒 Альтернативный способ (если не работает HTTPS)

Если возникают проблемы с HTTPS на localhost, можно использовать ngrok для создания HTTPS туннеля:

1. Установите [ngrok](https://ngrok.com/)
2. Запустите фронтенд обычно: `npm run dev` (без HTTPS)
3. В другом терминале: `ngrok http 3000`
4. Используйте HTTPS URL от ngrok в настройках VK приложения 