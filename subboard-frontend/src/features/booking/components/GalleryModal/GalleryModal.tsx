import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import PhotoEditor from './PhotoEditor';
import PhotoViewer from './PhotoViewer';

interface GalleryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface PhotoItem {
    id: string;
    file: File;
    url: string;
    name: string;
    size: number;
}

const GalleryModal: React.FC<GalleryModalProps> = ({ isOpen, onClose }) => {
    const [photos, setPhotos] = useState<PhotoItem[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [showPhotoEditor, setShowPhotoEditor] = useState(false);
    const [selectedFileForEdit, setSelectedFileForEdit] = useState<File | null>(null);
    const [showPhotoViewer, setShowPhotoViewer] = useState(false);
    const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        // Берем первый файл для редактирования
        const file = files[0];
        
        // Проверка типа файла
        if (!file.type.startsWith('image/')) {
            console.warn(`Файл ${file.name} не является изображением`);
            return;
        }

        // Проверка размера файла (5 МБ)
        if (file.size > 5 * 1024 * 1024) {
            console.warn(`Файл ${file.name} превышает максимальный размер 5 МБ`);
            return;
        }

        // Открываем редактор для выбранного файла
        setSelectedFileForEdit(file);
        setShowPhotoEditor(true);

        // Очищаем input для возможности повторного выбора тех же файлов
        if (event.target) {
            event.target.value = '';
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleDeletePhoto = (photoId: string) => {
        setPhotos(prev => {
            const photoToDelete = prev.find(p => p.id === photoId);
            if (photoToDelete) {
                URL.revokeObjectURL(photoToDelete.url);
            }
            return prev.filter(p => p.id !== photoId);
        });
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handlePhotoEditorSave = (croppedFile: File, originalFile: File) => {
        const photoItem: PhotoItem = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            file: croppedFile,
            url: URL.createObjectURL(croppedFile),
            name: croppedFile.name,
            size: croppedFile.size
        };

        setPhotos(prev => [...prev, photoItem]);
        setShowPhotoEditor(false);
        setSelectedFileForEdit(null);
    };

    const handlePhotoEditorClose = () => {
        setShowPhotoEditor(false);
        setSelectedFileForEdit(null);
    };

    const handlePhotoClick = (photoId: string) => {
        const photoIndex = photos.findIndex(photo => photo.id === photoId);
        if (photoIndex !== -1) {
            setCurrentPhotoIndex(photoIndex);
            setShowPhotoViewer(true);
        }
    };

    const handlePhotoViewerClose = () => {
        setShowPhotoViewer(false);
    };

    // Очистка URL объектов при размонтировании компонента
    useEffect(() => {
        return () => {
            photos.forEach(photo => {
                URL.revokeObjectURL(photo.url);
            });
        };
    }, [photos]);

    return (
        <AnimatePresence>
            {isOpen && (
                <ModalOverlay
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    onClick={onClose}
                >
                    <ModalContent
                        initial={{ scale: 0.8, opacity: 0, y: 50 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.8, opacity: 0, y: 50 }}
                        transition={{ 
                            type: "spring", 
                            stiffness: 300, 
                            damping: 25,
                            duration: 0.4
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <ModalHeader>
                            <HeaderTitle>📸 Галерея инвентаря</HeaderTitle>
                            <CloseButton onClick={onClose}>✕</CloseButton>
                        </ModalHeader>

                        <ModalBody>
                            {/* Скрытый input для выбора файлов - всегда доступен */}
                            <HiddenFileInput
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileSelect}
                            />
                            
                            {photos.length === 0 ? (
                                <EmptyState>
                                <EmptyStateIcon>
                                    <motion.div
                                        animate={{ 
                                            scale: [1, 1.1, 1],
                                            rotate: [0, 5, -5, 0]
                                        }}
                                        transition={{ 
                                            duration: 3,
                                            repeat: Infinity,
                                            ease: "easeInOut"
                                        }}
                                    >
                                        📷
                                    </motion.div>
                                </EmptyStateIcon>
                                
                                <EmptyStateTitle>Галерея пуста</EmptyStateTitle>
                                
                                <EmptyStateDescription>
                                    Здесь будут отображаться фотографии вашего инвентаря.
                                    <br />
                                    Загружайте качественные снимки досок, жилетов и другого оборудования,
                                    <br />
                                    чтобы клиенты могли увидеть состояние инвентаря перед бронированием.
                                </EmptyStateDescription>

                                <FeaturesList>
                                                            <FeatureItem>
                            <FeatureIcon>🎯</FeatureIcon>
                            <FeatureText>Показывайте реальное состояние инвентаря</FeatureText>
                        </FeatureItem>
                        <FeatureItem>
                            <FeatureIcon>⭐</FeatureIcon>
                            <FeatureText>Повышайте доверие клиентов</FeatureText>
                        </FeatureItem>
                        <FeatureItem>
                            <FeatureIcon>📸</FeatureIcon>
                            <FeatureText>Демонстрируйте качество оборудования</FeatureText>
                        </FeatureItem>
                                </FeaturesList>

                                <UploadButton
                                    type="button"
                                    whileHover={{ 
                                        scale: 1.05,
                                        boxShadow: '0 8px 32px rgba(255, 159, 10, 0.3)'
                                    }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleUploadClick}
                                    disabled={isUploading || showPhotoEditor}
                                >
                                    <UploadIcon>{isUploading ? '⏳' : showPhotoEditor ? '✂️' : '📤'}</UploadIcon>
                                    {isUploading ? 'Загрузка...' : showPhotoEditor ? 'Редактор открыт...' : 'Загрузить фотографии'}
                                </UploadButton>

                                <HelpText>
                                    💡 Рекомендуем загружать фото в формате JPG или PNG, размером не более 5 МБ
                                </HelpText>
                            </EmptyState>
                            ) : (
                                <PhotoGallery>
                                    <GalleryHeader>
                                        <GalleryTitle>📸 Фотографии инвентаря ({photos.length})</GalleryTitle>
                                        <AddMoreButton
                                            type="button"
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={handleUploadClick}
                                            disabled={isUploading || showPhotoEditor}
                                        >
                                            <span>{isUploading ? '⏳' : showPhotoEditor ? '✂️' : '➕'}</span>
                                            {isUploading ? 'Загрузка...' : showPhotoEditor ? 'Редактор открыт...' : 'Добавить еще'}
                                        </AddMoreButton>
                                    </GalleryHeader>
                                    
                                    <PhotoGrid>
                                        {photos.map((photo) => (
                                            <PhotoCard 
                                                key={photo.id}
                                                onClick={() => handlePhotoClick(photo.id)}
                                            >
                                                <PhotoImage src={photo.url} alt={photo.name} />
                                                <PhotoOverlay>
                                                    <PhotoActions>
                                                        <ViewButton>
                                                            🔍
                                                        </ViewButton>
                                                        <DeleteButton
                                                            whileHover={{ scale: 1.1 }}
                                                            whileTap={{ scale: 0.9 }}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeletePhoto(photo.id);
                                                            }}
                                                        >
                                                            🗑️
                                                        </DeleteButton>
                                                    </PhotoActions>
                                                    <PhotoInfo>
                                                        <PhotoName>{photo.name}</PhotoName>
                                                        <PhotoSize>{formatFileSize(photo.size)}</PhotoSize>
                                                    </PhotoInfo>
                                                </PhotoOverlay>
                                            </PhotoCard>
                                        ))}
                                    </PhotoGrid>
                                </PhotoGallery>
                            )}
                        </ModalBody>
                    </ModalContent>
                </ModalOverlay>
            )}
            
            {/* Редактор фотографий */}
            <PhotoEditor
                isOpen={showPhotoEditor}
                onClose={handlePhotoEditorClose}
                onSave={handlePhotoEditorSave}
                file={selectedFileForEdit}
            />

            {/* Просмотрщик фотографий */}
            <PhotoViewer
                isOpen={showPhotoViewer}
                onClose={handlePhotoViewerClose}
                photos={photos}
                currentIndex={currentPhotoIndex}
                onDelete={handleDeletePhoto}
            />
        </AnimatePresence>
    );
};

// Стили в стекломорфизм стиле
const ModalOverlay = styled(motion.div)`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
`;

const ModalContent = styled(motion.div)`
    background: linear-gradient(135deg, rgba(28, 28, 30, 0.95) 0%, rgba(44, 44, 46, 0.9) 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    backdrop-filter: blur(20px);
    box-shadow: 
        0 20px 60px rgba(0, 0, 0, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
    width: 100%;
    max-width: 800px;
    max-height: 90vh;
    overflow: hidden;
    position: relative;

    /* Анимированная подсветка */
    &::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.05), transparent);
        animation: shimmer 3s ease-in-out infinite;
    }

    @keyframes shimmer {
        0% { left: -100%; }
        50% { left: 100%; }
        100% { left: 100%; }
    }
`;

const ModalHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 24px 32px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    background: linear-gradient(135deg, rgba(44, 44, 46, 0.8) 0%, rgba(58, 58, 60, 0.6) 100%);
    position: relative;
    
    /* Фирменная полоска градиент */
    &::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(
            90deg,
            #007AFF 0%,
            #52C41A 25%,
            #FFD600 50%,
            #FF6B35 75%,
            #007AFF 100%
        );
        background-size: 200% 100%;
        animation: gradientShift 4s ease-in-out infinite;
    }
    
    @keyframes gradientShift {
        0%, 100% {
            background-position: 0% 50%;
        }
        50% {
            background-position: 100% 50%;
        }
    }
