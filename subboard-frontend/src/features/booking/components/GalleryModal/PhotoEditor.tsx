import React, { useState, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import Cropper from 'react-easy-crop';
import { Point, Area } from 'react-easy-crop/types';

interface PhotoEditorProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (croppedFile: File, originalFile: File) => void;
    file: File | null;
}

interface CropData {
    crop: Point;
    zoom: number;
    aspect: number;
    croppedAreaPixels: Area | null;
}

const PhotoEditor: React.FC<PhotoEditorProps> = ({ isOpen, onClose, onSave, file }) => {
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [aspect, setAspect] = useState(1); // 1:1 по умолчанию
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [imageUrl, setImageUrl] = useState<string>('');

    // Создаем URL для изображения когда файл меняется
    React.useEffect(() => {
        if (file) {
            const url = URL.createObjectURL(file);
            setImageUrl(url);
            return () => URL.revokeObjectURL(url);
        }
    }, [file]);

    const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const createCroppedImage = useCallback(async (
        imageSrc: string,
        pixelCrop: Area,
        fileName: string
    ): Promise<File> => {
        const image = new Image();
        image.src = imageSrc;
        
        return new Promise((resolve, reject) => {
            image.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                if (!ctx) {
                    reject(new Error('Не удалось создать canvas context'));
                    return;
                }

                // Устанавливаем размер canvas равный размеру кропа
                canvas.width = pixelCrop.width;
                canvas.height = pixelCrop.height;

                // Рисуем обрезанное изображение
                ctx.drawImage(
                    image,
                    pixelCrop.x,
                    pixelCrop.y,
                    pixelCrop.width,
                    pixelCrop.height,
                    0,
                    0,
                    pixelCrop.width,
                    pixelCrop.height
                );

                // Конвертируем canvas в blob и затем в File
                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('Не удалось создать blob'));
                        return;
                    }
                    
                    const croppedFile = new File([blob], fileName, {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                    });
                    
                    resolve(croppedFile);
                }, 'image/jpeg', 0.9);
            };
            
            image.onerror = () => reject(new Error('Не удалось загрузить изображение'));
        });
    }, []);

    const handleSave = useCallback(async () => {
        if (!file || !croppedAreaPixels) return;
        
        setIsProcessing(true);
        
        try {
            const croppedFile = await createCroppedImage(
                imageUrl,
                croppedAreaPixels,
                `cropped_${file.name}`
            );
            
            onSave(croppedFile, file);
            onClose();
        } catch (error) {
            console.error('Ошибка при обрезке изображения:', error);
        } finally {
            setIsProcessing(false);
        }
    }, [file, croppedAreaPixels, imageUrl, createCroppedImage, onSave, onClose]);

    const aspectRatios = [
        { label: '1:1', value: 1 },
        { label: '4:3', value: 4/3 },
        { label: '16:9', value: 16/9 },
        { label: '3:4', value: 3/4 },
        { label: 'Свободно', value: 0 },
    ];

    if (!file) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <EditorOverlay
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <EditorContainer
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ 
                            type: "spring", 
                            stiffness: 300, 
                            damping: 25 
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <EditorHeader>
                            <HeaderTitle>✂️ Редактирование фотографии</HeaderTitle>
                            <CloseButton onClick={onClose}>✕</CloseButton>
                        </EditorHeader>

                        <EditorBody>
                            <CropperContainer>
                                <Cropper
                                    image={imageUrl}
                                    crop={crop}
                                    zoom={zoom}
                                    aspect={aspect || undefined}
                                    onCropChange={setCrop}
                                    onCropComplete={onCropComplete}
                                    onZoomChange={setZoom}
                                    cropShape="rect"
                                    showGrid={true}
                                    style={{
                                        containerStyle: {
                                            background: 'rgba(0, 0, 0, 0.8)',
                                            borderRadius: '12px',
                                        },
                                        cropAreaStyle: {
                                            border: '2px solid #007AFF',
                                            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                                        },
                                    }}
                                />
                            </CropperContainer>

                            <ControlsPanel>
                                <ControlGroup>
                                    <ControlLabel>Масштаб</ControlLabel>
                                    <ZoomSlider
                                        type="range"
                                        min={1}
                                        max={3}
                                        step={0.1}
                                        value={zoom}
                                        onChange={(e) => setZoom(Number(e.target.value))}
                                    />
                                    <ZoomValue>{zoom.toFixed(1)}x</ZoomValue>
                                </ControlGroup>

                                <ControlGroup>
                                    <ControlLabel>Соотношение сторон</ControlLabel>
                                    <AspectRatioButtons>
                                        {aspectRatios.map((ratio) => (
                                            <AspectButton
                                                key={ratio.label}
                                                $active={aspect === ratio.value}
                                                onClick={() => setAspect(ratio.value)}
                                            >
                                                {ratio.label}
                                            </AspectButton>
                                        ))}
                                    </AspectRatioButtons>
                                </ControlGroup>
                            </ControlsPanel>
                        </EditorBody>

                        <EditorFooter>
                            <CancelButton onClick={onClose}>
                                Отмена
                            </CancelButton>
                            <SaveButton
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleSave}
                                disabled={isProcessing || !croppedAreaPixels}
                            >
                                {isProcessing ? '⏳ Обработка...' : '💾 Сохранить'}
                            </SaveButton>
                        </EditorFooter>
                    </EditorContainer>
                </EditorOverlay>
            )}
        </AnimatePresence>
    );
};

