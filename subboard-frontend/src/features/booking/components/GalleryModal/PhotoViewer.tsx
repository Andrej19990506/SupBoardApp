import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';

interface PhotoItem {
    id: string;
    file: File;
    url: string;
    name: string;
    size: number;
}

interface PhotoViewerProps {
    isOpen: boolean;
    onClose: () => void;
    photos: PhotoItem[];
    currentIndex: number;
    onDelete: (photoId: string) => void;
}

const PhotoViewer: React.FC<PhotoViewerProps> = ({ 
    isOpen, 
    onClose, 
    photos, 
    currentIndex, 
    onDelete 
}) => {
    const [currentPhotoIndex, setCurrentPhotoIndex] = useState(currentIndex);
    const [scale, setScale] = useState(1);
    const [showControls, setShowControls] = useState(true);
    const [showInfo, setShowInfo] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [showHints, setShowHints] = useState(true);

    const currentPhoto = photos[currentPhotoIndex];

    // Обновляем индекс когда меняется currentIndex извне
    useEffect(() => {
        setCurrentPhotoIndex(currentIndex);
    }, [currentIndex]);

    // Навигация клавишами
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'Escape':
                    onClose();
                    break;
                case 'ArrowLeft':
                    goToPrevious();
                    break;
                case 'ArrowRight':
                    goToNext();
                    break;
                case '+':
                case '=':
                    zoomIn();
                    break;
                case '-':
                    zoomOut();
                    break;
                case '0':
                    resetZoom();
                    break;
                case 'i':
                case 'I':
                    setShowInfo(!showInfo);
                    break;
                case 'Delete':
                case 'Backspace':
                    if (currentPhoto) {
                        handleDelete();
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, currentPhotoIndex, showInfo, scale]);

    // Автоскрытие контролов
    useEffect(() => {
        let timeout: NodeJS.Timeout;
        
        const resetTimeout = () => {
            clearTimeout(timeout);
            setShowControls(true);
            timeout = setTimeout(() => setShowControls(false), 3000);
        };

        if (isOpen) {
            resetTimeout();
            
            const handleMouseMove = () => resetTimeout();
            window.addEventListener('mousemove', handleMouseMove);
            
            return () => {
                clearTimeout(timeout);
                window.removeEventListener('mousemove', handleMouseMove);
            };
        }
    }, [isOpen]);

    // Автоскрытие подсказок через 5 секунд
    useEffect(() => {
        if (isOpen) {
            const hintsTimeout = setTimeout(() => {
                setShowHints(false);
            }, 5000);
            
            return () => clearTimeout(hintsTimeout);
        }
    }, [isOpen]);

    const goToPrevious = useCallback(() => {
        setCurrentPhotoIndex(prev => prev > 0 ? prev - 1 : photos.length - 1);
        setScale(1);
        setPosition({ x: 0, y: 0 });
        setShowHints(false); // Скрываем подсказки при навигации
    }, [photos.length]);

    const goToNext = useCallback(() => {
        setCurrentPhotoIndex(prev => prev < photos.length - 1 ? prev + 1 : 0);
        setScale(1);
        setPosition({ x: 0, y: 0 });
        setShowHints(false); // Скрываем подсказки при навигации
    }, [photos.length]);

    const zoomIn = () => setScale(prev => Math.min(prev * 1.5, 5));
    const zoomOut = () => setScale(prev => Math.max(prev / 1.5, 0.5));
    const resetZoom = () => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    };

    const handleDelete = () => {
        if (currentPhoto && window.confirm(`Удалить фотографию "${currentPhoto.name}"?`)) {
            onDelete(currentPhoto.id);
            
            // Если это была последняя фотография, закрываем просмотрщик
            if (photos.length === 1) {
                onClose();
            } else {
                // Переходим к следующей фотографии или к предыдущей если удаляем последнюю
                const nextIndex = currentPhotoIndex >= photos.length - 1 
                    ? Math.max(0, currentPhotoIndex - 1)
                    : currentPhotoIndex;
                setCurrentPhotoIndex(nextIndex);
            }
        }
    };

    const handleDownload = () => {
        if (currentPhoto) {
            const link = document.createElement('a');
            link.href = currentPhoto.url;
            link.download = currentPhoto.name;
            link.click();
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (file: File): string => {
        return new Date(file.lastModified).toLocaleString('ru-RU');
    };

    if (!currentPhoto) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <ViewerOverlay
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    onClick={onClose}
                >
                    {/* Основное изображение */}
                    <PhotoContainer
                        onClick={(e) => e.stopPropagation()}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    >
                        <PhotoImage
                            as={motion.img}
                            src={currentPhoto.url}
                            alt={currentPhoto.name}
                            style={{ 
                                transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`,
                                cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
                            }}
                            drag={scale > 1}
                            dragConstraints={{ left: -200, right: 200, top: -200, bottom: 200 }}
                            dragElastic={0.1}
                            onDragStart={() => setIsDragging(true)}
                            onDragEnd={() => setIsDragging(false)}
                            onDrag={(_, info) => {
                                setPosition({
                                    x: info.offset.x,
                                    y: info.offset.y
                                });
                            }}
                            onClick={(e) => e.stopPropagation()}
                            whileDrag={{ scale: scale * 0.95 }}
                        />
                    </PhotoContainer>

                    {/* Контролы навигации */}
                    <AnimatePresence>
                        {showControls && (
                            <>
                                {/* Шапка с информацией */}
                                <TopControls
                                    initial={{ y: -100, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: -100, opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <PhotoTitle>{currentPhoto.name}</PhotoTitle>
                                    <PhotoCounter>
                                        {currentPhotoIndex + 1} из {photos.length}
                                    </PhotoCounter>
                                    <CloseButton onClick={onClose}>✕</CloseButton>
                                </TopControls>

                                {/* Нижние контролы */}
                                <BottomControls
                                    initial={{ y: 100, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: 100, opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <ControlsLeft>
                                                                <ZoomControls onClick={(e) => e.stopPropagation()}>
                            <ZoomButton onClick={zoomOut} disabled={scale <= 0.5}>
                                🔍-
                            </ZoomButton>
                            <ZoomValue>{Math.round(scale * 100)}%</ZoomValue>
                            <ZoomButton onClick={zoomIn} disabled={scale >= 5}>
                                🔍+
                            </ZoomButton>
                            <ZoomButton onClick={resetZoom}>
                                ⚡
                            </ZoomButton>
                        </ZoomControls>
                                    </ControlsLeft>

                                    <ControlsCenter onClick={(e) => e.stopPropagation()}>
                                        <ActionButton 
                                            onClick={() => setShowInfo(!showInfo)}
                                            $active={showInfo}
                                        >
                                            ℹ️ Инфо
                                        </ActionButton>
                                        <ActionButton onClick={handleDownload}>
                                            📥 Скачать
                                        </ActionButton>
                                        <ActionButton onClick={handleDelete} $danger>
                                            🗑️ Удалить
                                        </ActionButton>
                                    </ControlsCenter>

                                    <ControlsRight onClick={(e) => e.stopPropagation()}>
                                        <NavigationButton 
                                            onClick={goToPrevious}
                                            disabled={photos.length <= 1}
                                        >
                                            ← Пред
                                        </NavigationButton>
                                        <NavigationButton 
                                            onClick={goToNext}
                                            disabled={photos.length <= 1}
                                        >
                                            След →
                                        </NavigationButton>
                                    </ControlsRight>
                                </BottomControls>


                            </>
                        )}
                    </AnimatePresence>

                    {/* Панель информации */}
                    <AnimatePresence>
                        {showInfo && (
                            <InfoPanel
                                initial={{ x: 300, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: 300, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <InfoTitle>Информация о файле</InfoTitle>
                                <InfoItem>
                                    <InfoLabel>Название:</InfoLabel>
                                    <InfoValue>{currentPhoto.name}</InfoValue>
                                </InfoItem>
                                <InfoItem>
                                    <InfoLabel>Размер:</InfoLabel>
                                    <InfoValue>{formatFileSize(currentPhoto.size)}</InfoValue>
                                </InfoItem>
                                <InfoItem>
                                    <InfoLabel>Дата изменения:</InfoLabel>
                                    <InfoValue>{formatDate(currentPhoto.file)}</InfoValue>
                                </InfoItem>
                                <InfoItem>
                                    <InfoLabel>Тип:</InfoLabel>
                                    <InfoValue>{currentPhoto.file.type}</InfoValue>
                                </InfoItem>
                            </InfoPanel>
                        )}
                    </AnimatePresence>

                    {/* Подсказки клавиш - показываем только при первом открытии */}
                    <KeyboardHints
                        initial={{ opacity: 0 }}
                        animate={{ opacity: showControls && showHints && !isDragging && scale === 1 ? 0.5 : 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <HintItem>ESC - закрыть</HintItem>
                        <HintItem>← → - навигация</HintItem>
                        <HintItem>+ - - масштаб</HintItem>
                        <HintItem>I - информация</HintItem>
                        <HintItem>Del - удалить</HintItem>
                    </KeyboardHints>
                </ViewerOverlay>
            )}
        </AnimatePresence>
    );
};

// Стили
const ViewerOverlay = styled(motion.div)`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #000000;
    z-index: 1200;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
`;

const PhotoContainer = styled(motion.div)`
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: default;
    background: transparent;
    border-radius: 8px;
    overflow: hidden;
`;

const PhotoImage = styled.img`
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 8px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    transition: box-shadow 0.3s ease;
    user-select: none;
    -webkit-user-drag: none;
    background: transparent;
`;

const TopControls = styled(motion.div)`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 80px;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.6) 50%, transparent 100%);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 32px;
    z-index: 1201;
`;

const PhotoTitle = styled.h3`
    color: #fff;
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    max-width: 40%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const PhotoCounter = styled.div`
    color: #86868B;
    font-size: 16px;
    font-weight: 500;
`;

const CloseButton = styled.button`
    background: rgba(255, 59, 48, 0.15);
    border: 1px solid rgba(255, 59, 48, 0.3);
    color: #fff;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 18px;
    font-weight: 600;
    transition: all 0.2s ease;
    box-shadow: 0 2px 12px rgba(255, 59, 48, 0.2);

    &:hover {
        background: rgba(255, 59, 48, 0.25);
        border-color: rgba(255, 59, 48, 0.5);
        transform: scale(1.05);
        box-shadow: 0 4px 16px rgba(255, 59, 48, 0.3);
    }

    &:active {
        transform: scale(0.95);
    }
`;

const BottomControls = styled(motion.div)`
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 80px;
    background: linear-gradient(0deg, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.6) 50%, transparent 100%);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    z-index: 1201;
`;

const ControlsLeft = styled.div`
    display: flex;
    align-items: center;
    gap: 16px;
`;

const ControlsCenter = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
`;

const ControlsRight = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
`;

const ZoomControls = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(40, 40, 40, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    padding: 6px 10px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
`;

const ZoomButton = styled.button`
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #fff;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    transition: all 0.2s ease;

    &:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.15);
        border-color: rgba(255, 255, 255, 0.25);
        transform: translateY(-1px);
    }

    &:active:not(:disabled) {
        transform: translateY(0);
        background: rgba(255, 255, 255, 0.2);
    }

    &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
`;

const ZoomValue = styled.span`
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    min-width: 45px;
    text-align: center;
    letter-spacing: 0.5px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
`;

const ActionButton = styled.button<{ $active?: boolean; $danger?: boolean }>`
    background: ${props => 
        props.$danger 
            ? 'rgba(255, 59, 48, 0.2)' 
            : props.$active 
                ? 'rgba(0, 122, 255, 0.3)' 
                : 'rgba(40, 40, 40, 0.95)'};
    border: 1px solid ${props => 
        props.$danger 
            ? 'rgba(255, 59, 48, 0.4)' 
            : props.$active 
                ? 'rgba(0, 122, 255, 0.5)' 
                : 'rgba(255, 255, 255, 0.2)'};
    color: #fff;
    padding: 8px 12px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);

    &:hover {
        background: ${props => 
            props.$danger 
                ? 'rgba(255, 59, 48, 0.3)' 
                : props.$active 
                    ? 'rgba(0, 122, 255, 0.4)'
                    : 'rgba(60, 60, 60, 0.95)'};
        transform: translateY(-1px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
    }

    &:active {
        transform: translateY(0);
    }
`;

const NavigationButton = styled.button`
    background: rgba(0, 122, 255, 0.2);
    border: 1px solid rgba(0, 122, 255, 0.4);
    color: #fff;
    padding: 8px 14px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 12px rgba(0, 122, 255, 0.2);

    &:hover:not(:disabled) {
        background: rgba(0, 122, 255, 0.3);
        border-color: rgba(0, 122, 255, 0.6);
        transform: translateY(-1px);
        box-shadow: 0 4px 16px rgba(0, 122, 255, 0.3);
    }

    &:active:not(:disabled) {
        transform: translateY(0);
    }

    &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
`;



const InfoPanel = styled(motion.div)`
    position: fixed;
    top: 80px;
    right: 0;
    width: 280px;
    height: calc(100vh - 160px);
    background: linear-gradient(135deg, rgba(30, 30, 30, 0.98) 0%, rgba(45, 45, 45, 0.95) 100%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 16px 0 0 16px;
    padding: 20px;
    z-index: 1201;
    overflow-y: auto;
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.6);

    /* Красивый скроллбар */
    &::-webkit-scrollbar {
        width: 4px;
    }

    &::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 2px;
    }

    &::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 2px;
    }

    &::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
    }
`;

const InfoTitle = styled.h4`
    color: #fff;
    margin: 0 0 18px 0;
    font-size: 16px;
    font-weight: 700;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 8px;
`;

const InfoItem = styled.div`
    margin-bottom: 14px;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);

    &:last-child {
        border-bottom: none;
        margin-bottom: 0;
    }
`;

const InfoLabel = styled.div`
    color: #86868B;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 3px;
`;

const InfoValue = styled.div`
    color: #fff;
    font-size: 13px;
    font-weight: 500;
    word-break: break-all;
    line-height: 1.4;
`;

const KeyboardHints = styled(motion.div)`
    position: fixed;
    bottom: 90px;
    right: 24px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    z-index: 1201;
    align-items: flex-end;
`;

const HintItem = styled.div`
    background: rgba(40, 40, 40, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #888888;
    padding: 2px 5px;
    border-radius: 3px;
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 0.2px;
    text-align: right;
`;

export default PhotoViewer; 