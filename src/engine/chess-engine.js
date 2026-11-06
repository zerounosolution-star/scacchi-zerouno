/**
 * MOTORE SCACCHISTICO ZEROUNO
 * JavaScript puro, zero dipendenze esterne.
 *
 * Regole FIDE supportate: mosse di tutti i pezzi, arrocco corto e lungo,
 * presa en passant, promozione, scacco, scacco matto, stallo,
 * materiale insufficiente, regola delle 50 mosse, FEN e notazione algebrica.
 *
 * Il modulo e' puro: non tocca il DOM e non conosce l'interfaccia.
 */

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
export const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export function sqToCoords(sq) {
    const c = FILES.indexOf(sq[0]);
    const r = 8 - parseInt(sq[1], 10);
    return { r, c };
}

export function coordsToSq(r, c) {
    return `${FILES[c]}${8 - r}`;
}

/*
 * Tabelle di direzione, create una volta sola.
 * Erano letterali dentro isSquareAttacked: allocarle a ogni chiamata
 * pesava sulla ricerca dell'AI, che chiama quella funzione milioni di volte.
 */
const KNIGHT_JUMPS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const ORTHO_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const DIAG_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

/*
 * IMPRONTA ZOBRIST
 *
 * Ogni posizione ha un numero che la identifica. Serve due volte: per la
 * regola della ripetizione e per la tavola di trasposizione della ricerca.
 *
 * Prima questa impronta era la FEN, costruita come stringa a ogni mossa e
 * a ogni annullamento. Dentro la ricerca sono due stringhe per nodo, ed
 * era la spesa piu' alta del motore.
 *
 * I numeri nascono da un generatore con seme fisso, quindi sono identici
 * in ogni sessione e in ogni thread: due motori diversi danno la stessa
 * impronta alla stessa posizione, e il conteggio delle ripetizioni si
 * puo' passare al Web Worker.
 */
const ZOBRIST_PIECE_INDEX = { p: 0, n: 1, b: 2, r: 3, q: 4, k: 5 };
const ZOBRIST_TURN = 12 * 64;
const ZOBRIST_CASTLING = ZOBRIST_TURN + 1;
const ZOBRIST_EP = ZOBRIST_CASTLING + 4;
const ZOBRIST_SLOTS = ZOBRIST_EP + 8;

/**
 * Due numeri casuali a 32 bit per casella: insieme formano una chiave a
 * 53 bit, il piu' grande intero che un numero JavaScript rappresenta
 * senza perdere cifre.
 */
const ZOBRIST = (() => {
    let seed = 0x9E3779B9 >>> 0;
    const next = () => {
        // xorshift32: sequenza fissa, nessuna dipendenza da Math.random
        seed ^= (seed << 13) >>> 0;
        seed >>>= 0;
        seed ^= seed >>> 17;
        seed ^= (seed << 5) >>> 0;
        seed >>>= 0;
        return seed;
    };
    const hi = new Int32Array(ZOBRIST_SLOTS);
    const lo = new Int32Array(ZOBRIST_SLOTS);
    for (let i = 0; i < ZOBRIST_SLOTS; i++) {
        hi[i] = next() | 0;
        lo[i] = next() | 0;
    }
    return { hi, lo };
})();

export function inBounds(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
}

export class ZeroUnoChessEngine {
    constructor() {
        this.reset();
    }

    reset() {
        this.boardGrid = Array.from({ length: 8 }, () => Array(8).fill(null));
        const backRank = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
        for (let c = 0; c < 8; c++) {
            this.boardGrid[0][c] = { type: backRank[c], color: 'b' };
            this.boardGrid[1][c] = { type: 'p', color: 'b' };
            this.boardGrid[6][c] = { type: 'p', color: 'w' };
            this.boardGrid[7][c] = { type: backRank[c], color: 'w' };
        }
        this.activeTurn = 'w';
        this.castling = { wK: true, wQ: true, bK: true, bQ: true };
        this.enPassantSq = null; // es. 'e3'
        this.halfMoves = 0;
        this.fullMoves = 1;
        this.moveStack = [];

        // Conta quante volte ogni posizione si e' ripetuta nella partita.
        this.positionCounts = new Map();
        this.refreshPositionKey();
        this.recordPosition();
    }

