/// <reference types="vite/client" />

// Расширяем Window interface для APP_CONFIG
declare global {
  interface Window {
    APP_CONFIG?: {
      API_URL: string;
      WS_URL: string;
      ENV: string;
      DEBUG: string;
      APPLICATION_SERVER_KEY?: string;
    };
  }
}

export {};
