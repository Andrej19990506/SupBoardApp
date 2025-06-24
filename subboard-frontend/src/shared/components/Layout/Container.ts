import styled from 'styled-components';

export const Container = styled.div`
    width: 100%;
    margin: 0 auto;
    padding: ${({ theme }) => theme.layout.padding.mobile};
    
    ${({ theme }) => theme.media.tablet} {
        max-width: ${({ theme }) => theme.layout.containerWidth.tablet};
        padding: ${({ theme }) => theme.layout.padding.tablet};
    }
    
    ${({ theme }) => theme.media.desktop} {
        max-width: ${({ theme }) => theme.layout.containerWidth.desktop};
        padding: ${({ theme }) => theme.layout.padding.desktop};
    }
    
    ${({ theme }) => theme.media.largeDesktop} {
        max-width: ${({ theme }) => theme.layout.containerWidth.largeDesktop};
    }
`; 