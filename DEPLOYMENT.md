# Развертывание SubBoard в продакшене

## Подготовка к развертыванию

### 1. Настройка переменных окружения

Скопируйте файл с примером переменных окружения:
```bash
cp env.prod.example .env.prod
```

Отредактируйте `.env.prod` и заполните реальными значениями:

**Обязательные переменные для изменения:**
- `JWT_SECRET_KEY` - секретный ключ для JWT токенов (минимум 32 символа)
- `POSTGRES_PASSWORD` - пароль для базы данных PostgreSQL
- `BOT_TOKEN` - токен Telegram бота
- `SMS_RU_API_ID` - API ключ для отправки SMS через SMS.ru
- `APPLICATION_SERVER_KEY` - VAPID ключ для push уведомлений

### 2. Настройка домена

Убедитесь что домен `supboardapp.ru` настроен в Cloudflare и указывает на ваш сервер.

**DNS записи в Cloudflare:**
- `A` запись: `supboardapp.ru` → IP вашего сервера
- `A` запись: `www.supboardapp.ru` → IP вашего сервера  
- `A` запись: `bot.supboardapp.ru` → IP вашего сервера

### 3. SSL сертификат

Настройте SSL/TLS в Cloudflare:
- SSL/TLS mode: **Full (Strict)**
- Всегда использовать HTTPS: **Включено**

## Запуск в продакшене

### 1. Сборка и запуск контейнеров

```bash
# Остановить dev версию если запущена
docker-compose down

# Запустить продакшн версию
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### 2. Проверка статуса

```bash
# Проверить статус контейнеров
docker-compose ps

# Посмотреть логи
docker-compose logs -f

# Проверить логи конкретного сервиса
docker-compose logs -f server
docker-compose logs -f nginx
```

### 3. Инициализация базы данных

```bash
# Выполнить миграции базы данных
docker-compose exec server alembic upgrade head

# Создать тестовые данные (опционально)
docker-compose exec server python scripts/create_test_data.py
```

## Мониторинг и обслуживание

### Проверка работоспособности

- **Основное приложение:** https://supboardapp.ru
- **API статус:** https://supboardapp.ru/api/health
- **Бот статус:** https://supboardapp.ru/api/bot/health

### Логи

Логи nginx сохраняются в `./nginx_logs/`:
- `access.log` - логи доступа
- `error.log` - логи ошибок
- `websocket_access.log` - логи WebSocket соединений

### Backup базы данных

```bash
# Создать backup
docker-compose exec postgres pg_dump -U postgres appsubboard > backup_$(date +%Y%m%d_%H%M%S).sql

# Восстановить из backup
docker-compose exec -T postgres psql -U postgres appsubboard < backup_file.sql
```

### Обновление приложения

```bash
# Получить последние изменения
git pull origin main

# Пересобрать и перезапустить контейнеры
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Выполнить миграции если есть
docker-compose exec server alembic upgrade head
```

## Безопасность

### Firewall настройки

Откройте только необходимые порты:
- `80` (HTTP) - для редиректа на HTTPS
- `443` (HTTPS) - основной трафик
- `22` (SSH) - для администрирования

### Cloudflare IP whitelist

Убедитесь что ваш сервер принимает соединения только от Cloudflare IP адресов.

### Регулярные обновления

```bash
# Обновить образы Docker
docker-compose pull

# Обновить систему
sudo apt update && sudo apt upgrade -y
```

## Troubleshooting

### Ошибка 521

Если видите ошибку 521:
1. Проверьте что контейнеры запущены: `docker-compose ps`
2. Проверьте логи nginx: `docker-compose logs nginx`
3. Убедитесь что порты 80/443 открыты на сервере

### Проблемы с WebSocket

Если не работают WebSocket соединения:
1. Проверьте логи websocket сервиса: `docker-compose logs websocket`
2. Убедитесь что Cloudflare не блокирует WebSocket соединения

### Проблемы с базой данных

```bash
# Проверить подключение к БД
docker-compose exec server python -c "from db.session import get_db_session; print('DB OK')"

# Проверить миграции
docker-compose exec server alembic current
``` 