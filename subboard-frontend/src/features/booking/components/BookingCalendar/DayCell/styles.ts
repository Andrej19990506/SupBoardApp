import styled, { css } from 'styled-components';

interface CellProps {
    $isToday: boolean;
    $isSelected: boolean;
    $hasBookings: boolean;
    $isPastDate?: boolean;
    $isFullyBooked?: boolean;
    $isPartiallyBooked?: boolean;
}

interface DayNumberProps {
    $isToday: boolean;
    $isPastDate?: boolean;
}

interface BookingIndicatorProps {
    $isPastDate?: boolean;
}

export const BookingIndicator = styled.div<BookingIndicatorProps>`
    position: absolute;
    background: linear-gradient(135deg, #007AFF 0%, #0066CC 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    box-shadow: 0 2px 8px rgba(0, 122, 255, 0.4);
    border: 2px solid rgba(255, 255, 255, 0.1);
    
    /* Адаптивные размеры индикатора */
    @media (max-width: 375px) {
        top: 2px;
        right: 2px;
        width: 16px;
        height: 16px;
        border-radius: 8px;
        font-size: 8px;
        border-width: 1px;
        box-shadow: 0 1px 4px rgba(0, 122, 255, 0.4);
    }
    
    @media (min-width: 376px) and (max-width: 414px) {
        top: 4px;
        right: 4px;
        width: 20px;
        height: 20px;
        border-radius: 10px;
        font-size: 10px;
        border-width: 1px;
        box-shadow: 0 2px 6px rgba(0, 122, 255, 0.4);
    }
    
    @media (min-width: 415px) {
        top: 6px;
        right: 6px;
        width: 24px;
        height: 24px;
        border-radius: 12px;
        font-size: 12px;
        border-width: 2px;
        box-shadow: 0 2px 8px rgba(0, 122, 255, 0.4);
    }

    ${({ $isPastDate }) => $isPastDate && css`
        background: rgba(0, 122, 255, 0.3);
        color: rgba(255, 255, 255, 0.6);
        box-shadow: none;
    `}
`;

export const CellContainer = styled.button<CellProps>`
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    cursor: pointer;
    position: relative;
    color: #fff;
    transition: all 0.2s ease;
    border-radius: 8px;
    
    /* Адаптивный padding в зависимости от размера экрана */
    @media (max-width: 375px) {
        padding: 3px 2px;
        border-radius: 6px;
    }
    
    @media (min-width: 376px) and (max-width: 414px) {
        padding: 6px 3px;
        border-radius: 8px;
    }
    
    @media (min-width: 415px) {
        padding: 8px 4px;
        border-radius: 10px;
    }

    ${({ $isToday }) => $isToday && css`
        background: rgba(0, 122, 255, 0.2);
        border: 2px solid #007AFF;
        box-shadow: 0 0 16px rgba(0, 122, 255, 0.3);
        
        @media (max-width: 375px) {
            border-width: 1px;
            box-shadow: 0 0 8px rgba(0, 122, 255, 0.3);
        }
    `}

    ${({ $isSelected }) => $isSelected && css`
        background: rgba(0, 122, 255, 0.4);
        border: 2px solid #007AFF;
        
        @media (max-width: 375px) {
            border-width: 1px;
        }
    `}

    ${({ $isFullyBooked }) => $isFullyBooked && css`
        background: linear-gradient(135deg, #FF4D4F 0%, #FF6B6B 100%) !important;
        color: #fff;
        border: 2px solid #FF4D4F;
        box-shadow: 0 4px 16px rgba(255, 77, 79, 0.4);
        
        @media (max-width: 375px) {
            border-width: 1px;
            box-shadow: 0 2px 8px rgba(255, 77, 79, 0.4);
        }
    `}

    ${({ $isPastDate }) => $isPastDate && css`
        opacity: 0.4;
        cursor: not-allowed;
        background: rgba(255, 255, 255, 0.02);

        &:hover {
            background: rgba(255, 255, 255, 0.02);
            transform: none;
        }
    `}

    ${({ $isPartiallyBooked }) => $isPartiallyBooked && css`
        background: linear-gradient(135deg, #FFD600 0%, #FFA500 100%) !important;
        color: #1C1C1E;
        border: 2px solid #FFD600;
        box-shadow: 0 4px 16px rgba(255, 214, 0, 0.4);
        font-weight: 600;
        
        @media (max-width: 375px) {
            border-width: 1px;
            box-shadow: 0 2px 8px rgba(255, 214, 0, 0.4);
        }
    `}

    &:hover:not([disabled]) {
        background: rgba(255, 255, 255, 0.08);
    }
    
    &:active:not([disabled]) {
        transform: scale(0.95);
    }
`;

export const DayNumber = styled.span<DayNumberProps>`
    font-weight: ${({ $isToday }) => ($isToday ? '700' : '500')};
    line-height: 1;
    
    /* Адаптивный размер шрифта в зависимости от размера экрана */
    @media (max-width: 375px) {
        font-size: 12px;
        margin-bottom: 2px;
        font-weight: ${({ $isToday }) => ($isToday ? '700' : '600')};
    }
    
    @media (min-width: 376px) and (max-width: 414px) {
        font-size: 16px;
        margin-bottom: 4px;
        font-weight: ${({ $isToday }) => ($isToday ? '700' : '500')};
    }
    
    @media (min-width: 415px) {
        font-size: 18px;
        margin-bottom: 6px;
        font-weight: ${({ $isToday }) => ($isToday ? '700' : '500')};
    }

    ${({ $isPastDate }) => $isPastDate && css`
        color: rgba(255, 255, 255, 0.3);
    `}
`; 