import React from 'react';
import canoeIcon from '@/assets/canoe.png';
import seatIcon from '@/assets/seat.png';
import { useAppSelector, useAppDispatch } from '@/features/booking/store/hooks';
import { addBoard, setBoardStatus, sendToRepair } from '@/features/booking/store/slices/board-slice/boardSlice';
import type { Board, BoardStatus } from '@/features/booking/store/types';
import { parseISO } from 'date-fns';
import { getRelevantBookingInterval } from '@features/booking/utils/bookingUtils';
import type { Booking } from '@/types/booking';

const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 199,
    background: 'rgba(0,0,0,0.4)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
};

const modalStyle: React.CSSProperties = {
    position: 'relative',
    background: '#1C1C1E',
    color: '#fff',
    boxShadow: '0 -8px 32px rgba(0,0,0,0.28)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: 320,
    maxHeight: '80vh',
    width: '100%',
    maxWidth: 600,
    transition: 'transform 0.3s',
    transform: 'translateY(0)',
    padding: 32,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'inherit',
};

const closeBtnStyle: React.CSSProperties = {
    position: 'absolute',
    top: 16,
    right: 24,
    fontSize: 32,
    background: 'none',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
    opacity: 0.8,
};

const closeBtnHoverStyle: React.CSSProperties = {
    ...closeBtnStyle,
    opacity: 1,
};

const iconsRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
    marginTop: 40,
};

const iconStyle: React.CSSProperties = {
    width: 64,
    height: 64,
    filter: 'drop-shadow(0 2px 8px #007aff33)',
    cursor: 'pointer',
    transition: 'transform 0.15s',
};

const boardsGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))',
    gap: 18,
    marginTop: 32,
    width: '100%',
    maxWidth: 420,
    justifyItems: 'center',
};

const boardCellStyle = (status: string): React.CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: status === 'available' ? '#23232a' : status === 'preparing' ? '#FFB30022' : '#FF4D4F22',
    border: `2px solid ${status === 'available' ? '#007AFF' : status === 'preparing' ? '#FFB300' : '#FF4D4F'}`,
    borderRadius: 14,
    padding: 8,
    minWidth: 60,
    minHeight: 90,
    position: 'relative',
});

const statusBadgeStyle = (status: string): React.CSSProperties => ({
    position: 'absolute',
    top: 6,
    right: 6,
    fontSize: 11,
    fontWeight: 600,
    color: status === 'available' ? '#007AFF' : status === 'preparing' ? '#FFB300' : '#FF4D4F',
    background: '#18181b',
    borderRadius: 8,
    padding: '2px 8px',
});

const addBoardBtnStyle: React.CSSProperties = {
    marginTop: 24,
    background: '#007AFF',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '10px 28px',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
};

const repairBtnStyle: React.CSSProperties = {
    marginTop: 8,
    background: '#FF4D4F',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '4px 10px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
};

const statusText: Record<BoardStatus, string> = {
    available: 'Доступна',
    booked: 'Забронирована',
    in_use: 'В использовании',
    servicing: 'Обслуживание',
    repair: 'В ремонте',
};

const AddBoardIcon: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <button
        onClick={onClick}
        style={{
            width: 56,
            height: 56,
            background: '#23232a',
            border: '2px dashed #007AFF',
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            marginTop: 8,
            marginBottom: 8,
            transition: 'background 0.15s, border-color 0.15s',
        }}
        aria-label="Добавить доску"
    >
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="12" y="4" width="4" height="20" rx="2" fill="#007AFF"/>
            <rect x="4" y="12" width="20" height="4" rx="2" fill="#007AFF"/>
        </svg>
    </button>
);

interface InventoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    plannedTime?: string;
    plannedDate?: string;
    durationInHours?: number;
}

