/**
 * PANNELLI DELL'INTERFACCIA
 *
 * Turno, notazione algebrica, materiale catturato, schede dei
 * giocatori e orologi.
 */

import { PIECE_SVGS } from '../data/pieces.js';
import { TIME_CONTROLS, timeControlById } from '../config/app.config.js';
import { chess, state } from '../core/state.js';
import { canHumanControlCurrentTurn } from '../core/utils.js';
import { triggerEndOfGame } from './gameover.js';
import { enterReview } from './review.js';

/**
 * Scrive un testo solo se e' davvero cambiato.
 *
 * #gameStatusHeadline e' una regione aria-live: riscriverlo identico a
 * ogni ridisegno (anche a ogni casella sorvolata durante un
 * trascinamento) farebbe ripetere l'annuncio al lettore di schermo.
 *
 * @param {HTMLElement|null} el
 * @param {string} text
 */
function setText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
}

/**
 * Un clic sulla notazione riporta la scacchiera a quella mossa.
 * L'ascoltatore sta sul corpo della tabella e non sulle singole righe:
 * le righe si rifanno a ogni mossa, il corpo no.
 */
function bindMoveHistoryClicks(tbody) {
    if (!tbody || tbody.dataset.bound === '1') return;
    tbody.dataset.bound = '1';
    tbody.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-ply]');
        if (!button) return;
        enterReview(Number(button.dataset.ply));
    });
}

/** Una casella della notazione: la mossa e' un bottone, quindi raggiungibile da tastiera. */
function moveCellHtml(san, ply, side, lastPly, reviewPly) {
    if (!san) return '<td class="zu-move-cell"></td>';

    const classes = ['zu-move'];
    if (ply === lastPly) classes.push('is-last');
    if (ply === reviewPly) classes.push('is-reviewing');

    const label = side === 'w' ? 'Bianco' : 'Nero';
    const numero = Math.ceil(ply / 2);

    return `<td class="zu-move-cell"><button type="button" class="${classes.join(' ')}" `
        + `data-ply="${ply}" data-side="${side}" `
        + `aria-label="Mossa ${numero} del ${label}: ${san}. Rivedi questa posizione">${san}</button></td>`;
}

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
            setText(headline, `Scacco al Re! Turno del ${turnLabel}`);
            headline.dataset.state = 'check';
        } else {
            setText(headline, `Turno del ${turnLabel}`);
            headline.dataset.state = 'turn';
        }

        if (state.review) {
            dot.dataset.state = 'review';
            setText(banner, `Stai rivedendo la mossa ${Math.ceil(state.review.ply / 2)}`
                + ' — premi Esc o "Torna alla partita" per continuare');
        } else if (humanTurn) {
            dot.dataset.state = 'you';
            // Il titolo qui sopra dice gia' di chi e' il turno: qui solo l'istruzione
            setText(banner, state.selectedSquare
                ? `Casa ${state.selectedSquare.toUpperCase()} selezionata — Clicca sulla casella evidenziata per muovere`
                : 'Clicca o trascina un pezzo, oppure usa le frecce e Invio');
        } else {
            dot.dataset.state = 'waiting';
            setText(banner, `L'avversario (${turnLabel}) sta pensando la mossa...`);
        }
    } else {
        dot.dataset.state = 'over';
        setText(banner, 'Partita conclusa — Guarda il video ZeroUno o avvia una Nuova Partita');
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
        bindMoveHistoryClicks(tbody);

        const lastPly = history.length;
        const reviewPly = state.review ? state.review.ply : null;

        for (let i = 0; i < history.length; i += 2) {
            const moveNum = Math.floor(i / 2) + 1;

            const tr = document.createElement('tr');
            tr.className = 'zu-move-row';
            tr.innerHTML = `<td class="zu-move-number">${moveNum}.</td>`
                + moveCellHtml(history[i], i + 1, 'w', lastPly, reviewPly)
                + moveCellHtml(history[i + 1], i + 2, 'b', lastPly, reviewPly);
            tbody.appendChild(tr);
        }

        /*
         * Durante la revisione la lista non scorre da sola: si resta
         * dove si sta guardando.
         */
        if (!state.review) container.scrollTop = container.scrollHeight;
    }

    const exitReviewBtn = document.getElementById('exitReviewBtn');
    if (exitReviewBtn) exitReviewBtn.classList.toggle('hidden', !state.review);

    // L'orologio in corsa cambia a ogni mossa, non solo allo scoccare del secondo
    renderTimersUI();
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
        bottomAvatar.dataset.color = 'w';

        topName.textContent = blackName;
        topBadge.textContent = 'Nero';
        topAvatar.textContent = 'N';
        topAvatar.dataset.color = 'b';
    } else {
        bottomName.textContent = blackName;
        bottomBadge.textContent = 'Nero';
        bottomAvatar.textContent = 'N';
        bottomAvatar.dataset.color = 'b';

        topName.textContent = whiteName;
        topBadge.textContent = 'Bianco';
        topAvatar.textContent = 'B';
        topAvatar.dataset.color = 'w';
    }
}

