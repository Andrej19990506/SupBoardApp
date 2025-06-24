# 🏄‍♂️ SubBoard - Система бронирования SUP досок

Современная система управления бронированием SUP досок с веб-интерфейсом, мобильным приложением и Telegram ботом.

## 🚀 Особенности

- **📅 Календарь бронирований** - интуитивный интерфейс с drag & drop
- **👤 Управление клиентами** - автокомплит, история, статистика
- **📱 Мобильная версия** - адаптивный дизайн для всех устройств
- **🤖 Telegram бот** - бронирование через мессенджер
- **🔔 Push уведомления** - уведомления о новых бронированиях
- **📊 Аналитика** - отчеты по доходам и загруженности
- **🔐 Безопасность** - JWT токены, device sessions, rate limiting
- **🌦️ Погодные данные** - интеграция с погодными API

## 🛠️ Технологии

### Backend
- **FastAPI** - современный Python веб-фреймворк
- **PostgreSQL** - надежная реляционная база данных
- **SQLAlchemy** - ORM для работы с БД
- **Redis/DragonFly** - кэширование и сессии
- **Alembic** - миграции базы данных

### Frontend
- **React 18** - современная библиотека для UI
- **TypeScript** - типизированный JavaScript
- **Redux Toolkit** - управление состоянием
- **Styled Components** - CSS-in-JS стилизация
- **Vite** - быстрый сборщик

### Infrastructure
- **Docker** - контейнеризация всех сервисов
- **Nginx** - reverse proxy и статические файлы
- **WebSocket** - real-time уведомления
- **Scheduler** - автоматизация задач

## 📦 Структура проекта

```
├── API server/          # FastAPI backend
├── subboard-frontend/   # React frontend
├── telegramBot/         # Telegram бот
├── websocket-service/   # WebSocket сервер
├── scheduler/           # Планировщик задач
├── nginx/              # Nginx конфигурация
└── docker-compose.yml  # Docker оркестрация
```

## 🚀 Быстрый старт

### Требования
- Docker & Docker Compose
- Git

### Установка

1. **Клонируйте репозиторий:**
```bash
git clone https://github.com/yourusername/subboard.git
cd subboard
```

2. **Создайте файлы окружения:**
```bash
cp env.dev.example env.dev
cp env.prod.example env.prod
```

3. **Отредактируйте переменные окружения:**
- Укажите токены для Telegram бота
- Настройте SMS API ключи
- Установите JWT секретные ключи
- Настройте параметры базы данных

4. **Запустите проект:**
```bash
# Development режим
docker-compose up -d

# Production режим
docker-compose -f docker-compose.prod.yml up -d
```

5. **Проверьте работу:**
- Frontend: http://localhost:3000
- API: http://localhost:8000/docs
- Adminer (БД): http://localhost:8080

## 🔧 Конфигурация

### Переменные окружения

#### Основные настройки
```env
ENVIRONMENT=development|production
DOMAIN=yourdomain.com
JWT_SECRET_KEY=your-secret-key
POSTGRES_PASSWORD=secure-password
```

#### Telegram бот
```env
BOT_TOKEN=your-telegram-bot-token
WEBHOOK_PATH=/api/telegram/webhook
```

#### SMS уведомления
```env
SMS_RU_API_ID=your-sms-api-key
```

#### Push уведомления
```env
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_PUBLIC_KEY=your-vapid-public-key
APPLICATION_SERVER_KEY=your-app-server-key
```

## 📱 API Документация

API документация доступна по адресу: `/docs` (Swagger UI)

### Основные endpoints:

- `GET /api/v1/bookings` - список бронирований
- `POST /api/v1/bookings` - создание бронирования
- `PUT /api/v1/bookings/{id}` - обновление бронирования
- `GET /api/v1/clients` - список клиентов
- `GET /api/v1/inventory` - инвентарь

## 🔐 Безопасность

- **JWT токены** с refresh механизмом
- **Device sessions** для отслеживания устройств
- **Rate limiting** для защиты от спама
- **CORS** настройки для безопасных запросов
- **Валидация** всех входящих данных

## 🚀 Деплой

### Development
```bash
docker-compose up -d
```

### Production
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Миграции базы данных
```bash
docker-compose exec server alembic upgrade head
```

## 📊 Мониторинг

- **Логи**: `docker-compose logs -f [service]`
- **Метрики**: интеграция с Prometheus (планируется)
- **Healthcheck**: `/api/health` endpoint

## 🤝 Участие в разработке

1. Fork репозитория
2. Создайте feature branch (`git checkout -b feature/amazing-feature`)
3. Commit изменения (`git commit -m 'Add amazing feature'`)
4. Push в branch (`git push origin feature/amazing-feature`)
5. Создайте Pull Request

## 📝 Лицензия

Этот проект лицензирован под MIT License - см. файл [LICENSE](LICENSE) для деталей.

## 📞 Поддержка

- **Email**: support@supboardapp.ru
- **Telegram**: @subboard_support
- **GitHub Issues**: [Создать issue](https://github.com/yourusername/subboard/issues)

## 🎯 Roadmap

- [ ] Мобильное приложение (React Native)
- [ ] Интеграция с платежными системами
- [ ] Система лояльности клиентов
- [ ] Многоязычность (i18n)
- [ ] Белые лейблы для партнеров

---

**Сделано с ❤️ для SUP сообщества** 