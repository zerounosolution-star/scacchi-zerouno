/**
 * REVISIONE DELLA PARTITA
 *
 * Cliccando una mossa nella notazione la scacchiera mostra com'era la
 * posizione in quel momento. La partita vera non si tocca: la posizione
 * rivista vive in un secondo motore, costruito rigiocando le mosse dal
 * principio.
 *
 * Mentre si rivede non si puo' muovere. Si torna alla partita con Esc,
 * con il bottone "Torna alla partita" o cliccando l'ultima mossa.
 */

import { ZeroUnoChessEngine } from '../engine/chess-engine.js';
import { chess, state } from '../core/state.js';
import { renderBoard } from './board.js';
import { showToast } from '../core/utils.js';

/**
 * Ricostruisce la posizione dopo un certo numero di semimosse.
 *
 * @param {Array<object>} moves  Storia in forma verbosa.
 * @param {number} ply           Quante semimosse applicare.
 * @returns {ZeroUnoChessEngine|null} null se una mossa non si applica.
 */
function replayTo(moves, ply) {
    const replay = new ZeroUnoChessEngine();
    for (let i = 0; i < ply; i++) {
        const m = moves[i];
        const done = replay.move({ from: m.from, to: m.to, promotion: m.promotion });
        if (!done) return null;
    }
    return replay;
}

/** Vero quando stiamo guardando una posizione passata. */
export function isReviewing() {
    return state.review !== null;
}

/**
 * Mostra la posizione dopo `ply` semimosse.
 *
 * Chiedere l'ultima mossa, o una oltre la fine, riporta alla partita.
 *
 * @param {number} ply
 */
export function enterReview(ply) {
    const moves = chess.history({ verbose: true });

    if (!Number.isInteger(ply) || ply < 1 || ply >= moves.length) {
        exitReview();
        return;
    }

    /*
     * Le partite online partono da una posizione caricata, non dalla
     * casa di partenza: rigiocare la storia darebbe un'altra scacchiera.
     * Se la ricostruzione completa non coincide con la partita vera, la
     * revisione non e' affidabile e non si apre.
     */
    const full = replayTo(moves, moves.length);
    if (!full || full.fen() !== chess.fen()) {
        showToast('La revisione non e\' disponibile in questa partita.');
        return;
    }

    const game = replayTo(moves, ply);
    if (!game) {
        showToast('La revisione non e\' disponibile in questa partita.');
        return;
    }

    const lastApplied = moves[ply - 1];
    state.review = {
        ply,
        game,
        from: lastApplied.from,
        to: lastApplied.to
    };

    // Niente selezione a mezz'aria quando si torna indietro
    state.selectedSquare = null;
    state.legalMovesForSelected = [];

    renderBoard();
}

/** Torna alla posizione vera della partita. */
export function exitReview() {
    if (!state.review) return;
    state.review = null;
    renderBoard();
}

/** Attacca il bottone "Torna alla partita". */
export function setupReviewControls() {
    const button = document.getElementById('exitReviewBtn');
    if (!button || button.dataset.bound === '1') return;
    button.dataset.bound = '1';
    button.addEventListener('click', () => exitReview());
}
