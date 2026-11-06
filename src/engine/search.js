/**
 * RICERCA DELLA MOSSA MIGLIORE
 *
 * Modulo puro: non tocca il DOM e non conosce lo stato dell'applicazione.
 * Per questo gira sia nel thread principale sia dentro un Web Worker
 * (src/engine/ai.worker.js) e si puo' provare con `npm test`.
 *
 * Tecniche usate:
 * - minimax con potatura alfa-beta
 * - ordinamento delle mosse MVV-LVA (prima le catture che rendono di piu')
 * - ricerca di quiescenza: dopo l'ultimo livello continua solo sulle
 *   catture, cosi' l'AI non si ferma a meta' di uno scambio credendo di
 *   aver guadagnato un pezzo
 * - approfondimento progressivo con tetto di tempo: la ricerca scende di
 *   un livello alla volta e si ferma quando il tempo e' finito, tenendo
 *   la mossa migliore trovata fino a quel momento
 */

import { ZeroUnoChessEngine } from './chess-engine.js';

/** Valore dei pezzi in centesimi di pedone. */
export const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

/** Punteggio di uno scacco matto. Si riduce con la distanza, per preferire i matti brevi. */
const MATE_SCORE = 99999;

/*
 * Tabelle posizionali, dal punto di vista del Bianco.
 * La prima riga e' la traversa 8, come l'indice di riga della scacchiera.
 * Per il Nero si specchiano in verticale.
 */
const PST = {
    p: [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [50, 50, 50, 50, 50, 50, 50, 50],
        [10, 10, 20, 30, 30, 20, 10, 10],
        [5, 5, 10, 25, 25, 10, 5, 5],
        [0, 0, 0, 20, 20, 0, 0, 0],
        [5, -5, -10, 0, 0, -10, -5, 5],
        [5, 10, 10, -20, -20, 10, 10, 5],
        [0, 0, 0, 0, 0, 0, 0, 0]
    ],
    n: [
        [-50, -40, -30, -30, -30, -30, -40, -50],
        [-40, -20, 0, 0, 0, 0, -20, -40],
        [-30, 0, 10, 15, 15, 10, 0, -30],
        [-30, 5, 15, 20, 20, 15, 5, -30],
        [-30, 0, 15, 20, 20, 15, 0, -30],
        [-30, 5, 10, 15, 15, 10, 5, -30],
        [-40, -20, 0, 5, 5, 0, -20, -40],
        [-50, -40, -30, -30, -30, -30, -40, -50]
    ],
    b: [
        [-20, -10, -10, -10, -10, -10, -10, -20],
        [-10, 0, 0, 0, 0, 0, 0, -10],
        [-10, 0, 5, 10, 10, 5, 0, -10],
        [-10, 5, 5, 10, 10, 5, 5, -10],
        [-10, 0, 10, 10, 10, 10, 0, -10],
        [-10, 10, 10, 10, 10, 10, 10, -10],
        [-10, 5, 0, 0, 0, 0, 5, -10],
        [-20, -10, -10, -10, -10, -10, -10, -20]
    ],
    r: [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [5, 10, 10, 10, 10, 10, 10, 5],
        [-5, 0, 0, 0, 0, 0, 0, -5],
        [-5, 0, 0, 0, 0, 0, 0, -5],
        [-5, 0, 0, 0, 0, 0, 0, -5],
        [-5, 0, 0, 0, 0, 0, 0, -5],
        [-5, 0, 0, 0, 0, 0, 0, -5],
        [0, 0, 0, 5, 5, 0, 0, 0]
    ],
    q: [
        [-20, -10, -10, -5, -5, -10, -10, -20],
        [-10, 0, 0, 0, 0, 0, 0, -10],
        [-10, 0, 5, 5, 5, 5, 0, -10],
        [-5, 0, 5, 5, 5, 5, 0, -5],
        [0, 0, 5, 5, 5, 5, 0, -5],
        [-10, 5, 5, 5, 5, 5, 0, -10],
        [-10, 0, 5, 0, 0, 0, 0, -10],
        [-20, -10, -10, -5, -5, -10, -10, -20]
    ],
    kMiddle: [
        [-30, -40, -40, -50, -50, -40, -40, -30],
        [-30, -40, -40, -50, -50, -40, -40, -30],
        [-30, -40, -40, -50, -50, -40, -40, -30],
        [-30, -40, -40, -50, -50, -40, -40, -30],
        [-20, -30, -30, -40, -40, -30, -30, -20],
        [-10, -20, -20, -20, -20, -20, -20, -10],
        [20, 20, 0, 0, 0, 0, 20, 20],
        [20, 30, 10, 0, 0, 10, 30, 20]
    ],
    kEnd: [
        [-50, -40, -30, -20, -20, -30, -40, -50],
        [-30, -20, -10, 0, 0, -10, -20, -30],
        [-30, -10, 20, 30, 30, 20, -10, -30],
        [-30, -10, 30, 40, 40, 30, -10, -30],
        [-30, -10, 30, 40, 40, 30, -10, -30],
        [-30, -10, 20, 30, 30, 20, -10, -30],
        [-30, -30, 0, 0, 0, 0, -30, -30],
        [-50, -30, -30, -30, -30, -30, -30, -50]
    ]
};

