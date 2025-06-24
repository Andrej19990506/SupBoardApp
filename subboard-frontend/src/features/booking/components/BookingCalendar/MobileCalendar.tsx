import React, { useState, useMemo } from 'react';
import type { FC } from 'react';
import { format, isToday as isTodayFn, startOfMonth, endOfMonth, getDay, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import DayCell from '@features/booking/components/BookingCalendar/DayCell';
import MobileHeader from './components/MobileHeader';
import type { Booking } from '@/types/booking';
import { useAppSelector } from '@features/booking/store/hooks';
import { useInventoryTotal } from '@features/booking/components/BookingForm/hooks/useInventoryTotal';

interface MobileCalendarProps {
  bookings: { [date: string]: Booking[] };
  onAddBooking: (date: Date) => void;
  onEditBooking: (booking: Booking) => void;
  onInventoryClick: () => void;
  onGalleryClick: () => void;
}

const MobileCalendar: FC<MobileCalendarProps> = ({
  bookings,
  onAddBooking,
  onEditBooking,
  onInventoryClick,
  onGalleryClick,
}) => {
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  
  const reduxBookings = useAppSelector(state => state.bookings.bookings);
  const fullyBookedDays = useAppSelector(state => state.bookings.fullyBookedDays || []);
  const partiallyBookedDays = useAppSelector(state => state.bookings.partiallyBookedDays || []);
  
  // Новая система инвентаря
  const { totalInventory } = useInventoryTotal();
  const effectiveTotalInventory = totalInventory;
  
  // Используем данные из Redux store
  const actualBookings = reduxBookings;

  // Генерируем месяцы для отображения
  const monthsToDisplay = useMemo(() => {
    const monthsArray: Date[] = [];
    const baseMonth = new Date();
    baseMonth.setDate(1);
    // Показываем 6 месяцев (текущий + 5 следующих)
    for (let i = 0; i < 6; i++) {
      const month = new Date(baseMonth);
      month.setMonth(baseMonth.getMonth() + i);
      monthsArray.push(month);
    }
    return monthsArray;
  }, []);

  const currentMonth = monthsToDisplay[currentMonthIndex];

  const canGoPrev = currentMonthIndex > 0;
  const canGoNext = currentMonthIndex < monthsToDisplay.length - 1;

  const handlePrevMonth = () => {
    if (canGoPrev) {
      setCurrentMonthIndex(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (canGoNext) {
      setCurrentMonthIndex(prev => prev + 1);
    }
  };

  const handleDayClick = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayBookings = actualBookings[dateStr] || [];
    
    if (dayBookings.length > 0) {
      // Если есть записи, показываем их (здесь можно добавить модальное окно списка)
      onAddBooking(date);
    } else {
      // Если записей нет, открываем форму добавления
      onAddBooking(date);
    }
  };

  const getMonthGrid = (month: Date) => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    let startOffset = getDay(start) - 1;
    if (startOffset < 0) startOffset = 6;
    const days: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let d = 0; d < end.getDate(); d++) {
      days.push(addDays(start, d));
    }
    while (days.length % 7 !== 0) days.push(null);
    return days;
  };

  const getDateBookings = (date: Date): Booking[] => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return actualBookings[dateStr] || [];
  };

  const daysGrid = getMonthGrid(currentMonth);
  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  return (
    <MobileContainer>
      <MobileHeader
        currentMonth={currentMonth}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        onInventoryClick={onInventoryClick}
        onGalleryClick={onGalleryClick}
      />
      
      <CalendarContent>
        <MonthCard
          key={format(currentMonth, 'yyyy-MM')}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Заголовки дней недели */}
          <WeekDaysHeader>
            {weekDays.map((day) => (
              <WeekDayLabel key={day}>{day}</WeekDayLabel>
            ))}
          </WeekDaysHeader>
          
          {/* Сетка дней */}
          <DaysGrid>
            {daysGrid.map((day, idx) => {
              if (!day) {
                return <EmptyCell key={idx} />;
              }

              const dateStr = format(day, 'yyyy-MM-dd');
              const dateBookings = getDateBookings(day);
              const hasBookings = dateBookings.length > 0;
              const isFullyBooked = fullyBookedDays.includes(dateStr);
              const partialDay = partiallyBookedDays.find(d => d.date === dateStr);
              const isPartiallyBooked = !!partialDay;
              const columnIndex = idx % 7;
              
              return (
                <DayCellWrapper key={dateStr}>
                  <DayCell
                    date={day}
                    isToday={isTodayFn(day)}
                    isSelected={false}
                    hasBookings={hasBookings}
                    bookings={dateBookings}
                    allBookings={Object.values(actualBookings).flat()}
                    totalBoards={effectiveTotalInventory}
                    isFullyBooked={isFullyBooked}
                    isPartiallyBooked={isPartiallyBooked}
                    availableAfter={partialDay ? partialDay.available_after : null}
                    columnIndex={columnIndex}
                    onClick={handleDayClick}
                    onEditBooking={onEditBooking}
                    onAddBooking={onAddBooking}
                    onViewDay={(date) => handleDayClick(date)}
                    // Мобильная версия не использует hover-карточки
                    onShowHoverCard={undefined}
                    onHideHoverCard={undefined}
                    onCancelHideHoverCard={undefined}
                  />
                </DayCellWrapper>
              );
            })}
          </DaysGrid>
        </MonthCard>
      </CalendarContent>
    </MobileContainer>
  );
};

