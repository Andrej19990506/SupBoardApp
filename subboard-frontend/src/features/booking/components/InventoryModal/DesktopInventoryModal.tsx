import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { inventoryApi, type InventoryType, type InventoryItem, type InventoryStats } from '@/features/booking/services/inventoryApi';

const ModalOverlay = styled.div`
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: fadeIn 0.3s ease-out;
    
    @keyframes fadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
`;

const ModalContainer = styled.div`
    background: linear-gradient(135deg, #1C1C1E 0%, #2C2C2E 50%, #1C1C1E 100%);
    border-radius: 24px;
    box-shadow: 
        0 20px 60px rgba(0, 0, 0, 0.5),
        0 0 0 1px rgba(255, 255, 255, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
    width: 100%;
    max-width: 1200px;
    max-height: 90vh;
    overflow: hidden;
    position: relative;
    animation: slideUp 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    
    @keyframes slideUp {
        from {
            opacity: 0;
            transform: translateY(30px) scale(0.95);
        }
        to {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
    }
`;

const ModalHeader = styled.div`
    background: linear-gradient(135deg, #2C2C2E 0%, #3A3A3C 50%, #2C2C2E 100%);
    padding: 24px 32px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: relative;
    
    /* Анимированная нижняя граница */
    &::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: linear-gradient(
            90deg,
            #007AFF 0%,
            #52C41A 25%,
            #FFD600 50%,
            #FF6B35 75%,
            #007AFF 100%
        );
        background-size: 200% 100%;
        animation: gradientShift 3s ease-in-out infinite;
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

const ModalTitle = styled.h2`
    color: #fff;
    font-size: 28px;
    font-weight: 700;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    
    &::before {
        content: '📦';
        font-size: 24px;
    }
`;

const CloseButton = styled.button`
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #fff;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 18px;
    transition: all 0.3s ease;
    
    &:hover {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.3);
        transform: translateY(-1px);
    }
    
    &:active {
        transform: translateY(0);
    }
`;

const TabsContainer = styled.div`
    display: flex;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding: 0 32px;
`;

const Tab = styled.button<{ $active: boolean }>`
    background: ${props => props.$active ? 'rgba(0, 122, 255, 0.2)' : 'transparent'};
    border: none;
    color: ${props => props.$active ? '#007AFF' : 'rgba(255, 255, 255, 0.7)'};
    padding: 16px 24px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    border-radius: 12px 12px 0 0;
    position: relative;
    
    &:hover {
        color: #007AFF;
        background: rgba(0, 122, 255, 0.1);
    }
    
    ${props => props.$active && `
        &::after {
            content: '';
            position: absolute;
            bottom: -1px;
            left: 0;
            right: 0;
            height: 2px;
            background: #007AFF;
        }
    `}
`;

const ModalContent = styled.div`
    padding: 32px;
    overflow-y: auto;
    max-height: calc(90vh - 180px);
    
    /* Красивый скроллбар */
    &::-webkit-scrollbar {
        width: 8px;
    }

    &::-webkit-scrollbar-track {
        background: rgba(44, 44, 46, 0.3);
        border-radius: 4px;
    }

    &::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, #86868B 0%, #5A5A5E 100%);
        border-radius: 4px;
        transition: background 0.2s ease;
    }

    &::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(180deg, #A0A0A5 0%, #7A7A7E 100%);
    }
`;

const StatsSection = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-bottom: 32px;
`;

const StatCard = styled.div`
    background: linear-gradient(135deg, rgba(44, 44, 46, 0.8) 0%, rgba(58, 58, 60, 0.6) 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 20px;
    text-align: center;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
    
    &::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
        transition: left 0.6s ease;
    }
    
    &:hover {
        transform: translateY(-2px);
        border-color: rgba(255, 255, 255, 0.2);
        
        &::before {
            left: 100%;
        }
    }
`;

const StatNumber = styled.div<{ $color?: string }>`
    font-size: 32px;
    font-weight: 800;
    color: ${props => props.$color || '#52C41A'};
    margin-bottom: 8px;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
`;

const StatLabel = styled.div`
    color: rgba(255, 255, 255, 0.8);
    font-size: 14px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
`;

const Section = styled.div`
    margin-bottom: 32px;
`;

const SectionTitle = styled.h3`
    color: #fff;
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 16px 0;
    display: flex;
    align-items: center;
    gap: 8px;
`;

const TypesGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
`;

const TypeCard = styled.div<{ $color?: string }>`
    background: linear-gradient(135deg, rgba(44, 44, 46, 0.9) 0%, rgba(58, 58, 60, 0.7) 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 20px;
    transition: all 0.3s ease;
    
    &:hover {
        transform: translateY(-2px);
        border-color: ${props => props.$color || '#007AFF'};
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    }
`;

const TypeHeader = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
`;

const TypeIcon = styled.div`
    font-size: 24px;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.1);
`;

const TypeName = styled.h4`
    color: #fff;
    font-size: 18px;
    font-weight: 600;
    margin: 0;
`;

const TypeDescription = styled.p`
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    margin: 0 0 16px 0;
    line-height: 1.4;
`;

const TypeStats = styled.div`
    display: flex;
    gap: 16px;
`;

const TypeStat = styled.div`
    text-align: center;
`;

const TypeStatNumber = styled.div<{ $color?: string }>`
    font-size: 20px;
    font-weight: 700;
    color: ${props => props.$color || '#fff'};
`;

const TypeStatLabel = styled.div`
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    text-transform: uppercase;
`;

const ItemsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 16px;
`;

const ItemCard = styled.div<{ $status?: string }>`
    background: linear-gradient(135deg, rgba(44, 44, 46, 0.9) 0%, rgba(58, 58, 60, 0.7) 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 16px;
    transition: all 0.3s ease;
    
    ${props => {
        switch (props.$status) {
            case 'available':
                return `border-left: 4px solid #52C41A;`;
            case 'in_use':
                return `border-left: 4px solid #007AFF;`;
            case 'servicing':
                return `border-left: 4px solid #FFD600;`;
            case 'repair':
                return `border-left: 4px solid #FF4D4F;`;
            default:
                return `border-left: 4px solid #86868B;`;
        }
    }}
    
    &:hover {
        transform: translateY(-1px);
        border-color: rgba(255, 255, 255, 0.2);
    }
`;

const ItemHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
`;

const ItemName = styled.h5`
    color: #fff;
    font-size: 16px;
    font-weight: 600;
    margin: 0;
`;

const ItemStatus = styled.span<{ $status?: string }>`
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    text-transform: uppercase;
    
    ${props => {
        switch (props.$status) {
            case 'available':
                return `background: rgba(82, 196, 26, 0.2); color: #52C41A;`;
            case 'in_use':
                return `background: rgba(0, 122, 255, 0.2); color: #007AFF;`;
            case 'servicing':
                return `background: rgba(255, 212, 0, 0.2); color: #FFD600;`;
            case 'repair':
                return `background: rgba(255, 77, 79, 0.2); color: #FF4D4F;`;
            default:
                return `background: rgba(134, 134, 139, 0.2); color: #86868B;`;
        }
    }}