const InventoryModal: React.FC<InventoryModalProps> = ({ isOpen, onClose, plannedTime, plannedDate, durationInHours }) => {
    const [hover, setHover] = React.useState(false);
    const [showBoards, setShowBoards] = React.useState(false);
    const boards = useAppSelector(state => state.boards.boards);
    const bookingsMap = useAppSelector(state => state.bookings.bookings);
    const selectedDate = useAppSelector(state => state.bookings.selectedDate);
    const flatAllBookings = React.useMemo(() => Object.values(bookingsMap || {}).flat(), [bookingsMap]);
    const dispatch = useAppDispatch();

    // --- адаптивные стили ---
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 480;
    const mobileIconsRowStyle = isMobile ? { ...iconsRowStyle, gap: 32, marginTop: 24 } : iconsRowStyle;
    const mobileIconStyle = isMobile ? { ...iconStyle, width: 32, height: 32 } : iconStyle;
    const mobileBoardsGridStyle = isMobile
        ? { ...boardsGridStyle, gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 12, flex: '1 1 auto', height: '100%', padding: '0 4px 6px 4px' }
        : boardsGridStyle;
    const mobileBoardCellStyle = (status: string) => isMobile
        ? { ...boardCellStyle(status), minWidth: 60, minHeight: 80, padding: 4, boxShadow: '0 2px 8px #0002', borderRadius: 12 }
        : boardCellStyle(status);
    const mobileStatusBadgeStyle = (status: string) => isMobile
        ? { ...statusBadgeStyle(status), fontSize: 12, padding: '3px 10px', top: 8, right: 8, borderRadius: 10 }
        : statusBadgeStyle(status);
    const mobileRepairBtnStyle = isMobile
        ? { ...repairBtnStyle, fontSize: 13, padding: '6px 14px', marginTop: 8, borderRadius: 10 }
        : repairBtnStyle;
    // --- конец адаптивных стилей ---

    const handleBoardClick = (id: number, status: BoardStatus) => {
        let nextStatus: BoardStatus;
        if (status === 'available') nextStatus = 'booked';
        else if (status === 'booked') nextStatus = 'in_use';
        else if (status === 'in_use') nextStatus = 'servicing';
        else if (status === 'servicing') nextStatus = 'available';
        else nextStatus = 'available';
        dispatch(setBoardStatus({ id, status: nextStatus }));
    };
    const handleRepair = (id: number) => {
        dispatch(sendToRepair({ id }));
    };
    const handleAddBoard = () => {
        dispatch(addBoard());
    };

    // Выбираем "now" как выбранную дату и время (если есть), иначе текущий момент
    let now: Date;
    if (selectedDate) {
        now = new Date(selectedDate + 'T' + (plannedTime || '12:00') + ':00');
    } else {
        now = new Date();
    }

    if (!isOpen) return null;
    return (
        <div style={overlayStyle} onClick={onClose}>
            <div
                style={{ ...modalStyle, height: '85vh', overflowY: 'auto', ...(isMobile ? { padding: 12, minHeight: 0, maxHeight: '85vh', borderTopLeftRadius: 18, borderTopRightRadius: 18 } : {}) }}
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    style={hover ? closeBtnHoverStyle : closeBtnStyle}
                    onMouseEnter={() => setHover(true)}
                    onMouseLeave={() => setHover(false)}
                    aria-label="Закрыть"
                >
                    ×
                </button>
                <h2 style={{ marginBottom: isMobile ? 10 : 24, color: '#fff', fontWeight: 700, fontSize: isMobile ? '1.15rem' : '1.4rem', letterSpacing: 0.2 }}>Инвентарь</h2>
                {!showBoards ? (
                    <div style={mobileIconsRowStyle}>
                        <img src={canoeIcon} alt="Доска" style={iconStyle} onClick={() => setShowBoards(true)} />
                        <img src={seatIcon} alt="Кресло" style={iconStyle} />
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 14 : 18, marginBottom: isMobile ? 10 : 18 }}>
                            <span style={{ fontWeight: 700, fontSize: isMobile ? 16 : 18, letterSpacing: 0.1 }}>Доски</span>
                            <button style={{ ...addBoardBtnStyle, background: '#23232a', color: '#007AFF', border: '1.5px solid #007AFF', fontWeight: 500, padding: isMobile ? '8px 18px' : '6px 16px', fontSize: isMobile ? 14 : 14, borderRadius: isMobile ? 12 : 10 }} onClick={() => setShowBoards(false)}>Назад</button>
                        </div>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: 18,
                            marginTop: 18,
                            width: '100%',
                            maxWidth: 420,
                            justifyItems: 'center',
                        }}>
                            {boards.map((board: Board) => {
                                // ЛОГИРОВАНИЕ состояния доски
                                console.log('[INVENTORY_MODAL] BOARD', board.id, 'status:', board.status, 'lastServiceEnd:', board.lastServiceEnd);
                                // Найти все бронирования для этой доски
                                const bookings = flatAllBookings.filter((b: Booking) => Array.isArray(b.boardIds) && b.boardIds.includes(board.id));
                                bookings.forEach(booking => {
                                    const interval = getRelevantBookingInterval(booking);
                                    console.log('[InventoryModal] getRelevantBookingInterval:', {
                                        boardId: board.id,
                                        bookingId: booking.id,
                                        bookingStatus: booking.status,
                                        plannedStartTime: booking.plannedStartTime,
                                        actualStartTime: booking.actualStartTime,
                                        durationInHours: booking.durationInHours,
                                        interval
                                    });
                                });
                                const lastBooking = bookings[0];
                                let filter = 'invert(60%) sepia(80%) saturate(2000%) hue-rotate(80deg) brightness(1.1)'; // зелёный (доступна)
                                let statusText = 'Доступна';
                                let textColor = '#fff';
                                let availableTime: Date | null = null;
                                let availableTimeText = '';
                                let isBusy = false;
                                if (board.status === 'repair') {
                                    filter = 'grayscale(1) opacity(0.5)';
                                    statusText = 'Ремонт';
                                    textColor = '#23232a';
                                } else if (lastBooking) {
                                    // Определяем интервал занятости доски с учётом обслуживания
                                    let intervalStart: Date | null = null;
                                    let intervalEnd: Date | null = null;
                                    if (lastBooking.status === 'booked') {
                                        intervalStart = parseISO(lastBooking.plannedStartTime);
                                        intervalEnd = new Date(intervalStart.getTime() + lastBooking.durationInHours * 60 * 60 * 1000 + 60 * 60 * 1000);
                                    } else if (lastBooking.status === 'in_use' && lastBooking.actualStartTime) {
                                        intervalStart = parseISO(lastBooking.actualStartTime);
                                        intervalEnd = new Date(intervalStart.getTime() + lastBooking.durationInHours * 60 * 60 * 1000 + 60 * 60 * 1000);
                                    } else if (board.status === 'servicing' && board.lastServiceEnd) {
                                        intervalStart = now;
                                        intervalEnd = new Date(board.lastServiceEnd);
                                    }
                                    // ЛОГИ ДЛЯ ОТЛАДКИ
                                    console.log('BOARD', board.id, 'now:', now, 'intervalStart:', intervalStart, 'intervalEnd:', intervalEnd, 'lastBooking.status:', lastBooking.status);
                                    if (intervalStart && intervalEnd && now >= intervalStart && now < intervalEnd) {
                                        isBusy = true;
                                        if (lastBooking.status === 'booked') {
                                            filter = 'invert(36%) sepia(99%) saturate(7492%) hue-rotate(200deg) brightness(1.1)'; // синий
                                            statusText = 'Забронирована';
                                        } else if (lastBooking.status === 'in_use') {
                                            filter = 'invert(18%) sepia(99%) saturate(7492%) hue-rotate(0deg) brightness(1.1)'; // красный
                                            statusText = 'В использовании';
                                        } else if (board.status === 'servicing') {
                                            filter = 'invert(80%) sepia(99%) saturate(7492%) hue-rotate(40deg) brightness(1.1)';
                                            statusText = 'Обслуживание';
                                        }
                                        availableTime = intervalEnd;
                                        availableTimeText = `Доступна в ${availableTime.toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}`;
                                    } else {
                                        // Если нет активного бронирования, явно отображаем статус доски
                                        if (board.status === 'available') {
                                            filter = 'invert(60%) sepia(80%) saturate(2000%) hue-rotate(80deg) brightness(1.1)';
                                            statusText = 'Доступна';
                                        } else if (board.status === 'booked') {
                                            filter = 'invert(36%) sepia(99%) saturate(7492%) hue-rotate(200deg) brightness(1.1)';
                                            statusText = 'Забронирована';
                                        } else if (board.status === 'in_use') {
                                            filter = 'invert(18%) sepia(99%) saturate(7492%) hue-rotate(0deg) brightness(1.1)';
                                            statusText = 'В использовании';
                                        } else if (board.status === 'servicing') {
                                            filter = 'invert(80%) sepia(99%) saturate(7492%) hue-rotate(40deg) brightness(1.1)';
                                            statusText = 'Обслуживание';
                                        }
                                    }
                                } else {
                                    // Если нет lastBooking вообще, явно отображаем статус доски
                                    if (board.status === 'available') {
                                        filter = 'invert(60%) sepia(80%) saturate(2000%) hue-rotate(80deg) brightness(1.1)';
                                        statusText = 'Доступна';
                                    } else if (board.status === 'booked') {
                                        filter = 'invert(36%) sepia(99%) saturate(7492%) hue-rotate(200deg) brightness(1.1)';
                                        statusText = 'Забронирована';
                                    } else if (board.status === 'in_use') {
                                        filter = 'invert(18%) sepia(99%) saturate(7492%) hue-rotate(0deg) brightness(1.1)';
                                        statusText = 'В использовании';
                                    } else if (board.status === 'servicing') {
                                        filter = 'invert(80%) sepia(99%) saturate(7492%) hue-rotate(40deg) brightness(1.1)';
                                        statusText = 'Обслуживание';
                                    }
                                }
                                return (
                                    <div key={board.id} style={{
                                        width: isMobile ? 56 : 68,
                                        height: isMobile ? 80 : 92,
                                        borderRadius: 16,
                                        background: 'transparent',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 2px 8px #0002',
                                        position: 'relative',
                                        marginBottom: 8,
                                    }}>
                                        <img
                                            src={canoeIcon}
                                            alt={`Доска ${board.id}`}
                                            style={{
                                                width: isMobile ? 38 : 48,
                                                height: isMobile ? 38 : 48,
                                                filter,
                                                marginBottom: 4,
                                            }}
                                        />
                                        <span style={{ fontWeight: 700, fontSize: isMobile ? 13 : 16, color: textColor }}>{board.id}</span>
                                        <span style={{ fontSize: isMobile ? 9 : 11, color: textColor, marginTop: 2 }}>{statusText}</span>
                                        {availableTimeText && (
                                            <span style={{ fontSize: isMobile ? 8 : 10, color: '#23232a', marginTop: 2 }}>{availableTimeText}</span>
                                        )}
                                        {/* Кнопка ручного перевода из обслуживания в доступные */}
                                        {board.status === 'servicing' && (
                                            <button
                                                style={{
                                                    marginTop: 6,
                                                    background: '#22C55E',
                                                    color: '#fff',
                                                    border: 'none',
                                                    borderRadius: 8,
                                                    padding: '4px 10px',
                                                    fontSize: 13,
                                                    fontWeight: 500,
                                                    cursor: 'pointer'
                                                }}
                                                onClick={() => dispatch(setBoardStatus({ id: board.id, status: 'available' }))}
                                            >
                                                Сделать доступной
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default InventoryModal; 