// Стили
const EditorOverlay = styled(motion.div)`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.9);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
    padding: 20px;
`;

const EditorContainer = styled(motion.div)`
    background: linear-gradient(135deg, rgba(28, 28, 30, 0.95) 0%, rgba(44, 44, 46, 0.9) 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    backdrop-filter: blur(20px);
    box-shadow: 
        0 20px 60px rgba(0, 0, 0, 0.6),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
    width: 100%;
    max-width: 900px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
`;

const EditorHeader = styled.div`
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
`;

const EditorBody = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
`;

const CropperContainer = styled.div`
    position: relative;
    flex: 1;
    min-height: 400px;
    background: #000;
    border-radius: 12px;
    margin: 20px;
    overflow: hidden;
`;

const ControlsPanel = styled.div`
    padding: 20px 32px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    background: linear-gradient(135deg, rgba(44, 44, 46, 0.6) 0%, rgba(58, 58, 60, 0.4) 100%);
    display: flex;
    gap: 32px;
    align-items: center;
    flex-wrap: wrap;
`;

const ControlGroup = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 200px;
`;

const ControlLabel = styled.label`
    font-size: 14px;
    color: #86868B;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
`;

const ZoomSlider = styled.input`
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: linear-gradient(to right, #007AFF 0%, #007AFF ${props => ((props.value as number - 1) / 2) * 100}%, rgba(255, 255, 255, 0.2) ${props => ((props.value as number - 1) / 2) * 100}%);
    outline: none;
    appearance: none;
    cursor: pointer;

    &::-webkit-slider-thumb {
        appearance: none;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #007AFF;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0, 122, 255, 0.3);
        transition: all 0.2s ease;
    }

    &::-webkit-slider-thumb:hover {
        transform: scale(1.2);
        box-shadow: 0 4px 16px rgba(0, 122, 255, 0.4);
    }
`;

const ZoomValue = styled.span`
    font-size: 12px;
    color: #007AFF;
    font-weight: 600;
    text-align: center;
`;

const AspectRatioButtons = styled.div`
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
`;

const AspectButton = styled.button<{ $active: boolean }>`
    padding: 8px 16px;
    border-radius: 8px;
    border: 1px solid ${props => props.$active ? '#007AFF' : 'rgba(255, 255, 255, 0.2)'};
    background: ${props => props.$active 
        ? 'linear-gradient(135deg, #007AFF 0%, #0056CC 100%)' 
        : 'rgba(255, 255, 255, 0.1)'};
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;

    &:hover {
        border-color: #007AFF;
        background: ${props => props.$active 
            ? 'linear-gradient(135deg, #3395FF 0%, #007AFF 100%)' 
            : 'rgba(0, 122, 255, 0.1)'};
    }
`;

const EditorFooter = styled.div`
    padding: 24px 32px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    background: linear-gradient(135deg, rgba(44, 44, 46, 0.8) 0%, rgba(58, 58, 60, 0.6) 100%);
    display: flex;
    justify-content: flex-end;
    gap: 16px;
`;

const CancelButton = styled.button`
    padding: 12px 24px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;

    &:hover {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.3);
    }
`;

const SaveButton = styled(motion.button)`
    padding: 12px 24px;
    border-radius: 12px;
    border: none;
    background: linear-gradient(135deg, #52C41A 0%, #389E0D 100%);
    color: #fff;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 16px rgba(82, 196, 26, 0.3);
    transition: all 0.3s ease;

    &:hover {
        background: linear-gradient(135deg, #73D13D 0%, #52C41A 100%);
    }

    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`;

export default PhotoEditor; 