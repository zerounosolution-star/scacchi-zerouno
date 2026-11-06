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
import { updatePlayerCardsUI, startMatchTimers } from '../ui/panels.js';
import { cleanupActiveOnlineMatch } from '../online/firestore.js';

export function startNewAiGame() {
    cleanupActiveOnlineMatch();
    state.gameMode = 'ai';
    state.matchEnded = false;
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
    state.gameMode = 'local';
    state.matchEnded = false;
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
    const chosen = challengerObj || WORLD_CHALLENGERS[Math.floor(Math.random() * WORLD_CHALLENGERS.length)];
    state.gameMode = 'world-challenger';
    state.matchEnded = false;
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
