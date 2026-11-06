/**
 * INTERAZIONE: CLICK, TRASCINAMENTO E TOCCO
 *
 * Gestisce la selezione dei pezzi, il drag & drop con il mouse su
 * desktop, il tocco su mobile, la finestra di promozione e
 * l'esecuzione effettiva di una mossa.
 */

import { PIECE_SVGS } from '../data/pieces.js';
import { chess, dragState, state } from '../core/state.js';
import { playChessSound } from '../core/sound.js';
import { showToast, canHumanControlCurrentTurn } from '../core/utils.js';
import { getSquareFromClientCoords, renderBoard } from './board.js';
import { makeAiMove } from '../engine/ai.js';
import { saveMatch } from '../core/persistence.js';
import { checkAndHandleGameOver } from './gameover.js';
import { syncOnlineMove } from '../online/firestore.js';

export function setupDesktopMouseAndTouchHandlers() {
    const boardEl = document.getElementById('chessboard');
    const floatingEl = document.getElementById('floatingDragPiece');

    // MOUSE DOWN SU DESKTOP
    boardEl.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Solo tasto sinistro del mouse
        e.preventDefault(); // Impedisce selezione testo o drag nativo del browser

        const sq = getSquareFromClientCoords(e.clientX, e.clientY);
        if (!sq) return;

        handlePointerDownOnSquare(sq, e.clientX, e.clientY);
    });

    // MOUSE MOVE GLOBALE (per Drag & Drop fluido)
    window.addEventListener('mousemove', (e) => {
        if (!dragState.active) return;

        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;
        const dist = Math.hypot(dx, dy);

        if (!dragState.isDraggingVisual && dist > 4) {
            dragState.isDraggingVisual = true;
            floatingEl.innerHTML = PIECE_SVGS[dragState.pieceKey] || '';
            floatingEl.style.display = 'block';
            renderBoard();
        }

        if (dragState.isDraggingVisual) {
            floatingEl.style.left = `${e.clientX}px`;
            floatingEl.style.top = `${e.clientY}px`;

            const overSq = getSquareFromClientCoords(e.clientX, e.clientY);
            if (overSq !== dragState.hoveredSq) {
                dragState.hoveredSq = overSq;
                renderBoard();
            }
        }
    });

    // MOUSE UP GLOBALE (completa il Drag & Drop o mantiene la selezione per il Click-to-Move)
    window.addEventListener('mouseup', (e) => {
        if (!dragState.active) return;

        const targetSq = getSquareFromClientCoords(e.clientX, e.clientY);
        const wasDragging = dragState.isDraggingVisual;
        const sourceSq = dragState.sourceSq;

        // Reset stato drag visivo
        dragState.active = false;
        dragState.isDraggingVisual = false;
        dragState.sourceSq = null;
        dragState.pieceKey = null;
        dragState.hoveredSq = null;
        floatingEl.style.display = 'none';
        floatingEl.innerHTML = '';

        if (wasDragging && targetSq && targetSq !== sourceSq) {
            const moveCandidate = state.legalMovesForSelected.find(m => m.to === targetSq);
            if (moveCandidate) {
                triggerMoveOrPromotion(sourceSq, targetSq, moveCandidate);
                return;
            }
        }

        renderBoard();
    });

    // SUPPORTO TOUCH PER TABLET & MOBILE
    boardEl.addEventListener('touchstart', (e) => {
        if (!e.touches || e.touches.length === 0) return;
        const touch = e.touches[0];
        const sq = getSquareFromClientCoords(touch.clientX, touch.clientY);
        if (!sq) return;
        e.preventDefault();
        handlePointerDownOnSquare(sq, touch.clientX, touch.clientY);
    }, { passive: false });

    boardEl.addEventListener('touchmove', (e) => {
        if (!dragState.active || !e.touches || e.touches.length === 0) return;
        const touch = e.touches[0];
        const dx = touch.clientX - dragState.startX;
        const dy = touch.clientY - dragState.startY;
        if (!dragState.isDraggingVisual && Math.hypot(dx, dy) > 6) {
            dragState.isDraggingVisual = true;
            floatingEl.innerHTML = PIECE_SVGS[dragState.pieceKey] || '';
            floatingEl.style.display = 'block';
        }
        if (dragState.isDraggingVisual) {
            floatingEl.style.left = `${touch.clientX}px`;
            floatingEl.style.top = `${touch.clientY}px`;
            const overSq = getSquareFromClientCoords(touch.clientX, touch.clientY);
            if (overSq !== dragState.hoveredSq) {
                dragState.hoveredSq = overSq;
                renderBoard();
            }
        }
    }, { passive: false });

    boardEl.addEventListener('touchend', (e) => {
        if (!dragState.active) return;
        const touch = e.changedTouches && e.changedTouches[0];
        const targetSq = touch ? getSquareFromClientCoords(touch.clientX, touch.clientY) : null;
        const wasDragging = dragState.isDraggingVisual;
        const sourceSq = dragState.sourceSq;

        dragState.active = false;
        dragState.isDraggingVisual = false;
        dragState.sourceSq = null;
        dragState.pieceKey = null;
        dragState.hoveredSq = null;
        floatingEl.style.display = 'none';
        floatingEl.innerHTML = '';

        if (wasDragging && targetSq && targetSq !== sourceSq) {
            const moveCandidate = state.legalMovesForSelected.find(m => m.to === targetSq);
            if (moveCandidate) {
                triggerMoveOrPromotion(sourceSq, targetSq, moveCandidate);
                return;
            }
        }
        renderBoard();
    });
}

