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
 * - tavola di trasposizione: la stessa posizione raggiunta per strade
 *   diverse non si ricalcola, e la mossa che era risultata migliore si
 *   riprova per prima
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

/*
 * TAVOLA DI TRASPOSIZIONE
 *
 * La stessa posizione si raggiunge per ordini di mosse diversi. Senza
 * memoria, la ricerca la ricalcola ogni volta da capo.
 *
 * Di ogni posizione si tiene: a che profondita' era stata cercata, il
 * punteggio, che genere di punteggio e' (esatto o solo un limite) e la
 * mossa che era risultata migliore.
 */
const TT_EXACT = 0;
const TT_LOWER = 1;  // il punteggio vero e' almeno questo
const TT_UPPER = 2;  // il punteggio vero e' al massimo questo

/** Oltre questo numero di posizioni in memoria la tavola riparte da zero. */
const TT_MAX_ENTRIES = 300000;

/** La ricerca muove sempre mosse gia' verificate: salta i controlli. */
const FAST_MOVE = { fast: true };

/*
 * I punteggi di matto contengono la distanza dalla radice. La stessa
 * posizione, raggiunta a profondita' diversa, ha distanze diverse:
 * in tavola il punteggio si salva contato dal nodo, non dalla radice.
 */
function scoreToTT(score, ply) {
    if (score >= MATE_SCORE - 1000) return score + ply;
    if (score <= -(MATE_SCORE - 1000)) return score - ply;
    return score;
}

function scoreFromTT(score, ply) {
    if (score >= MATE_SCORE - 1000) return score - ply;
    if (score <= -(MATE_SCORE - 1000)) return score + ply;
    return score;
}

/** Salva una posizione, senza scalzare un risultato piu' profondo. */
function storeTT(ctx, key, depth, flag, score, move) {
    const tt = ctx.tt;
    const previous = tt.get(key);

    if (previous && previous.depth > depth) return;
    if (!previous && tt.size >= TT_MAX_ENTRIES) tt.clear();

    tt.set(key, {
        depth,
        flag,
        score: scoreToTT(score, ctx.ply),
        move: move ? { from: move.from, to: move.to } : (previous ? previous.move : null)
    });
}

/*
 * TERMINI POSIZIONALI OLTRE AI PEZZI
 *
 * Le tabelle PST dicono dove sta bene un pezzo da solo. Non dicono
 * niente su come i pezzi stanno insieme: un pedone isolato, una torre su
 * colonna aperta, il re scoperto. Sono i valori che un giocatore di club
 * guarda per primi.
 *
 * I pesi sono in centesimi di pedone e volutamente prudenti: un termine
 * posizionale troppo pesante fa giocare l'AI per la forma invece che per
 * la sostanza.
 */
const DOUBLED_PAWN = -12;      // per ogni pedone in piu' sulla stessa colonna
const ISOLATED_PAWN = -14;     // nessun pedone amico sulle colonne vicine
const ROOK_OPEN_FILE = 18;     // colonna senza pedoni
const ROOK_SEMI_OPEN_FILE = 9; // colonna senza pedoni propri
const BISHOP_PAIR = 32;        // i due alfieri che si coprono i colori
const KING_SHIELD_MISSING = -14; // colonna sguarnita davanti al re

/** Pedone passato: vale secondo quanto e' avanzato (0 = casa di partenza). */
const PASSED_PAWN = [0, 12, 22, 40, 70, 110];

/*
 * Spazio di lavoro riusato a ogni valutazione.
 *
 * La valutazione gira a ogni foglia della ricerca: allocare sei array
 * per chiamata costerebbe piu' del calcolo. Il modulo non e' rientrante
 * e gira in un thread solo, quindi si possono riusare.
 */
const pawnCount = { w: new Int8Array(8), b: new Int8Array(8) };
const whitePawnMaxRow = new Int8Array(8);  // pedone bianco piu' arretrato
const blackPawnMinRow = new Int8Array(8);  // pedone nero piu' arretrato

