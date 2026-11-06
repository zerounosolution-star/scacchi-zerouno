/**
 * WORKER DELL'AI
 *
 * Esegue la ricerca della mossa in un thread separato, cosi' la pagina
 * resta reattiva mentre l'AI pensa: la scacchiera si ridisegna, gli
 * orologi scorrono, i bottoni rispondono.
 *
 * Riceve { id, fen, level, timeBudgetMs } e risponde con
 * { id, move } oppure { id, error }.
 */

import { chooseMove } from './search.js';

self.addEventListener('message', (event) => {
    const { id, fen, level, timeBudgetMs } = event.data || {};

    try {
        const move = chooseMove(fen, level, timeBudgetMs ? { timeBudgetMs } : {});
        self.postMessage({ id, move });
    } catch (error) {
        self.postMessage({ id, error: error && error.message ? error.message : String(error) });
    }
});