    /**
     * Impronta di una posizione per la regola della ripetizione.
     *
     * E' la FEN senza i due contatori di mossa: due posizioni sono "la
     * stessa" quando coincidono pezzi, turno, diritti di arrocco e
     * possibilita' di presa en passant.
     *
     * @returns {string}
     */
    positionKey() {
        return this.positionHash;
    }

    /**
     * Ricalcola l'impronta della posizione corrente.
     *
     * Va chiamata dopo ogni cambiamento della scacchiera: reset, load,
     * move, undo. Il valore si tiene da parte perche' la ricerca lo
     * chiede a ogni nodo.
     */
    refreshPositionKey() {
        const grid = this.boardGrid;
        let hi = 0;
        let lo = 0;

        for (let r = 0; r < 8; r++) {
            const row = grid[r];
            for (let c = 0; c < 8; c++) {
                const piece = row[c];
                if (!piece) continue;
                const slot = ((piece.color === 'w' ? 0 : 6) + ZOBRIST_PIECE_INDEX[piece.type]) * 64 + r * 8 + c;
                hi ^= ZOBRIST.hi[slot];
                lo ^= ZOBRIST.lo[slot];
            }
        }

        if (this.activeTurn === 'w') {
            hi ^= ZOBRIST.hi[ZOBRIST_TURN];
            lo ^= ZOBRIST.lo[ZOBRIST_TURN];
        }
        if (this.castling.wK) { hi ^= ZOBRIST.hi[ZOBRIST_CASTLING]; lo ^= ZOBRIST.lo[ZOBRIST_CASTLING]; }
        if (this.castling.wQ) { hi ^= ZOBRIST.hi[ZOBRIST_CASTLING + 1]; lo ^= ZOBRIST.lo[ZOBRIST_CASTLING + 1]; }
        if (this.castling.bK) { hi ^= ZOBRIST.hi[ZOBRIST_CASTLING + 2]; lo ^= ZOBRIST.lo[ZOBRIST_CASTLING + 2]; }
        if (this.castling.bQ) { hi ^= ZOBRIST.hi[ZOBRIST_CASTLING + 3]; lo ^= ZOBRIST.lo[ZOBRIST_CASTLING + 3]; }

        if (this.enPassantSq) {
            const file = this.enPassantSq.charCodeAt(0) - 97;
            if (file >= 0 && file < 8) {
                hi ^= ZOBRIST.hi[ZOBRIST_EP + file];
                lo ^= ZOBRIST.lo[ZOBRIST_EP + file];
            }
        }

        // 21 bit alti + 32 bassi = 53 bit: resta un intero esatto
        this.positionHash = (hi & 0x1FFFFF) * 4294967296 + (lo >>> 0);
        return this.positionHash;
    }

    /** Registra la posizione corrente nel conteggio delle ripetizioni. */
    recordPosition() {
        const key = this.positionKey();
        this.positionCounts.set(key, (this.positionCounts.get(key) || 0) + 1);
    }

    /**
     * Il conteggio delle posizioni, in forma trasferibile.
     * Serve a passare la storia della partita alla ricerca dell'AI,
     * anche dentro un Web Worker.
     *
     * @returns {Array<[string, number]>}
     */
    positionCountEntries() {
        return Array.from(this.positionCounts.entries());
    }

