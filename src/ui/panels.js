/**
 * PANNELLI DELL'INTERFACCIA
 *
 * Turno, notazione algebrica, materiale catturato, schede dei
 * giocatori e orologi.
 */

import { PIECE_SVGS } from '../data/pieces.js';
import { chess, state } from '../core/state.js';
import { canHumanControlCurrentTurn } from '../core/utils.js';
import { triggerEndOfGame } from './gameover.js';

export function updateStatusAndHistoryUI() {
    const headline = document.getElementById('gameStatusHeadline');
    const banner = document.getElementById('mouseInstructionBanner');
    const dot = document.getElementById('turnIndicatorDot');
    const selBadge = document.getElementById('selectedSquareIndicator');

    const turn = chess.turn();
    const turnLabel = turn === 'w' ? 'Bianco' : 'Nero';
    const humanTurn = canHumanControlCurrentTurn();

    if (state.selectedSquare) {
        selBadge.textContent = `Selezionato: ${state.selectedSquare.toUpperCase()} (${state.legalMovesForSelected.length} mosse)`;
    } else {
        selBadge.textContent = '';
    }

    if (!state.matchEnded) {
        if (chess.in_check()) {
            headline.textContent = `Scacco al Re! Turno del ${turnLabel}`;
            headline.className = 'font-serif text-2xl font-semibold text-rose-700';
        } else {
            headline.textContent = `Turno del ${turnLabel}`;
            headline.className = 'font-serif text-2xl font-semibold text-anthracite-900';
        }

        if (humanTurn) {
            dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0';
            banner.textContent = state.selectedSquare
                ? `Casa ${state.selectedSquare.toUpperCase()} selezionata — Clicca sulla casella evidenziata per muovere`
                : `Tocca a te (${turnLabel}) — Clicca o trascina un pezzo con il mouse`;
        } else {
            dot.className = 'w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0';
            banner.textContent = `L'avversario (${turnLabel}) sta pensando la mossa...`;
        }
    } else {
        dot.className = 'w-2.5 h-2.5 rounded-full bg-bronze-500 shrink-0';
        banner.textContent = 'Partita conclusa — Guarda il video ZeroUno o avvia una Nuova Partita';
    }

    // Cronologia mosse in notazione algebrica
    const history = chess.history();
    const countBadge = document.getElementById('moveCounterBadge');
    const emptyState = document.getElementById('moveHistoryEmpty');
    const table = document.getElementById('moveHistoryTable');
    const tbody = document.getElementById('moveHistoryBody');
    const container = document.getElementById('moveHistoryContainer');

    countBadge.textContent = `${history.length} ${history.length === 1 ? 'mossa' : 'mosse'}`;

    if (history.length === 0) {
        emptyState.classList.remove('hidden');
        table.classList.add('hidden');
        tbody.innerHTML = '';
    } else {
        emptyState.classList.add('hidden');
        table.classList.remove('hidden');
        tbody.innerHTML = '';

        for (let i = 0; i < history.length; i += 2) {
            const moveNum = Math.floor(i / 2) + 1;
            const whiteMove = history[i] || '';
            const blackMove = history[i + 1] || '';

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-ivory-100/70 transition';
            tr.innerHTML = `
                <td class="py-1.5 px-2 text-neutral-400 w-12">${moveNum}.</td>
                <td class="py-1.5 px-2 font-medium text-anthracite-900">${whiteMove}</td>
                <td class="py-1.5 px-2 font-medium text-neutral-700">${blackMove}</td>
            `;
            tbody.appendChild(tr);
        }
        container.scrollTop = container.scrollHeight;
    }
}