/**
 * Valuta la posizione dal punto di vista del Bianco.
 * Positivo: sta meglio il Bianco. Negativo: sta meglio il Nero.
 *
 * @param {ZeroUnoChessEngine} game
 * @param {number} ply  Semimosse dalla radice, per preferire i matti brevi.
 * @returns {number}
 */
export function evaluatePosition(game, ply = 0) {
    /*
     * Qui non si controlla il matto: in_checkmate() rigenera tutte le
     * mosse legali, e questa funzione viene chiamata a ogni foglia
     * della ricerca. Matto e stallo li riconosce minimax, che la lista
     * delle mosse ce l'ha gia' in mano.
     */
    const board = game.board();

    // Finale: pochi pezzi pesanti in giro, il re va al centro.
    let heavyMaterial = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (p && p.type !== 'k' && p.type !== 'p') heavyMaterial += PIECE_VALUES[p.type];
        }
    }
    const isEndgame = heavyMaterial <= 1300;

    let score = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (!piece) continue;

            const table = piece.type === 'k'
                ? (isEndgame ? PST.kEnd : PST.kMiddle)
                : PST[piece.type];

            // Il Nero legge la stessa tabella specchiata in verticale
            const row = piece.color === 'w' ? r : 7 - r;
            const value = PIECE_VALUES[piece.type] + table[row][c];

            score += piece.color === 'w' ? value : -value;
        }
    }
    return score;
}

/**
 * Patta riconoscibile senza generare le mosse: materiale insufficiente,
 * regola delle 50 mosse, ripetizione.
 *
 * Lo stallo non e' qui: per riconoscerlo serve la lista delle mosse,
 * che chi chiama genera comunque.
 *
 * @param {ZeroUnoChessEngine} game
 * @returns {boolean}
 */
function isDrawByRule(game) {
    return game.insufficient_material()
        || game.halfMoves >= 100
        || game.in_threefold_repetition();
}

/**
 * Ordina le mosse per far scattare prima la potatura.
 * MVV-LVA: cattura il pezzo piu' prezioso con il pezzo meno prezioso.
 *
 * @param {Array<object>} moves
 * @returns {Array<object>}
 */
function orderMoves(moves) {
    return moves
        .map((m) => {
            let priority = 0;
            if (m.captured) {
                priority = 10000 + (PIECE_VALUES[m.captured] || 0) - (PIECE_VALUES[m.piece] || 0);
            }
            if (m.flags && m.flags.includes('p')) priority += 9000;
            return { move: m, priority };
        })
        .sort((a, b) => b.priority - a.priority)
        .map((entry) => entry.move);
}

/**
 * Ricerca di quiescenza: prosegue solo sulle catture, per non valutare
 * una posizione a meta' di uno scambio.
 */
