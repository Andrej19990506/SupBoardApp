import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ProfileDropdownContextType {
  isOpen: boolean;
  position: { top: number; right: number } | null;
  openDropdown: (position: { top: number; right: number }) => void;
  closeDropdown: () => void;
}

const ProfileDropdownContext = createContext<ProfileDropdownContextType | null>(null);

export const useProfileDropdown = () => {
  const context = useContext(ProfileDropdownContext);
  if (!context) {
    throw new Error('useProfileDropdown must be used within ProfileDropdownProvider');
  }
  return context;
};

interface ProfileDropdownProviderProps {
  children: ReactNode;
}

export const ProfileDropdownProvider: React.FC<ProfileDropdownProviderProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);

  const openDropdown = (newPosition: { top: number; right: number }) => {
    setPosition(newPosition);
    setIsOpen(true);
  };

  const closeDropdown = () => {
    setIsOpen(false);
    setPosition(null);
  };

  return (
    <ProfileDropdownContext.Provider 
      value={{ 
        isOpen, 
        position, 
        openDropdown, 
        closeDropdown 
      }}
    >
      {children}
    </ProfileDropdownContext.Provider>
  );
}; 