/**
 * Riempie il quadro dei pedoni: quanti per colonna e il piu' avanzato.
 * Serve per doppiati, isolati, passati, colonne aperte e riparo del re.
 */
function scanPawns(board) {
    for (let f = 0; f < 8; f++) {
        pawnCount.w[f] = 0;
        pawnCount.b[f] = 0;
        whitePawnMaxRow[f] = -1;
        blackPawnMinRow[f] = 8;
    }

    for (let r = 0; r < 8; r++) {
        const row = board[r];
        for (let c = 0; c < 8; c++) {
            const piece = row[c];
            if (!piece || piece.type !== 'p') continue;
            if (piece.color === 'w') {
                pawnCount.w[c]++;
                if (r > whitePawnMaxRow[c]) whitePawnMaxRow[c] = r;
            } else {
                pawnCount.b[c]++;
                if (r < blackPawnMinRow[c]) blackPawnMinRow[c] = r;
            }
        }
    }
}

/**
 * Un pedone e' passato quando nessun pedone avversario puo' piu'
 * fermarlo: ne' sulla sua colonna ne' sulle due vicine.
 */
function isPassedPawn(color, r, c) {
    const from = c > 0 ? c - 1 : 0;
    const to = c < 7 ? c + 1 : 7;

    if (color === 'w') {
        // Un pedone nero davanti (riga minore) lo ferma
        for (let f = from; f <= to; f++) {
            if (blackPawnMinRow[f] < r) return false;
        }
        return true;
    }

    for (let f = from; f <= to; f++) {
        if (whitePawnMaxRow[f] > r) return false;
    }
    return true;
}

/**
 * Riparo del re: quante delle tre colonne intorno al re hanno ancora un
 * pedone amico subito davanti. Conta solo a medio gioco: nel finale il
 * re deve uscire, non nascondersi.
 */