`;

const HeaderTitle = styled.h2`
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    color: #fff;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
`;

const CloseButton = styled.button`
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
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
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);

    &:hover {
        background: rgba(255, 59, 48, 0.2);
        border-color: rgba(255, 59, 48, 0.4);
        transform: scale(1.1);
    }

    &:active {
        transform: scale(0.95);
    }
`;

const ModalBody = styled.div`
    padding: 40px 32px;
    overflow-y: auto;
    max-height: calc(90vh - 100px);

    /* Красивый скроллбар */
    &::-webkit-scrollbar {
        width: 6px;
    }

    &::-webkit-scrollbar-track {
        background: rgba(44, 44, 46, 0.3);
        border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, #86868B 0%, #5A5A5E 100%);
        border-radius: 3px;
        transition: background 0.2s ease;
    }

    &::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(180deg, #A0A0A5 0%, #7A7A7E 100%);
    }
`;

const EmptyState = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 40px 20px;
`;

const EmptyStateIcon = styled.div`
    font-size: 80px;
    margin-bottom: 24px;
    filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3));
`;

const EmptyStateTitle = styled.h3`
    font-size: 28px;
    font-weight: 700;
    color: #fff;
    margin: 0 0 16px 0;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
`;

const EmptyStateDescription = styled.p`
    font-size: 16px;
    color: #86868B;
    line-height: 1.6;
    margin: 0 0 32px 0;
    max-width: 600px;
`;

