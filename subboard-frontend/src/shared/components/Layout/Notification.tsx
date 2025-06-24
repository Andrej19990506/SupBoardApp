import React, { useEffect, useRef, useState } from 'react';

interface NotificationProps {
    message: string;
    type?: 'success' | 'error' | 'info';
    isOpen: boolean;
    onClose: () => void;
}

const getBgColor = (type?: string) => {
    switch (type) {
        case 'success': return 'rgba(52, 199, 89, 0.98)';
        case 'error': return 'rgba(255, 77, 79, 0.98)';
        case 'info':
        default: return 'rgba(0, 122, 255, 0.98)';
    }
};

const Notification: React.FC<NotificationProps> = ({ message, type = 'info', isOpen, onClose }) => {
    const [visible, setVisible] = useState(isOpen);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        setVisible(isOpen);
        if (isOpen) {
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                setVisible(false);
                setTimeout(onClose, 350); // дождаться анимации
            }, 3000);
        }
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [isOpen, onClose]);

    if (!isOpen && !visible) return null;
    return (
        <div
            style={{
                position: 'fixed',
                top: 32,
                left: '50%',
                transform: `translateX(-50%) ${visible ? 'translateY(0)' : 'translateY(-40px)'}`,
                zIndex: 3000,
                background: getBgColor(type),
                color: '#fff',
                padding: '16px 32px',
                borderRadius: 12,
                boxShadow: '0 4px 24px #0006',
                fontSize: 18,
                fontWeight: 500,
                minWidth: 220,
                textAlign: 'center',
                transition: 'opacity 0.35s, transform 0.35s',
                opacity: visible ? 1 : 0,
                pointerEvents: 'auto',
                cursor: 'pointer',
            }}
            onClick={() => {
                setVisible(false);
                setTimeout(onClose, 350);
            }}
        >
            {message}
        </div>
    );
};

export default Notification; 