import { BoardStatus } from "../../store/types";



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