export function formatSeconds(sec) {
    const m = Math.floor(Math.max(0, sec) / 60);
    const s = Math.max(0, sec) % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Il tempo di gioco scelto per questa partita. */
export function activeTimeControl() {
    return timeControlById(state.timeControlId);
}

/**
 * Incremento Fischer: chi ha appena mosso si riprende i secondi previsti.
 *
 * @param {string} colorThatMoved  'w' oppure 'b'.
 */
export function applyClockIncrement(colorThatMoved) {
    const increment = activeTimeControl().incrementSeconds;
    if (!increment || state.matchEnded) return;

    if (colorThatMoved === 'w') state.whiteTimeSeconds += increment;
    else state.blackTimeSeconds += increment;

    renderTimersUI();
}

/**
 * Riempie i menu del tempo di gioco e li tiene allineati fra loro.
 * Le voci nascono da TIME_CONTROLS: l'elenco sta in un posto solo.
 */
export function setupTimeControlSelects() {
    const selects = [...document.querySelectorAll('[data-time-control]')];

    selects.forEach((select) => {
        select.innerHTML = TIME_CONTROLS
            .map((c) => `<option value="${c.id}">${c.label}</option>`)
            .join('');

        select.addEventListener('change', () => {
            state.timeControlId = select.value;
            syncTimeControlSelects();
        });
    });

    syncTimeControlSelects();
}

/** Riporta i menu sul tempo di gioco scelto (sono piu' di uno). */
export function syncTimeControlSelects() {
    document.querySelectorAll('[data-time-control]').forEach((select) => {
        select.value = state.timeControlId;
    });
}

export function startMatchTimers() {
    if (state.timerInterval) clearInterval(state.timerInterval);
    const control = activeTimeControl();
    state.whiteTimeSeconds = control.seconds;
    state.blackTimeSeconds = control.seconds;
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

/** Sotto questa soglia l'orologio segnala che il tempo sta finendo. */
const LOW_TIME_SECONDS = 30;

export function renderTimersUI() {
    const bottomIsWhite = state.boardOrientation === 'w';
    const bottomTimerEl = document.getElementById('bottomTimerBox');
    const topTimerEl = document.getElementById('topTimerBox');
    if (!bottomTimerEl || !topTimerEl) return;

    const bottomSeconds = bottomIsWhite ? state.whiteTimeSeconds : state.blackTimeSeconds;
    const topSeconds = bottomIsWhite ? state.blackTimeSeconds : state.whiteTimeSeconds;

    bottomTimerEl.textContent = formatSeconds(bottomSeconds);
    topTimerEl.textContent = formatSeconds(topSeconds);

    /*
     * Quale dei due orologi sta scorrendo: senza questo i due riquadri
     * sono identici ed e' l'unico dato della partita che non si legge a
     * colpo d'occhio. Il disegno dei due stati sta in styles.css.
     */
    const bottomColor = bottomIsWhite ? 'w' : 'b';
    const bottomIsRunning = !state.matchEnded && chess.turn() === bottomColor;

    bottomTimerEl.dataset.active = bottomIsRunning ? '1' : '';
    topTimerEl.dataset.active = (!state.matchEnded && !bottomIsRunning) ? '1' : '';

    bottomTimerEl.dataset.low = bottomSeconds <= LOW_TIME_SECONDS ? '1' : '';
    topTimerEl.dataset.low = topSeconds <= LOW_TIME_SECONDS ? '1' : '';
}