    /**
     * Riporta nel motore un conteggio di posizioni arrivato da fuori,
     * sommandolo a quello corrente.
     *
     * Senza questo, l'AI che analizza una posizione caricata da FEN non
     * sa quali posizioni sono gia' comparse e ripete le mosse anche
     * quando sta vincendo.
     *
     * @param {Array<[string, number]>} entries
     */
    seedPositionCounts(entries) {
        if (!Array.isArray(entries)) return;
        for (const [key, count] of entries) {
            if (!Number.isFinite(key) || !Number.isFinite(count)) continue;
            this.positionCounts.set(key, Math.max(this.positionCounts.get(key) || 0, count));
        }
    }

    /** Toglie la posizione corrente dal conteggio (serve a undo()). */
    forgetPosition() {
        const key = this.positionKey();
        const count = this.positionCounts.get(key) || 0;
        if (count <= 1) {
            this.positionCounts.delete(key);
        } else {
            this.positionCounts.set(key, count - 1);
        }
    }

    turn() {
        return this.activeTurn;
    }

    board() {
        return this.boardGrid;
    }

    get(sq) {
        const { r, c } = sqToCoords(sq);
        if (!inBounds(r, c)) return null;
        return this.boardGrid[r][c];
    }

    cloneBoardGrid(grid = this.boardGrid) {
        return grid.map(row => row.map(cell => (cell ? { ...cell } : null)));
    }