function quiescence(game, alpha, beta, isMaximizing, pliesLeft, ply, ctx) {
    ctx.nodes++;

    const standPat = evaluatePosition(game, ply);
    if (pliesLeft <= 0) return standPat;

    if (ctx.deadline && (ctx.nodes & 255) === 0 && Date.now() > ctx.deadline) {
        ctx.timedOut = true;
        return standPat;
    }

    if (isMaximizing) {
        if (standPat >= beta) return beta;
        if (standPat > alpha) alpha = standPat;
    } else {
        if (standPat <= alpha) return alpha;
        if (standPat < beta) beta = standPat;
    }

    const captures = orderMoves(game.moves({ verbose: true }).filter((m) => m.captured));

    for (const m of captures) {
        game.move(m);
        const value = quiescence(game, alpha, beta, !isMaximizing, pliesLeft - 1, ply + 1, ctx);
        game.undo();

        if (isMaximizing) {
            if (value > alpha) alpha = value;
        } else if (value < beta) {
            beta = value;
        }
        if (beta <= alpha) break;
    }

    return isMaximizing ? alpha : beta;
}

/**
 * Minimax con potatura alfa-beta.
 *
 * @param {ZeroUnoChessEngine} game
 * @param {number} depth            Livelli ancora da esplorare.
 * @param {number} alpha
 * @param {number} beta
 * @param {boolean} isMaximizing    true quando tocca al Bianco.
 * @param {object} ctx              { deadline, quiescencePlies, ply, nodes }
 * @returns {number}
 */
