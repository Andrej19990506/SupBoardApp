import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import Dict, Any, Optional
from core.config import settings
from datetime import datetime, timedelta
import uuid

logger = logging.getLogger(__name__)

class EmailService:
    """Сервис для отправки email уведомлений"""
    
    def __init__(self):
        self.smtp_server = settings.SMTP_SERVER
        self.smtp_port = settings.SMTP_PORT
        self.smtp_username = settings.SMTP_USERNAME
        self.smtp_password = settings.SMTP_PASSWORD
        self.from_email = settings.FROM_EMAIL
        self.from_name = "SUBboards"
        self.frontend_url = settings.FRONTEND_URL
        
        # Логируем настройки SMTP для диагностики
        print(f"🔧 [EMAIL_SERVICE] SMTP настройки инициализированы:")
        print(f"📧 [EMAIL_SERVICE] SMTP_SERVER: {self.smtp_server}")
        print(f"🔌 [EMAIL_SERVICE] SMTP_PORT: {self.smtp_port}")
        print(f"👤 [EMAIL_SERVICE] SMTP_USERNAME: {self.smtp_username}")
        print(f"🔑 [EMAIL_SERVICE] SMTP_PASSWORD: {'***' + self.smtp_password[-4:] if self.smtp_password else 'НЕ УСТАНОВЛЕН'}")
        print(f"📤 [EMAIL_SERVICE] FROM_EMAIL: {self.from_email}")
        print(f"🌐 [EMAIL_SERVICE] FRONTEND_URL: {self.frontend_url}")
        
        logger.info(f"🔧 SMTP настройки инициализированы:")
        logger.info(f"📧 SMTP_SERVER: {self.smtp_server}")
        logger.info(f"🔌 SMTP_PORT: {self.smtp_port}")
        logger.info(f"👤 SMTP_USERNAME: {self.smtp_username}")
        logger.info(f"🔑 SMTP_PASSWORD: {'***' + self.smtp_password[-4:] if self.smtp_password else 'НЕ УСТАНОВЛЕН'}")
        logger.info(f"📤 FROM_EMAIL: {self.from_email}")
        logger.info(f"🌐 FRONTEND_URL: {self.frontend_url}")
        
        # Проверяем режим работы
        if self.smtp_username and self.smtp_password:
            logger.info(f"✅ SMTP настройки найдены - РЕАЛЬНАЯ ОТПРАВКА EMAIL")
        else:
            logger.warning(f"⚠️ SMTP настройки не полные - РЕЖИМ РАЗРАБОТКИ (только логи)")
            if not self.smtp_username:
                logger.warning(f"❌ SMTP_USERNAME пустой или не установлен")
            if not self.smtp_password:
                logger.warning(f"❌ SMTP_PASSWORD пустой или не установлен")
        
        # Временное хранилище токенов восстановления через email
        self.email_reset_tokens = {}
    
    def generate_email_reset_token(self) -> str:
        """Генерирует уникальный токен для восстановления через email"""
        return str(uuid.uuid4())
    
    def create_password_changed_notification_template(self, user_name: str) -> str:
        """Создает красивый HTML шаблон для уведомления о смене пароля"""
        return f"""
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Пароль изменен - SUBboards</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f8fafc;
        }}
        
        .container {{
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        }}
        
        .header {{
            background: linear-gradient(135deg, #00D4AA 0%, #007AFF 100%);
            padding: 40px 30px;
            text-align: center;
            color: white;
        }}
        
        .logo {{
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 10px;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }}
        
        .tagline {{
            font-size: 16px;
            opacity: 0.9;
            margin-bottom: 0;
        }}
        
        .content {{
            padding: 40px 30px;
        }}
        
        .success-icon {{
            text-align: center;
            margin-bottom: 30px;
        }}
        
        .success-circle {{
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #00D4AA 0%, #007AFF 100%);
            border-radius: 50%;
            box-shadow: 0 8px 24px rgba(0, 212, 170, 0.3);
        }}
        
        .checkmark {{
            color: white;
            font-size: 36px;
            font-weight: bold;
        }}
        
        .greeting {{
            font-size: 24px;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 20px;
            text-align: center;
        }}
        
        .success-title {{
            font-size: 20px;
            font-weight: 600;
            color: #00D4AA;
            margin-bottom: 20px;
            text-align: center;
        }}
        
        .message {{
            font-size: 16px;
            color: #4a5568;
            margin-bottom: 30px;
            line-height: 1.8;
            text-align: center;
        }}
        
        .details-card {{
            background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
            border-radius: 12px;
            padding: 24px;
            margin: 30px 0;
            border-left: 4px solid #00D4AA;
        }}
        
        .details-title {{
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 15px;
            font-size: 16px;
        }}
        
        .detail-row {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #e2e8f0;
        }}
        
        .detail-row:last-child {{
            border-bottom: none;
        }}
        
        .detail-label {{
            color: #718096;
            font-size: 14px;
        }}
        
        .detail-value {{
            color: #2d3748;
            font-weight: 500;
            font-size: 14px;
        }}
        
        .security-warning {{
            background-color: #fef5e7;
            border: 1px solid #f6e05e;
            border-radius: 8px;
            padding: 20px;
            margin: 30px 0;
        }}
        
        .warning-title {{
            font-weight: 600;
            color: #744210;
            margin-bottom: 10px;
            font-size: 16px;
        }}
        
        .warning-text {{
            color: #744210;
            font-size: 14px;
            line-height: 1.6;
        }}
        
        .action-button {{
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white !important;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            transition: all 0.3s ease;
            margin: 20px auto;
            display: block;
            width: fit-content;
        }}
        
        .footer {{
            background-color: #2d3748;
            color: #a0aec0;
            padding: 30px;
            text-align: center;
        }}
        
        .footer-title {{
            color: #e2e8f0;
            font-weight: 600;
            margin-bottom: 15px;
        }}
        
        .footer-text {{
            font-size: 14px;
            line-height: 1.6;
            margin-bottom: 20px;
        }}
        
        .social-links {{
            margin-top: 20px;
        }}
        
        .social-link {{
            display: inline-block;
            margin: 0 10px;
            color: #a0aec0;
            text-decoration: none;
            font-size: 14px;
        }}
        
        .divider {{
            height: 1px;
            background: linear-gradient(to right, transparent, #e2e8f0, transparent);
            margin: 30px 0;
        }}
        
        @media (max-width: 600px) {{
            .container {{
                margin: 0;
                border-radius: 0;
            }}
            
            .header, .content, .footer {{
                padding: 30px 20px;
            }}
            
            .greeting {{
                font-size: 20px;
            }}
            
            .details-card {{
                padding: 20px;
            }}
            
            .detail-row {{
                flex-direction: column;
                align-items: flex-start;
                gap: 4px;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">SUBboards</div>
            <div class="tagline">Прокат SUP досок и водного снаряжения</div>
        </div>
        
        <div class="content">
            <div class="success-icon">
                <div class="success-circle">
                    <div class="checkmark">✓</div>
                </div>
            </div>
            
            <div class="greeting">Привет, {user_name}!</div>
            <div class="success-title">Пароль успешно изменен</div>
            
            <div class="message">
                Ваш пароль для входа в SUBboards был успешно изменен. 
                Теперь вы можете использовать новый пароль для входа в систему.
            </div>
            
            <div class="details-card">
                <div class="details-title">Детали изменения</div>
                <div class="detail-row">
                    <span class="detail-label">Дата и время:</span>
                    <span class="detail-value">{datetime.now().strftime('%d.%m.%Y в %H:%M')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Способ изменения:</span>
                    <span class="detail-value">Восстановление пароля</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">IP адрес:</span>
                    <span class="detail-value">Скрыт для безопасности</span>
                </div>
            </div>
            
            <div class="security-warning">
                <div class="warning-title">Важная информация о безопасности</div>
                <div class="warning-text">
                    Если вы не изменяли пароль, немедленно свяжитесь с нашей службой поддержки. 
                    Возможно, кто-то получил несанкционированный доступ к вашему аккаунту.
                </div>
            </div>
            
            <a href="{self.frontend_url}" class="action-button">
                Войти в SUBboards
            </a>
            
            <div class="divider"></div>
            
            <div class="message">
                Рекомендуем использовать надежные пароли и не передавать их третьим лицам. 
                Если у вас есть вопросы, обращайтесь в нашу службу поддержки.
            </div>
        </div>
        
        <div class="footer">
            <div class="footer-title">SUBboards - Ваши приключения на воде</div>
            <div class="footer-text">
                Мы помогаем владельцам прокатов SUP досок управлять бронированиями 
                и предоставляем клиентам удобный сервис для аренды водного снаряжения.
            </div>
            
            <div class="social-links">
                <a href="https://supboardapp.ru" class="social-link">Сайт</a>
                <a href="mailto:support@supboardapp.ru" class="social-link">Поддержка</a>
                <a href="tel:+78001234567" class="social-link">Телефон</a>
            </div>
            
            <div style="margin-top: 20px; font-size: 12px; opacity: 0.7;">
                © {datetime.now().year} SUBboards. Все права защищены.
            </div>
        </div>
    </div>
</body>
</html>
"""

    def create_password_reset_email_template(self, user_name: str, reset_link: str) -> str:
        """Создает красивый HTML шаблон для восстановления пароля"""
        return f"""
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Восстановление пароля - SUBboards</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f8fafc;
        }}
        
        .container {{
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        }}
        
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 30px;
            text-align: center;
            color: white;
        }}
        
        .logo {{
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 10px;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }}
        
        .tagline {{
            font-size: 16px;
            opacity: 0.9;
            margin-bottom: 0;
        }}
        
        .content {{
            padding: 40px 30px;
        }}
        
        .greeting {{
            font-size: 24px;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 20px;
        }}
        
        .message {{
            font-size: 16px;
            color: #4a5568;
            margin-bottom: 30px;
            line-height: 1.8;
        }}
        
        .reset-button {{
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white !important;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            transition: all 0.3s ease;
            margin: 20px 0;
        }}
        
        .reset-button:hover {{
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
        }}
        
        .security-info {{
            background-color: #f7fafc;
            border-left: 4px solid #4299e1;
            padding: 20px;
            margin: 30px 0;
            border-radius: 0 8px 8px 0;
        }}
        
        .security-title {{
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 10px;
            font-size: 16px;
        }}
        
        .security-text {{
            color: #4a5568;
            font-size: 14px;
            line-height: 1.6;
        }}
        
        .footer {{
            background-color: #2d3748;
            color: #a0aec0;
            padding: 30px;
            text-align: center;
        }}
        
        .footer-title {{
            color: #e2e8f0;
            font-weight: 600;
            margin-bottom: 15px;
        }}
        
        .footer-text {{
            font-size: 14px;
            line-height: 1.6;
            margin-bottom: 20px;
        }}
        
        .social-links {{
            margin-top: 20px;
        }}
        
        .social-link {{
            display: inline-block;
            margin: 0 10px;
            color: #a0aec0;
            text-decoration: none;
            font-size: 14px;
        }}
        
        .divider {{
            height: 1px;
            background: linear-gradient(to right, transparent, #e2e8f0, transparent);
            margin: 30px 0;
        }}
        
        .expiry-warning {{
            background-color: #fef5e7;
            border: 1px solid #f6e05e;
            border-radius: 8px;
            padding: 16px;
            margin: 20px 0;
        }}
        
        .expiry-text {{
            color: #744210;
            font-size: 14px;
            font-weight: 500;
        }}
        
        @media (max-width: 600px) {{
            .container {{
                margin: 0;
                border-radius: 0;
            }}
            
            .header, .content, .footer {{
                padding: 30px 20px;
            }}
            
            .greeting {{
                font-size: 20px;
            }}
            
            .reset-button {{
                display: block;
                text-align: center;
                width: 100%;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🏄‍♂️ SUBboards</div>
            <div class="tagline">Прокат SUP досок и водного снаряжения</div>
        </div>
        
        <div class="content">
            <div class="greeting">Привет, {user_name}! 👋</div>
            
            <div class="message">
                Мы получили запрос на восстановление пароля для вашего аккаунта в SUBboards. 
                Если это были вы, нажмите на кнопку ниже, чтобы создать новый пароль.
            </div>
            
            <div style="text-align: center;">
                <a href="{reset_link}" class="reset-button">
                    🔑 Восстановить пароль
                </a>
            </div>
            
            <div class="expiry-warning">
                <div class="expiry-text">
                    ⏰ Ссылка действительна в течение 30 минут с момента отправки письма.
                </div>
            </div>
            
            <div class="security-info">
                <div class="security-title">🔒 Безопасность прежде всего</div>
                <div class="security-text">
                    Если вы не запрашивали восстановление пароля, просто проигнорируйте это письмо. 
                    Ваш пароль останется неизменным. Никогда не передавайте эту ссылку третьим лицам.
                </div>
            </div>
            
            <div class="divider"></div>
            
            <div class="message">
                Если кнопка не работает, скопируйте и вставьте эту ссылку в браузер:<br>
                <code style="background: #f7fafc; padding: 8px; border-radius: 4px; font-size: 12px; word-break: break-all;">
                    {reset_link}
                </code>
            </div>
        </div>
        
        <div class="footer">
            <div class="footer-title">SUBboards - Ваши приключения на воде</div>
            <div class="footer-text">
                Мы помогаем владельцам прокатов SUP досок управлять бронированиями 
                и предоставляем клиентам удобный сервис для аренды водного снаряжения.
            </div>
            
            <div class="social-links">
                <a href="https://supboardapp.ru" class="social-link">🌐 Сайт</a>
                <a href="mailto:support@supboardapp.ru" class="social-link">📧 Поддержка</a>
                <a href="tel:+78001234567" class="social-link">📞 Телефон</a>
            </div>
            
            <div style="margin-top: 20px; font-size: 12px; opacity: 0.7;">
                © {datetime.now().year} SUBboards. Все права защищены.
            </div>
        </div>
    </div>
</body>
</html>
"""
    
    def send_password_reset_email(
        self, 
        to_email: str, 
        user_name: str, 
        reset_token: str
    ) -> Dict[str, Any]:
        """Отправляет email для восстановления пароля"""
        try:
            # Создаем ссылку для восстановления
            reset_link = f"{self.frontend_url}/reset-password?token={reset_token}"
            
            # Сохраняем токен с временем истечения (30 минут)
            self.email_reset_tokens[reset_token] = {
                'email': to_email,
                'user_name': user_name,
                'created_at': datetime.now(),
                'expires_at': datetime.now() + timedelta(minutes=30)
            }
            
            # Создаем сообщение
            msg = MIMEMultipart('alternative')
            msg['Subject'] = "🔑 Восстановление пароля - SUBboards"
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email
            
            # HTML версия
            html_content = self.create_password_reset_email_template(user_name, reset_link)
            html_part = MIMEText(html_content, 'html', 'utf-8')
            
            # Текстовая версия (fallback)
            text_content = f"""
Привет, {user_name}!

Мы получили запрос на восстановление пароля для вашего аккаунта в SUBboards.

Перейдите по ссылке для восстановления пароля:
{reset_link}

Ссылка действительна в течение 30 минут.

Если вы не запрашивали восстановление пароля, просто проигнорируйте это письмо.

С уважением,
Команда SUBboards
            """
            text_part = MIMEText(text_content, 'plain', 'utf-8')
            
            msg.attach(text_part)
            msg.attach(html_part)
            
            # Отправляем email
            logger.info(f"🔍 Проверяем SMTP настройки для отправки...")
            logger.info(f"👤 SMTP_USERNAME: {self.smtp_username}")
            logger.info(f"🔑 SMTP_PASSWORD: {'есть' if self.smtp_password else 'отсутствует'}")
            
            if self.smtp_username and self.smtp_password:
                logger.info(f"🚀 Отправляем РЕАЛЬНЫЙ email через SMTP...")
                try:
                    # Используем SSL для порта 465, STARTTLS для порта 587
                    if self.smtp_port == 465:
                        logger.info(f"🔌 Подключение к SMTP серверу через SSL: {self.smtp_server}:{self.smtp_port}")
                        with smtplib.SMTP_SSL(self.smtp_server, self.smtp_port) as server:
                            logger.info(f"🔐 SSL соединение установлено...")
                            server.login(self.smtp_username, self.smtp_password)
                            logger.info(f"✅ Авторизация успешна...")
                            server.send_message(msg)
                            logger.info(f"📧 Сообщение отправлено!")
                    else:
                        logger.info(f"🔌 Подключение к SMTP серверу через STARTTLS: {self.smtp_server}:{self.smtp_port}")
                        with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                            server.starttls()
                            logger.info(f"🔐 STARTTLS включен...")
                            server.login(self.smtp_username, self.smtp_password)
                            logger.info(f"✅ Авторизация успешна...")
                            server.send_message(msg)
                            logger.info(f"📧 Сообщение отправлено!")
                    
                    logger.info(f"✅ Email восстановления отправлен на {to_email}")
                    
                    return {
                        "success": True,
                        "message": "Email отправлен",
                        "reset_token": reset_token
                    }
                except Exception as smtp_error:
                    logger.error(f"❌ Ошибка SMTP отправки: {str(smtp_error)}")
                    logger.info(f"🔄 Переключаемся в DEV режим из-за ошибки SMTP...")
                    logger.info(f"📧 [DEV MODE] Email восстановления для {to_email}")
                    logger.info(f"🔗 [DEV MODE] Ссылка восстановления: {reset_link}")
                    
                    return {
                        "success": True,
                        "message": "Email отправлен (dev mode - SMTP error)",
                        "reset_token": reset_token,
                        "dev_reset_link": reset_link,
                        "smtp_error": str(smtp_error)
                    }
            else:
                # Режим разработки - просто логируем
                logger.warning(f"⚠️ SMTP настройки неполные - работаем в DEV режиме")
                logger.info(f"📧 [DEV MODE] Email восстановления для {to_email}")
                logger.info(f"🔗 [DEV MODE] Ссылка восстановления: {reset_link}")
                
                return {
                    "success": True,
                    "message": "Email отправлен (dev mode)",
                    "reset_token": reset_token,
                    "dev_reset_link": reset_link  # Для разработки
                }
                
        except Exception as e:
            logger.error(f"❌ Ошибка отправки email: {str(e)}")
            return {
                "success": False,
                "error": f"Ошибка отправки email: {str(e)}"
            }
    
    def verify_email_reset_token(self, token: str) -> Dict[str, Any]:
        """Проверяет токен восстановления через email"""
        if token not in self.email_reset_tokens:
            return {
                "valid": False,
                "error": "Токен не найден или уже использован"
            }
        
        token_data = self.email_reset_tokens[token]
        
        # Проверяем не истек ли токен
        if datetime.now() > token_data['expires_at']:
            del self.email_reset_tokens[token]
            return {
                "valid": False,
                "error": "Ссылка восстановления истекла. Запросите новую."
            }
        
        return {
            "valid": True,
            "email": token_data['email'],
            "user_name": token_data['user_name']
        }
    
    def consume_email_reset_token(self, token: str) -> bool:
        """Использует (удаляет) токен восстановления после успешного сброса пароля"""
        if token in self.email_reset_tokens:
            del self.email_reset_tokens[token]
            return True
        return False
    
    def send_password_changed_notification(
        self, 
        to_email: str, 
        user_name: str
    ) -> Dict[str, Any]:
        """Отправляет уведомление о смене пароля"""
        try:
            # Создаем сообщение
            msg = MIMEMultipart('alternative')
            msg['Subject'] = "🔐 Пароль изменен - SUBboards"
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email
            
            # HTML версия
            html_content = self.create_password_changed_notification_template(user_name)
            html_part = MIMEText(html_content, 'html', 'utf-8')
            
            # Текстовая версия (fallback)
            text_content = f"""
Привет, {user_name}!

Ваш пароль для входа в SUBboards был успешно изменен.

Детали изменения:
- Дата и время: {datetime.now().strftime('%d.%m.%Y в %H:%M')}
- Способ изменения: Восстановление пароля

Если вы не изменяли пароль, немедленно свяжитесь с нашей службой поддержки.

Войти в SUBboards: {self.frontend_url}

С уважением,
Команда SUBboards
            """
            text_part = MIMEText(text_content, 'plain', 'utf-8')
            
            msg.attach(text_part)
            msg.attach(html_part)
            
            # Отправляем email
            logger.info(f"🔍 Проверяем SMTP настройки для уведомления...")
            
            if self.smtp_username and self.smtp_password:
                logger.info(f"🚀 Отправляем РЕАЛЬНОЕ уведомление через SMTP...")
                try:
                    # Используем SSL для порта 465, STARTTLS для порта 587
                    if self.smtp_port == 465:
                        logger.info(f"🔌 Подключение к SMTP серверу для уведомления через SSL...")
                        with smtplib.SMTP_SSL(self.smtp_server, self.smtp_port) as server:
                            logger.info(f"🔐 SSL соединение для уведомления установлено...")
                            server.login(self.smtp_username, self.smtp_password)
                            logger.info(f"✅ Авторизация для уведомления успешна...")
                            server.send_message(msg)
                            logger.info(f"📧 Уведомление отправлено!")
                    else:
                        logger.info(f"🔌 Подключение к SMTP серверу для уведомления через STARTTLS...")
                        with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                            server.starttls()
                            logger.info(f"🔐 STARTTLS для уведомления включен...")
                            server.login(self.smtp_username, self.smtp_password)
                            logger.info(f"✅ Авторизация для уведомления успешна...")
                            server.send_message(msg)
                            logger.info(f"📧 Уведомление отправлено!")
                    
                    logger.info(f"✅ Уведомление о смене пароля отправлено на {to_email}")
                    
                    return {
                        "success": True,
                        "message": "Уведомление отправлено"
                    }
                except Exception as smtp_error:
                    logger.error(f"❌ Ошибка SMTP при отправке уведомления: {str(smtp_error)}")
                    logger.info(f"📧 [DEV MODE] Уведомление о смене пароля для {to_email} (SMTP error)")
                    logger.info(f"👤 [DEV MODE] Пользователь: {user_name}")
                    
                    return {
                        "success": False,
                        "message": "Ошибка отправки уведомления",
                        "error": str(smtp_error)
                    }
            else:
                # Режим разработки - просто логируем
                logger.warning(f"⚠️ SMTP настройки неполные - уведомление в DEV режиме")
                logger.info(f"📧 [DEV MODE] Уведомление о смене пароля для {to_email}")
                logger.info(f"👤 [DEV MODE] Пользователь: {user_name}")
                
                return {
                    "success": True,
                    "message": "Уведомление отправлено (dev mode)"
                }
                
        except Exception as e:
            logger.error(f"❌ Ошибка отправки уведомления о смене пароля: {str(e)}")
            return {
                "success": False,
                "error": f"Ошибка отправки уведомления: {str(e)}"
            }

# Создаем глобальный экземпляр
email_service = EmailService() 