    findKingSquare(color, grid = this.boardGrid) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = grid[r][c];
                if (p && p.color === color && p.type === 'k') {
                    return { r, c };
                }
            }
        }
        return null;
    }

    isSquareAttacked(targetR, targetC, byColor, grid = this.boardGrid) {
        // 1. Attacchi da pedoni
        const pawnAttackRow = byColor === 'w' ? targetR + 1 : targetR - 1;
        if (inBounds(pawnAttackRow, targetC - 1)) {
            const p = grid[pawnAttackRow][targetC - 1];
            if (p && p.color === byColor && p.type === 'p') return true;
        }
        if (inBounds(pawnAttackRow, targetC + 1)) {
            const p = grid[pawnAttackRow][targetC + 1];
            if (p && p.color === byColor && p.type === 'p') return true;
        }

        // 2. Attacchi da cavalli
        for (const [dr, dc] of KNIGHT_JUMPS) {
            const nr = targetR + dr;
            const nc = targetC + dc;
            if (inBounds(nr, nc)) {
                const p = grid[nr][nc];
                if (p && p.color === byColor && p.type === 'n') return true;
            }
        }

        // 3. Attacchi dal Re avversario
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = targetR + dr;
                const nc = targetC + dc;
                if (inBounds(nr, nc)) {
                    const p = grid[nr][nc];
                    if (p && p.color === byColor && p.type === 'k') return true;
                }
            }
        }

        // 4. Attacchi ortogonali (Torre / Regina)
        for (const [dr, dc] of ORTHO_DIRS) {
            let nr = targetR + dr;
            let nc = targetC + dc;
            while (inBounds(nr, nc)) {
                const p = grid[nr][nc];
                if (p) {
                    if (p.color === byColor && (p.type === 'r' || p.type === 'q')) return true;
                    break;
                }
                nr += dr;
                nc += dc;
            }
        }

        // 5. Attacchi diagonali (Alfiere / Regina)
        for (const [dr, dc] of DIAG_DIRS) {
            let nr = targetR + dr;
            let nc = targetC + dc;
            while (inBounds(nr, nc)) {
                const p = grid[nr][nc];
                if (p) {
                    if (p.color === byColor && (p.type === 'b' || p.type === 'q')) return true;
                    break;
                }
                nr += dr;
                nc += dc;
            }
        }

        return false;
    }

    isKingInCheck(color, grid = this.boardGrid) {
        const kingPos = this.findKingSquare(color, grid);
        if (!kingPos) return false;
        const enemyColor = color === 'w' ? 'b' : 'w';
        return this.isSquareAttacked(kingPos.r, kingPos.c, enemyColor, grid);
    }

    in_check() {
        return this.isKingInCheck(this.activeTurn);
    }

    generatePseudoMovesForSquare(r, c) {
        const piece = this.boardGrid[r][c];
        if (!piece) return [];
        const moves = [];
        const color = piece.color;
        const enemy = color === 'w' ? 'b' : 'w';
        const fromSq = coordsToSq(r, c);

        if (piece.type === 'p') {
            const dir = color === 'w' ? -1 : 1;
            const startRow = color === 'w' ? 6 : 1;
            const promoRow = color === 'w' ? 0 : 7;

            // Passo singolo avanti
            const r1 = r + dir;
            if (inBounds(r1, c) && !this.boardGrid[r1][c]) {
                const isPromo = r1 === promoRow;
                moves.push({
                    from: fromSq,
                    to: coordsToSq(r1, c),
                    color,
                    piece: 'p',
                    captured: null,
                    flags: isPromo ? 'p' : 'n'
                });

                // Doppio passo iniziale
                const r2 = r + dir * 2;
                if (r === startRow && inBounds(r2, c) && !this.boardGrid[r2][c]) {
                    moves.push({
                        from: fromSq,
                        to: coordsToSq(r2, c),
                        color,
                        piece: 'p',
                        captured: null,
                        flags: 'b'
                    });
                }
            }

            // Catture diagonali & En Passant
            for (const dc of [-1, 1]) {
                const nc = c + dc;
                if (!inBounds(r1, nc)) continue;
                const targetSq = coordsToSq(r1, nc);
                const targetPiece = this.boardGrid[r1][nc];
                const isPromo = r1 === promoRow;

                if (targetPiece && targetPiece.color === enemy) {
                    moves.push({
                        from: fromSq,
                        to: targetSq,
                        color,
                        piece: 'p',
                        captured: targetPiece.type,
                        flags: isPromo ? 'cp' : 'c'
                    });
                } else if (this.enPassantSq && targetSq === this.enPassantSq) {
                    moves.push({
                        from: fromSq,
                        to: targetSq,
                        color,
                        piece: 'p',
                        captured: 'p',
                        flags: 'e'
                    });
                }
            }
        } else if (piece.type === 'n') {
            const jumps = [
                [-2, -1], [-2, 1], [-1, -2], [-1, 2],
                [1, -2], [1, 2], [2, -1], [2, 1]
            ];
            for (const [dr, dc] of jumps) {
                const nr = r + dr;
                const nc = c + dc;
                if (!inBounds(nr, nc)) continue;
                const target = this.boardGrid[nr][nc];
                if (!target || target.color === enemy) {
                    moves.push({
                        from: fromSq,
                        to: coordsToSq(nr, nc),
                        color,
                        piece: 'n',
                        captured: target ? target.type : null,
                        flags: target ? 'c' : 'n'
                    });
                }
            }
        } else if (piece.type === 'b' || piece.type === 'r' || piece.type === 'q') {
            const dirs = [];
            if (piece.type === 'b' || piece.type === 'q') {
                dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
            }
            if (piece.type === 'r' || piece.type === 'q') {
                dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
            }
            for (const [dr, dc] of dirs) {
                let nr = r + dr;
                let nc = c + dc;
                while (inBounds(nr, nc)) {
                    const target = this.boardGrid[nr][nc];
                    if (!target) {
                        moves.push({
                            from: fromSq,
                            to: coordsToSq(nr, nc),
                            color,
                            piece: piece.type,
                            captured: null,
                            flags: 'n'
                        });
                    } else {
                        if (target.color === enemy) {
                            moves.push({
                                from: fromSq,
                                to: coordsToSq(nr, nc),
                                color,
                                piece: piece.type,
                                captured: target.type,
                                flags: 'c'
                            });
                        }
                        break;
                    }
                    nr += dr;
                    nc += dc;
                }
            }
        } else if (piece.type === 'k') {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const nr = r + dr;
                    const nc = c + dc;
                    if (!inBounds(nr, nc)) continue;
                    const target = this.boardGrid[nr][nc];
                    if (!target || target.color === enemy) {
                        moves.push({
                            from: fromSq,
                            to: coordsToSq(nr, nc),
                            color,
                            piece: 'k',
                            captured: target ? target.type : null,
                            flags: target ? 'c' : 'n'
                        });
                    }
                }
            }

            // Arrocco Corto (O-O) e Lungo (O-O-O)
            const homeRow = color === 'w' ? 7 : 0;
            if (r === homeRow && c === 4 && !this.isKingInCheck(color)) {
                const canKingSide = color === 'w' ? this.castling.wK : this.castling.bK;
                const canQueenSide = color === 'w' ? this.castling.wQ : this.castling.bQ;

                // Lato Re (colonne 5 e 6 libere e non attaccate, torre in colonna 7)
                if (
                    canKingSide &&
                    !this.boardGrid[homeRow][5] &&
                    !this.boardGrid[homeRow][6] &&
                    this.boardGrid[homeRow][7] &&
                    this.boardGrid[homeRow][7].type === 'r' &&
                    this.boardGrid[homeRow][7].color === color &&
                    !this.isSquareAttacked(homeRow, 5, enemy) &&
                    !this.isSquareAttacked(homeRow, 6, enemy)
                ) {
                    moves.push({
                        from: fromSq,
                        to: coordsToSq(homeRow, 6),
                        color,
                        piece: 'k',
                        captured: null,
                        flags: 'k'
                    });
                }

                // Lato Donna (colonne 1, 2, 3 libere; 2 e 3 non attaccate, torre in colonna 0)
                if (
                    canQueenSide &&
                    !this.boardGrid[homeRow][1] &&
                    !this.boardGrid[homeRow][2] &&
                    !this.boardGrid[homeRow][3] &&
                    this.boardGrid[homeRow][0] &&
                    this.boardGrid[homeRow][0].type === 'r' &&
                    this.boardGrid[homeRow][0].color === color &&
                    !this.isSquareAttacked(homeRow, 3, enemy) &&
                    !this.isSquareAttacked(homeRow, 2, enemy)
                ) {
                    moves.push({
                        from: fromSq,
                        to: coordsToSq(homeRow, 2),
                        color,
                        piece: 'k',
                        captured: null,
                        flags: 'q'
                    });
                }
            }
        }

        return moves;
    }

    /**
     * Dice se una mossa pseudo-legale lascia il proprio re al sicuro.
     *
     * La mossa si applica sulla scacchiera vera e poi si annulla,
     * salvando soltanto le caselle toccate (al massimo quattro).
     * Copiare tutte e 64 le caselle a ogni controllo costava all'AI la
     * maggior parte del suo tempo.
     *
     * @param {object} moveObj
     * @returns {boolean}
     */
    isMoveLegal(moveObj, knownKingSquare = null) {
        const from = sqToCoords(moveObj.from);
        const to = sqToCoords(moveObj.to);
        const grid = this.boardGrid;
        const movingPiece = grid[from.r][from.c];
        if (!movingPiece) return false;

        const touched = [];
        const put = (r, c, value) => {
            touched.push([r, c, grid[r][c]]);
            grid[r][c] = value;
        };

        put(from.r, from.c, null);
        if (moveObj.flags === 'e') {
            // En passant toglie il pedone avversario dalla riga di partenza
            put(from.r, to.c, null);
        } else if (moveObj.flags === 'k') {
            put(from.r, 5, grid[from.r][7]);
            put(from.r, 7, null);
        } else if (moveObj.flags === 'q') {
            put(from.r, 3, grid[from.r][0]);
            put(from.r, 0, null);
        }
        put(to.r, to.c, {
            type: moveObj.promotion || movingPiece.type,
            color: movingPiece.color
        });

        /*
         * La casella del re e' nota: se non si muove il re, e' quella
         * passata da moves(); se si muove il re, e' la casella d'arrivo.
         * Cosi' si evita di ricercare il re su tutte e 64 le caselle a
         * ogni singola mossa da verificare.
         */
        let kingR;
        let kingC;
        if (movingPiece.type === 'k') {
            kingR = to.r;
            kingC = to.c;
        } else if (knownKingSquare) {
            kingR = knownKingSquare.r;
            kingC = knownKingSquare.c;
        } else {
            const found = this.findKingSquare(movingPiece.color, grid);
            kingR = found ? found.r : -1;
            kingC = found ? found.c : -1;
        }

        const enemyColor = movingPiece.color === 'w' ? 'b' : 'w';
        const kingExposed = kingR >= 0 && this.isSquareAttacked(kingR, kingC, enemyColor, grid);

        // Ripristino in ordine inverso: regge anche se una casella
        // e' stata scritta due volte.
        for (let i = touched.length - 1; i >= 0; i--) {
            grid[touched[i][0]][touched[i][1]] = touched[i][2];
        }

        return !kingExposed;
    }

    moves(options = {}) {
        const squareFilter = options.square || null;
        const legalMoves = [];

        // Una sola ricerca del re per tutta la generazione delle mosse
        const kingSquare = this.findKingSquare(this.activeTurn);

        if (squareFilter) {
            const { r, c } = sqToCoords(squareFilter);
            if (inBounds(r, c)) {
                const p = this.boardGrid[r][c];
                if (p && p.color === this.activeTurn) {
                    const pseudo = this.generatePseudoMovesForSquare(r, c);
                    for (const m of pseudo) {
                        if (this.isMoveLegal(m, kingSquare)) legalMoves.push(m);
                    }
                }
            }
        } else {
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const p = this.boardGrid[r][c];
                    if (p && p.color === this.activeTurn) {
                        const pseudo = this.generatePseudoMovesForSquare(r, c);
                        for (const m of pseudo) {
                            if (this.isMoveLegal(m, kingSquare)) legalMoves.push(m);
                        }
                    }
                }
            }
        }

        return legalMoves;
    }

    /**
     * Esegue una mossa.
     *
     * @param {object} moveInput      { from, to, promotion }.
     * @param {object} [options]      fast: il chiamante garantisce che
     *                                moveInput e' uscito da moves() su
     *                                questa stessa posizione. Allora si
     *                                salta il controllo di legalita', la
     *                                notazione algebrica e il simbolo di
     *                                scacco: dentro la ricerca sono tre
     *                                lavori inutili ripetuti a ogni nodo.
     * @returns {object|null}
     */
    move(moveInput, options = {}) {
        const fast = options.fast === true;
        const fromSq = moveInput.from;
        const toSq = moveInput.to;
        const promotionType = moveInput.promotion || 'q';

        let matched;
        if (fast) {
            matched = moveInput;
        } else {
            const legalForSquare = this.moves({ square: fromSq, verbose: true });
            matched = legalForSquare.find(m => m.to === toSq);
            if (!matched) return null;
        }

        // Salva stato precedente per undo(): solo le caselle toccate,
        // non una copia dell'intera scacchiera.
        const touchedCells = [];
        const prevSnapshot = {
            cells: touchedCells,
            activeTurn: this.activeTurn,
            castling: { ...this.castling },
            enPassantSq: this.enPassantSq,
            halfMoves: this.halfMoves,
            fullMoves: this.fullMoves
        };

        const from = sqToCoords(fromSq);
        const to = sqToCoords(toSq);
        const movingPiece = this.boardGrid[from.r][from.c];
        const isPromo = matched.flags.includes('p');

        // Costruisci notazione algebrica (SAN)
        let san = '';
        if (fast) {
            // la ricerca non legge la notazione
        } else if (matched.flags === 'k') {
            san = 'O-O';
        } else if (matched.flags === 'q') {
            san = 'O-O-O';
        } else {
            if (movingPiece.type !== 'p') {
                san += movingPiece.type.toUpperCase();
            } else if (matched.captured) {
                san += fromSq[0];
            }
            if (matched.captured) san += 'x';
            san += toSq;
            if (isPromo) san += `=${promotionType.toUpperCase()}`;
        }

        // Applica mossa sulla griglia, annotando ogni casella toccata
        const put = (r, c, value) => {
            touchedCells.push([r, c, this.boardGrid[r][c]]);
            this.boardGrid[r][c] = value;
        };

        put(from.r, from.c, null);

        if (matched.flags === 'e') {
            put(from.r, to.c, null);
        } else if (matched.flags === 'k') {
            put(from.r, 5, this.boardGrid[from.r][7]);
            put(from.r, 7, null);
        } else if (matched.flags === 'q') {
            put(from.r, 3, this.boardGrid[from.r][0]);
            put(from.r, 0, null);
        }

        put(to.r, to.c, {
            type: isPromo ? promotionType : movingPiece.type,
            color: movingPiece.color
        });

        // Aggiorna diritti di arrocco
        if (movingPiece.type === 'k') {
            if (movingPiece.color === 'w') {
                this.castling.wK = false;
                this.castling.wQ = false;
            } else {
                this.castling.bK = false;
                this.castling.bQ = false;
            }
        }
        if (fromSq === 'a1' || toSq === 'a1') this.castling.wQ = false;
        if (fromSq === 'h1' || toSq === 'h1') this.castling.wK = false;
        if (fromSq === 'a8' || toSq === 'a8') this.castling.bQ = false;
        if (fromSq === 'h8' || toSq === 'h8') this.castling.bK = false;

        // Aggiorna casa En Passant
        if (matched.flags === 'b') {
            const epRow = (from.r + to.r) / 2;
            this.enPassantSq = coordsToSq(epRow, from.c);
        } else {
            this.enPassantSq = null;
        }

        // Aggiorna contatori e turno
        if (movingPiece.type === 'p' || matched.captured) {
            this.halfMoves = 0;
        } else {
            this.halfMoves++;
        }
        if (this.activeTurn === 'b') {
            this.fullMoves++;
        }
        this.activeTurn = this.activeTurn === 'w' ? 'b' : 'w';

        // Aggiungi simbolo di scacco (+) o scacco matto (#).
        // Costa una generazione completa delle mosse: solo fuori dalla ricerca.
        if (!fast && this.in_check()) {
            san += this.moves().length === 0 ? '#' : '+';
        }

        const executedMove = {
            ...matched,
            promotion: isPromo ? promotionType : undefined,
            san,
            prevSnapshot
        };

        this.moveStack.push(executedMove);
        this.refreshPositionKey();
        this.recordPosition();
        return executedMove;
    }

    undo() {
        const last = this.moveStack.pop();
        if (!last) return null;

        // La posizione che sto per abbandonare esce dal conteggio
        this.forgetPosition();

        const snap = last.prevSnapshot;

        // Ripristino in ordine inverso: regge anche se una casella
        // e' stata scritta due volte dalla stessa mossa.
        for (let i = snap.cells.length - 1; i >= 0; i--) {
            this.boardGrid[snap.cells[i][0]][snap.cells[i][1]] = snap.cells[i][2];
        }

        this.activeTurn = snap.activeTurn;
        this.castling = snap.castling;
        this.enPassantSq = snap.enPassantSq;
        this.halfMoves = snap.halfMoves;
        this.fullMoves = snap.fullMoves;
        this.refreshPositionKey();
        return last;
    }

    in_checkmate() {
        return this.in_check() && this.moves().length === 0;
    }

    in_stalemate() {
        return !this.in_check() && this.moves().length === 0;
    }

    /**
     * Patta per ripetizione: la stessa posizione comparsa tre volte,
     * con lo stesso giocatore al tratto.
     *
     * @returns {boolean}
     */
    in_threefold_repetition() {
        return (this.positionCounts.get(this.positionKey()) || 0) >= 3;
    }

    insufficient_material() {
        const pieces = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.boardGrid[r][c];
                if (p && p.type !== 'k') pieces.push(p);
            }
        }
        if (pieces.length === 0) return true; // Re contro Re
        if (pieces.length === 1 && (pieces[0].type === 'n' || pieces[0].type === 'b')) return true;
        return false;
    }

    /**
     * Patta: stallo, materiale insufficiente, regola delle 50 mosse
     * (100 semimosse senza catture ne' mosse di pedone) o ripetizione.
     *
     * @returns {boolean}
     */
    in_draw() {
        return this.in_stalemate()
            || this.insufficient_material()
            || this.halfMoves >= 100
            || this.in_threefold_repetition();
    }

    game_over() {
        return this.in_checkmate() || this.in_draw();
    }

    history(options = {}) {
        if (options.verbose) {
            return this.moveStack.map(m => ({ ...m }));
        }
        return this.moveStack.map(m => m.san);
    }

    pgn() {
        const parts = [];
        for (let i = 0; i < this.moveStack.length; i += 2) {
            const num = Math.floor(i / 2) + 1;
            const wSan = this.moveStack[i].san;
            const bSan = this.moveStack[i + 1] ? ` ${this.moveStack[i + 1].san}` : '';
            parts.push(`${num}. ${wSan}${bSan}`);
        }
        return parts.join(' ');
    }

    fen() {
        const rows = [];
        for (let r = 0; r < 8; r++) {
            let empty = 0;
            let rowStr = '';
            for (let c = 0; c < 8; c++) {
                const p = this.boardGrid[r][c];
                if (!p) {
                    empty++;
                } else {
                    if (empty > 0) {
                        rowStr += empty;
                        empty = 0;
                    }
                    rowStr += p.color === 'w' ? p.type.toUpperCase() : p.type;
                }
            }
            if (empty > 0) rowStr += empty;
            rows.push(rowStr);
        }
        let castleStr = '';
        if (this.castling.wK) castleStr += 'K';
        if (this.castling.wQ) castleStr += 'Q';
        if (this.castling.bK) castleStr += 'k';
        if (this.castling.bQ) castleStr += 'q';
        if (!castleStr) castleStr = '-';

        return `${rows.join('/')} ${this.activeTurn} ${castleStr} ${this.enPassantSq || '-'} ${this.halfMoves} ${this.fullMoves}`;
    }

    load(fenString) {
        if (!fenString) return false;
        try {
            const tokens = fenString.trim().split(/\s+/);
            const boardPart = tokens[0].split('/');
            if (boardPart.length !== 8) return false;

            const newGrid = Array.from({ length: 8 }, () => Array(8).fill(null));
            for (let r = 0; r < 8; r++) {
                let c = 0;
                for (const ch of boardPart[r]) {
                    if (ch >= '1' && ch <= '8') {
                        c += parseInt(ch, 10);
                    } else {
                        const color = ch === ch.toUpperCase() ? 'w' : 'b';
                        newGrid[r][c] = { type: ch.toLowerCase(), color };
                        c++;
                    }
                }
            }
            this.boardGrid = newGrid;
            this.activeTurn = tokens[1] === 'b' ? 'b' : 'w';
            const cRights = tokens[2] || '-';
            this.castling = {
                wK: cRights.includes('K'),
                wQ: cRights.includes('Q'),
                bK: cRights.includes('k'),
                bQ: cRights.includes('q')
            };
            this.enPassantSq = tokens[3] && tokens[3] !== '-' ? tokens[3] : null;
            this.halfMoves = parseInt(tokens[4] || '0', 10);
            this.fullMoves = parseInt(tokens[5] || '1', 10);

            // La posizione caricata e' un nuovo inizio: la storia delle
            // mosse precedenti non le appartiene piu'.
            this.moveStack = [];
            this.positionCounts = new Map();
            this.refreshPositionKey();
            this.recordPosition();
            return true;
        } catch (e) {
            return false;
        }
    }
}
