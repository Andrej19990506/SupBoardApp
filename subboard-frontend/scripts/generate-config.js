#!/usr/bin/env node
/**
 * Скрипт для генерации config.js в development режиме
 * Аналог nginx скрипта 50-generate-config-js.sh для dev окружения
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Путь к public/config.js
const publicDir = join(__dirname, '..', 'public');
const configPath = join(publicDir, 'config.js');

// Переменные окружения с fallback значениями для dev
const config = {
  API_URL: process.env.VITE_APP_API_URL || "http://localhost/api",
  WS_URL: process.env.VITE_APP_WS_URL || "ws://localhost/api/ws", 
  ENV: process.env.ENV_TYPE || "development",
  DEBUG: process.env.VITE_APP_DEBUG || "true",
  APPLICATION_SERVER_KEY: process.env.APPLICATION_SERVER_KEY || "BL9aHxCJHILa-O2H3lShmC3k-E7e8Tb1Krdm-lPeYEjV1PgF38LRS-Q8Ax0naHfu-cA-9W8WOdBlfYMvi3pFj_Q"
};

// Создаем содержимое config.js
const configContent = `window.APP_CONFIG = {
    API_URL: "${config.API_URL}",
    WS_URL: "${config.WS_URL}",
    ENV: "${config.ENV}",
    DEBUG: "${config.DEBUG}",
    APPLICATION_SERVER_KEY: "${config.APPLICATION_SERVER_KEY}"
};`;

try {
  // Создаем директорию public если не существует
  mkdirSync(publicDir, { recursive: true });
  
  // Записываем config.js
  writeFileSync(configPath, configContent, 'utf8');
  
  console.log('✅ Config.js сгенерирован для development режима');
  console.log('📁 Путь:', configPath);
  console.log('🔧 Конфигурация:');
  console.log(`   API_URL: ${config.API_URL}`);
  console.log(`   WS_URL: ${config.WS_URL}`);
  console.log(`   ENV: ${config.ENV}`);
  console.log(`   DEBUG: ${config.DEBUG}`);
  console.log(`   APPLICATION_SERVER_KEY: ${config.APPLICATION_SERVER_KEY.substring(0, 20)}...`);
} catch (error) {
  console.error('❌ Ошибка при генерации config.js:', error);
  process.exit(1);
} 