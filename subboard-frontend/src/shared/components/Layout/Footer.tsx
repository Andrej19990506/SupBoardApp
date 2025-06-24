import React from 'react';
import styled from 'styled-components';

const FooterWrapper = styled.footer`
  width: 100%;
  height: 80px;
  background: #1c1c1e;
  box-shadow: 0 -2px 16px rgba(0,0,0,0.07);
  display: flex;
  align-items: center;
  justify-content: center;
  position: fixed;
  left: 0;
  bottom: 0;
  z-index: 100;
  padding: 0 24px;

  @media (max-width: 600px) {
    height: 64px;
    padding: 0 8px;
  }
`;

const FooterContent = styled.div`
  width: 100%;
  max-width: 1200px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  color: ${({ theme }) => theme.colors.lightText || '#888'};
`;

const Footer: React.FC = () => {
  return (
    <FooterWrapper>
      <FooterContent>
        {/* Здесь можно добавить кнопки, например: <InventoryButton /> */}
        © {new Date().getFullYear()} Subboard — Все права защищены
      </FooterContent>
    </FooterWrapper>
  );
};

export default Footer; 

