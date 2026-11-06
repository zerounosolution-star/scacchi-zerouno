/**
 * GIOCO DA TASTIERA
 *
 * Si gioca una partita intera senza mouse e senza tocco:
 *
 *   Tab            porta il fuoco sulla scacchiera
 *   frecce         spostano la casella attiva
 *   Invio / Spazio selezionano un pezzo, poi muovono
 *   Esc            annullano la selezione
 *   Home / Fine    prima e ultima colonna della traversa
 *
 * Serve a chi non usa il mouse e a chi naviga con un lettore di schermo,
 * che legge il nome della casella e il pezzo che ci sta sopra.
 */

import { squareElementsMap, dragState, state } from '../core/state.js';
import { handlePointerDownOnSquare } from './input.js';
import { renderBoard } from './board.js';
import { exitReview } from './review.js';

/** Casella che ha il fuoco della tastiera, per esempio 'e2'. */
let focusedSquare = null;

/**
 * Nome della casella in una certa posizione visiva.
 * Tiene conto della rotazione della scacchiera.
 */
function squareAtVisual(vRow, vCol) {
    const el = squareElementsMap.get(`${vRow}-${vCol}`);
    return el ? el.dataset.square || null : null;
}

/** Posizione visiva di una casella, o null se non e' sulla scacchiera. */
function visualOf(squareName) {
    for (const [key, el] of squareElementsMap) {
        if (el.dataset.square === squareName) {
            const [vRow, vCol] = key.split('-').map(Number);
            return { vRow, vCol };
        }
    }
    return null;
}

/**
 * Sposta il fuoco su una casella e lo dichiara al browser.
 * Usa il "roving tabindex": una sola casella alla volta e' raggiungibile
 * con Tab, le altre restano fuori dal giro.
 */
export function focusSquare(squareName) {
    if (!squareName) return;

    focusedSquare = squareName;

    for (const el of squareElementsMap.values()) {
        const isFocused = el.dataset.square === squareName;
        el.tabIndex = isFocused ? 0 : -1;
        el.classList.toggle('keyboard-focus', isFocused);
        if (isFocused) el.focus({ preventScroll: false });
    }
}

/** Seleziona o muove, come farebbe un click, ma senza armare il trascinamento. */
function activateSquare(squareName) {
    handlePointerDownOnSquare(squareName, 0, 0);
    dragState.active = false;
    dragState.isDraggingVisual = false;
    renderBoard();
    focusSquare(squareName);
}

/**
 * Gestisce un tasto premuto sulla scacchiera.
 * @returns {boolean} true se il tasto e' stato usato.
 */
function handleKey(event) {
    /*
     * La casella attiva si legge dal documento, non da una variabile:
     * l'evento focusin non arriva sempre (per esempio quando la finestra
     * non ha il fuoco) e la variabile resterebbe indietro.
     */
    const active = document.activeElement;
    const activeSquare = active && active.dataset ? active.dataset.square : null;

    const current = activeSquare
        || focusedSquare
        || state.selectedSquare
        || squareAtVisual(6, 4);

    const position = visualOf(current);
    if (!position) return false;

    let { vRow, vCol } = position;

    switch (event.key) {
        case 'ArrowUp': vRow = Math.max(0, vRow - 1); break;
        case 'ArrowDown': vRow = Math.min(7, vRow + 1); break;
        case 'ArrowLeft': vCol = Math.max(0, vCol - 1); break;
        case 'ArrowRight': vCol = Math.min(7, vCol + 1); break;
        case 'Home': vCol = 0; break;
        case 'End': vCol = 7; break;
        case 'Enter':
        case ' ':
            activateSquare(current);
            return true;
        case 'Escape':
            // Prima si esce dalla revisione, poi si annulla la selezione
            if (state.review) {
                exitReview();
                focusSquare(current);
                return true;
            }
            state.selectedSquare = null;
            state.legalMovesForSelected = [];
            renderBoard();
            focusSquare(current);
            return true;
        default:
            return false;
    }

    focusSquare(squareAtVisual(vRow, vCol));
    return true;
}

/**
 * Attiva il gioco da tastiera. Si chiama una volta sola, dopo che le
 * caselle esistono nel DOM.
 */
export function setupKeyboardPlay() {
    const boardEl = document.getElementById('chessboard');
    if (!boardEl) return;

    boardEl.addEventListener('keydown', (event) => {
        if (handleKey(event)) {
            // Le frecce non devono anche far scorrere la pagina
            event.preventDefault();
        }
    });

    // Il primo Tab sulla scacchiera parte da una casella sensata
    boardEl.addEventListener('focusin', (event) => {
        const square = event.target && event.target.dataset ? event.target.dataset.square : null;
        if (square) focusedSquare = square;
        else if (!focusedSquare) focusSquare(state.lastMoveSquares.to || squareAtVisual(6, 4));
    });
}

/** La casella che ha il fuoco, o null. */
export function getFocusedSquare() {
    return focusedSquare;
}
