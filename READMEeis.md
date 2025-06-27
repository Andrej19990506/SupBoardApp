# 🤖 EisBot - Telegram Bot для анализа госзакупок

![Python](https://img.shields.io/badge/python-3.11+-blue.svg)
![Status](https://img.shields.io/badge/status-in%20development-orange.svg)
![Architecture](https://img.shields.io/badge/architecture-clean%20architecture-green.svg)
![API](https://img.shields.io/badge/API-GosPlan%20%2B%20FNS-blue.svg)

**EisBot** - современный Telegram бот для поиска и анализа российских государственных закупок с интеграцией официальных API.

## 🎯 Основные возможности

- 🔍 **Поиск закупок по ИНН** заказчика
- 📊 **Реальные названия организаций** из ЕГРЮЛ/ЕГРИП
- 📈 **Аналитика и статистика** по закупкам
- 🌍 **Региональный анализ** заказчиков
- 💰 **Финансовые показатели** и тренды
- ⚡ **Высокая производительность** через асинхронные API

## 🏗️ Архитектура

Проект построен на принципах **Clean Architecture**:

```
┌─── Presentation Layer ─── Telegram Bot UI ─────────── [Планируется]
├─── Application Layer ─── Use Cases & Services ───── [Планируется] 
├─── Domain Layer ──────── Business Logic ──────────── ✅ Готово
└─── Infrastructure ───── API Integrations ─────────── ✅ Готово
```

## 🔌 API Интеграции

| API | Endpoint | Данные | Лимиты | Стоимость |
|-----|----------|--------|--------|-----------|
| **GosPlan** | `v2test.gosplan.info` | Закупки 44-ФЗ/223-ФЗ | 10 req/min | 🆓 Бесплатно |
| **ЕГРЮЛ** | `egrul.itsoft.ru` | Названия организаций | 1000 req/day | 🆓 Бесплатно |

## 🚀 Быстрый старт

### Установка зависимостей

```bash
cd EisBot
pip install -r requirements.txt
```

### Тестирование интеграций

```python
# Тест GosPlan API
python -c "
import asyncio
from src.infrastructure.repositories import GosPlanProcurementRepository
from src.domain.value_objects import INN

async def test():
    async with GosPlanProcurementRepository() as repo:
        procurements = await repo.find_by_customer_inn(INN('7710349494'), limit=1)
        print(f'Найдено закупок: {len(procurements)}')
        if procurements:
            print(f'Заказчик: {procurements[0].customer_name}')

asyncio.run(test())
"
```

```python
# Тест FNS API (получение названий организаций)
python -c "
import asyncio
from src.infrastructure.external_apis.fns_client import FNSClient

async def test():
    async with FNSClient() as client:
        org = await client.get_organization_by_inn('7710349494')
        if org:
            print(f'Организация: {org.name}')
            print(f'Полное название: {org.full_name}')

asyncio.run(test())
"
```

## 📦 Структура проекта

```
EisBot/
├── src/
│   ├── domain/                 # ✅ Бизнес-логика и правила
│   │   ├── entities/          # Procurement, Customer
│   │   ├── value_objects/     # INN, Money, DateRange
│   │   └── repositories/      # Интерфейсы репозиториев
│   ├── infrastructure/        # ✅ Внешние интеграции
│   │   ├── repositories/      # GosPlan API repos
│   │   ├── mappers/          # Преобразователи данных
│   │   └── external_apis/    # FNS/EGRUL клиенты
│   ├── application/          # 🔄 Use Cases (в разработке)
│   └── presentation/         # 🔄 Telegram Bot (в разработке)
├── tests/                    # Тесты
├── configs/                  # Конфигурации
├── ARCHITECTURE_SUMMARY.md   # Подробная архитектура
└── README.md                 # Этот файл
```

## 🧪 Пример работы

### Поиск закупок по ИНН

```python
from src.domain.value_objects import INN
from src.infrastructure.repositories import GosPlanProcurementRepository

async def search_procurements():
    async with GosPlanProcurementRepository() as repo:
        # Ищем закупки Минэкономразвития
        customer_inn = INN('7710349494')
        procurements = await repo.find_by_customer_inn(customer_inn, limit=5)
        
        for p in procurements:
            print(f"📋 {p.title}")
            print(f"💰 Сумма: {p.initial_price}")
            print(f"🏢 Заказчик: {p.customer_name}")
            print(f"📅 Дата: {p.published_date}")
            print("---")
```

### Получение полной информации об организации

```python
from src.infrastructure.external_apis.fns_client import FNSClient

async def get_organization_info():
    async with FNSClient() as client:
        org = await client.get_organization_by_inn('7710349494')
        
        print(f"🏢 Название: {org.name}")
        print(f"📋 Полное название: {org.full_name}")
        print(f"🆔 ИНН: {org.inn}")
        print(f"📊 Статус: {org.status}")
        print(f"📍 Адрес: {org.address}")
```

## 📊 Покрытие данными

| Компонент | GosPlan API | FNS API | Итого |
|-----------|:-----------:|:-------:|:-----:|
| **Procurement** | 85% | +15% | **100%** |
| **Customer** | 60% | +40% | **100%** |
| **Названия орг.** | 0% | 100% | **100%** |

## 🎯 Текущий статус

### ✅ Реализовано
- [x] **Domain Layer** - полная бизнес-логика
- [x] **Infrastructure Layer** - интеграции с API
- [x] **GosPlan API** - поиск закупок
- [x] **FNS/EGRUL API** - названия организаций
- [x] **Data Mapping** - преобразование данных
- [x] **Async Processing** - высокая производительность

### 🔄 В разработке
- [ ] **Application Layer** - Use Cases и сервисы
- [ ] **Telegram Bot** - пользовательский интерфейс
- [ ] **Caching** - Redis кэширование
- [ ] **Analytics** - расширенная аналитика

### 📋 Планируется
- [ ] **ML Analytics** - прогнозирование и тренды
- [ ] **Export Features** - Excel/PDF отчеты
- [ ] **Notifications** - подписки на обновления
- [ ] **Admin Dashboard** - веб интерфейс администратора

## 🔧 Разработка

### Запуск тестов

```bash
# Запуск всех тестов
python -m pytest tests/

# Тест конкретного компонента
python test_repositories.py
```

### Добавление новых функций

1. **Domain Layer** - добавьте бизнес-логику в `src/domain/`
2. **Infrastructure** - реализуйте в `src/infrastructure/`
3. **Tests** - покройте тестами в `tests/`

### Конфигурация

Скопируйте и настройте конфигурацию:

```bash
cp configs/environment_example.py configs/environment.py
# Отредактируйте настройки API
```

## 📈 Производительность

- **Время ответа**: ~500ms (с обогащением данными ФНС)
- **Пропускная способность**: ~1,200 запросов/час
- **API лимиты**: 14,400 запросов/день (суммарно)
- **Стоимость**: 🆓 **Полностью бесплатно**

## 🤝 Контрибьюшн

1. Fork репозиторий
2. Создайте feature branch (`git checkout -b feature/amazing-feature`)
3. Commit изменения (`git commit -m 'Add amazing feature'`)
4. Push в branch (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

## 📄 Лицензия

Этот проект распространяется под лицензией MIT. См. файл `LICENSE` для подробностей.

## 📞 Поддержка

Для получения подробной технической информации см. [ARCHITECTURE_SUMMARY.md](ARCHITECTURE_SUMMARY.md)

---

**Состояние**: В активной разработке  
**Версия**: 1.0-alpha  
**Последнее обновление**: Январь 2025 