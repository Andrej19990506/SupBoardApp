# 🛡️ Рекомендации по безопасности

## 🔧 Development режим - простые пароли OK

### ✅ Почему в dev можно оставить простой пароль:
- 🏠 **Локальная работа:** База данных доступна только внутри Docker сети
- 🚫 **Нет внешнего доступа:** Порт 5432 не проброшен наружу
- 🧪 **Тестовые данные:** В dev нет реальных пользовательских данных
- ⚡ **Удобство разработки:** Простые пароли ускоряют разработку

```env
# ✅ ПРАВИЛЬНО для dev
POSTGRES_PASSWORD=postgres
JWT_SECRET_KEY=dev_jwt_secret_key_for_development_only_2024
```

## 🚨 КРИТИЧНО: Обновите чувствительные данные в env.prod

### 1. База данных PostgreSQL
```env
# ❌ ТЕКУЩЕЕ (НЕБЕЗОПАСНО)
POSTGRES_PASSWORD=postgres

# ✅ СГЕНЕРИРОВАННЫЙ ПАРОЛЬ (ИСПОЛЬЗУЙТЕ ЭТОТ)
POSTGRES_PASSWORD=y>vB?mw@XIJ[?ROX-GE.c|k0N_.(xk9@
```

### 2. JWT Secret Key
```env
# ❌ ТЕКУЩЕЕ (PLACEHOLDER)
JWT_SECRET_KEY=your_super_secret_key_here_change_this

# ✅ СГЕНЕРИРОВАННЫЙ КЛЮЧ (ИСПОЛЬЗУЙТЕ ЭТОТ)
JWT_SECRET_KEY=77047bf31dfb44bd9326fd2029f92ebca41231ac
```

### 3. Telegram Bot Token
```env
# ❌ ТЕКУЩЕЕ (PLACEHOLDER)
BOT_TOKEN=your_telegram_bot_token_here

# ✅ ПОЛУЧИТЕ РЕАЛЬНЫЙ ТОКЕН
# 1. Найдите @BotFather в Telegram
# 2. Отправьте /newbot
# 3. Следуйте инструкциям
# 4. Скопируйте токен вида: 1234567890:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
BOT_TOKEN=ВАШ_РЕАЛЬНЫЙ_ТОКЕН_ОТ_BOTFATHER
```

## 🔐 Команды для генерации безопасных ключей

### JWT Secret Key (64 символа):
```bash
openssl rand -hex 32
```

### PostgreSQL Password:
```bash
openssl rand -base64 32
```

### Проверка webhook path:
```bash
openssl rand -hex 16
```

## 📋 Чек-лист безопасности

- [ ] ✅ Разные пароли в dev и prod
- [ ] ✅ Сильные пароли (минимум 16 символов)
- [ ] ✅ Реальные токены Telegram Bot
- [ ] ✅ Уникальный JWT secret key
- [ ] ✅ Случайный webhook path
- [ ] ✅ env.prod в .gitignore
- [ ] ✅ Резервное копирование ключей

## ⚠️ ВАЖНО

1. **НЕ КОММИТЬТЕ** реальные пароли в git
2. **СОХРАНИТЕ** копию ключей в безопасном месте
3. **ОБНОВИТЕ** пароли регулярно
4. **ИСПОЛЬЗУЙТЕ** разные пароли для dev и prod

## 🔄 Пример обновления env.prod

```bash
# Создайте резервную копию
cp env.prod env.prod.backup

# Отредактируйте env.prod
nano env.prod

# Перезапустите контейнеры
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
``` 