function kingShieldPenalty(board, color, r, c) {
    const dir = color === 'w' ? -1 : 1;
    let missing = 0;

    for (let f = c - 1; f <= c + 1; f++) {
        if (f < 0 || f > 7) continue;

        let found = false;
        for (let step = 1; step <= 2; step++) {
            const rr = r + dir * step;
            if (rr < 0 || rr > 7) break;
            const piece = board[rr][f];
            if (piece && piece.type === 'p' && piece.color === color) {
                found = true;
                break;
            }
        }
        if (!found) missing++;
    }

    return missing * KING_SHIELD_MISSING;
}

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

    scanPawns(board);

    let score = 0;
    let whiteBishops = 0;
    let blackBishops = 0;

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (!piece) continue;

            const isWhite = piece.color === 'w';
            const table = piece.type === 'k'
                ? (isEndgame ? PST.kEnd : PST.kMiddle)
                : PST[piece.type];

            // Il Nero legge la stessa tabella specchiata in verticale
            const row = isWhite ? r : 7 - r;
            let value = PIECE_VALUES[piece.type] + table[row][c];

            if (piece.type === 'p') {
                const own = isWhite ? pawnCount.w : pawnCount.b;

                if (own[c] > 1) value += DOUBLED_PAWN;

                const left = c > 0 ? own[c - 1] : 0;
                const right = c < 7 ? own[c + 1] : 0;
                if (left === 0 && right === 0) value += ISOLATED_PAWN;

                if (isPassedPawn(piece.color, r, c)) {
                    // Quante traverse ha gia' percorso, dalla sua casa di partenza
                    const advance = isWhite ? 6 - r : r - 1;
                    if (advance > 0 && advance < PASSED_PAWN.length) value += PASSED_PAWN[advance];
                }
            } else if (piece.type === 'r') {
                const ownPawns = isWhite ? pawnCount.w[c] : pawnCount.b[c];
                const enemyPawns = isWhite ? pawnCount.b[c] : pawnCount.w[c];
                if (ownPawns === 0) {
                    value += enemyPawns === 0 ? ROOK_OPEN_FILE : ROOK_SEMI_OPEN_FILE;
                }
            } else if (piece.type === 'b') {
                if (isWhite) whiteBishops++;
                else blackBishops++;
            } else if (piece.type === 'k' && !isEndgame) {
                value += kingShieldPenalty(board, piece.color, r, c);
            }

            score += isWhite ? value : -value;
        }
    }

    if (whiteBishops >= 2) score += BISHOP_PAIR;
    if (blackBishops >= 2) score -= BISHOP_PAIR;

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
function orderMoves(moves, ttMove = null) {
    return moves
        .map((m) => {
            let priority = 0;
            // La mossa che la tavola ricorda come migliore si prova per prima
            if (ttMove && m.from === ttMove.from && m.to === ttMove.to) priority = 1000000;
            else if (m.captured) {
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
        game.move(m, FAST_MOVE);
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

    /*
     * Patte che non dipendono dalle mosse disponibili: costano poco.
     * Vanno controllate prima della tavola, perche' la patta per
     * ripetizione dipende dalla partita giocata, non dalla sola
     * posizione.
     */
    if (isDrawByRule(game)) return 0;

    const alphaOriginal = alpha;
    const betaOriginal = beta;
    const key = game.positionKey();
    let ttMove = null;

    const entry = ctx.tt.get(key);
    if (entry) {
        ttMove = entry.move;
        if (entry.depth >= depth) {
            const score = scoreFromTT(entry.score, ctx.ply);
            if (entry.flag === TT_EXACT) return score;
            if (entry.flag === TT_LOWER && score >= beta) return score;
            if (entry.flag === TT_UPPER && score <= alpha) return score;
        }
    }

    if (depth === 0) {
        return quiescence(game, alpha, beta, isMaximizing, ctx.quiescencePlies, ctx.ply, ctx);
    }

    // Ogni tanto controlla il tempo: fermarsi e' meglio che far aspettare.
    if (ctx.deadline && (ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) {
        ctx.timedOut = true;
        return evaluatePosition(game, ctx.ply);
    }

    const moves = orderMoves(game.moves({ verbose: true }), ttMove);

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
    let bestMoveHere = null;

    for (const m of moves) {
        game.move(m, FAST_MOVE);
        ctx.ply++;
        const value = minimax(game, depth - 1, alpha, beta, !isMaximizing, ctx);
        ctx.ply--;
        game.undo();

        if (isMaximizing) {
            if (value > best) { best = value; bestMoveHere = m; }
            if (value > alpha) alpha = value;
        } else {
            if (value < best) { best = value; bestMoveHere = m; }
            if (value < beta) beta = value;
        }
        if (beta <= alpha) break;
        if (ctx.timedOut) break;
    }

    /*
     * Un giro interrotto dal tempo non si salva: il punteggio non e'
     * stato cercato fino in fondo e inquinerebbe le ricerche successive.
     */
    if (!ctx.timedOut) {
        let flag = TT_EXACT;
        if (best <= alphaOriginal) flag = TT_UPPER;
        else if (best >= betaOriginal) flag = TT_LOWER;
        storeTT(ctx, key, depth, flag, best, bestMoveHere);
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

    /*
     * La tavola vive per tutta la scelta della mossa: il giro a
     * profondita' 4 riusa quello che ha imparato il giro a profondita' 3.
     */
    const tt = new Map();
    let reachedDepth = 0;
    let totalNodes = 0;

    // Approfondimento progressivo: ogni giro scende di un livello.
    for (let depth = 1; depth <= settings.maxDepth; depth++) {
        const ctx = {
            deadline,
            quiescencePlies: settings.quiescencePlies,
            ply: 0,
            nodes: 0,
            timedOut: false,
            tt
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
            game.move(m, FAST_MOVE);
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