export function minimax(game, depth, alpha, beta, isMaximizing, ctx) {
    ctx.nodes++;

    // Patte che non dipendono dalle mosse disponibili: costano poco
    if (isDrawByRule(game)) return 0;

    if (depth === 0) {
        return quiescence(game, alpha, beta, isMaximizing, ctx.quiescencePlies, ctx.ply, ctx);
    }

    // Ogni tanto controlla il tempo: fermarsi e' meglio che far aspettare.
    if (ctx.deadline && (ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) {
        ctx.timedOut = true;
        return evaluatePosition(game, ctx.ply);
    }

    const moves = orderMoves(game.moves({ verbose: true }));

    /*
     * Niente mosse legali: o e' matto, o e' stallo. Si riconosce qui,
     * dove la lista delle mosse e' gia' pronta, invece di chiedere
     * in_checkmate() e far rigenerare tutto da capo.
     */
    if (moves.length === 0) {
        if (!game.in_check()) return 0;
        return game.turn() === 'w' ? -(MATE_SCORE - ctx.ply) : (MATE_SCORE - ctx.ply);
    }

    let best = isMaximizing ? -Infinity : Infinity;

    for (const m of moves) {
        game.move(m);
        ctx.ply++;
        const value = minimax(game, depth - 1, alpha, beta, !isMaximizing, ctx);
        ctx.ply--;
        game.undo();

        if (isMaximizing) {
            if (value > best) best = value;
            if (value > alpha) alpha = value;
        } else {
            if (value < best) best = value;
            if (value < beta) beta = value;
        }
        if (beta <= alpha) break;
        if (ctx.timedOut) break;
    }

    return best;
}

/** Impostazioni di ricerca per ciascun livello di difficolta'. */
export const LEVELS = {
    1: { label: 'Principiante', maxDepth: 1, quiescencePlies: 0, timeBudgetMs: 150, blunderChance: 0.35 },
    2: { label: 'Club', maxDepth: 4, quiescencePlies: 2, timeBudgetMs: 900, blunderChance: 0 },
    3: { label: 'Maestro', maxDepth: 6, quiescencePlies: 2, timeBudgetMs: 2200, blunderChance: 0 }
};

/**
 * Sceglie la mossa per la posizione data.
 *
 * @param {string} fen              Posizione di partenza.
 * @param {number} level            1, 2 o 3.
 * @param {object} [options]        { timeBudgetMs, positionHistory }.
 *                                  positionHistory e' il conteggio delle
 *                                  posizioni gia' viste nella partita:
 *                                  senza, l'AI non sa di stare ripetendo.
 * @returns {{from: string, to: string, promotion: string, score: number, depth: number, nodes: number, elapsedMs: number}|null}
 */
export function chooseMove(fen, level = 2, options = {}) {
    const settings = LEVELS[level] || LEVELS[2];
    const timeBudgetMs = options.timeBudgetMs ?? settings.timeBudgetMs;

    const game = new ZeroUnoChessEngine();
    if (!game.load(fen)) return null;

    // La partita giocata finora: cosi' la ripetizione vale come patta
    if (options.positionHistory) game.seedPositionCounts(options.positionHistory);

    const legalMoves = game.moves({ verbose: true });
    if (legalMoves.length === 0) return null;

    const startedAt = Date.now();
    const deadline = startedAt + timeBudgetMs;
    const isMaximizing = game.turn() === 'w';

    // Livello 1: gioca d'istinto, e ogni tanto sbaglia apposta.
    if (level === 1 && Math.random() < settings.blunderChance) {
        const random = legalMoves[Math.floor(Math.random() * legalMoves.length)];
        return {
            from: random.from,
            to: random.to,
            promotion: random.promotion || 'q',
            score: 0,
            depth: 0,
            nodes: 0,
            elapsedMs: Date.now() - startedAt
        };
    }

    let bestMove = legalMoves[0];
    let bestScore = isMaximizing ? -Infinity : Infinity;
    let reachedDepth = 0;
    let totalNodes = 0;

    // Approfondimento progressivo: ogni giro scende di un livello.
    for (let depth = 1; depth <= settings.maxDepth; depth++) {
        const ctx = {
            deadline,
            quiescencePlies: settings.quiescencePlies,
            ply: 0,
            nodes: 0,
            timedOut: false
        };

        let roundBest = null;
        let roundScore = isMaximizing ? -Infinity : Infinity;
        const equallyGood = [];

        // La mossa migliore del giro precedente si prova per prima.
        const ordered = orderMoves(legalMoves);
        const first = ordered.findIndex((m) => m.from === bestMove.from && m.to === bestMove.to);
        if (first > 0) ordered.unshift(ordered.splice(first, 1)[0]);

        /*
         * Alla radice ogni mossa si cerca a finestra piena (-Infinito,
         * +Infinito). Restringendo la finestra con alpha e beta, un ramo
         * potato restituisce un limite e non il punteggio vero: alla
         * radice quel limite verrebbe scambiato per il punteggio della
         * mossa e si finirebbe per giocare una mossa qualunque con il
         * punteggio del matto trovato da un'altra.
         */
        for (const m of ordered) {
            game.move(m);
            ctx.ply++;
            const score = minimax(game, depth - 1, -Infinity, Infinity, !isMaximizing, ctx);
            ctx.ply--;
            game.undo();

            if (ctx.timedOut) break;

            const better = isMaximizing ? score > roundScore : score < roundScore;
            if (better) {
                roundScore = score;
                roundBest = m;
                equallyGood.length = 0;
                equallyGood.push(m);
            } else if (score === roundScore) {
                equallyGood.push(m);
            }
        }

        totalNodes += ctx.nodes;

        // Un giro interrotto a meta' non e' affidabile: tengo il precedente.
        if (ctx.timedOut && reachedDepth > 0) break;

        if (roundBest) {
            // Fra mosse di pari punteggio ne prendo una a caso: partite meno uguali.
            bestMove = equallyGood.length > 1
                ? equallyGood[Math.floor(Math.random() * equallyGood.length)]
                : roundBest;
            bestScore = roundScore;
            reachedDepth = depth;
        }

        if (ctx.timedOut || Date.now() > deadline) break;

        // Matto trovato: inutile cercare oltre.
        if (Math.abs(bestScore) >= MATE_SCORE - 100) break;
    }

    return {
        from: bestMove.from,
        to: bestMove.to,
        promotion: bestMove.promotion || 'q',
        score: bestScore,
        depth: reachedDepth,
        nodes: totalNodes,
        elapsedMs: Date.now() - startedAt
    };
}
