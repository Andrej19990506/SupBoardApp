# 🎯 Система управления статусами бронирований

## 📋 Статусы бронирований

### Основные статусы:
- **BOOKED** (`booked`) - Забронировано (неподтвержденное)
- **PENDING_CONFIRMATION** (`pending_confirmation`) - Ожидает подтверждения (за час до начала)
- **CONFIRMED** (`confirmed`) - Подтверждено (готово к выдаче)
- **IN_USE** (`in_use`) - Инвентарь выдан, идет отсчет времени аренды/сплава
- **COMPLETED** (`completed`) - Аренда/сплав завершена, инвентарь возвращен
- **CANCELLED** (`cancelled`) - Отменено

### Дополнительные статусы:
- **NO_SHOW** (`no_show`) - Клиент не явился (не пришел)
- **RESCHEDULED** (`rescheduled`) - Перенесено на другое время

## 🔄 Автоматические переходы

### Правила автопереходов:
1. **BOOKED → PENDING_CONFIRMATION**: За 60 минут до начала
   - Проверяется каждые 5 минут
   - Логируется в консоль: `🔔 Требуется подтверждение: [Клиент] (ID) - до начала X мин`

2. **BOOKED → NO_SHOW**: Через 90 минут опоздания
   - Проверяется каждые 5 минут
   - Логируется в консоль: `🤖 Автопереход: [Клиент] (ID) booked → no_show`

3. **PENDING_CONFIRMATION → NO_SHOW**: Через 120 минут опоздания
   - Для неподтвержденных дается больше времени
   - Логируется в консоль: `🤖 Автопереход: [Клиент] (ID) pending_confirmation → no_show`

4. **CONFIRMED → NO_SHOW**: Через 90 минут опоздания
   - Подтвержденные бронирования имеют тот же лимит, что и обычные
   - Логируется в консоль: `🤖 Автопереход: [Клиент] (ID) confirmed → no_show`

## 🎮 Ручные действия операторов

### Для статуса BOOKED:
- ✅ **Выдать** → IN_USE (клиент пришел)
- 👻 **Не явился** → NO_SHOW (опоздание 30+ мин)
- ❌ **Отменить** → CANCELLED (опоздание 15+ мин)

### Для статуса PENDING_CONFIRMATION:
- ✅ **Подтвердить** → CONFIRMED (подтверждение получено)
- 🏄‍♂️ **Выдать сразу** → IN_USE (подтвердить и выдать инвентарь)
- ❌ **Отменить** → CANCELLED (не подтвердил)
- 🔄 **Перенести** → RESCHEDULED (перенос на другое время)

### Для статуса CONFIRMED:
- 🏄‍♂️ **Выдать** → IN_USE (клиент пришел)
- 👻 **Не явился** → NO_SHOW (опоздание 30+ мин)
- ❌ **Отменить** → CANCELLED

### Для статуса IN_USE:
- ✅ **Завершить** → COMPLETED (клиент вернул инвентарь)
- ⏰ **+1ч** → продлить время аренды

### Для статуса NO_SHOW:
- 🏄‍♂️ **Пришел** → IN_USE (клиент все-таки пришел)
- ↩️ **Восстановить** → BOOKED

### Для статуса RESCHEDULED:
- ✅ **Активировать** → BOOKED

### Для статуса CANCELLED:
- ↩️ **Восстановить** → BOOKED

### Для статуса COMPLETED:
- Завершенные бронирования не имеют дополнительных действий
- Для создания нового бронирования используйте обычную форму

## 🔔 Уведомления

### Автоматические уведомления:
- **За 15 мин до начала**: "Клиент должен прийти через X мин"
- **При опоздании**: "Клиент опаздывает на X мин"
- **За 10 мин до возврата**: "Клиент должен вернуть инвентарь через X мин"
- **При просрочке возврата**: "Клиент просрочил возврат на X мин"

### Звуковые сигналы:
- **Критические** (опоздание 15+ мин): тревожный звук
- **Предупреждения** (опоздание, время возврата): предупреждающий звук
- **Информационные** (приход через 5 мин): мягкий звук

## 📊 Статистика

### Отображаемые метрики:
- **Всего** - общее количество бронирований
- **Забронировано** - неподтвержденные бронирования
- **Ожидают подтверждения** - требуют звонка клиенту (если > 0)
- **Подтверждено** - подтвержденные бронирования (если > 0)
- **В использовании** - выданный инвентарь
- **Отменено** - отмененные бронирования (если > 0)
- **Не явились** - клиенты, которые не пришли (если > 0)
- **Перенесено** - перенесенные бронирования (если > 0)
- **Просрочено** - опоздавшие клиенты (если > 0)
- **В ближайший час** - предстоящие бронирования (если > 0)

## 🎨 Цветовая индикация

### Цвета статусов:
- **BOOKED**: Синий (#007AFF)
- **PENDING_CONFIRMATION**: Оранжевый (#FF9500)
- **CONFIRMED**: Зеленый (#34C759)
- **IN_USE**: Зеленый (#34C759)
- **COMPLETED**: Серый (#8E8E93)
- **CANCELLED**: Красный (#FF3B30)
- **NO_SHOW**: Оранжевый (#FF9500)
- **RESCHEDULED**: Фиолетовый (#AF52DE)

### Иконки статусов:
- **BOOKED**: 📅
- **PENDING_CONFIRMATION**: ⏳
- **CONFIRMED**: ✅
- **IN_USE**: 🏄‍♂️
- **COMPLETED**: ✅
- **CANCELLED**: ❌
- **NO_SHOW**: 👻
- **RESCHEDULED**: 🔄

## 🛠️ Технические детали

### Компоненты системы:
1. **QuickStatusActions** - быстрые действия в списках
2. **BookingStatusManager** - автоматические уведомления
3. **AutoStatusTransition** - автоматические переходы статусов
4. **NotificationSound** - звуковые уведомления

### Частота обновлений:
- **Уведомления**: каждую минуту
- **Автопереходы**: каждые 5 минут
- **Звуки**: по событиям

### Настройки:
- Звуки можно отключить в настройках браузера
- Уведомления работают только при открытом приложении
- Автопереходы можно отключить через props `enabled={false}` 