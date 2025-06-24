#!/usr/bin/env python3
"""
Скрипт для генерации VAPID ключей для push уведомлений

Использование:
    python utils/generate_vapid_keys.py
"""

import subprocess
import sys
import os
from pathlib import Path

def generate_vapid_keys():
    """Генерирует VAPID ключи используя команду vapid-gen из библиотеки webpush"""
    
    try:
        # Проверяем, установлена ли библиотека webpush
        result = subprocess.run(
            ["vapid-gen"],
            capture_output=True,
            text=True,
            check=True
        )
        
        print("✅ VAPID ключи сгенерированы успешно!")
        print("\n" + "="*60)
        print("📋 РЕЗУЛЬТАТ ГЕНЕРАЦИИ VAPID КЛЮЧЕЙ")
        print("="*60)
        
        # Парсим вывод команды vapid-gen
        output_lines = result.stdout.strip().split('\n')
        
        private_key = None
        public_key = None
        application_server_key = None
        
        for line in output_lines:
            if line.startswith("Private key saved in"):
                private_key_file = line.split("in ")[1]
                try:
                    with open(private_key_file, 'r') as f:
                        private_key = f.read().strip()
                except FileNotFoundError:
                    print(f"⚠️  Файл приватного ключа не найден: {private_key_file}")
            
            elif line.startswith("Public key saved in"):
                public_key_file = line.split("in ")[1]
                try:
                    with open(public_key_file, 'r') as f:
                        public_key = f.read().strip()
                except FileNotFoundError:
                    print(f"⚠️  Файл публичного ключа не найден: {public_key_file}")
            
            elif line.startswith("Application Server Key saved in"):
                app_key_file = line.split("in ")[1]
                try:
                    with open(app_key_file, 'r') as f:
                        application_server_key = f.read().strip()
                except FileNotFoundError:
                    print(f"⚠️  Файл Application Server Key не найден: {app_key_file}")
        
        # Выводим ключи
        if private_key:
            print(f"🔐 PRIVATE KEY:")
            print(f"   {private_key}")
            print()
        
        if public_key:
            print(f"🔓 PUBLIC KEY:")
            print(f"   {public_key}")
            print()
        
        if application_server_key:
            print(f"📱 APPLICATION SERVER KEY (для frontend):")
            print(f"   {application_server_key}")
            print()
        
        # Создаем пример .env файла
        env_content = f"""# VAPID ключи для push уведомлений
VAPID_PRIVATE_KEY={private_key or "YOUR_PRIVATE_KEY_HERE"}
VAPID_PUBLIC_KEY={public_key or "YOUR_PUBLIC_KEY_HERE"}
VAPID_CLAIMS_SUB=mailto:admin@example.com

# Application Server Key для frontend (используется в JavaScript)
# APPLICATION_SERVER_KEY={application_server_key or "YOUR_APPLICATION_SERVER_KEY_HERE"}
"""
        
        # Сохраняем в файл .env.vapid.example
        env_file = Path(".env.vapid.example")
        with open(env_file, 'w') as f:
            f.write(env_content)
        
        print("="*60)
        print("📝 ИНСТРУКЦИЯ ПО НАСТРОЙКЕ")
        print("="*60)
        print("1. Скопируйте ключи выше в ваш .env файл:")
        print(f"   - VAPID_PRIVATE_KEY={private_key or 'YOUR_PRIVATE_KEY'}")
        print(f"   - VAPID_PUBLIC_KEY={public_key or 'YOUR_PUBLIC_KEY'}")
        print("   - VAPID_CLAIMS_SUB=mailto:ваш-email@example.com")
        print()
        print("2. В frontend используйте Application Server Key:")
        print(f"   const applicationServerKey = '{application_server_key or 'YOUR_APPLICATION_SERVER_KEY'}';")
        print()
        print("3. Пример .env файла сохранен в:", env_file.absolute())
        print()
        print("⚠️  ВАЖНО: Никогда не публикуйте приватный ключ!")
        print("   Только публичный ключ и Application Server Key используются в frontend.")
        
        # Очищаем временные файлы
        for filename in ["private_key.pem", "public_key.pem", "applicationServerKey"]:
            if os.path.exists(filename):
                os.remove(filename)
                print(f"🗑️  Удален временный файл: {filename}")
        
    except subprocess.CalledProcessError as e:
        print("❌ Ошибка при генерации VAPID ключей:")
        print(f"   {e}")
        print(f"   Stderr: {e.stderr}")
        
        print("\n💡 Возможные решения:")
        print("1. Убедитесь, что библиотека webpush установлена:")
        print("   pip install webpush")
        print()
        print("2. Убедитесь, что команда vapid-gen доступна в PATH")
        print("3. Попробуйте переустановить библиотеку:")
        print("   pip uninstall webpush && pip install webpush")
        
    except FileNotFoundError:
        print("❌ Команда vapid-gen не найдена!")
        print("\n💡 Решение:")
        print("1. Установите библиотеку webpush:")
        print("   pip install webpush")
        print()
        print("2. Убедитесь, что команда добавлена в PATH")

def main():
    print("🔑 Генератор VAPID ключей для push уведомлений")
    print("="*50)
    print()
    
    generate_vapid_keys()

if __name__ == "__main__":
    main() 