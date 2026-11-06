/**
 * TEMA TAILWIND DI SCACCHI ZEROUNO
 *
 * Script classico, non modulo: deve essere eseguito dopo il CDN di
 * Tailwind e prima del disegno della pagina.
 *
 * Palette: avorio (fondo), antracite (testo e pezzi neri), bronzo (accenti).
 */
tailwind.config = {
    theme: {
        extend: {
            colors: {
                ivory: {
                    50: '#FAF7F2',
                    100: '#F2ECE1',
                    200: '#E5DCCB',
                    300: '#D3C5AC'
                },
                anthracite: {
                    800: '#2A2825',
                    900: '#1C1B18',
                    950: '#12110F'
                },
                bronze: {
                    400: '#C5A667',
                    500: '#9E7B4F',
                    600: '#84633B'
                }
            },
            fontFamily: {
                serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
                sans: ['"Inter"', 'system-ui', 'sans-serif'],
                mono: ['"JetBrains Mono"', 'monospace']
            }
        }
    }
};
