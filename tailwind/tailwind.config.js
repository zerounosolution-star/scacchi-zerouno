/**
 * TEMA TAILWIND DI SCACCHI ZEROUNO — SOLO PER COSTRUIRE IL FOGLIO DI STILE
 *
 * Fino al 20 novembre 2026 la pagina caricava Tailwind da un sito esterno
 * (cdn.tailwindcss.com), che a ogni visita leggeva la pagina e ne ricavava
 * gli stili dentro il browser. Quella forma e' pensata per le prove, non
 * per un sito pubblico: pesa, non ha una versione fissata e mette nella
 * pagina un programma che non controlliamo noi.
 *
 * Ora gli stili si costruiscono una volta sola e finiscono in
 * src/css/tailwind.css, che viaggia con il resto del gioco:
 *
 *     npm run css
 *
 * Va rilanciato quando in index.html o nei file di src/ compare una classe
 * Tailwind che prima non c'era. La pubblicazione automatica lo rifa'
 * comunque da se', cosi' il sito pubblicato non resta mai indietro.
 *
 * Palette: avorio (fondo), antracite (testo e pezzi neri), bronzo (accenti).
 */
export default {
    // Dove cercare le classi usate: la pagina e i moduli del gioco.
    content: ['./index.html', './src/**/*.js'],
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
