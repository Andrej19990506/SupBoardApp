# 🔒 ТЕСТИРОВАНИЕ БЕЗОПАСНОСТИ ЧЕРЕЗ POSTMAN

## Базовые настройки

**Base URL:** `http://localhost:8000`

**Обязательные заголовки для всех запросов:**
```
Content-Type: application/json
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36
Accept: application/json
Accept-Language: ru-RU,ru;q=0.9,en;q=0.8
Accept-Encoding: gzip, deflate, br
sec-ch-ua: "Google Chrome";v="91", "Chromium";v="91", ";Not A Brand";v="99"
sec-ch-ua-platform: "Windows"
sec-ch-ua-mobile: ?0
```

---

## 🧪 ТЕСТ 1: Проверка существования пользователя

### Легитимный запрос
```http
POST /api/v1/auth/check-phone
Content-Type: application/json

{
  "phone": "+79001234567"
}
```

**Ожидаемый ответ:** `404 Not Found`
```json
{
  "detail": "Пользователь с таким номером телефона не найден. Пожалуйста, зарегистрируйтесь."
}
```

### 🚨 SQL Injection атака
```http
POST /api/v1/auth/check-phone
Content-Type: application/json

{
  "phone": "+7900'; DROP TABLE clients; --"
}
```

**Проверяем:** Система должна отклонить с `400 Bad Request`

### 🚨 XSS атака
```http
POST /api/v1/auth/check-phone
Content-Type: application/json

{
  "phone": "<script>alert('XSS')</script>"
}
```

**Проверяем:** Система должна отклонить с `400 Bad Request`

---

## 🧪 ТЕСТ 2: Rate Limiting на SMS

### Массовые запросы SMS
Выполните подряд 10 запросов:

```http
POST /api/v1/auth/send-sms-code
Content-Type: application/json

{
  "phone": "+79001234567"
}
```

**Проверяем:** 
- Первые 5 запросов: `404 Not Found` (пользователь не найден)
- После 5-го запроса: `429 Too Many Requests`

```json
{
  "detail": "Превышен лимит SMS запросов. Попробуйте через X минут."
}
```

---

## 🧪 ТЕСТ 3: Device Trust без cookie

### Проверка Device Trust без refresh token
```http
POST /api/v1/auth/check-device-trust
Content-Type: application/json

{
  "phone": "+79001234567"
}
```

**Ожидаемый ответ:** `200 OK`
```json
{
  "trusted": false,
  "reason": "no_refresh_token",
  "message": "Отсутствует refresh token в cookie"
}
```

---

## 🧪 ТЕСТ 4: Поддельный refresh token

### С поддельным cookie
```http
POST /api/v1/auth/check-device-trust
Content-Type: application/json
Cookie: refresh_token=fake_token_12345

{
  "phone": "+79001234567"
}
```

**Ожидаемый ответ:** `200 OK`
```json
{
  "trusted": false,
  "reason": "invalid_session",
  "message": "Сессия не найдена или недействительна"
}
```

---

## 🧪 ТЕСТ 5: Endpoint /me без токена

### Без Authorization заголовка
```http
GET /api/v1/auth/me
```

**Ожидаемый ответ:** `401 Unauthorized`
```json
{
  "detail": "Отсутствует токен авторизации"
}
```

### С поддельным токеном
```http
GET /api/v1/auth/me
Authorization: Bearer fake_token_123
```

**Ожидаемый ответ:** `401 Unauthorized`
```json
{
  "detail": "Неверный токен"
}
```

---

## 🧪 ТЕСТ 6: Подмена Device Fingerprint

### Легитимный запрос с одними заголовками
```http
POST /api/v1/auth/check-device-trust
Content-Type: application/json
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
Accept-Language: ru-RU,ru;q=0.9

{
  "phone": "+79001234567"
}
```

### Затем с поддельными заголовками (эмуляция атаки)
```http
POST /api/v1/auth/check-device-trust
Content-Type: application/json
User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15
Accept-Language: en-US,en;q=0.9
sec-ch-ua-mobile: ?1
sec-ch-ua-platform: "iOS"

{
  "phone": "+79001234567"
}
```

**Проверяем:** Система должна определить разные fingerprint и отклонить доверие

---

## 🧪 ТЕСТ 7: Refresh endpoint с поддельными данными

### Поддельный refresh token
```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "fake_refresh_token_12345"
}
```

**Ожидаемый ответ:** `401 Unauthorized`
```json
{
  "detail": "Недействительный refresh token"
}
```

---

## 🧪 ТЕСТ 8: Auto-login без валидной сессии

### Попытка автоматического входа
```http
POST /api/v1/auth/auto-login
Content-Type: application/json

{
  "phone": "+79001234567"
}
```

**Ожидаемый ответ:** `401 Unauthorized`
```json
{
  "detail": "Отсутствует refresh token - требуется SMS код"
}
```

---

## 🧪 ТЕСТ 9: Доступ к защищенным endpoints

### Device Sessions без авторизации
```http
GET /api/v1/auth/device-sessions
```

**Ожидаемый ответ:** `401 Unauthorized` (должен требовать валидную сессию)

### Удаление сессии без авторизации
```http
DELETE /api/v1/auth/device-sessions/123
```

**Ожидаемый ответ:** `401 Unauthorized`

---

## 🧪 ТЕСТ 10: Injection в различных полях

### JSON Injection
```http
POST /api/v1/auth/check-phone
Content-Type: application/json

{
  "phone": "+7900\",\"admin\":true,\"hack\":\"yes"
}
```

### NoSQL Injection (если используется)
```http
POST /api/v1/auth/check-phone
Content-Type: application/json

{
  "phone": {"$ne": null}
}
```

### Command Injection
```http
POST /api/v1/auth/check-phone
Content-Type: application/json

{
  "phone": "+7900; rm -rf /"
}
```

**Проверяем:** Все должны быть отклонены с `400 Bad Request`

---

## 📊 Что проверяем в ответах:

### ✅ Хорошие признаки безопасности:
- **401 Unauthorized** для недействительных токенов
- **429 Too Many Requests** при превышении лимитов
- **400 Bad Request** для невалидных данных
- **404 Not Found** для несуществующих ресурсов
- Отсутствие чувствительной информации в ошибках
- Консистентные сообщения об ошибках

### 🚨 Плохие признаки (уязвимости):
- **200 OK** с чувствительными данными без авторизации
- **500 Internal Server Error** с stack trace
- Различные ответы для существующих/несуществующих пользователей
- Отсутствие rate limiting
- SQL ошибки в ответах
- Принятие невалидных данных

---

## 🔍 Дополнительные проверки:

### Заголовки безопасности в ответах
Проверьте наличие:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (если HTTPS)

### Cookies
Проверьте настройки refresh token cookie:
- `HttpOnly: true`
- `Secure: true` (если HTTPS)
- `SameSite: Lax`

### Логирование
Проверьте логи сервера на предмет:
- Записи о подозрительной активности
- Rate limiting событий
- Неудачных попыток авторизации

---

## 🎯 Результаты тестирования

Создайте таблицу результатов:

| Тест | Статус | Ответ сервера | Безопасность |
|------|--------|---------------|--------------|
| SQL Injection | ✅/❌ | 400/500/200 | OK/УЯЗВИМОСТЬ |
| Rate Limiting | ✅/❌ | 429/200 | OK/УЯЗВИМОСТЬ |
| Device Trust | ✅/❌ | 401/200 | OK/УЯЗВИМОСТЬ |
| ... | ... | ... | ... |

Если все тесты показывают правильные коды ответов - система безопасна! 🛡️ 