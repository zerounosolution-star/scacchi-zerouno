/**
 * MOSSA SCRITTA
 *
 * Si gioca scrivendo la mossa invece di cercarla sulla scacchiera:
 * "e4", "Nf6", "O-O", "e8=Q", oppure le due case ("e2e4").
 *
 * Per chi gioca da tastiera e' la via piu' corta: la navigazione casella
 * per casella con le frecce resta, ma per una mossa lontana costa molte
 * pressioni.
 *
 * Qui c'e' solo la parte che tocca la pagina: leggere la notazione e
 * trovare la mossa e' compito di engine/notation.js.
 */

import { chess, state } from '../core/state.js';
import { showToast, canHumanControlCurrentTurn } from '../core/utils.js';
import { findMoveFromNotation } from '../engine/notation.js';
import { executeMove, triggerMoveOrPromotion } from './input.js';

const MESSAGES = {
    vuoto: 'Scrivi una mossa, per esempio e4 oppure Nf6.',
    illegale: 'Mossa non valida in questa posizione.',
    ambigua: 'Due pezzi possono farla: scrivi le due case, per esempio g1e2.'
};

/**
 * Gioca la mossa scritta.
 *
 * @param {string} text
 * @returns {boolean} vero se la mossa e' stata giocata.
 */
export function playNotation(text) {
    if (state.review) {
        showToast('Stai rivedendo una mossa precedente. Torna alla partita per muovere.');
        return false;
    }
    if (state.matchEnded) {
        showToast('La partita e\' conclusa.');
        return false;
    }
    if (!canHumanControlCurrentTurn()) {
        showToast('Attendi la mossa dell\'avversario...');
        return false;
    }

    const result = findMoveFromNotation(chess, text);
    if (result.error) {
        showToast(MESSAGES[result.error] || MESSAGES.illegale);
        return false;
    }

    const { move, promotion } = result;
    const isPromotion = move.flags && move.flags.includes('p');

    state.selectedSquare = null;
    state.legalMovesForSelected = [];

    if (isPromotion && promotion) {
        // Il pezzo lo ha gia' scelto chi ha scritto: niente finestra
        executeMove(move.from, move.to, promotion);
    } else {
        triggerMoveOrPromotion(move.from, move.to, move);
    }

    return true;
}

/** Attacca il campo di testo sotto la scacchiera. */
export function setupNotationInput() {
    const input = document.getElementById('notationMoveInput');
    if (!input || input.dataset.bound === '1') return;
    input.dataset.bound = '1';

    input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        if (playNotation(input.value)) input.value = '';
    });
}
