/**
 * DA CHE PARTE SI GUARDA LA SCACCHIERA
 *
 * Un posto solo che gira la scacchiera: lo usano il bottone «Ruota» e la
 * rotazione automatica della partita in due. Girare vuol dire tre cose
 * insieme: i pezzi, le due fasce dei giocatori, i due orologi.
 *
 * QUANDO girare lo decide src/game/autoflip.js, che non tocca la pagina
 * e si prova fuori dal browser.
 */

import { chess, state, dragState } from '../core/state.js';
import { renderBoard } from './board.js';
import { updatePlayerCardsUI, renderTimersUI } from './panels.js';
import { orientationForLocalTurn } from '../game/autoflip.js';

/** La scelta resta tra una visita e l'altra. '0' = spenta. */
const STORAGE_KEY = 'zerouno_gira_da_sola';

/**
 * Attesa prima di girare: chi ha mosso deve vedere il pezzo arrivare
 * dal proprio lato, poi la scacchiera passa all'altro.
 */
const FLIP_DELAY_MS = 550;

let pendingFlip = null;

/**
 * Mette in basso il colore indicato.
 *
 * I nomi dei due giocatori si leggono dalle fasce: sono gia' a schermo,
 * e cosi' la funzione vale per ogni modalita' senza sapere chi gioca.
 *
 * @param {'w'|'b'} next
 */
export function setBoardOrientation(next) {
    if (next !== 'w' && next !== 'b') return;
    if (state.boardOrientation === next) return;

    const top = document.getElementById('topPlayerName');
    const bottom = document.getElementById('bottomPlayerName');
    if (!top || !bottom) return;

    const bottomWasWhite = state.boardOrientation === 'w';
    const whiteName = bottomWasWhite ? bottom.textContent : top.textContent;
    const blackName = bottomWasWhite ? top.textContent : bottom.textContent;

    state.boardOrientation = next;
    updatePlayerCardsUI(whiteName, blackName);
    renderTimersUI();
    renderBoard();
}

/** Il bottone «Ruota»: l'altro lato, subito. */
export function flipBoard() {
    setBoardOrientation(state.boardOrientation === 'w' ? 'b' : 'w');
}

/** Vero se qualcuno ha gia' un pezzo in mano o una scelta aperta. */
function isBusy() {
    return Boolean(
        dragState.active
        || state.selectedSquare
        || state.pendingPromotionMove
        || state.review
    );
}

/** In due sullo stesso schermo: la scacchiera guarda chi deve muovere, adesso. */
export function alignLocalBoardNow() {
    const next = orientationForLocalTurn({
        gameMode: state.gameMode,
        autoFlip: state.localAutoFlip,
        turn: chess.turn(),
        matchEnded: state.matchEnded,
        busy: isBusy()
    });
    if (next) setBoardOrientation(next);
}

/** Dopo una mossa: si lascia vedere il pezzo che arriva, poi si gira. */
export function scheduleLocalAutoFlip() {
    if (pendingFlip) {
        clearTimeout(pendingFlip);
        pendingFlip = null;
    }
    if (state.gameMode !== 'local' || !state.localAutoFlip) return;

    pendingFlip = setTimeout(() => {
        pendingFlip = null;
        // La situazione si rilegge qui: nel frattempo puo' essere cambiato tutto
        alignLocalBoardNow();
    }, FLIP_DELAY_MS);
}

function readSaved() {
    try {
        return localStorage.getItem(STORAGE_KEY) !== '0';
    } catch (err) {
        return true;
    }
}

function writeSaved(accesa) {
    try {
        if (accesa) localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, '0');
    } catch (err) {
        // Senza memoria locale la scelta vale solo per questa visita
    }
}

/** Collega la spunta «Gira la scacchiera a ogni mossa». */
export function setupAutoFlipToggle() {
    state.localAutoFlip = readSaved();

    const toggle = document.getElementById('localAutoFlipToggle');
    if (!toggle) return;
    toggle.checked = state.localAutoFlip;

    toggle.addEventListener('change', () => {
        state.localAutoFlip = toggle.checked;
        writeSaved(state.localAutoFlip);
        // Riaccesa a partita in corso: la scacchiera si mette subito a posto
        if (state.localAutoFlip) alignLocalBoardNow();
    });
}