// Стили
const MobileContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh; /* Динамическая высота viewport для мобильных */
  width: 100vw;
  max-width: 100vw;
  background: #000;
  overflow: hidden;
  position: relative;
  box-sizing: border-box;
`;

const CalendarContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  gap: 0;
  background: rgb(56 54 54 / 100%);
  width: 100%;
  max-width: 100%;
  min-height: 0;
  
  /* Адаптивный padding */
  @media (max-width: 375px) {
    padding: 4px;
  }
  
  @media (min-width: 376px) and (max-width: 414px) {
    padding: 6px;
  }
  
  @media (min-width: 415px) {
    padding: 8px;
  }
`;

const MonthCard = styled(motion.div)`
  background: #1C1C1E;
  border-radius: 20px;
  overflow: hidden;
  flex: 1;
  display: flex;
  flex-direction: column;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  min-height: 0;
  border: 1px solid rgba(255, 255, 255, 0.05);
  width: 100%;
  max-width: 100%;
  
  @media (max-width: 375px) {
    border-radius: 16px;
  }
  
  @media (min-width: 376px) and (max-width: 414px) {
    border-radius: 18px;
  }
`;

const WeekDaysHeader = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: rgba(255, 255, 255, 0.08);
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
`;

const WeekDayLabel = styled.div`
  text-align: center;
  color: #A1A1A6;
  text-transform: uppercase;
  
  /* Адаптивные размеры заголовков */
  @media (max-width: 375px) {
    padding: 8px 2px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.5px;
  }
  
  @media (min-width: 376px) and (max-width: 414px) {
    padding: 12px 3px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.6px;
  }
  
  @media (min-width: 415px) {
    padding: 16px 4px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.8px;
  }
`;

const DaysGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  grid-template-rows: repeat(8, 1fr);
  background: rgba(255, 255, 255, 0.05);
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: 100%;
  height: 100%;
  box-sizing: border-box;
  
  /* Адаптивные gaps и padding в зависимости от размера экрана */
  @media (max-width: 375px) {
    gap: 1px;
    padding: 1px;
  }
  
  @media (min-width: 376px) and (max-width: 414px) {
    gap: 2px;
    padding: 2px;
  }
  
  @media (min-width: 415px) {
    gap: 3px;
    padding: 3px;
  }
`;

const DayCellWrapper = styled.div`
  background: #1C1C1E;
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  transition: all 0.2s ease;
  border: 1px solid rgba(255, 255, 255, 0.02);
  width: 100%;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  overflow: hidden;
  
  /* Адаптивные border-radius в зависимости от размера экрана */
  @media (max-width: 375px) {
    border-radius: 8px;
  }
  
  @media (min-width: 376px) and (max-width: 414px) {
    border-radius: 10px;
  }
  
  @media (min-width: 415px) {
    border-radius: 12px;
  }
  
  &:hover {
    background: #2C2C2E;
    border-color: rgba(255, 255, 255, 0.08);
    transform: scale(1.02);
  }
  
  &:active {
    transform: scale(0.98);
  }
`;

const EmptyCell = styled.div`
  background: transparent;
  width: 100%;
  height: 100%;
  
  /* Адаптивные border-radius */
  @media (max-width: 375px) {
    border-radius: 8px;
  }
  
  @media (min-width: 376px) and (max-width: 414px) {
    border-radius: 10px;
  }
  
  @media (min-width: 415px) {
    border-radius: 12px;
  }
`;

export default MobileCalendar; 