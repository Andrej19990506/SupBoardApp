# ===== DEVELOPMENT STAGE =====
FROM node:22-alpine as development

# Устанавливаем рабочую директорию
WORKDIR /app

# Устанавливаем зависимости для сборки
RUN apk add --no-cache python3 make g++

# Принимаем build аргументы
ARG VITE_APP_API_URL
ARG VITE_APP_WS_URL  
ARG VITE_APP_ENV
ARG VITE_APP_DEBUG

# Копируем файлы package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости используя npm ci
RUN npm ci --legacy-peer-deps

# Устанавливаем переменные окружения
ENV VITE_APP_API_URL=$VITE_APP_API_URL
ENV VITE_APP_WS_URL=$VITE_APP_WS_URL
ENV VITE_APP_ENV=$VITE_APP_ENV
ENV VITE_APP_DEBUG=$VITE_APP_DEBUG

# Открываем порт для Vite dev server
EXPOSE 3000

# Команда запуска будет переопределена в docker-compose
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]

# ===== PRODUCTION BUILD STAGE =====
FROM node:22-alpine as production-build

# Устанавливаем рабочую директорию
WORKDIR /app

# Устанавливаем зависимости для сборки
RUN apk add --no-cache python3 make g++

# Принимаем build аргументы
ARG VITE_APP_API_URL
ARG VITE_APP_WS_URL  
ARG VITE_APP_ENV
ARG VITE_APP_DEBUG

# Копируем файлы package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости используя npm ci
RUN npm ci --legacy-peer-deps

# Копируем исходный код
COPY . .

# Устанавливаем переменные окружения для сборки
ENV VITE_APP_API_URL=$VITE_APP_API_URL
ENV VITE_APP_WS_URL=$VITE_APP_WS_URL
ENV VITE_APP_ENV=$VITE_APP_ENV
ENV VITE_APP_DEBUG=$VITE_APP_DEBUG

# Собираем приложение
RUN npm run build

# Используем nginx для раздачи статики
FROM nginx:alpine

# Копируем собранное приложение
COPY --from=production-build /app/dist /usr/share/nginx/html

# Копируем конфигурацию nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Открываем порт
EXPOSE 80

# Запускаем nginx
CMD ["nginx", "-g", "daemon off;"] 