export function handlePointerDownOnSquare(squareName, clientX, clientY) {
    if (state.review) {
        showToast('Stai rivedendo una mossa precedente. Torna alla partita per muovere.');
        return;
    }

    if (state.matchEnded) {
        showToast("La partita è conclusa. Clicca 'Nuova Partita' per giocare ancora.");
        return;
    }

    if (!canHumanControlCurrentTurn()) {
        showToast("Attendi la mossa dell'avversario...");
        return;
    }

    const currentTurn = chess.turn();

    // 1. Se c'è già un pezzo selezionato e l'utente clicca su una casella di destinazione valida -> Muovi subito!
    if (state.selectedSquare) {
        const targetMove = state.legalMovesForSelected.find(m => m.to === squareName);
        if (targetMove) {
            triggerMoveOrPromotion(state.selectedSquare, squareName, targetMove);
            return;
        }
    }

    // 2. Se l'utente clicca su un proprio pezzo -> Selezionalo, mostra le mosse valide e prepara eventuale Drag & Drop
    const pieceOnSquare = chess.get(squareName);
    if (pieceOnSquare && pieceOnSquare.color === currentTurn) {
        state.selectedSquare = squareName;
        state.legalMovesForSelected = chess.moves({ square: squareName, verbose: true });

        dragState.active = true;
        dragState.isDraggingVisual = false;
        dragState.sourceSq = squareName;
        dragState.pieceKey = `${pieceOnSquare.color}${pieceOnSquare.type.toUpperCase()}`;
        dragState.startX = clientX;
        dragState.startY = clientY;
        dragState.hoveredSq = squareName;

        renderBoard();
    } else {
        // Clic su una casella vuota non valida o pezzo avversario non catturabile
        state.selectedSquare = null;
        state.legalMovesForSelected = [];
        renderBoard();
    }
}

export function triggerMoveOrPromotion(fromSq, toSq, moveObj) {
    if (moveObj.flags && moveObj.flags.includes('p')) {
        openPromotionModal(fromSq, toSq, chess.turn());
        return;
    }
    executeMove(fromSq, toSq, 'q');
}

export function openPromotionModal(fromSq, toSq, color) {
    state.pendingPromotionMove = { from: fromSq, to: toSq };
    const overlay = document.getElementById('promotionOverlay');
    const choicesContainer = document.getElementById('promotionChoices');
    choicesContainer.innerHTML = '';

    const pieces = [
        { code: 'q', name: 'Regina' },
        { code: 'r', name: 'Torre' },
        { code: 'b', name: 'Alfiere' },
        { code: 'n', name: 'Cavallo' }
    ];

    pieces.forEach(p => {
        const svgKey = `${color}${p.code.toUpperCase()}`;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'zu-promo-btn';
        btn.innerHTML = `
            <span class="zu-promo-piece">${PIECE_SVGS[svgKey]}</span>
            <span class="zu-promo-label">${p.name}</span>
        `;
        btn.addEventListener('click', () => {
            overlay.classList.add('hidden');
            if (state.pendingPromotionMove) {
                executeMove(state.pendingPromotionMove.from, state.pendingPromotionMove.to, p.code);
                state.pendingPromotionMove = null;
            }
        });
        choicesContainer.appendChild(btn);
    });

    overlay.classList.remove('hidden');
}

export async function executeMove(fromSq, toSq, promotionPiece = 'q') {
    const moveObj = chess.move({
        from: fromSq,
        to: toSq,
        promotion: promotionPiece
    });

    if (!moveObj) return;

    state.selectedSquare = null;
    state.legalMovesForSelected = [];
    state.lastMoveSquares = { from: moveObj.from, to: moveObj.to };

    if (chess.in_check()) {
        playChessSound('check');
    } else if (moveObj.captured) {
        playChessSound('capture');
    } else {
        playChessSound('move');
    }

    renderBoard();

    // Se siamo in modalità Online Firebase, sincronizziamo la mossa
    if (state.gameMode === 'online' && state.currentMatchId && state.currentUser && state.db) {
        await syncOnlineMove(moveObj);
    }

    // Controllo fine partita (Scacco Matto, Stallo, Patta)
    if (checkAndHandleGameOver()) {
        return;
    }

    // La partita in corso resta nella memoria del browser
    saveMatch();

    // Se siamo contro AI o contro uno Sfidante Internazionale simulato ed è il suo turno
    if ((state.gameMode === 'ai' || state.gameMode === 'world-challenger') && chess.turn() !== state.playerColor && !state.matchEnded) {
        setTimeout(() => makeAiMove(), 380);
    }
}
