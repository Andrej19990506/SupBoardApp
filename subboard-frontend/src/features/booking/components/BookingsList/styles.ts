import styled, { keyframes } from 'styled-components';
import { motion } from 'framer-motion';
import { BookingStatus } from '@/types/booking';
import { media } from '@shared/styles/breakpoints';

const slideUp = keyframes`
    from {
        transform: translateY(100%);
    }
    to {
        transform: translateY(0);
    }
`;

const slideDown = keyframes`
    from {
        transform: translateY(0);
    }
    to {
        transform: translateY(100%);
    }
`;

export const ModalOverlay = styled.div<{ $isClosing: boolean }>`
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: stretch;
    justify-content: center;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    transition: opacity 0.3s;
    opacity: ${({ $isClosing }) => ($isClosing ? 0 : 1)};
`;

export const ModalContainer = styled.div<{ $isClosing: boolean }>`
    background: #1C1C1E;
    border-radius: 20px 20px 0 0;
    padding: 24px;
    width: 100%;
    max-width: 600px;
    max-height: 100vh;
    min-height: 100vh;
    overflow-y: auto;
    animation: ${({ $isClosing }) => ($isClosing ? slideDown : slideUp)} 0.3s ease-in-out;
`;

export const Header = styled.div`
    margin-bottom: 24px;
`;

export const Title = styled.h2`
    font-size: 1.5rem;
    color: #fff;
    margin: 0;
    text-transform: capitalize;
`;

export const StyledList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 24px;
`;

export const DeleteBackground = styled(motion.div)`
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding-left: 25px;
    border-radius: 12px;
    pointer-events: none;
    background: linear-gradient(to left, transparent, rgba(0, 84, 255, 0.9));
`;

export const DeleteIconWrapper = styled(motion.div)`
    color: #fff;
    font-size: 24px;
    display: flex;
    align-items: center;
    gap: 8px;
`;

export const ConfirmContainer = styled(motion.div)`
    position: absolute;
    inset: 0;
    background-color: rgba(28, 28, 30, 0.95);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #fff;
    padding: 15px;
    text-align: center;
    z-index: 10;
    backdrop-filter: blur(4px);
`;

export const ConfirmText = styled.h3`
    margin: 0 0 15px 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: inherit;
`;

export const ConfirmButtonWrapper = styled.div`
    display: flex;
    gap: 15px;
`;

export const ConfirmButton = styled(motion.button)<{ $variant: 'delete' | 'cancel' }>`
    padding: 8px 20px;
    border-radius: 12px;
    border: none;
    cursor: pointer;
    font-weight: 600;
    transition: transform 0.1s ease-out;
    color: #fff;

    ${({ $variant }) => 
        $variant === 'delete' 
            ? `
                background-color: #0054FF;
                border: 1px solid #0054FF;
                box-shadow: 0 0 10px rgba(0, 84, 255, 0.3);
            `
            : `
                background-color: #3A3A3C;
                border: 1px solid #3A3A3C;
            `
    }

    &:hover {
        transform: scale(1.03);
    }
    &:active {
        transform: scale(0.97);
    }
`;

export const DeleteText = styled.span`
    font-size: 0.9rem;
    font-weight: 500;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
`;

export const BookingCardContainer = styled(motion.div)`
    position: relative;
    overflow: hidden;
    border-radius: 12px;
`;

export const BookingCardContent = styled(motion.div)<{ $isPaid?: boolean; $isCancelled?: boolean; $status?: BookingStatus }>`
    background: ${({ $isPaid, $isCancelled, $status }) =>
        $isCancelled
            ? 'linear-gradient(135deg, rgba(255, 77, 79, 0.15) 0%, rgba(255, 77, 79, 0.25) 100%), #2C2C2E'
            : $isPaid
            ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%), #2C2C2E'
            : $status === BookingStatus.PENDING_CONFIRMATION
                ? 'linear-gradient(135deg, rgba(255, 149, 0, 0.22) 0%, rgba(255, 186, 0, 0.32) 100%), #2C2C2E'
            : $status === BookingStatus.BOOKED
                ? 'linear-gradient(135deg, rgba(0, 122, 255, 0.18) 0%, rgba(0, 122, 255, 0.32) 100%), #2C2C2E'
                : '#2C2C2E'};
    border-radius: 12px;
    padding: 16px;
    padding-right: 52px;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
    z-index: 1;

    &:hover {
        // opacity: ${({ $isPaid }) => $isPaid ? 1 : 0.8};
    }
`;

export const BookingTime = styled.div`
    font-size: 1.25rem;
    font-weight: 600;
    color: #fff;
    margin-bottom: 8px;
`;

export const BookingInfo = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;

    > div:first-child {
        font-weight: 500;
    }

    > div:nth-child(2) {
        color: #007AFF;
    }

    > div:nth-child(3) {
        color: #86868B;
        font-size: 0.9rem;
    }

    > div.comment {
        color: #86868B;
        font-size: 0.9rem;
        font-style: italic;
        margin-top: 8px;
        padding: 8px 12px;
        background: rgba(44, 44, 46, 0.8);
        border-left: 2px solid #007AFF;
        border-radius: 0 8px 8px 0;
        white-space: pre-wrap;
        word-break: break-word;
        backdrop-filter: blur(4px);
        transition: all 0.2s ease;

        &:hover {
            background: rgba(44, 44, 46, 1);
            border-left-width: 3px;
        }
    }
`;

export const StatusBadge = styled.span<{ $status: BookingStatus }>`
    display: inline-flex;
    align-items: center;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: capitalize;
    
    ${({ $status, theme }) => {
        switch ($status) {
            case BookingStatus.BOOKED:
                return `background: rgba(59, 130, 246, 0.1); color: #3B82F6;`;
            case BookingStatus.IN_USE:
                return `background: rgba(34, 197, 94, 0.1); color: #22C55E;`;
            case BookingStatus.PENDING_CONFIRMATION:
                return `background: rgba(255, 149, 0, 0.1); color: #FF9500;`;
            case BookingStatus.COMPLETED:
                return `background: rgba(142, 142, 147, 0.1); color: #8E8E93;`;
            case BookingStatus.CANCELLED:
                return `background: rgba(255, 77, 79, 0.1); color: #FF4D4F;`;
            default:
                return `background: rgba(107, 114, 128, 0.1); color: #6B7280;`;
        }
    }}
`;

export const ButtonGroup = styled.div`
    display: flex;
    gap: 12px;
    margin-top: 24px;
`;

export const Button = styled.button`
    flex: 1;
    padding: 12px;
    border-radius: 8px;
    border: none;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.2s ease;

    &:hover {
        opacity: 0.8;
    }
`;

export const PrimaryButton = styled(Button)`
    background: #007AFF;
    color: #fff;
`;

export const SecondaryButton = styled(Button)`
    background: #3A3A3C;
    color: #fff;
`;

export const EditButton = styled(motion.button)`
    position: absolute;
    top: 12px;
    right: 12px;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(0, 122, 255, 0.1);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #007AFF;
    z-index: 2;
    transition: all 0.2s ease;

    &:hover {
        background: rgba(0, 122, 255, 0.2);
    }

    svg {
        width: 18px;
        height: 18px;
    }
`; 