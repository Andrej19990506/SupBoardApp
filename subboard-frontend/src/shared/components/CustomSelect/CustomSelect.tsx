import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';

const SelectWrapper = styled.div`
  position: relative;
  min-width: 140px;
  user-select: none;
`;

const Selected = styled.div<{ $color?: string }>`
  width: 100%;
  padding: 6px 28px 6px 10px;
  border-radius: 8px;
  border: 1px solid #444;
  background: #222;
  color: ${({ $color }) => $color || '#fff'};
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;

  @media (max-width: 480px) {
    font-size: 0.82rem;
    padding: 4px 18px 4px 8px;
    min-height: 32px;
  }
`;

const Dropdown = styled.ul`
  position: absolute;
  top: 110%;
  left: 0;
  width: 100%;
  background: #18181b;
  border-radius: 10px;
  box-shadow: 0 4px 24px #0008;
  z-index: 100;
  margin: 0;
  padding: 6px 0;
  list-style: none;
  border: 1px solid #333;
`;

const OptionLi = styled.li<{ $active?: boolean; $color?: string }>`
  padding: 8px 16px;
  color: ${({ $color }) => $color || '#fff'};
  background: ${({ $active }) => $active ? '#2a2a2e' : 'transparent'};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 500;
  font-size: 1rem;
  transition: background 0.15s;
  &:hover {
    background: #23232a;
  }
`;

interface Option {
  value: string;
  label: React.ReactNode;
  color?: string;
}

interface CustomSelectProps {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  style?: React.CSSProperties;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ value, options, onChange, style }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <SelectWrapper style={style} ref={ref}>
      <Selected $color={current?.color} onClick={() => setOpen(o => !o)}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{current?.label}</span>
        <span style={{ marginLeft: 8, fontSize: 18, opacity: 0.7 }}>▼</span>
      </Selected>
      {open && (
        <Dropdown>
          {options.map(opt => (
            <OptionLi
              key={opt.value}
              $active={opt.value === value}
              $color={opt.color}
              onClick={() => { setOpen(false); onChange(opt.value); }}
            >
              {opt.label}
            </OptionLi>
          ))}
        </Dropdown>
      )}
    </SelectWrapper>
  );
};

export default CustomSelect; 