`;

const ItemDetails = styled.div`
    color: rgba(255, 255, 255, 0.7);
    font-size: 13px;
    line-height: 1.4;
`;

const EmptyState = styled.div`
    text-align: center;
    padding: 60px 20px;
    color: rgba(255, 255, 255, 0.6);
`;

const EmptyIcon = styled.div`
    font-size: 64px;
    margin-bottom: 16px;
`;

const EmptyTitle = styled.h3`
    color: rgba(255, 255, 255, 0.8);
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 8px 0;
`;

const EmptyDescription = styled.p`
    font-size: 16px;
    margin: 0;
    max-width: 400px;
    margin: 0 auto;
    line-height: 1.5;
`;

const LoadingState = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    color: rgba(255, 255, 255, 0.7);
`;

const LoadingSpinner = styled.div`
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top: 3px solid #007AFF;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;

// Стили для кнопок и форм
const ActionButton = styled.button`
    background: linear-gradient(135deg, #007AFF 0%, #0056CC 100%);
    color: white;
    border: none;
    border-radius: 12px;
    padding: 12px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 16px rgba(0, 122, 255, 0.3);
    
    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 24px rgba(0, 122, 255, 0.4);
    }
    
    &:active {
        transform: translateY(0);
    }
`;

const SecondaryButton = styled(ActionButton)`
    background: linear-gradient(135deg, #52C41A 0%, #389E0D 100%);
    box-shadow: 0 4px 16px rgba(82, 196, 26, 0.3);
    
    &:hover {
        box-shadow: 0 6px 24px rgba(82, 196, 26, 0.4);
    }
`;

const ButtonsRow = styled.div`
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
    flex-wrap: wrap;
`;

const FormContainer = styled.div`
    background: rgba(28, 28, 30, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 24px;
    backdrop-filter: blur(16px);
`;

const FormTitle = styled.h3`
    margin: 0 0 20px 0;
    font-size: 18px;
    font-weight: 600;
    color: #ffffff;
    display: flex;
    align-items: center;
    gap: 8px;
`;

const FormRow = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 16px;
    
    @media (max-width: 768px) {
        grid-template-columns: 1fr;
    }
`;

const FormField = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
`;

const FormLabel = styled.label`
    font-size: 14px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
`;

const FormHint = styled.div`
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    margin-top: 4px;
    line-height: 1.3;
`;

const FormInput = styled.input`
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 12px;
    color: #ffffff;
    font-size: 14px;
    transition: all 0.3s ease;
    
    &:focus {
        outline: none;
        border-color: #007AFF;
        background: rgba(255, 255, 255, 0.08);
        box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
    }
    
    &::placeholder {
        color: rgba(255, 255, 255, 0.4);
    }
`;

const FormTextarea = styled.textarea`
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 12px;
    color: #ffffff;
    font-size: 14px;
    resize: vertical;
    min-height: 80px;
    transition: all 0.3s ease;
    font-family: inherit;
    
    &:focus {
        outline: none;
        border-color: #007AFF;
        background: rgba(255, 255, 255, 0.08);
        box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
    }
    
    &::placeholder {
        color: rgba(255, 255, 255, 0.4);
    }
`;

const FormButtons = styled.div`
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 20px;
`;

const CancelButton = styled.button`
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    padding: 10px 16px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.3s ease;
    
    &:hover {
        background: rgba(255, 255, 255, 0.15);
        color: rgba(255, 255, 255, 0.9);
    }
`;

const SubmitButton = styled(ActionButton)`
    padding: 10px 20px;
    font-size: 14px;
`;

// Стили для селектора иконок
const IconGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 8px;
    max-height: 200px;
    overflow-y: auto;
    padding: 12px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    
    &::-webkit-scrollbar {
        width: 6px;
    }
    
    &::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 3px;
    }
    
    &::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
        
        &:hover {
            background: rgba(255, 255, 255, 0.3);
        }
    }
`;

const IconOption = styled.button<{ $selected?: boolean }>`
    width: 40px;
    height: 40px;
    border: 2px solid ${props => props.$selected ? '#007AFF' : 'rgba(255, 255, 255, 0.1)'};
    border-radius: 8px;
    background: ${props => props.$selected ? 'rgba(0, 122, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)'};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover {
        border-color: #007AFF;
        background: rgba(0, 122, 255, 0.1);
        transform: scale(1.1);
    }
    
    &:active {
        transform: scale(0.95);
    }
`;

const CustomIconInput = styled.div`
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 8px;
`;

const IconPreview = styled.div`
    width: 40px;
    height: 40px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    background: rgba(255, 255, 255, 0.05);
`;

const FormSelect = styled.select`
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 12px;
    color: #ffffff;
    font-size: 14px;
    width: 100%;
    transition: all 0.3s ease;
    
    &:focus {
        outline: none;
        border-color: #007AFF;
        background: rgba(255, 255, 255, 0.08);
        box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
    }
    
    option {
        background: #1C1C1E;
        color: #ffffff;
        padding: 8px;
    }
`;

interface DesktopInventoryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const DesktopInventoryModal: React.FC<DesktopInventoryModalProps> = ({
    isOpen,
    onClose
}) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'types' | 'items'>('overview');
    const [inventoryTypes, setInventoryTypes] = useState<InventoryType[]>([]);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [inventoryStats, setInventoryStats] = useState<InventoryStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Состояния для форм
    const [showCreateTypeForm, setShowCreateTypeForm] = useState(false);
    const [showCreateItemsForm, setShowCreateItemsForm] = useState(false);
    const [selectedTypeForItems, setSelectedTypeForItems] = useState<number | null>(null);
    
    // Состояние формы создания типа
    const [newTypeForm, setNewTypeForm] = useState({
        name: '',
        display_name: '',
        description: '',
        icon_name: '',
        color: '#007AFF',
        affects_availability: false,  // По умолчанию НЕ влияет на доступность
        board_equivalent: 0.0,        // По умолчанию не эквивалентно доскам
        initial_quantity: 1
    });
    
    // Состояние формы создания единиц
    const [newItemsForm, setNewItemsForm] = useState({
        quantity: 1,
        name_prefix: ''
    });
    
    // Популярные иконки для инвентаря
    const inventoryIcons = [
        '🛶', '🚣', '⛵', '🏄‍♂️', '🏄‍♀️', '🤿', '🦺', '⛑️',
        '🎯', '🏹', '🎪', '⛰️', '🏔️', '🌊', '🏖️', '🌅',
        '🔥', '⭐', '💎', '🎨', '🎭', '🎪', '🎡', '🎢',
        '🚁', '✈️', '🚀', '⚓', '🧭', '🗺️', '📍', '🎒',
        '⚡', '🌟', '💫', '🔮', '🎲', '🃏', '🎯', '🏆',
        '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️', '👑',
        '💰', '💎', '🔑', '🗝️', '🔒', '🔓', '🛡️', '⚔️',
        '🏰', '🗼', '🌉', '🎡', '🎢', '🎠', '🎪', '🎭'
    ];

    // Загрузка данных
    useEffect(() => {
        if (isOpen) {
            loadInventoryData();
        }
    }, [isOpen]);

    const loadInventoryData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const [typesResponse, itemsResponse, statsResponse] = await Promise.all([
                inventoryApi.getInventoryTypes(),
                inventoryApi.getInventoryItems(),
                inventoryApi.getInventoryStats()
            ]);
            
            setInventoryTypes(typesResponse.data);
            setInventoryItems(itemsResponse.data);
            setInventoryStats(statsResponse.data);
        } catch (err) {
            console.error('Ошибка загрузки данных инвентаря:', err);
            setError('Не удалось загрузить данные инвентаря');
        } finally {
            setLoading(false);
        }
    };

    // Кэш переводов для оптимизации
    const translationCache = useRef<Map<string, string>>(new Map());
    const [isTranslating, setIsTranslating] = useState(false);
    const [showPriorityTooltip, setShowPriorityTooltip] = useState<number | null>(null);
    const translationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Умный словарь переводов для инвентаря
    const inventoryTranslations: {[key: string]: string} = {
        // Водный спорт и лодки
        'каяк': 'kayak', 'байдарка': 'kayak', 'лодка': 'boat', 'плот': 'raft',
        'доска': 'board', 'сап': 'sup', 'sup': 'sup', 'серф': 'surf',
        'виндсерф': 'windsurf', 'катамаран': 'catamaran', 'яхта': 'yacht',
        
        // Безопасность
        'спасательный': 'life', 'жилет': 'jacket', 'спасжилет': 'life_jacket',
        'шлем': 'helmet', 'каска': 'helmet', 'защита': 'protection',
        
        // Экипировка
        'весло': 'paddle', 'весла': 'paddles', 'гидрокостюм': 'wetsuit',
        'костюм': 'suit', 'маска': 'mask', 'ласты': 'fins', 'трубка': 'snorkel',
        'очки': 'goggles', 'перчатки': 'gloves', 'носки': 'socks', 'боты': 'boots',
        
        // Аксессуары
        'рюкзак': 'backpack', 'сумка': 'bag', 'чехол': 'cover', 'насос': 'pump',
        'ремкомплект': 'repair_kit', 'комплект': 'kit', 'набор': 'set',
        
        // Качества и размеры
        'детский': 'kids', 'взрослый': 'adult', 'большой': 'large',
        'маленький': 'small', 'средний': 'medium', 'премиум': 'premium',
        'vip': 'vip', 'стандарт': 'standard', 'профессиональный': 'professional',
        
        // Цвета
        'красный': 'red', 'синий': 'blue', 'зеленый': 'green', 'желтый': 'yellow',
        'черный': 'black', 'белый': 'white', 'оранжевый': 'orange'
    };

    // Гибридная функция перевода: умный словарь + Google Translate + транслитерация
    const translateToEnglish = async (text: string): Promise<string> => {
        // Проверяем кэш
        const cacheKey = text.toLowerCase().trim();
        if (translationCache.current.has(cacheKey)) {
            return translationCache.current.get(cacheKey)!;
        }

        // Если текст уже на английском, возвращаем как есть
        if (!/[а-яё]/i.test(text)) {
            const result = text.toLowerCase()
                .replace(/[^a-z0-9]/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_|_$/g, '');
            translationCache.current.set(cacheKey, result);
            return result;
        }

        // Этап 1: Умный перевод через словарь
        const words = text.toLowerCase().split(/[\s\-_.,!?()]+/).filter(w => w.length > 0);
        const translatedWords = words.map(word => {
            // Точное совпадение
            if (inventoryTranslations[word]) {
                return inventoryTranslations[word];
            }
            // Частичное совпадение (слово содержит известное слово)
            for (const [ru, en] of Object.entries(inventoryTranslations)) {
                if (word.includes(ru)) {
                    return en;
                }
            }
            return null; // Не найдено в словаре
        });

        // Если все слова переведены через словарь - используем результат
        if (translatedWords.every(w => w !== null)) {
            const result = translatedWords.join('_');
            translationCache.current.set(cacheKey, result);
            return result;
        }

        // Этап 2: Google Translate API (бесплатный через публичный endpoint)
        try {
            const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ru&tl=en&dt=t&q=${encodeURIComponent(text)}`;
            
            const response = await fetch(googleUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                signal: AbortSignal.timeout(5000) // 5 секунд
            });

            if (response.ok) {
                const data = await response.json();
                if (data[0] && data[0][0] && data[0][0][0]) {
                    const translated = data[0][0][0]
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, '_')
                        .replace(/_+/g, '_')
                        .replace(/^_|_$/g, '');
                    
                    translationCache.current.set(cacheKey, translated);
                    return translated;
                }
            }
        } catch (error) {
            console.warn('Google Translate недоступен:', error);
        }

        // Этап 3: Fallback - транслитерация
        const fallback = text
            .toLowerCase()
            .replace(/[а-яё]/g, (char) => {
                const map: {[key: string]: string} = {
                    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
                    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
                    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
                    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
                    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
                };
                return map[char] || char;
            })
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
        
        translationCache.current.set(cacheKey, fallback);
        return fallback;
    };

    // Автозаполнение системного имени при изменении отображаемого названия
    const handleDisplayNameChange = async (value: string) => {
        // Обновляем display_name
        setNewTypeForm(prev => ({
            ...prev,
            display_name: value
        }));

        // ВСЕГДА переводим, если есть русский текст (с debounce 500мс)
        if (value.trim() && /[а-яё]/i.test(value)) {
            // Отменяем предыдущий таймер
            if (translationTimeoutRef.current) {
                clearTimeout(translationTimeoutRef.current);
            }
            
            setIsTranslating(true);
            
            // Устанавливаем новый таймер
            translationTimeoutRef.current = setTimeout(async () => {
                try {
                    const translatedName = await translateToEnglish(value);
                    setNewTypeForm(prev => ({
                        ...prev,
                        name: translatedName
                    }));
                } catch (error) {
                    console.error('❌ Ошибка перевода:', error);
                } finally {
                    setIsTranslating(false);
                }
            }, 500); // 500мс задержка
        } else if (value.trim() === '') {
            // Если поле очищено, очищаем и системное имя
            if (translationTimeoutRef.current) {
                clearTimeout(translationTimeoutRef.current);
            }
            setIsTranslating(false);
            setNewTypeForm(prev => ({
                ...prev,
                name: ''
            }));
        } else {
            if (translationTimeoutRef.current) {
                clearTimeout(translationTimeoutRef.current);
            }
            setIsTranslating(false);
        }
    };

    // Функции для создания инвентаря
    const handleCreateType = async () => {
        try {
            setLoading(true);
            await inventoryApi.createInventoryTypeQuick(newTypeForm);
            setShowCreateTypeForm(false);
            setNewTypeForm({
                name: '',
                display_name: '',
                description: '',
                icon_name: '',
                color: '#007AFF',
                affects_availability: false,
                board_equivalent: 0.0,
                initial_quantity: 1
            });
            await loadInventoryData(); // Перезагружаем данные
        } catch (err) {
            console.error('Ошибка создания типа инвентаря:', err);
            setError('Не удалось создать тип инвентаря');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateItems = async () => {
        if (!selectedTypeForItems) return;
        
        try {
            setLoading(true);
            await inventoryApi.createInventoryItemsBulk(selectedTypeForItems, newItemsForm.quantity, newItemsForm.name_prefix);
            setShowCreateItemsForm(false);
            setSelectedTypeForItems(null);
            setNewItemsForm({
                quantity: 1,
                name_prefix: ''
            });
            await loadInventoryData(); // Перезагружаем данные
        } catch (err) {
            console.error('Ошибка создания единиц инвентаря:', err);
            setError('Не удалось создать единицы инвентаря');
        } finally {
            setLoading(false);
        }
    };

    // Функция для получения иконки статуса
    const getStatusIcon = (status: string): string => {
        switch (status) {
            case 'available': return '✅';
            case 'in_use': return '🔵';
            case 'servicing': return '🔧';
            case 'repair': return '🔴';
            default: return '❓';
        }
    };

    // Функция для получения названия статуса
    const getStatusName = (status: string): string => {
        switch (status) {
            case 'available': return 'Доступно';
            case 'in_use': return 'Используется';
            case 'servicing': return 'Обслуживание';
            case 'repair': return 'В ремонте';
            default: return 'Неизвестно';
        }
    };

    // Рендер вкладки "Обзор"
    const renderOverview = () => {
        if (!inventoryStats) return null;

        return (
            <>
                <StatsSection>
                    <StatCard>
                        <StatNumber $color="#52C41A">{inventoryStats.total_types}</StatNumber>
                        <StatLabel>Типов инвентаря</StatLabel>
                    </StatCard>
                    <StatCard>
                        <StatNumber $color="#007AFF">{inventoryStats.total_items}</StatNumber>
                        <StatLabel>Всего единиц</StatLabel>
                    </StatCard>
                    <StatCard>
                        <StatNumber $color="#52C41A">{inventoryStats.available_items}</StatNumber>
                        <StatLabel>Доступно</StatLabel>
                    </StatCard>
                    <StatCard>
                        <StatNumber $color="#007AFF">{inventoryStats.in_use_items}</StatNumber>
                        <StatLabel>Используется</StatLabel>
                    </StatCard>
                    <StatCard>
                        <StatNumber $color="#FFD600">{inventoryStats.servicing_items}</StatNumber>
                        <StatLabel>Обслуживание</StatLabel>
                    </StatCard>
                    <StatCard>
                        <StatNumber $color="#FF4D4F">{inventoryStats.repair_items}</StatNumber>
                        <StatLabel>В ремонте</StatLabel>
                    </StatCard>
                </StatsSection>

                {Object.keys(inventoryStats.by_type).length > 0 && (
                    <Section>
                        <SectionTitle>📊 Статистика по типам</SectionTitle>
                        <TypesGrid>
                            {Object.entries(inventoryStats.by_type).map(([typeName, typeStats]) => {
                                const type = inventoryTypes.find(t => t.name === typeName);
                                return (
                                    <TypeCard key={typeName} $color={type?.color}>
                                        <TypeHeader>
                                            <TypeIcon>{type?.icon_name || '📦'}</TypeIcon>
                                            <TypeName>{type?.display_name || typeName}</TypeName>
                                        </TypeHeader>
                                        <TypeStats>
                                            <TypeStat>
                                                <TypeStatNumber $color="#52C41A">{typeStats.available}</TypeStatNumber>
                                                <TypeStatLabel>Доступно</TypeStatLabel>
                                            </TypeStat>
                                            <TypeStat>
                                                <TypeStatNumber $color="#007AFF">{typeStats.in_use}</TypeStatNumber>
                                                <TypeStatLabel>Используется</TypeStatLabel>
                                            </TypeStat>
                                            <TypeStat>
                                                <TypeStatNumber $color="#FFD600">{typeStats.servicing}</TypeStatNumber>
                                                <TypeStatLabel>Обслуживание</TypeStatLabel>
                                            </TypeStat>
                                            <TypeStat>
                                                <TypeStatNumber $color="#FF4D4F">{typeStats.repair}</TypeStatNumber>
                                                <TypeStatLabel>Ремонт</TypeStatLabel>
                                            </TypeStat>
                                        </TypeStats>
                                    </TypeCard>
                                );
                            })}
                        </TypesGrid>
                    </Section>
                )}
            </>
        );
    };

    // Рендер вкладки "Типы инвентаря"
    const renderTypes = () => {
        return (
            <>
                <ButtonsRow>
                    <ActionButton onClick={() => setShowCreateTypeForm(true)}>
                        ➕ Создать тип инвентаря
                    </ActionButton>
                    {inventoryTypes.length > 0 && (
                        <SecondaryButton onClick={() => setShowCreateItemsForm(true)}>
                            📦 Добавить единицы
                        </SecondaryButton>
                    )}
                </ButtonsRow>

                {showCreateTypeForm && (
                    <FormContainer>
                        <FormTitle>➕ Создание нового типа инвентаря</FormTitle>
                        <FormRow>
                            <FormField>
                                <FormLabel>Отображаемое название *</FormLabel>
                                <FormInput
                                    type="text"
                                    placeholder="Каяк, Спасательный жилет, Весло..."
                                    value={newTypeForm.display_name}
                                    onChange={(e) => handleDisplayNameChange(e.target.value)}
                                />
                                <FormHint>
                                    Название, которое будут видеть пользователи
                                </FormHint>
                            </FormField>
                            <FormField>
                                <FormLabel>Системное имя *</FormLabel>
                                <FormInput
                                    type="text"
                                    placeholder={isTranslating ? "Переводим..." : "kayak, life_jacket, paddle..."}
                                    value={newTypeForm.name}
                                    onChange={(e) => setNewTypeForm({...newTypeForm, name: e.target.value})}
                                    disabled={isTranslating}
                                />
                                <FormHint>
                                    {isTranslating ? (
                                        <>🔄 Переводим: умный словарь → Google Translate → транслитерация...</>
                                    ) : (
                                        <>Автоматически переводится: умный словарь → Google Translate → транслитерация. Можно редактировать вручную.</>
                                    )}
                                </FormHint>
                            </FormField>
                        </FormRow>
                        
                        <FormRow>
                            <FormField>
                                <FormLabel>Иконка</FormLabel>
                                <IconGrid>
                                    {inventoryIcons.map((icon, index) => (
                                        <IconOption
                                            key={index}
                                            type="button"
                                            $selected={newTypeForm.icon_name === icon}
                                            onClick={() => setNewTypeForm({...newTypeForm, icon_name: icon})}
                                            title={`Выбрать иконку ${icon}`}
                                        >
                                            {icon}
                                        </IconOption>
                                    ))}
                                </IconGrid>
                                <CustomIconInput>
                                    <FormInput
                                        type="text"
                                        placeholder="Или введите свою иконку..."
                                        value={newTypeForm.icon_name}
                                        onChange={(e) => setNewTypeForm({...newTypeForm, icon_name: e.target.value})}
                                        style={{ flex: 1 }}
                                    />
                                    <IconPreview>
                                        {newTypeForm.icon_name || '📦'}
                                    </IconPreview>
                                </CustomIconInput>
                                <FormHint>
                                    Выберите из популярных или введите любой эмодзи. Можно скопировать из интернета!
                                </FormHint>
                            </FormField>
                            <FormField>
                                <FormLabel>Цвет темы</FormLabel>
                                <FormInput
                                    type="color"
                                    value={newTypeForm.color}
                                    onChange={(e) => setNewTypeForm({...newTypeForm, color: e.target.value})}
                                />
                                <FormHint>
                                    Цвет для карточек и элементов интерфейса этого типа инвентаря
                                </FormHint>
                            </FormField>
                        </FormRow>

                        <FormRow>
                            <FormField>
                                <FormLabel>Начальное количество</FormLabel>
                                <FormInput
                                    type="number"
                                    min="1"
                                    max="50"
                                    value={newTypeForm.initial_quantity}
                                    onChange={(e) => setNewTypeForm({...newTypeForm, initial_quantity: parseInt(e.target.value) || 1})}
                                />
                                <FormHint>
                                    Сколько единиц создать сразу (от 1 до 50)
                                </FormHint>
                            </FormField>
                            <FormField>
                                <FormLabel>Тип инвентаря</FormLabel>
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '12px',
                                    padding: '12px',
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255, 255, 255, 0.1)'
                                }}>
                                    <label style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        cursor: 'pointer',
                                        color: '#ffffff',
                                        fontSize: '14px'
                                    }}>
                                        <input
                                            type="checkbox"
                                            checked={newTypeForm.affects_availability}
                                            onChange={(e) => setNewTypeForm({
                                                ...newTypeForm,
                                                affects_availability: e.target.checked,
                                                board_equivalent: e.target.checked ? 1.0 : 0.0
                                            })}
                                            style={{
                                                width: '16px',
                                                height: '16px',
                                                accentColor: '#007AFF'
                                            }}
                                        />
                                        🏄‍♂️ Критически важный инвентарь
                                        <div 
                                            style={{
                                                position: 'relative',
                                                display: 'inline-block',
                                                marginLeft: '4px'
                                            }}
                                            onMouseEnter={() => setShowPriorityTooltip(-1)}
                                            onMouseLeave={() => setShowPriorityTooltip(null)}
                                        >
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                width: '16px',
                                                height: '16px',
                                                borderRadius: '50%',
                                                backgroundColor: 'rgba(0, 122, 255, 0.2)',
                                                color: '#007AFF',
                                                fontSize: '10px',
                                                fontWeight: 'bold',
                                                cursor: 'help',
                                                border: '1px solid rgba(0, 122, 255, 0.3)',
                                                transition: 'all 0.2s ease'
                                            }}>
                                                ?
                                            </span>
                                                                                         {showPriorityTooltip === -1 && (
                                                 <div style={{
                                                     position: 'absolute',
                                                     top: '-20px',
                                                     right: '-240px',
                                                     backgroundColor: 'rgba(44, 44, 46, 0.95)',
                                                     backdropFilter: 'blur(16px)',
                                                     border: '1px solid rgba(255, 255, 255, 0.1)',
                                                     borderRadius: '8px',
                                                     padding: '12px',
                                                     width: '240px',
                                                     zIndex: 1000,
                                                     boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                                                     fontSize: '12px',
                                                     lineHeight: '1.3',
                                                     color: '#ffffff'
                                                 }}>
                                                     <div style={{ 
                                                         fontWeight: '600', 
                                                         marginBottom: '8px',
                                                         color: '#007AFF',
                                                         fontSize: '11px'
                                                     }}>
                                                         📋 Приоритет инвентаря:
                                                     </div>
                                                     
                                                     <div style={{ marginBottom: '6px' }}>
                                                         <div style={{ 
                                                             fontWeight: '500',
                                                             color: '#FF3B30',
                                                             fontSize: '11px'
                                                         }}>
                                                             🚫 Включено: БЛОКИРУЕТ запись
                                                         </div>
                                                         <div style={{ 
                                                             fontSize: '10px',
                                                             color: 'rgba(255, 255, 255, 0.7)',
                                                             marginTop: '2px'
                                                         }}>
                                                             Доски закончились → клиент не может записаться
                                                         </div>
                                                     </div>

                                                     <div>
                                                         <div style={{ 
                                                             fontWeight: '500',
                                                             color: '#FF9500',
                                                             fontSize: '11px'
                                                         }}>
                                                             ⚠️ Выключено: только предупреждает
                                                         </div>
                                                         <div style={{ 
                                                             fontSize: '10px',
                                                             color: 'rgba(255, 255, 255, 0.7)',
                                                             marginTop: '2px'
                                                         }}>
                                                             Жилеты закончились → запись разрешена
                                                         </div>
                                                     </div>
                                                 </div>
                                             )}
                                        </div>
                                    </label>
                                    <div style={{
                                        fontSize: '12px',
                                        color: 'rgba(255, 255, 255, 0.6)',
                                        lineHeight: '1.4'
                                    }}>
                                    </div>
                                </div>
                                <FormHint>
                                    Критически важный инвентарь будет блокировать запись при нехватке.
                                </FormHint>
                            </FormField>
                        </FormRow>

                        <FormField>
                            <FormLabel>Описание (необязательно)</FormLabel>
                            <FormTextarea
                                placeholder="Например: Одноместный каяк для сплавов по спокойной воде..."
                                value={newTypeForm.description}
                                onChange={(e) => setNewTypeForm({...newTypeForm, description: e.target.value})}
                            />
                            <FormHint>
                                Дополнительная информация о типе инвентаря для операторов
                            </FormHint>
                        </FormField>

                        <FormButtons>
                            <CancelButton onClick={() => setShowCreateTypeForm(false)}>
                                Отмена
                            </CancelButton>
                            <SubmitButton 
                                onClick={handleCreateType}
                                disabled={!newTypeForm.name || !newTypeForm.display_name}
                            >
                                ✅ Создать
                            </SubmitButton>
                        </FormButtons>
                    </FormContainer>
                )}

                {showCreateItemsForm && (
                    <FormContainer>
                        <FormTitle>📦 Добавление единиц инвентаря</FormTitle>
                        <FormRow>
                            <FormField>
                                <FormLabel>Тип инвентаря *</FormLabel>
                                <select
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '8px',
                                        padding: '12px',
                                        color: '#ffffff',
                                        fontSize: '14px',
                                        width: '100%'
                                    }}
                                    value={selectedTypeForItems || ''}
                                    onChange={(e) => setSelectedTypeForItems(parseInt(e.target.value) || null)}
                                >
                                    <option value="">Выберите тип</option>
                                    {inventoryTypes.map(type => (
                                        <option key={type.id} value={type.id}>
                                            {type.icon_name} {type.display_name}
                                        </option>
                                    ))}
                                </select>
                            </FormField>
                            <FormField>
                                <FormLabel>Количество единиц</FormLabel>
                                <FormInput
                                    type="number"
                                    min="1"
                                    max="50"
                                    value={newItemsForm.quantity}
                                    onChange={(e) => setNewItemsForm({...newItemsForm, quantity: parseInt(e.target.value) || 1})}
                                />
                            </FormField>
                        </FormRow>

                        <FormField>
                            <FormLabel>Префикс названий (необязательно)</FormLabel>
                            <FormInput
                                type="text"
                                placeholder="VIP, Премиум, Детский..."
                                value={newItemsForm.name_prefix}
                                onChange={(e) => setNewItemsForm({...newItemsForm, name_prefix: e.target.value})}
                            />
                        </FormField>

                        <FormButtons>
                            <CancelButton onClick={() => {
                                setShowCreateItemsForm(false);
                                setSelectedTypeForItems(null);
                            }}>
                                Отмена
                            </CancelButton>
                            <SubmitButton 
                                onClick={handleCreateItems}
                                disabled={!selectedTypeForItems}
                            >
                                ✅ Добавить
                            </SubmitButton>
                        </FormButtons>
                    </FormContainer>
                )}

                {inventoryTypes.length === 0 && !showCreateTypeForm ? (
                    <EmptyState>
                        <EmptyIcon>📦</EmptyIcon>
                        <EmptyTitle>Нет типов инвентаря</EmptyTitle>
                        <EmptyDescription>
                            Создайте первый тип инвентаря, чтобы начать управление оборудованием
                        </EmptyDescription>
                    </EmptyState>
                ) : (
                    <TypesGrid>
                        {inventoryTypes.map(type => (
                            <TypeCard key={type.id} $color={type.color} style={{ position: 'relative' }}>
                                <div 
                                    style={{
                                        position: 'absolute',
                                        top: '8px',
                                        right: '8px',
                                        zIndex: 10
                                    }}
                                    onMouseEnter={() => setShowPriorityTooltip(type.id)}
                                    onMouseLeave={() => setShowPriorityTooltip(null)}
                                >
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        backgroundColor: type.affects_availability 
                                            ? 'rgba(255, 59, 48, 0.2)' 
                                            : 'rgba(255, 149, 0, 0.2)',
                                        border: type.affects_availability 
                                            ? '1px solid rgba(255, 59, 48, 0.4)' 
                                            : '1px solid rgba(255, 149, 0, 0.4)',
                                        fontSize: '11px',
                                        cursor: 'help',
                                        transition: 'all 0.2s ease',
                                        backdropFilter: 'blur(8px)',
                                        lineHeight: '1',
                                        textAlign: 'center'
                                    }}>
                                        <span style={{ 
                                            display: 'block',
                                            transform: 'translateY(-0.5px)' // Небольшая коррекция для идеального центрирования эмодзи
                                        }}>
                                            {type.affects_availability ? '🚫' : '⚠️'}
                                        </span>
                                    </div>
                                    {showPriorityTooltip === type.id && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '30px',
                                            right: '0px',
                                            backgroundColor: 'rgba(44, 44, 46, 0.95)',
                                            backdropFilter: 'blur(16px)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: '8px',
                                            padding: '8px 12px',
                                            width: '180px',
                                            zIndex: 1000,
                                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                                            fontSize: '11px',
                                            lineHeight: '1.3',
                                            color: '#ffffff',
                                            textAlign: 'left'
                                        }}>
                                            <div style={{ 
                                                fontWeight: '600', 
                                                marginBottom: '4px',
                                                color: type.affects_availability ? '#FF3B30' : '#FF9500'
                                            }}>
                                                {type.affects_availability ? '🚫 Критический' : '⚠️ Обычный'}
                                            </div>
                                            <div style={{ 
                                                fontSize: '10px',
                                                color: 'rgba(255, 255, 255, 0.8)'
                                            }}>
                                                {type.affects_availability 
                                                    ? 'Блокирует запись при отсутствии'
                                                    : 'Предупреждает при отсутствии'
                                                }
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <TypeHeader>
                                    <TypeIcon>{type.icon_name || '📦'}</TypeIcon>
                                    <div style={{ flex: 1 }}>
                                        <TypeName>{type.display_name}</TypeName>
                                        {type.name !== type.display_name && (
                                            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                                                ({type.name})
                                            </div>
                                        )}
                                    </div>
                                </TypeHeader>
                                {type.description && (
                                    <TypeDescription>{type.description}</TypeDescription>
                                )}
                                <TypeStats>
                                    <TypeStat>
                                        <TypeStatNumber $color="#007AFF">{type.items_count || 0}</TypeStatNumber>
                                        <TypeStatLabel>Всего единиц</TypeStatLabel>
                                    </TypeStat>
                                    <TypeStat>
                                        <TypeStatNumber $color="#52C41A">{type.available_count || 0}</TypeStatNumber>
                                        <TypeStatLabel>Доступно</TypeStatLabel>
                                    </TypeStat>
                                </TypeStats>
                            </TypeCard>
                        ))}
                    </TypesGrid>
                )}
            </>
        );
    };

    // Рендер вкладки "Единицы инвентаря"
    const renderItems = () => {
        return (
            <>
                {inventoryTypes.length > 0 && (
                    <ButtonsRow>
                        <SecondaryButton onClick={() => setShowCreateItemsForm(true)}>
                            ➕ Добавить единицы
                        </SecondaryButton>
                    </ButtonsRow>
                )}

                {showCreateItemsForm && (
                    <FormContainer>
                        <FormTitle>📦 Добавление единиц инвентаря</FormTitle>
                        <FormRow>
                            <FormField>
                                <FormLabel>Тип инвентаря *</FormLabel>
                                <select
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '8px',
                                        padding: '12px',
                                        color: '#ffffff',
                                        fontSize: '14px',
                                        width: '100%'
                                    }}
                                    value={selectedTypeForItems || ''}
                                    onChange={(e) => setSelectedTypeForItems(parseInt(e.target.value) || null)}
                                >
                                    <option value="">Выберите тип</option>
                                    {inventoryTypes.map(type => (
                                        <option key={type.id} value={type.id}>
                                            {type.icon_name} {type.display_name}
                                        </option>
                                    ))}
                                </select>
                            </FormField>
                            <FormField>
                                <FormLabel>Количество единиц</FormLabel>
                                <FormInput
                                    type="number"
                                    min="1"
                                    max="50"
                                    value={newItemsForm.quantity}
                                    onChange={(e) => setNewItemsForm({...newItemsForm, quantity: parseInt(e.target.value) || 1})}
                                />
                            </FormField>
                        </FormRow>

                        <FormField>
                            <FormLabel>Префикс названий (необязательно)</FormLabel>
                            <FormInput
                                type="text"
                                placeholder="VIP, Премиум, Детский..."
                                value={newItemsForm.name_prefix}
                                onChange={(e) => setNewItemsForm({...newItemsForm, name_prefix: e.target.value})}
                            />
                        </FormField>

                        <FormButtons>
                            <CancelButton onClick={() => {
                                setShowCreateItemsForm(false);
                                setSelectedTypeForItems(null);
                            }}>
                                Отмена
                            </CancelButton>
                            <SubmitButton 
                                onClick={handleCreateItems}
                                disabled={!selectedTypeForItems}
                            >
                                ✅ Добавить
                            </SubmitButton>
                        </FormButtons>
                    </FormContainer>
                )}

                {inventoryItems.length === 0 && !showCreateItemsForm ? (
                    <EmptyState>
                        <EmptyIcon>📋</EmptyIcon>
                        <EmptyTitle>Нет единиц инвентаря</EmptyTitle>
                        <EmptyDescription>
                            {inventoryTypes.length === 0 
                                ? 'Сначала создайте типы инвентаря во вкладке "Типы инвентаря"'
                                : 'Добавьте единицы инвентаря для отслеживания конкретного оборудования'
                            }
                        </EmptyDescription>
                    </EmptyState>
                ) : (
                    <ItemsGrid>
                        {inventoryItems.map(item => {
                            const type = inventoryTypes.find(t => t.id === item.inventory_type_id);
                            return (
                                <ItemCard key={item.id} $status={item.status}>
                                    <ItemHeader>
                                        <ItemName>
                                            {type?.icon_name || '📦'} {item.name || `${type?.display_name} #${item.id}`}
                                        </ItemName>
                                        <ItemStatus $status={item.status}>
                                            {getStatusIcon(item.status)} {getStatusName(item.status)}
                                        </ItemStatus>
                                    </ItemHeader>
                                    <ItemDetails>
                                        <div><strong>Тип:</strong> {type?.display_name || 'Неизвестно'}</div>
                                        {item.serial_number && (
                                            <div><strong>Серийный номер:</strong> {item.serial_number}</div>
                                        )}
                                        {item.current_booking_id && (
                                            <div><strong>Бронирование:</strong> {item.current_booking_id}</div>
                                        )}
                                        {item.notes && (
                                            <div><strong>Заметки:</strong> {item.notes}</div>
                                        )}
                                        <div><strong>Создано:</strong> {new Date(item.created_at).toLocaleDateString()}</div>
                                    </ItemDetails>
                                </ItemCard>
                            );
                        })}
                    </ItemsGrid>
                )}
            </>
        );
    };

    if (!isOpen) return null;

    return (
        <ModalOverlay onClick={onClose}>
            <ModalContainer onClick={(e) => e.stopPropagation()}>
                <ModalHeader>
                    <ModalTitle>Управление инвентарем</ModalTitle>
                    <CloseButton onClick={onClose}>✕</CloseButton>
                </ModalHeader>

                <TabsContainer>
                    <Tab 
                        $active={activeTab === 'overview'}
                        onClick={() => setActiveTab('overview')}
                    >
                        📊 Обзор
                    </Tab>
                    <Tab 
                        $active={activeTab === 'types'}
                        onClick={() => setActiveTab('types')}
                    >
                        📦 Типы инвентаря
                    </Tab>
                    <Tab 
                        $active={activeTab === 'items'}
                        onClick={() => setActiveTab('items')}
                    >
                        📋 Единицы инвентаря
                    </Tab>
                </TabsContainer>

                <ModalContent>
                    {loading ? (
                        <LoadingState>
                            <LoadingSpinner />
                            <div>Загрузка данных инвентаря...</div>
                        </LoadingState>
                    ) : error ? (
                        <EmptyState>
                            <EmptyIcon>❌</EmptyIcon>
                            <EmptyTitle>Ошибка загрузки</EmptyTitle>
                            <EmptyDescription>{error}</EmptyDescription>
                        </EmptyState>
                    ) : (
                        <>
                            {activeTab === 'overview' && renderOverview()}
                            {activeTab === 'types' && renderTypes()}
                            {activeTab === 'items' && renderItems()}
                        </>
                    )}
                </ModalContent>
            </ModalContainer>
        </ModalOverlay>
    );
};

export default DesktopInventoryModal;