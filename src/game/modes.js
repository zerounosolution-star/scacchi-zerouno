/**
 * MODALITA' DI GIOCO
 *
 * Avvio di una nuova partita contro l'AI, in due sullo stesso
 * dispositivo, o contro uno sfidante internazionale.
 */

import { WORLD_CHALLENGERS } from '../data/challengers.js';
import { chess, state } from '../core/state.js';
import { showToast, getPlayerNickname } from '../core/utils.js';
import { renderBoard } from '../ui/board.js';
import { makeAiMove } from '../engine/ai.js';
import { updatePlayerCardsUI, startMatchTimers, renderTimersUI, syncTimeControlSelects } from '../ui/panels.js';
import { timeControlById } from '../config/app.config.js';
import { cleanupActiveOnlineMatch } from '../online/firestore.js';
import { readSavedMatch, replayMoves, clearSavedMatch } from '../core/persistence.js';
import { exitReview } from '../ui/review.js';

export function startNewAiGame() {
    cleanupActiveOnlineMatch();
    clearSavedMatch();
    state.gameMode = 'ai';
    state.matchEnded = false;
    exitReview();
    chess.reset();
    state.selectedSquare = null;
    state.legalMovesForSelected = [];
    state.lastMoveSquares = { from: null, to: null };

    state.aiDifficulty = parseInt(document.getElementById('aiDifficultySelect').value, 10) || 2;
    const colorChoice = document.getElementById('aiColorSelect').value;

    if (colorChoice === 'random') {
        state.playerColor = Math.random() < 0.5 ? 'w' : 'b';
    } else {
        state.playerColor = colorChoice;
    }

    state.boardOrientation = state.playerColor;

    const levelNames = { 1: 'Principiante', 2: 'Club', 3: 'Maestro' };
    const aiLabel = `Maestro AI (${levelNames[state.aiDifficulty]})`;
    const humanLabel = `${getPlayerNickname()} (Tu)`;

    if (state.playerColor === 'w') {
        updatePlayerCardsUI(humanLabel, aiLabel);
    } else {
        updatePlayerCardsUI(aiLabel, humanLabel);
    }

    document.getElementById('gameModePill').textContent = `Contro AI (${levelNames[state.aiDifficulty]})`;
    startMatchTimers();
    renderBoard();

    if (state.playerColor === 'b') {
        setTimeout(() => makeAiMove(), 500);
    }
}

export function startNewLocalGame() {
    cleanupActiveOnlineMatch();
    clearSavedMatch();
    state.gameMode = 'local';
    state.matchEnded = false;
    exitReview();
    chess.reset();
    state.selectedSquare = null;
    state.legalMovesForSelected = [];
    state.lastMoveSquares = { from: null, to: null };
    state.playerColor = 'w';
    state.boardOrientation = 'w';

    updatePlayerCardsUI('Giocatore 1 (Bianco)', 'Giocatore 2 (Nero)');
    document.getElementById('gameModePill').textContent = '2 Giocatori in Locale';
    startMatchTimers();
    renderBoard();
    showToast("Partita 2 Giocatori avviata: muovi col mouse!", "gold");
}

export function startWorldChallengerMatch(challengerObj) {
    cleanupActiveOnlineMatch();
    clearSavedMatch();
    const chosen = challengerObj || WORLD_CHALLENGERS[Math.floor(Math.random() * WORLD_CHALLENGERS.length)];
    state.gameMode = 'world-challenger';
    state.matchEnded = false;
    exitReview();
    chess.reset();
    state.selectedSquare = null;
    state.legalMovesForSelected = [];
    state.lastMoveSquares = { from: null, to: null };
    state.playerColor = 'w';
    state.boardOrientation = 'w';
    state.aiDifficulty = chosen.level || 2;

    const humanLabel = `${getPlayerNickname()} (Tu)`;
    const oppLabel = `${chosen.name} ${chosen.country} (${chosen.elo})`;

    updatePlayerCardsUI(humanLabel, oppLabel);
    document.getElementById('gameModePill').textContent = `Mondiale vs ${chosen.country}`;
    startMatchTimers();
    renderBoard();
    showToast(`Connesso con ${chosen.name} (${chosen.country}). Tocca a te col Bianco!`, 'gold');
}

/** Nomi dei tre livelli dell'AI, usati nelle schede dei giocatori. */
const LEVEL_NAMES = { 1: 'Principiante', 2: 'Club', 3: 'Maestro' };

/**
 * Riprende la partita lasciata a meta' alla visita precedente.
 *
 * @returns {boolean} false se non c'era niente da riprendere, o se il
 *                    salvataggio non tornava: in quel caso chi chiama
 *                    avvia una partita nuova.
 */
export function resumeSavedMatch() {
    const snapshot = readSavedMatch();
    if (!snapshot) return false;

    if (!replayMoves(snapshot)) {
        clearSavedMatch();
        return false;
    }

    cleanupActiveOnlineMatch();

    state.gameMode = snapshot.gameMode;
    state.matchEnded = false;
    state.playerColor = snapshot.playerColor || 'w';
    state.boardOrientation = snapshot.boardOrientation || state.playerColor;
    state.aiDifficulty = snapshot.aiDifficulty || 2;
    // Il tempo di gioco fa parte della partita: ripartire con un altro
    // cambierebbe le regole a meta'.
    state.timeControlId = timeControlById(snapshot.timeControlId).id;
    syncTimeControlSelects();
    state.selectedSquare = null;
    state.legalMovesForSelected = [];

    const history = chess.history({ verbose: true });
    const last = history[history.length - 1];
    state.lastMoveSquares = last ? { from: last.from, to: last.to } : { from: null, to: null };

    if (snapshot.gameMode === 'local') {
        updatePlayerCardsUI('Giocatore 1 (Bianco)', 'Giocatore 2 (Nero)');
        document.getElementById('gameModePill').textContent = '2 Giocatori in Locale';
    } else {
        const opponentLabel = snapshot.opponentName
            || `Maestro AI (${LEVEL_NAMES[state.aiDifficulty] || 'Club'})`;
        const humanLabel = `${getPlayerNickname()} (Tu)`;

        if (state.playerColor === 'w') {
            updatePlayerCardsUI(humanLabel, opponentLabel);
        } else {
            updatePlayerCardsUI(opponentLabel, humanLabel);
        }
        document.getElementById('gameModePill').textContent = snapshot.gameMode === 'world-challenger'
            ? `Sfida: ${opponentLabel}`
            : `Contro AI (${LEVEL_NAMES[state.aiDifficulty] || 'Club'})`;
    }

    startMatchTimers();

    // Gli orologi ripartono dai secondi salvati, non da capo
    if (Number.isFinite(snapshot.whiteTimeSeconds)) state.whiteTimeSeconds = snapshot.whiteTimeSeconds;
    if (Number.isFinite(snapshot.blackTimeSeconds)) state.blackTimeSeconds = snapshot.blackTimeSeconds;
    renderTimersUI();

    renderBoard();
    showToast('Partita ripresa da dove l\'avevi lasciata', 'gold');

    // Se tocca all'AI, muove lei
    if (snapshot.gameMode !== 'local' && chess.turn() !== state.playerColor) {
        setTimeout(() => makeAiMove(), 600);
    }

    return true;
}