export function updateCapturedMaterialUI() {
    const historyVerbose = chess.history({ verbose: true });
    const capturedByWhite = []; // pezzi neri catturati dal bianco
    const capturedByBlack = []; // pezzi bianchi catturati dal nero

    historyVerbose.forEach(m => {
        if (m.captured) {
            if (m.color === 'w') capturedByWhite.push(m.captured);
            else capturedByBlack.push(m.captured);
        }
    });

    // Calcolo vantaggio materiale
    const vals = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    let whiteScore = 0;
    let blackScore = 0;
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (p) {
                if (p.color === 'w') whiteScore += vals[p.type] || 0;
                else blackScore += vals[p.type] || 0;
            }
        }
    }

    const bottomIsWhite = state.boardOrientation === 'w';
    const bottomCaptures = bottomIsWhite ? capturedByWhite : capturedByBlack;
    const topCaptures = bottomIsWhite ? capturedByBlack : capturedByWhite;
    const bottomPiecePrefix = bottomIsWhite ? 'b' : 'w';
    const topPiecePrefix = bottomIsWhite ? 'w' : 'b';

    const renderMiniPieces = (arr, prefix) =>
        arr.map(t => `<span class="w-4 h-4 inline-block">${PIECE_SVGS[prefix + t.toUpperCase()] || ''}</span>`).join('');

    document.getElementById('bottomCapturedPieces').innerHTML = renderMiniPieces(bottomCaptures, bottomPiecePrefix);
    document.getElementById('topCapturedPieces').innerHTML = renderMiniPieces(topCaptures, topPiecePrefix);

    const diff = whiteScore - blackScore;
    const bottomDiffEl = document.getElementById('bottomMaterialDiff');
    const topDiffEl = document.getElementById('topMaterialDiff');

    bottomDiffEl.textContent = '';
    topDiffEl.textContent = '';

    if (diff > 0) {
        if (bottomIsWhite) bottomDiffEl.textContent = `+${diff}`;
        else topDiffEl.textContent = `+${diff}`;
    } else if (diff < 0) {
        if (bottomIsWhite) topDiffEl.textContent = `+${Math.abs(diff)}`;
        else bottomDiffEl.textContent = `+${Math.abs(diff)}`;
    }
}

export function updatePlayerCardsUI(whiteName, blackName) {
    const bottomIsWhite = state.boardOrientation === 'w';

    const topAvatar = document.getElementById('topPlayerAvatar');
    const topName = document.getElementById('topPlayerName');
    const topBadge = document.getElementById('topPlayerBadge');

    const bottomAvatar = document.getElementById('bottomPlayerAvatar');
    const bottomName = document.getElementById('bottomPlayerName');
    const bottomBadge = document.getElementById('bottomPlayerBadge');

    if (bottomIsWhite) {
        bottomName.textContent = whiteName;
        bottomBadge.textContent = 'Bianco';
        bottomAvatar.textContent = 'B';
        bottomAvatar.className = 'w-9 h-9 rounded-lg bg-ivory-200 text-anthracite-900 border border-ivory-300 flex items-center justify-center font-serif font-semibold text-base shrink-0';

        topName.textContent = blackName;
        topBadge.textContent = 'Nero';
        topAvatar.textContent = 'N';
        topAvatar.className = 'w-9 h-9 rounded-lg bg-anthracite-900 text-ivory-50 flex items-center justify-center font-serif font-semibold text-base shrink-0';
    } else {
        bottomName.textContent = blackName;
        bottomBadge.textContent = 'Nero';
        bottomAvatar.textContent = 'N';
        bottomAvatar.className = 'w-9 h-9 rounded-lg bg-anthracite-900 text-ivory-50 flex items-center justify-center font-serif font-semibold text-base shrink-0';

        topName.textContent = whiteName;
        topBadge.textContent = 'Bianco';
        topAvatar.textContent = 'B';
        topAvatar.className = 'w-9 h-9 rounded-lg bg-ivory-200 text-anthracite-900 border border-ivory-300 flex items-center justify-center font-serif font-semibold text-base shrink-0';
    }
}

export function formatSeconds(sec) {
    const m = Math.floor(Math.max(0, sec) / 60);
    const s = Math.max(0, sec) % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function startMatchTimers() {
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.whiteTimeSeconds = 600;
    state.blackTimeSeconds = 600;
    renderTimersUI();

    state.timerInterval = setInterval(() => {
        if (state.matchEnded) return;
        if (chess.history().length === 0) return; // Il timer parte dopo la prima mossa

        if (chess.turn() === 'w') {
            state.whiteTimeSeconds--;
            if (state.whiteTimeSeconds <= 0) {
                triggerEndOfGame('Tempo Scaduto — Vittoria del Nero', 'Il tempo a disposizione del Bianco è terminato');
            }
        } else {
            state.blackTimeSeconds--;
            if (state.blackTimeSeconds <= 0) {
                triggerEndOfGame('Tempo Scaduto — Vittoria del Bianco', 'Il tempo a disposizione del Nero è terminato');
            }
        }
        renderTimersUI();
    }, 1000);
}

export function renderTimersUI() {
    const bottomIsWhite = state.boardOrientation === 'w';
    const bottomTimerEl = document.getElementById('bottomTimerBox');
    const topTimerEl = document.getElementById('topTimerBox');

    bottomTimerEl.textContent = formatSeconds(bottomIsWhite ? state.whiteTimeSeconds : state.blackTimeSeconds);
    topTimerEl.textContent = formatSeconds(bottomIsWhite ? state.blackTimeSeconds : state.whiteTimeSeconds);
}
