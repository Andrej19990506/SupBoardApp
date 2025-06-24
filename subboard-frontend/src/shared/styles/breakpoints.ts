export const breakpoints = {
    mobile: '320px',
    tablet: '768px',
    desktop: '1024px',
    largeDesktop: '1440px'
} as const;

export const media = {
    mobile: `@media (min-width: ${breakpoints.mobile})`,
    tablet: `@media (min-width: ${breakpoints.tablet})`,
    desktop: `@media (min-width: ${breakpoints.desktop})`,
    largeDesktop: `@media (min-width: ${breakpoints.largeDesktop})`
} as const; 