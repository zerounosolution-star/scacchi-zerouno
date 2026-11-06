/**
 * COSTRUZIONE E DISEGNO DELLA SCACCHIERA
 *
 * Le 64 caselle si creano una volta sola (initPersistentBoardDOM) e
 * poi si aggiornano soltanto i contenuti (renderBoard).
 */

import { FILES, RANKS } from '../engine/chess-engine.js';
import { PIECE_SVGS } from '../data/pieces.js';
import { chess, squareElementsMap, dragState, state } from '../core/state.js';
import { canHumanControlCurrentTurn } from '../core/utils.js';
import { setupDesktopMouseAndTouchHandlers } from './input.js';
import { setupKeyboardPlay } from './keyboard.js';
import { updateStatusAndHistoryUI, updateCapturedMaterialUI } from './panels.js';

export function initPersistentBoardDOM() {
    const boardEl = document.getElementById('chessboard');
    boardEl.innerHTML = '';
    squareElementsMap.clear();

    for (let visualRow = 0; visualRow < 8; visualRow++) {
        for (let visualCol = 0; visualCol < 8; visualCol++) {
            const sqDiv = document.createElement('div');
            sqDiv.className = 'square';
            sqDiv.dataset.vrow = visualRow;
            sqDiv.dataset.vcol = visualCol;

            // Accessibilita': ogni casella e' una cella raggiungibile da
            // tastiera e annunciata dai lettori di schermo. Una sola
            // casella per volta entra nel giro di Tab (roving tabindex).
            sqDiv.setAttribute('role', 'gridcell');
            sqDiv.tabIndex = -1;

            sqDiv.innerHTML = `
                <span class="coord-rank"></span>
                <span class="coord-file"></span>
                <div class="piece-layer"></div>
                <div class="move-dot"></div>
                <div class="capture-ring"></div>
            `;

            boardEl.appendChild(sqDiv);
            squareElementsMap.set(`${visualRow}-${visualCol}`, sqDiv);
        }
    }

    boardEl.setAttribute('role', 'grid');
    boardEl.setAttribute('aria-label', 'Scacchiera. Usa le frecce per spostarti, Invio per selezionare e muovere.');

    setupDesktopMouseAndTouchHandlers();
    setupKeyboardPlay();
}

/** Nomi dei pezzi per i lettori di schermo. */
const PIECE_NAMES = { p: 'pedone', n: 'cavallo', b: 'alfiere', r: 'torre', q: 'donna', k: 're' };

/**
 * Descrizione parlata di una casella, per esempio
 * "e4, pedone bianco" oppure "d5, vuota, mossa possibile".
 */
function describeSquare(squareName, piece, isLegalTarget) {
    const parts = [squareName.toUpperCase()];

    if (piece) {
        parts.push(`${PIECE_NAMES[piece.type]} ${piece.color === 'w' ? 'bianco' : 'nero'}`);
    } else {
        parts.push('vuota');
    }

    if (isLegalTarget) parts.push(piece ? 'cattura possibile' : 'mossa possibile');

    return parts.join(', ');
}

/* Calcola la casella (es. 'e4') direttamente dalle coordinate geometriche (clientX, clientY) */
export function getSquareFromClientCoords(clientX, clientY) {
    const boardEl = document.getElementById('chessboard');
    if (!boardEl) return null;
    const rect = boardEl.getBoundingClientRect();
    if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
    ) {
        return null;
    }

    const relX = clientX - rect.left;
    const relY = clientY - rect.top;
    const vCol = Math.min(7, Math.max(0, Math.floor((relX / rect.width) * 8)));
    const vRow = Math.min(7, Math.max(0, Math.floor((relY / rect.height) * 8)));

    const isFlipped = state.boardOrientation === 'b';
    const displayRanks = isFlipped ? [...RANKS].reverse() : RANKS;
    const displayFiles = isFlipped ? [...FILES].reverse() : FILES;

    return `${displayFiles[vCol]}${displayRanks[vRow]}`;
}

export function renderBoard() {
    const boardState = chess.board();
    const isFlipped = state.boardOrientation === 'b';
    const displayRanks = isFlipped ? [...RANKS].reverse() : RANKS;
    const displayFiles = isFlipped ? [...FILES].reverse() : FILES;

    const inCheck = chess.in_check();
    const turnColor = chess.turn();
    const humanCanMove = canHumanControlCurrentTurn();

    for (let vRow = 0; vRow < 8; vRow++) {
        for (let vCol = 0; vCol < 8; vCol++) {
            const sqDiv = squareElementsMap.get(`${vRow}-${vCol}`);
            if (!sqDiv) continue;

            const rankChar = displayRanks[vRow];
            const fileChar = displayFiles[vCol];
            const squareName = `${fileChar}${rankChar}`;
            sqDiv.dataset.square = squareName;

            const boardRow = 8 - parseInt(rankChar, 10);
            const boardCol = FILES.indexOf(fileChar);
            const piece = boardState[boardRow][boardCol];

            const isLight = (boardRow + boardCol) % 2 === 0;

            // Costruisci le classi senza mai distruggere il nodo DOM
            const classList = ['square', isLight ? 'light' : 'dark'];

            if (state.selectedSquare === squareName) {
                classList.push('selected');
            } else if (state.lastMoveSquares.from === squareName || state.lastMoveSquares.to === squareName) {
                classList.push('last-move');
            }

            if (inCheck && piece && piece.type === 'k' && piece.color === turnColor) {
                classList.push('in-check');
            }

            if (humanCanMove && piece && piece.color === turnColor) {
                classList.push('playable-piece');
            }

            if (dragState.isDraggingVisual && dragState.sourceSq === squareName) {
                classList.push('dragging-source');
            }

            if (dragState.isDraggingVisual && dragState.hoveredSq === squareName) {
                classList.push('drag-hover');
            }

            const legalMove = state.legalMovesForSelected.find(m => m.to === squareName);
            if (legalMove) {
                if (piece || legalMove.flags === 'e') {
                    classList.push('valid-capture');
                } else {
                    classList.push('valid-move');
                }
            }

            // Il fuoco della tastiera non si perde quando la scacchiera si ridisegna
            if (sqDiv.classList.contains('keyboard-focus')) classList.push('keyboard-focus');

            sqDiv.className = classList.join(' ');

            sqDiv.setAttribute('aria-label', describeSquare(squareName, piece, Boolean(legalMove)));
            sqDiv.setAttribute('aria-selected', state.selectedSquare === squareName ? 'true' : 'false');

            // Aggiorna coordinate solo sui bordi
            const rankSpan = sqDiv.querySelector('.coord-rank');
            const fileSpan = sqDiv.querySelector('.coord-file');
            rankSpan.textContent = vCol === 0 ? rankChar : '';
            fileSpan.textContent = vRow === 7 ? fileChar : '';

            // Aggiorna SVG pezzo solo se cambiato
            const pieceLayer = sqDiv.querySelector('.piece-layer');
            const newPieceKey = piece ? `${piece.color}${piece.type.toUpperCase()}` : '';
            if (pieceLayer.dataset.pieceKey !== newPieceKey) {
                pieceLayer.dataset.pieceKey = newPieceKey;
                pieceLayer.innerHTML = newPieceKey ? (PIECE_SVGS[newPieceKey] || '') : '';
            }
        }
    }

    updateStatusAndHistoryUI();
    updateCapturedMaterialUI();
}
