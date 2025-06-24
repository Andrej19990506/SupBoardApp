export const theme = {
    colors: {
        primary: '#D32F2F',        // Красный из логотипа
        secondary: '#1B5E20',      // Тёмно-зелёный из логотипа
        background: '#F5F5DC',     // Светлый беж для фона
        text: '#263238',           // Тёмно-синий/серый для текста
        lightBackground: '#FFFFFF', // Белый для контраста
        lightText: '#757575'       // Светло-серый для второстепенного текста
    },
    layout: {
        containerWidth: {
            mobile: '100%',
            tablet: '720px',
            desktop: '960px',
            largeDesktop: '1200px'
        },
        padding: {
            mobile: '16px',
            tablet: '24px',
            desktop: '32px'
        }
    },
    media: {
        tablet: '@media (min-width: 600px)',
        desktop: '@media (min-width: 900px)',
        largeDesktop: '@media (min-width: 1200px)'
    }
} as const;

export type Theme = typeof theme;