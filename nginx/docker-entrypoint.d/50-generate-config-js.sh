#!/bin/sh
set -e

# Используем путь напрямую

echo "--- Script 50-generate-config-js.sh starting ---"
echo "Target file: /usr/share/nginx/html/config.js"

# Создаем директорию
mkdir -p /usr/share/nginx/html
if [ ! -d /usr/share/nginx/html ]; then
    echo "Error: Failed to create /usr/share/nginx/html" >&2
    exit 1
fi

# ЛОГИРУЕМ ПЕРЕМЕННЫЕ ПЕРЕД ИСПОЛЬЗОВАНИЕМ
echo "Checking environment variables:"
echo "  VITE_APP_API_URL='${VITE_APP_API_URL}'"
echo "  VITE_APP_WS_URL='${VITE_APP_WS_URL}'"
echo "  ENV_TYPE='${ENV_TYPE}'"
echo "  VITE_APP_DEBUG='${VITE_APP_DEBUG}'"
echo "  APPLICATION_SERVER_KEY='${APPLICATION_SERVER_KEY}'"
echo "  VK_CLIENT_ID='${VK_CLIENT_ID}'"

# ПРОВЕРКА НА ПУСТОТУ
if [ -z "${VITE_APP_API_URL}" ] || [ -z "${VITE_APP_WS_URL}" ] || [ -z "${ENV_TYPE}" ] || [ -z "${VITE_APP_DEBUG}" ]; then
     echo "Error: One or more required environment variables are empty! Exiting." >&2
     exit 1
fi

# APPLICATION_SERVER_KEY и VK_CLIENT_ID не обязательные, но лучше предупредить
if [ -z "${APPLICATION_SERVER_KEY}" ]; then
     echo "Warning: APPLICATION_SERVER_KEY is empty - push notifications may not work" >&2
fi

if [ -z "${VK_CLIENT_ID}" ]; then
     echo "Warning: VK_CLIENT_ID is empty - VK OAuth will not work" >&2
fi

echo "Generating /usr/share/nginx/html/config.js content..."
# Генерация файла с явным путем и printf
cat > "/usr/share/nginx/html/config.js" <<INNER_EOF
window.APP_CONFIG = {
    API_URL: "$(printf '%s' "${VITE_APP_API_URL}")",
    WS_URL: "$(printf '%s' "${VITE_APP_WS_URL}")",
    ENV: "$(printf '%s' "${ENV_TYPE}")",
    DEBUG: "$(printf '%s' "${VITE_APP_DEBUG}")",
    APPLICATION_SERVER_KEY: "$(printf '%s' "${APPLICATION_SERVER_KEY}")",
    VK_CLIENT_ID: "$(printf '%s' "${VK_CLIENT_ID}")"
};
INNER_EOF

# Проверяем, что файл создался
if [ ! -f "/usr/share/nginx/html/config.js" ]; then
    echo "Error: Failed to create /usr/share/nginx/html/config.js" >&2
    exit 1
fi

# Выставляем права
chmod 644 "/usr/share/nginx/html/config.js"
chown nginx:nginx "/usr/share/nginx/html/config.js" 2>/dev/null || echo "Warning: Couldn't chown /usr/share/nginx/html/config.js, maybe running as root or user nginx doesn't exist?"

echo "--- Generated /usr/share/nginx/html/config.js content: ---"
cat "/usr/share/nginx/html/config.js"
echo "--- Script 50-generate-config-js.sh finished ---"

exit 0 