const FeaturesList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 40px;
    width: 100%;
    max-width: 500px;
`;

const FeatureItem = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    background: linear-gradient(135deg, rgba(44, 44, 46, 0.6) 0%, rgba(58, 58, 60, 0.4) 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    backdrop-filter: blur(10px);
    transition: all 0.3s ease;

    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        border-color: rgba(255, 255, 255, 0.2);
    }
`;

const FeatureIcon = styled.div`
    font-size: 24px;
    flex-shrink: 0;
`;

const FeatureText = styled.div`
    font-size: 16px;
    color: #fff;
    font-weight: 500;
`;

const UploadButton = styled(motion.button)`
    background: linear-gradient(135deg, #FF9F0A 0%, #FF8C00 100%);
    border: none;
    color: #fff;
    padding: 16px 32px;
    border-radius: 16px;
    font-size: 18px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 
        0 8px 24px rgba(255, 159, 10, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
    transition: all 0.3s ease;
    margin-bottom: 24px;

    &:hover {
        background: linear-gradient(135deg, #FFB340 0%, #FF9F0A 100%);
    }

    &:active {
        transform: scale(0.98);
    }

    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`;

const UploadIcon = styled.div`
    font-size: 20px;
`;

const HelpText = styled.div`
    font-size: 14px;
    color: #86868B;
    font-style: italic;
    max-width: 500px;
`;

const HiddenFileInput = styled.input`
    display: none;
`;

// Стили для галереи фотографий
const PhotoGallery = styled.div`
    width: 100%;
`;

const GalleryHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const GalleryTitle = styled.h3`
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    color: #fff;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
`;

const AddMoreButton = styled(motion.button)`
    background: linear-gradient(135deg, #007AFF 0%, #0056CC 100%);
    border: none;
    color: #fff;
    padding: 12px 20px;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 16px rgba(0, 122, 255, 0.3);
    transition: all 0.3s ease;

    &:hover {
        background: linear-gradient(135deg, #3395FF 0%, #007AFF 100%);
    }

    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    span {
        font-size: 18px;
    }
`;

const PhotoGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 20px;
    margin-bottom: 24px;
`;

const PhotoCard = styled(motion.div)`
    position: relative;
    aspect-ratio: 1;
    border-radius: 16px;
    overflow: hidden;
    background: linear-gradient(135deg, rgba(44, 44, 46, 0.8) 0%, rgba(58, 58, 60, 0.6) 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    transition: all 0.3s ease;
    cursor: pointer;

    &:hover {
        transform: translateY(-4px);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
        border-color: rgba(255, 255, 255, 0.2);
    }

    &:active {
        transform: translateY(-2px) scale(0.98);
    }
`;

const PhotoImage = styled.img`
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;

    ${PhotoCard}:hover & {
        transform: scale(1.05);
    }
`;

const PhotoOverlay = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
        to bottom,
        rgba(0, 0, 0, 0.4) 0%,
        transparent 40%,
        transparent 60%,
        rgba(0, 0, 0, 0.7) 100%
    );
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 12px;
    opacity: 0;
    transition: opacity 0.3s ease;

    ${PhotoCard}:hover & {
        opacity: 1;
    }
`;

const PhotoActions = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
`;

const ViewButton = styled.div`
    background: rgba(0, 122, 255, 0.9);
    color: #fff;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    box-shadow: 0 2px 8px rgba(0, 122, 255, 0.3);
    transition: all 0.3s ease;
    cursor: pointer;

    &:hover {
        background: rgba(0, 122, 255, 1);
        transform: scale(1.1);
    }
`;

const PhotoInfo = styled.div`
    margin-top: auto;
`;

const PhotoName = styled.div`
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 4px;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const PhotoSize = styled.div`
    color: #86868B;
    font-size: 12px;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
`;

const DeleteButton = styled(motion.button)`
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(255, 59, 48, 0.9);
    border: none;
    color: #fff;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 16px;
    box-shadow: 0 2px 8px rgba(255, 59, 48, 0.3);
    transition: all 0.3s ease;

    &:hover {
        background: rgba(255, 59, 48, 1);
        transform: scale(1.1);
    }
`;

export default GalleryModal; 