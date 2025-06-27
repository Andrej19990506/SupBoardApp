import styled, { keyframes } from 'styled-components';
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

const fadeIn = keyframes`
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
`;

export const ModalOverlay = styled.div<{ $isClosing: boolean }>`
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    transition: opacity 0.3s;
    opacity: ${({ $isClosing }) => ($isClosing ? 0 : 1)};

    /* ${media.desktop} {
        display: none;
    } */
`;

export const ModalContainer = styled.div<{ $isClosing: boolean }>`
    background: #1C1C1E;
    border-radius: 20px 20px 0 0;
    width: 100%;
    max-width: 600px;
    height: 100vh;
    max-height: 100vh; 
    animation: ${({ $isClosing }) => ($isClosing ? slideDown : slideUp)} 0.3s ease-in-out;
    position: relative;
    transform-origin: bottom;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    ${media.desktop} {
        width: 100%;
        height: 100%;
        max-width: none;
        max-height: none;
        padding: 0; 
        background: transparent;
        border-radius: 0;
        animation: none;
    }
`;

export const SuccessOverlay = styled.div<{ $isVisible: boolean }>`
    position: fixed;
    inset: 0;
    background: rgba(28, 28, 30, 0.95);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24px;
    opacity: ${({ $isVisible }) => ($isVisible ? 1 : 0)};
    visibility: ${({ $isVisible }) => ($isVisible ? 'visible' : 'hidden')};
    transition: all 0.3s ease;
    animation: ${fadeIn} 0.3s ease;
    border-radius: 20px 20px 0 0;
    z-index: 200;
    margin: -24px;
    padding: 24px;
`;

export const SuccessIcon = styled.div`
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: rgba(52, 199, 89, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #34C759;
    font-size: 32px;
`;

export const SuccessMessage = styled.div`
    color: #fff;
    font-size: 1.25rem;
    font-weight: 500;
    text-align: center;
`;

export const OkButton = styled.button`
    background: #344759;
    color: white;
    border: none;
    border-radius: 12px;
    padding: 12px 48px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.2s ease;

    &:hover {
        opacity: 0.9;
    }
`;

export const Form = styled.form`
    display: flex;
    flex-direction: column;
    gap: 16px;
    flex: 1;
    overflow-y: auto;
    padding: 0 24px;
    min-height: 0;
    height: 100%;

    &::-webkit-scrollbar {
        width: 6px;
    }
    &::-webkit-scrollbar-track {
        background: transparent; 
        border-radius: 3px;
    }
    &::-webkit-scrollbar-thumb {
        background-color: #86868B;
        border-radius: 3px;
    }
    &::-webkit-scrollbar-thumb:hover {
        background-color: #555;
    }

    ${media.desktop} {
        height: 100%;
        padding: 0;
    }
`;

export const FormGroup = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
    
`;

export const Label = styled.label`
    color: #86868B;
    font-size: 0.875rem;
`;

export const Input = styled.input`
    background: #2C2C2E;
    border: none;
    border-radius: 12px;
    padding: 12px;
    color: #fff;
    font-size: 1rem;

    &:focus {
        outline: none;
        background: #3C3C3E;
    }
`;

export const Select = styled.select`
    background: #2C2C2E;
    border: none;
    border-radius: 12px;
    padding: 12px;
    color: #fff;
    font-size: 1rem;
    appearance: none;

    &:focus {
        outline: none;
        background: #3C3C3E;
    }
`;

export const TextArea = styled.textarea`
    background: #2C2C2E;
    border: none;
    border-radius: 12px;
    padding: 12px;
    color: #fff;
    font-size: 1rem;
    min-height: 100px;
    resize: vertical;

    &:focus {
        outline: none;
        background: #3C3C3E;
    }
`;

export const ButtonGroup = styled.div`
    display: flex;
    gap: 12px;
    padding: 16px 24px;
    background: #1C1C1E;
    border-top: 1px solid #2C2C2E;
    flex-shrink: 0;

    ${media.desktop} {
        padding: 24px;
        border-top: none;
    }
`;

export const Button = styled.button`
    flex: 1;
    padding: 12px;
    border-radius: 12px;
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

export const SaveButton = styled(PrimaryButton)`
    &:disabled {
        background: #7dafff !important;
        color: #fff !important;
        opacity: 0.7;
        cursor: not-allowed;
    }
`;

export const CancelButton = styled(SecondaryButton)``;

export const FormTitle = styled.h2`
    color: #fff;
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 24px 0;
    padding: 24px 24px 0;
    flex-shrink: 0;

    ${media.desktop} {
        padding: 0 0 24px 0;
    }
`; 
