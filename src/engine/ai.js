/**
 * MOTORE AI: MINIMAX CON POTATURA ALFA-BETA
 *
 * Livello 1: mosse casuali con preferenza per le catture.
 * Livello 2: ricerca a profondita' 2.
 * Livello 3: ricerca a profondita' 3.
 * La valutazione somma il valore dei pezzi e un bonus posizionale.
 */

import { chess, state } from '../core/state.js';
import { executeMove } from '../ui/input.js';

export const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

// Bonus centrale leggero per incoraggiare mosse armoniose e sviluppo
export const CENTER_BONUS = [
    [0,  0,  0,  0,  0,  0,  0,  0],
    [5, 10, 10, 10, 10, 10, 10,  5],
    [5, 10, 20, 25, 25, 20, 10,  5],
    [5, 15, 25, 35, 35, 25, 15,  5],
    [5, 15, 25, 35, 35, 25, 15,  5],
    [5, 10, 20, 25, 25, 20, 10,  5],
    [5, 10, 10, 10, 10, 10, 10,  5],
    [0,  0,  0,  0,  0,  0,  0,  0]
];

export function evaluateBoard(gameInstance) {
    if (gameInstance.in_checkmate()) {
        return gameInstance.turn() === 'w' ? -99999 : 99999;
    }
    if (gameInstance.in_draw() || gameInstance.in_stalemate() || gameInstance.in_threefold_repetition()) {
        return 0;
    }

    const b = gameInstance.board();
    let score = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = b[r][c];
            if (p) {
                const base = PIECE_VALUES[p.type] || 0;
                const positional = (p.type !== 'k') ? CENTER_BONUS[r][c] : 0;
                const total = base + positional;
                score += (p.color === 'w') ? total : -total;
            }
        }
    }
    return score;
}

export function minimax(gameInstance, depth, alpha, beta, isMaximizing) {
    if (depth === 0 || gameInstance.game_over()) {
        return evaluateBoard(gameInstance);
    }

    const moves = gameInstance.moves({ verbose: true });
    // Ordina le catture prima per migliorare il pruning
    moves.sort((a, b) => (b.captured ? 1 : 0) - (a.captured ? 1 : 0));

    if (isMaximizing) {
        let maxEval = -Infinity;
        for (const m of moves) {
            gameInstance.move(m);
            const evaluation = minimax(gameInstance, depth - 1, alpha, beta, false);
            gameInstance.undo();
            maxEval = Math.max(maxEval, evaluation);
            alpha = Math.max(alpha, evaluation);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const m of moves) {
            gameInstance.move(m);
            const evaluation = minimax(gameInstance, depth - 1, alpha, beta, true);
            gameInstance.undo();
            minEval = Math.min(minEval, evaluation);
            beta = Math.min(beta, evaluation);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

export function makeAiMove() {
    if (state.matchEnded || chess.game_over()) return;

    const legalMoves = chess.moves({ verbose: true });
    if (legalMoves.length === 0) return;

    let chosenMove = null;
    const aiColor = chess.turn();

    if (state.aiDifficulty === 1) {
        // Livello 1: mix di mosse casuali e catture semplici
        const captures = legalMoves.filter(m => m.captured);
        if (captures.length > 0 && Math.random() > 0.45) {
            chosenMove = captures[Math.floor(Math.random() * captures.length)];
        } else {
            chosenMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
        }
    } else {
        // Livello 2 o 3: Minimax con Alpha-Beta pruning
        const searchDepth = state.aiDifficulty === 3 ? 3 : 2;
        const isMaximizing = aiColor === 'w';
        let bestScore = isMaximizing ? -Infinity : Infinity;
        let bestMoves = [];

        for (const m of legalMoves) {
            chess.move(m);
            const score = minimax(chess, searchDepth - 1, -Infinity, Infinity, !isMaximizing);
            chess.undo();

            if (isMaximizing) {
                if (score > bestScore) {
                    bestScore = score;
                    bestMoves = [m];
                } else if (score === bestScore) {
                    bestMoves.push(m);
                }
            } else {
                if (score < bestScore) {
                    bestScore = score;
                    bestMoves = [m];
                } else if (score === bestScore) {
                    bestMoves.push(m);
                }
            }
        }
        chosenMove = bestMoves[Math.floor(Math.random() * bestMoves.length)] || legalMoves[0];
    }

    if (chosenMove) {
        executeMove(chosenMove.from, chosenMove.to, chosenMove.promotion || 'q');
    }
}
