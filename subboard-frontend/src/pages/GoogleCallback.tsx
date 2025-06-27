import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import { authenticateWithGoogle } from '../features/auth/store/authSlice';
import { AppDispatch } from '../features/booking/store';
import AnimatedLogo from '../shared/components/AnimatedLogo';

const GoogleCallback: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    const handleGoogleCallback = async () => {
      try {
        // Получаем код авторизации из URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const scope = urlParams.get('scope');

        console.log('🔄 Google callback - получены параметры:', { 
          code: code?.substring(0, 20) + '...', 
          state, 
          scope 
        });

        if (code) {
          console.log('📡 Отправляем код на сервер...');
          
          // Отправляем код на сервер для получения токена
          const result = await dispatch(authenticateWithGoogle({ 
            code, 
            state: state || undefined,
            scope: scope || 'openid email profile'
          }));
          
          console.log('✅ Результат авторизации:', result);
          
          // Перенаправляем на главную страницу
          window.location.href = '/';
        } else {
          // Ошибка авторизации
          console.error('❌ Google authorization failed: no code received');
          window.location.href = '/';
        }
      } catch (error) {
        console.error('❌ Google callback error:', error);
        window.location.href = '/';
      }
    };

    handleGoogleCallback();
  }, [dispatch]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      width: '100vw',
      position: 'fixed',
      top: 0,
      left: 0,
      background: `
        radial-gradient(circle at 20% 30%, rgba(0, 122, 255, 0.08) 0%, transparent 50%),
        radial-gradient(circle at 80% 70%, rgba(52, 199, 89, 0.06) 0%, transparent 50%),
        radial-gradient(circle at 40% 80%, rgba(255, 45, 85, 0.04) 0%, transparent 50%),
        radial-gradient(circle at 70% 20%, rgba(175, 82, 222, 0.05) 0%, transparent 50%),
        #0A0A0B
      `,
      color: 'white',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      overflow: 'hidden'
    }}>
      {/* Фоновые анимированные элементы */}
      <motion.div
        style={{
          position: 'absolute',
          top: '10%',
          left: '15%',
          width: '200px',
          height: '200px',
          background: 'radial-gradient(circle, rgba(0, 122, 255, 0.1) 0%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(40px)',
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      <motion.div
        style={{
          position: 'absolute',
          bottom: '20%',
          right: '20%',
          width: '150px',
          height: '150px',
          background: 'radial-gradient(circle, rgba(52, 199, 89, 0.08) 0%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(30px)',
        }}
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.4, 0.8, 0.4],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1
        }}
      />

      {/* Основной контент */}
      <motion.div 
        style={{ 
          textAlign: 'center',
          position: 'relative',
          zIndex: 2
        }}
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ 
          duration: 0.8,
          type: "spring",
          stiffness: 100,
          damping: 15
        }}
      >
        {/* Контейнер с иконками и стрелкой */}
        <motion.div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '40px',
            marginBottom: '40px'
          }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ 
            duration: 1,
            delay: 0.3,
            type: "spring",
            stiffness: 150,
            damping: 20
          }}
        >
          {/* Наш логотип */}
          <motion.div
            whileHover={{ scale: 1.1 }}
            animate={{ 
              rotateY: [0, 10, 0, -10, 0],
            }}
            transition={{
              rotateY: {
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }
            }}
          >
            <AnimatedLogo size="large" />
          </motion.div>

          {/* Анимированная стрелка */}
          <motion.div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}
            animate={{
              x: [0, 10, 0, -5, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <motion.div
              style={{
                fontSize: '32px',
                background: 'linear-gradient(135deg, #007AFF, #00D4FF)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 0 8px rgba(0, 122, 255, 0.3))'
              }}
              animate={{
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              ➜
            </motion.div>
            
            {/* Световые частицы вокруг стрелки */}
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                style={{
                  position: 'absolute',
                  width: '4px',
                  height: '4px',
                  background: '#007AFF',
                  borderRadius: '50%',
                  boxShadow: '0 0 6px #007AFF',
                }}
                animate={{
                  x: [0, 20, 40, 60],
                  opacity: [0, 1, 1, 0],
                  scale: [0, 1, 1, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.3,
                  ease: "easeOut"
                }}
              />
            ))}
          </motion.div>

          {/* Google иконка */}
          <motion.div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              position: 'relative',
              overflow: 'hidden'
            }}
            whileHover={{ scale: 1.1 }}
            animate={{ 
              rotateY: [0, -10, 0, 10, 0],
            }}
            transition={{
              rotateY: {
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 2
              }
            }}
          >
            <img 
              src="/icons8-google.svg" 
              alt="Google" 
              style={{ 
                width: '48px', 
                height: '48px',
                filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))'
              }} 
            />
            
            {/* Эффект блика */}
            <motion.div
              style={{
                position: 'absolute',
                top: '-50%',
                left: '-50%',
                width: '200%',
                height: '200%',
                background: 'linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.3) 50%, transparent 70%)',
                borderRadius: '50%',
                pointerEvents: 'none',
              }}
              animate={{
                rotate: [0, 360],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear"
              }}
            />
          </motion.div>
        </motion.div>

        {/* Заголовок */}
        <motion.h2 
          style={{
            fontSize: '28px',
            fontWeight: 700,
            margin: '0 0 16px 0',
            background: 'linear-gradient(135deg, #FFFFFF, #E0E0E0)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
            lineHeight: 1.2
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            duration: 0.8,
            delay: 0.6,
            type: "spring",
            stiffness: 100
          }}
        >
          Авторизация через Google
        </motion.h2>

        {/* Подзаголовок */}
        <motion.p 
          style={{
            fontSize: '18px',
            color: '#86868B',
            margin: '0 0 32px 0',
            fontWeight: 500,
            lineHeight: 1.4
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ 
            duration: 0.8,
            delay: 0.8
          }}
        >
          Подождите, завершаем процесс входа...
        </motion.p>

        {/* Анимированный индикатор загрузки */}
        <motion.div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '24px'
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ 
            duration: 0.8,
            delay: 1
          }}
        >
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #007AFF, #00D4FF)',
                boxShadow: '0 0 10px rgba(0, 122, 255, 0.5)'
              }}
              animate={{
                scale: [0.8, 1.2, 0.8],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut"
              }}
            />
          ))}
        </motion.div>

        {/* Дополнительная информация */}
        <motion.div
          style={{
            fontSize: '14px',
            color: '#5A5A5E',
            fontStyle: 'italic',
            maxWidth: '400px',
            margin: '0 auto'
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ 
            duration: 0.8,
            delay: 1.2
          }}
        >
          Если процесс затягивается, попробуйте обновить страницу
        </motion.div>
      </motion.div>

      {/* Дополнительные декоративные элементы */}
      <motion.div
        style={{
          position: 'absolute',
          top: '50%',
          left: '5%',
          width: '2px',
          height: '100px',
          background: 'linear-gradient(to bottom, transparent, rgba(0, 122, 255, 0.3), transparent)',
          borderRadius: '1px',
        }}
        animate={{
          scaleY: [0, 1, 0],
          opacity: [0, 0.8, 0],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      <motion.div
        style={{
          position: 'absolute',
          top: '30%',
          right: '8%',
          width: '2px',
          height: '80px',
          background: 'linear-gradient(to bottom, transparent, rgba(52, 199, 89, 0.3), transparent)',
          borderRadius: '1px',
        }}
        animate={{
          scaleY: [0, 1, 0],
          opacity: [0, 0.6, 0],
        }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1
        }}
      />
    </div>
  );
};

export default GoogleCallback; 