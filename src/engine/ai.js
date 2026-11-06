/**
 * AVVERSARIO ARTIFICIALE
 *
 * Questo modulo fa da ponte fra la partita e la ricerca:
 * decide quando l'AI deve muovere, chiede la mossa e la applica.
 *
 * La ricerca vera e' in search.js e gira in un Web Worker
 * (ai.worker.js): mentre l'AI pensa, la pagina resta viva.
 * Se il browser non concede i worker, la ricerca viene eseguita nel
 * thread principale, con un tetto di tempo piu' basso per non bloccare
 * l'interfaccia troppo a lungo.
 */

import { chess, state } from '../core/state.js';
import { timeControlById } from '../config/app.config.js';
import { executeMove } from '../ui/input.js';
import { chooseMove, LEVELS } from './search.js';

/** Tetto di tempo di sicurezza quando si cerca senza worker. */
const FALLBACK_TIME_BUDGET_MS = 400;

/** Secondi che l'AI non tocca mai: servono a non cadere sul filo. */
const CLOCK_SAFETY_SECONDS = 1;

/** Su quante mosse ancora da giocare si spalma il tempo rimasto. */
const MOVES_AHEAD = 20;

/** Sotto questo tempo non si cerca: si muove e basta. */
const MIN_BUDGET_MS = 80;

/**
 * Quanto tempo puo' prendersi l'AI per questa mossa.
 *
 * Il tetto del livello e' un massimo, non un diritto. L'AI ha un
 * orologio come chiunque altro: se le resta poco tempo deve muovere
 * subito, altrimenti perde per il tempo una partita che sta vincendo.
 *
 * Il tempo rimasto si spalma su una ventina di mosse, piu' quasi tutto
 * l'incremento, che tanto torna indietro a ogni mossa.
 *
 * @param {number} level
 * @returns {number} millisecondi.
 */
function thinkingBudgetMs(level) {
    const settings = LEVELS[level] || LEVELS[2];
    const remaining = chess.turn() === 'w' ? state.whiteTimeSeconds : state.blackTimeSeconds;

    if (!Number.isFinite(remaining)) return settings.timeBudgetMs;

    const control = timeControlById(state.timeControlId);
    const spendable = Math.max(0, remaining - CLOCK_SAFETY_SECONDS) * 1000 / MOVES_AHEAD;
    const fromIncrement = (control.incrementSeconds || 0) * 1000 * 0.8;

    return Math.max(MIN_BUDGET_MS, Math.min(settings.timeBudgetMs, spendable + fromIncrement));
}

let worker = null;
let workerUnavailable = false;
let requestCounter = 0;
let lastRequestToken = 0;
const pendingRequests = new Map();

/**
 * Restituisce il worker, creandolo alla prima richiesta.
 * @returns {Worker|null} null se i worker non sono disponibili.
 */
function getWorker() {
    if (worker || workerUnavailable) return worker;

    if (typeof Worker === 'undefined') {
        workerUnavailable = true;
        return null;
    }

    try {
        worker = new Worker(new URL('./ai.worker.js', import.meta.url), { type: 'module' });

        worker.addEventListener('message', (event) => {
            const { id, move, error } = event.data || {};
            const pending = pendingRequests.get(id);
            if (!pending) return;
            pendingRequests.delete(id);
            if (error) pending.reject(new Error(error));
            else pending.resolve(move);
        });

        worker.addEventListener('error', (event) => {
            console.error('Worker AI non disponibile, si continua nel thread principale:', event.message);
            workerUnavailable = true;
            worker = null;
            // Chi stava aspettando riceve un errore e passa al piano B
            for (const [, pending] of pendingRequests) {
                pending.reject(new Error('worker non disponibile'));
            }
            pendingRequests.clear();
        });
    } catch (err) {
        console.error('Creazione del worker AI fallita:', err);
        workerUnavailable = true;
        worker = null;
    }

    return worker;
}

/**
 * Chiede la mossa migliore per una posizione.
 *
 * @param {string} fen
 * @param {number} level  1, 2 o 3.
 * @param {Array<[number, number]>|null} positionHistory  Posizioni gia' viste.
 * @param {number|null} timeBudgetMs  Tetto di tempo per questa mossa.
 * @returns {Promise<{from: string, to: string, promotion: string}|null>}
 */
export async function requestBestMove(fen, level, positionHistory = null, timeBudgetMs = null) {
    const activeWorker = getWorker();

    if (activeWorker) {
        const id = ++requestCounter;
        try {
            return await new Promise((resolve, reject) => {
                pendingRequests.set(id, { resolve, reject });
                activeWorker.postMessage({ id, fen, level, positionHistory, timeBudgetMs });
            });
        } catch (err) {
            // Il worker ha fallito: si prosegue nel thread principale
            console.warn('Ricerca nel worker fallita, uso il thread principale:', err.message);
        }
    }

    // Senza worker la ricerca blocca la pagina: tetto piu' basso
    const fallbackBudget = Math.min(FALLBACK_TIME_BUDGET_MS, timeBudgetMs || FALLBACK_TIME_BUDGET_MS);
    return chooseMove(fen, level, { timeBudgetMs: fallbackBudget, positionHistory });
}

/**
 * Fa muovere l'AI, se tocca a lei.
 * Si puo' chiamare senza attendere: applica la mossa quando e' pronta.
 *
 * @returns {Promise<void>}
 */
export async function makeAiMove() {
    if (state.matchEnded || chess.game_over()) return;

    const fen = chess.fen();
    const level = LEVELS[state.aiDifficulty] ? state.aiDifficulty : 2;

    /*
     * Ogni richiesta ha il suo numero. Se nel frattempo ne parte
     * un'altra (nuova partita, mossa annullata), la risposta vecchia
     * arriva fuori tempo massimo e va buttata: non si blocca la nuova.
     */
    const token = ++lastRequestToken;
    state.aiThinking = true;

    let move = null;
    try {
        move = await requestBestMove(fen, level, chess.positionCountEntries(), thinkingBudgetMs(level));
    } catch (err) {
        console.error('Errore nella ricerca della mossa:', err);
    } finally {
        if (token === lastRequestToken) state.aiThinking = false;
    }

    if (token !== lastRequestToken || !move) return;

    /*
     * Mentre l'AI pensava la partita puo' essere cambiata: nuova partita,
     * mossa annullata, abbandono. La mossa vale solo se la posizione e'
     * ancora quella su cui e' stata calcolata.
     */
    if (state.matchEnded || chess.fen() !== fen) return;

    executeMove(move.from, move.to, move.promotion || 'q');
}

export { chooseMove, LEVELS };
