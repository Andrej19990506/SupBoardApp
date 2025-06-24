# backend/API server/Dockerfile

# Используем конкретную версию Python slim для стабильности
FROM python:3.11-slim

# Устанавливаем переменные окружения
# Не создавать .pyc файлы
ENV PYTHONDONTWRITEBYTECODE 1  
# Выводить логи сразу
ENV PYTHONUNBUFFERED=1         
# Отключить кеш pip внутри образа
ENV PIP_NO_CACHE_DIR=off       

# Устанавливаем рабочую директорию
WORKDIR /app

# Обновляем pip и устанавливаем зависимости
# Копируем только requirements.txt для кеширования слоя Docker
COPY requirements.txt ./

# <<< ДОБАВЛЯЕМ УСТАНОВКУ curl >>>
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Копируем весь код приложения из текущей директории (контекста сборки)
# в рабочую директорию /app внутри образа.
# Точка "." означает текущую директорию контекста сборки,
# которая будет ./backend/API server/ согласно docker-compose.yml
COPY . .

# Указываем порт, который приложение будет слушать внутри контейнера
EXPOSE 8000

# Команда по умолчанию для запуска приложения.
# Будет использоваться, если не переопределена в docker-compose.yml.
# Запускает uvicorn, слушая на всех интерфейсах (0.0.0.0) внутри контейнера.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

# Production target
FROM python:3.11-slim as production

# Устанавливаем переменные окружения
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=off

# Устанавливаем рабочую директорию
WORKDIR /app

# Устанавливаем системные зависимости
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Копируем и устанавливаем Python зависимости
COPY requirements.txt ./
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install gunicorn

# Копируем код приложения
COPY . .

# Создаем необходимые директории
RUN mkdir -p data

# Указываем порт
EXPOSE 8000

# В продакшне используем gunicorn с несколькими рабочими процессами
CMD ["gunicorn", "main:app", "-b", "0.0.0.0:8000", "--workers", "4", "--timeout", "120", "-k", "uvicorn.workers.UvicornWorker"] 