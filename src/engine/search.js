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
 * - mosse killer e tabella della storia: una mossa tranquilla che ha
 *   gia' fatto saltare altri rami si riprova presto, anche dove non e'
 *   una cattura
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
 * Mezza ampiezza della finestra di sondaggio alla radice.
 *
 * I punteggi della valutazione sono tutti interi: la finestra
 * (metro - 1, metro + 1) contiene il solo punteggio del migliore.
 * Basta a distinguere peggiore (limite), pari esatto e forse
 * migliore, senza mai produrre un punteggio ambiguo.
 */
const ROOT_SCOUT_MARGIN = 1;

/*
 * ORDINE DI PROVA DELLE MOSSE
 *
 * La potatura alfa-beta rende quanto prima si prova la mossa giusta.
 * Le fasce sono distanti fra loro perche' il confronto resti leggibile:
 * nessun punteggio di una fascia puo' scavalcare quella sopra.
 */
const ORDER_TT_MOVE = 1000000;     // la mossa che la tavola ricorda
const ORDER_CAPTURE = 500000;      // catture, poi MVV-LVA fra loro
const ORDER_PROMOTION = 400000;    // promozioni
const ORDER_KILLER_FIRST = 300000; // mossa tranquilla che ha gia' tagliato qui
const ORDER_KILLER_SECOND = 290000;
const ORDER_HISTORY_MAX = 200000;  // tetto della tabella della storia

/** Quante mosse killer si ricordano per ogni livello di profondita'. */
const KILLERS_PER_PLY = 2;

/*
 * POTATURA DEL TRATTO NULLO
 *
 * Se in una posizione posso passare il tratto e una ricerca ridotta
 * dice che resto comunque fuori dalla finestra, una mossa vera lo
 * farebbe a maggior ragione: il ramo si taglia senza generare le mosse.
 * E' l'unico taglio del motore che rinuncia alla certezza: si paga nei
 * casi rari di zugzwang (dove muovere fa perdere), si guadagna un
 * fattore di ramificazione molto piu' basso, cioe' piu' profondita'
 * nello stesso tempo.
 */
const NULL_MOVE_REDUCTION = 2;  // R: livelli in meno nella ricerca di verifica
const NULL_MOVE_MIN_DEPTH = 3;  // sotto, il taglio rende poco e rischia troppo
// Sopra questa soglia il punteggio parla di matto: un matto non si
// dichiara ne' si nasconde con un tratto passato.
const NULL_MATE_BOUND = MATE_SCORE - 1000;

/**
 * Ricorda una mossa tranquilla che ha fatto saltare questo nodo.
 *
 * Una mossa che taglia in un ramo taglia spesso anche nei rami vicini,
 * alla stessa profondita': provarla subito fa risparmiare molto.
 */
function rememberKiller(ctx, ply, move) {
    if (!ctx.killers) return;
    const slot = ctx.killers[ply] || (ctx.killers[ply] = []);
    if (slot[0] && slot[0].from === move.from && slot[0].to === move.to) return;
    slot.unshift({ from: move.from, to: move.to });
    slot.length = Math.min(slot.length, KILLERS_PER_PLY);
}

/**
 * Alza il punteggio di una mossa tranquilla che ha tagliato.
 *
 * Il peso cresce con il quadrato della profondita': un taglio trovato a
 * profondita' alta vale piu' di uno trovato vicino alle foglie.
 */
function bumpHistory(ctx, move, depth) {
    if (!ctx.history) return;
    const key = move.from + move.to;
    ctx.history.set(key, (ctx.history.get(key) || 0) + depth * depth);
}

/** Quanto spesso questa mossa ha gia' tagliato, con un tetto. */
function historyScore(ctx, move) {
    if (!ctx.history) return 0;
    return Math.min(ctx.history.get(move.from + move.to) || 0, ORDER_HISTORY_MAX);
}

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
const CONNECTED_PAWN = 7;      // pedone amico di fianco o a sostegno in diagonale

/** Pedone passato: vale secondo quanto e' avanzato (0 = casa di partenza). */
const PASSED_PAWN = [0, 12, 22, 40, 70, 110];

/*
 * FINALI CON PEDONI PASSATI
 *
 * Le partite che muoiono al limite delle 200 semimosse sono finali con
 * pezzi ancora in gioco che nessuno converte. A queste profondita' i
 * piani "porta il re sul pedone" e "cambia i pezzi e corri" non entrano
 * nell'orizzonte: serve un gradiente statico che li suggerisca alle
 * foglie, dove il motore arriva gia'.
 *
 * Tutti i termini dipendono solo da pezzi e tratto, che stanno entrambi
 * nell'impronta Zobrist: niente ply ne' contatore delle 50 mosse, cosi'
 * la tavola di trasposizione resta onesta.
 */
const PASSED_ENDGAME_SCALE = 0.5;    // a finale pieno il passato vale il 50% in piu'
const PASSED_OWN_KING = 4;           // per passo del proprio re dalla casa davanti al passato, per avanzata
const PASSED_ENEMY_KING = 4;         // lo stesso per il re avversario, in positivo quando sta lontano
const ROOK_BEHIND_PASSED = 14;       // torre propria dietro il passato; quella avversaria vale lo stesso in negativo
const PASSED_UNSTOPPABLE_BASE = 400; // regola del quadrato: il re avversario non lo prende piu'
const PASSED_UNSTOPPABLE_STEP = 30;  // in piu' per ogni passo gia' fatto: fra due corse vince la piu' corta

/*
 * FASE DELLA PARTITA
 *
 * Il re sta al riparo a medio gioco e al centro nel finale: due tabelle
 * opposte. Scegliere di colpo l'una o l'altra mette un gradino nella
 * valutazione, e una cattura sola puo' far saltare il punteggio del re
 * di quasi un pedone senza che sulla scacchiera sia cambiato niente per
 * il re. Fra le due tabelle si passa invece per gradi, in proporzione al
 * materiale pesante ancora in gioco.
 */
const PHASE_MIDDLEGAME = 3200; // materiale pesante delle due parti: medio gioco pieno
const PHASE_ENDGAME = 1300;    // sotto questa soglia il finale e' pieno

/*
 * SPINTA AL MATTO
 *
 * Con un re nudo davanti, materiale e tabelle non bastano: dicono che si
 * sta vincendo, non come si vince. Il motore vaga, arriva alla regola
 * delle 50 mosse e lì ogni mossa vale zero, compreso buttare la torre.
 *
 * Questi due termini danno alla ricerca una direzione da seguire anche
 * quando il matto e' fuori dal suo orizzonte: il re perdente verso il
 * bordo, il re vincente addosso. Valgono solo dove sono veri, cioe'
 * quando una parte e' avanti di almeno una torre e l'altra non ha
 * pedoni: con i pedoni in gioco spingere il re al bordo e' un consiglio
 * sbagliato.
 */
const MATE_DRIVE_EDGE = 12;  // per ogni passo del re perdente lontano dal centro
const MATE_DRIVE_CLOSE = 5;  // per ogni passo guadagnato dal re vincente

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
 * Un pedone e' collegato quando ha un pedone amico di fianco o a
 * sostegno in diagonale dietro.
 *
 * Due pedoni collegati si difendono fra loro e avanzano insieme; un
 * pedone solo va difeso con i pezzi. E' il rovescio del pedone isolato,
 * che la valutazione punisce gia': qui si premia la catena.
 */
function isConnectedPawn(board, color, r, c) {
    const behind = color === 'w' ? r + 1 : r - 1;

    for (const f of [c - 1, c + 1]) {
        if (f < 0 || f > 7) continue;

        const side = board[r][f];
        if (side && side.type === 'p' && side.color === color) return true;

        if (behind >= 0 && behind <= 7) {
            const support = board[behind][f];
            if (support && support.type === 'p' && support.color === color) return true;
        }
    }

    return false;
}

/** Distanza fra due case in mosse di re. */
function kingDistance(r1, c1, r2, c2) {
    const dr = Math.abs(r1 - r2);
    const dc = Math.abs(c1 - c2);
    return dr > dc ? dr : dc;
}

/**
 * Prima torre sulla colonna dietro un pedone passato: +1 se propria,
 * -1 se avversaria, 0 se non c'e' o se un altro pezzo sta in mezzo.
 *
 * Regola di Tarrasch: la torre dietro il passato lo spinge senza
 * intralciarlo e guadagna case mentre avanza; davanti fa il contrario.
 */
function rookBehindPasser(board, color, r, c) {
    const step = color === 'w' ? 1 : -1; // dietro un pedone bianco = verso la riga 7
    for (let rr = r + step; rr >= 0 && rr <= 7; rr += step) {
        const piece = board[rr][c];
        if (!piece) continue;
        if (piece.type === 'r') return piece.color === color ? 1 : -1;
        return 0;
    }
    return 0;
}

/**
 * Quanto il re perdente e' lontano dal centro: 1 al centro, 7 sul bordo.
 * Sul bordo ha meno case per scappare, e lungo il bordo si da' matto.
 *
 * Si prende la maggiore delle due distanze, non la somma. La somma
 * distinguerebbe l'angolo dal bordo, e con i due alfieri il matto si da'
 * solo in un angolo: sembra la cosa giusta, ma misurata va peggio.
 * Portare il re verso l'angolo allunga la strada e con la donna fa
 * sfiorare lo stallo. Chi ci riprova lo misuri su tutte le famiglie di
 * matto, non solo sugli alfieri.
 */
function distanceFromCentre(r, c) {
    return Math.max(Math.abs(2 * r - 7), Math.abs(2 * c - 7));
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

    /*
     * Un giro solo per tutto quello che serve prima di valutare i pezzi
     * uno per uno: la fase della partita, chi e' avanti, chi ha pedoni e
     * dove stanno i due re.
     */
    let heavyMaterial = 0;
    let whiteMaterial = 0;
    let blackMaterial = 0;
    let whitePieces = 0; // pezzi non pedone per colore: serve alla regola del quadrato
    let blackPieces = 0;
    let whitePawns = 0;
    let blackPawns = 0;
    let whiteKing = null;
    let blackKing = null;

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (!p) continue;

            if (p.type === 'k') {
                if (p.color === 'w') whiteKing = { r, c };
                else blackKing = { r, c };
                continue;
            }

            if (p.type === 'p') {
                if (p.color === 'w') whitePawns++;
                else blackPawns++;
            } else {
                heavyMaterial += PIECE_VALUES[p.type];
                if (p.color === 'w') whitePieces += PIECE_VALUES[p.type];
                else blackPieces += PIECE_VALUES[p.type];
            }

            if (p.color === 'w') whiteMaterial += PIECE_VALUES[p.type];
            else blackMaterial += PIECE_VALUES[p.type];
        }
    }

    // 1 = medio gioco pieno, 0 = finale pieno, in mezzo si passa per gradi
    const phase = Math.max(0, Math.min(1,
        (heavyMaterial - PHASE_ENDGAME) / (PHASE_MIDDLEGAME - PHASE_ENDGAME)));

    // 1 = finale pieno: i termini dei passati pesano in proporzione
    const endgame = 1 - phase;
    const sideToMove = game.turn(); // il tempo nella regola del quadrato

    scanPawns(board);

    let score = 0;
    let whiteBishops = 0;
    let blackBishops = 0;

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (!piece) continue;

            const isWhite = piece.color === 'w';

            // Il Nero legge le stesse tabelle specchiate in verticale
            const row = isWhite ? r : 7 - r;

            let positional;
            if (piece.type === 'k') {
                // Fra riparo e centro si passa per gradi, non di colpo
                positional = Math.round(
                    PST.kMiddle[row][c] * phase + PST.kEnd[row][c] * (1 - phase));
            } else {
                positional = PST[piece.type][row][c];
            }

            let value = PIECE_VALUES[piece.type] + positional;

            if (piece.type === 'p') {
                const own = isWhite ? pawnCount.w : pawnCount.b;

                if (own[c] > 1) value += DOUBLED_PAWN;

                const left = c > 0 ? own[c - 1] : 0;
                const right = c < 7 ? own[c + 1] : 0;
                if (left === 0 && right === 0) value += ISOLATED_PAWN;
                else if (isConnectedPawn(board, piece.color, r, c)) value += CONNECTED_PAWN;

                if (isPassedPawn(piece.color, r, c)) {
                    // Quante traverse ha gia' percorso, dalla sua casa di partenza
                    const advance = isWhite ? 6 - r : r - 1;
                    const ownKing = isWhite ? whiteKing : blackKing;
                    const enemyKing = isWhite ? blackKing : whiteKing;

                    if (advance > 0 && advance < PASSED_PAWN.length) {
                        // A medio gioco un passato e' una promessa, nel finale
                        // e' il piano della partita: il valore sale con endgame.
                        let passer = PASSED_PAWN[advance] * (1 + PASSED_ENDGAME_SCALE * endgame);

                        /*
                         * La corsa si gioca sulla casa davanti al pedone: il
                         * proprio re vicino lo scorta, quello avversario
                         * vicino lo blocca. Pesa con l'avanzata, perche' la
                         * scorta di un passato arretrato non vale il viaggio
                         * del re, e con endgame: a medio gioco quasi niente.
                         */
                        const frontRow = isWhite ? r - 1 : r + 1;
                        if (ownKing && enemyKing) {
                            passer += endgame * advance * (
                                PASSED_ENEMY_KING * kingDistance(enemyKing.r, enemyKing.c, frontRow, c)
                                - PASSED_OWN_KING * kingDistance(ownKing.r, ownKing.c, frontRow, c));
                        }

                        // Arrotondamento su valori identici allo specchio: i due
                        // colori si annullano esatti e il totale resta intero.
                        value += Math.round(passer);

                        value += ROOK_BEHIND_PASSED * rookBehindPasser(board, piece.color, r, c);
                    }

                    /*
                     * Regola del quadrato: se l'avversario non ha pezzi e il
                     * suo re, contando chi muove, non raggiunge piu' la casa
                     * di promozione, il pedone promuove da solo. Il premio
                     * sta sotto donna meno pedone (800), cosi' promuovere
                     * davvero conviene sempre; e sotto i due passi dalla
                     * promozione non entra: li' la variante concreta la vede
                     * la ricerca, e il premio farebbe preferire la promessa
                     * alla promozione (il test della sottopromozione a
                     * stallo sorveglia proprio questo).
                     */
                    const enemyPieces = isWhite ? blackPieces : whitePieces;
                    if (enemyPieces === 0 && enemyKing) {
                        const promoRow = isWhite ? 0 : 7;
                        // Dalla casa di partenza il pedone parte col doppio passo
                        const steps = isWhite ? (r === 6 ? 5 : r) : (r === 1 ? 5 : 7 - r);
                        if (steps >= 2) {
                            // Chi muove guadagna un tempo nella corsa
                            const tempo = sideToMove === piece.color ? 1 : 0;
                            const chase = kingDistance(enemyKing.r, enemyKing.c, promoRow, c);
                            if (chase > steps - tempo) {
                                value += PASSED_UNSTOPPABLE_BASE
                                    + PASSED_UNSTOPPABLE_STEP * (5 - steps);
                            }
                        }
                    }
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
            } else if (piece.type === 'k' && phase > 0) {
                // Il riparo conta quanto la partita e' ancora di medio gioco
                value += Math.round(kingShieldPenalty(board, piece.color, r, c) * phase);
            }

            score += isWhite ? value : -value;
        }
    }

    if (whiteBishops >= 2) score += BISHOP_PAIR;
    if (blackBishops >= 2) score -= BISHOP_PAIR;

    /*
     * Spinta al matto: vale solo quando una parte e' avanti di almeno una
     * torre e la parte debole non ha pedoni. Sono le posizioni dove il
     * materiale ha gia' deciso la partita e manca solo la tecnica.
     */
    const edge = whiteMaterial - blackMaterial;
    if (whiteKing && blackKing && Math.abs(edge) >= PIECE_VALUES.r) {
        const strongIsWhite = edge > 0;
        const weakPawns = strongIsWhite ? blackPawns : whitePawns;

        if (weakPawns === 0) {
            const strong = strongIsWhite ? whiteKing : blackKing;
            const weak = strongIsWhite ? blackKing : whiteKing;

            // Distanza fra i re: da 14 (lontanissimi) a 2 (addosso)
            const between = Math.abs(strong.r - weak.r) + Math.abs(strong.c - weak.c);
            const drive = distanceFromCentre(weak.r, weak.c) * MATE_DRIVE_EDGE
                + (14 - between) * MATE_DRIVE_CLOSE;

            score += strongIsWhite ? drive : -drive;
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
 * Dice se in questa posizione il tratto nullo si puo' tentare.
 *
 * Due esclusioni, tutte e due per lo zugzwang:
 * - il lato al tratto ha solo re e pedoni: nei finali di pedoni
 *   l'obbligo di muovere decide le partite, e passare il tratto
 *   "gratis" fa sembrare tenibili posizioni perse;
 * - la posizione e' quella della spinta al matto (una parte avanti di
 *   almeno una torre, l'altra senza pedoni, stessa condizione di
 *   evaluatePosition): li' la valutazione e' gonfiata apposta per dare
 *   una direzione, e i finali senza pedoni sono la casa di zugzwang e
 *   stallo. Cosi' i due meccanismi non si pestano i piedi.
 */
function nullMovePruningAllowed(game) {
    const board = game.board();
    const side = game.turn();

    let sidePieces = 0;     // pezzi non pedone del lato al tratto
    let whiteMaterial = 0;
    let blackMaterial = 0;
    let whitePawns = 0;
    let blackPawns = 0;

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (!p || p.type === 'k') continue;

            if (p.type === 'p') {
                if (p.color === 'w') whitePawns++;
                else blackPawns++;
            } else if (p.color === side) {
                sidePieces++;
            }

            if (p.color === 'w') whiteMaterial += PIECE_VALUES[p.type];
            else blackMaterial += PIECE_VALUES[p.type];
        }
    }

    if (sidePieces === 0) return false;

    // Il gate della spinta al matto, identico a quello della valutazione
    const edge = whiteMaterial - blackMaterial;
    if (Math.abs(edge) >= PIECE_VALUES.r) {
        const weakPawns = edge > 0 ? blackPawns : whitePawns;
        if (weakPawns === 0) return false;
    }

    return true;
}

/**
 * Ordina le mosse per far scattare prima la potatura.
 * MVV-LVA: cattura il pezzo piu' prezioso con il pezzo meno prezioso.
 *
 * @param {Array<object>} moves
 * @param {{from: string, to: string}|null} ttMove  Mossa ricordata dalla tavola.
 * @param {object|null} ctx   Serve per killer e storia: senza, si ordina
 *                            solo per tavola, catture e promozioni.
 * @param {number} ply        Profondita' del nodo, per le mosse killer.
 * @returns {Array<object>}
 */
function orderMoves(moves, ttMove = null, ctx = null, ply = 0) {
    const killers = (ctx && ctx.killers && ctx.killers[ply]) || null;

    return moves
        .map((m) => {
            let priority = 0;

            if (ttMove && m.from === ttMove.from && m.to === ttMove.to) {
                priority = ORDER_TT_MOVE;
            } else {
                if (m.captured) {
                    priority += ORDER_CAPTURE
                        + (PIECE_VALUES[m.captured] || 0)
                        - (PIECE_VALUES[m.piece] || 0);
                }
                if (m.flags && m.flags.includes('p')) priority += ORDER_PROMOTION;

                // Mossa tranquilla: valgono i ricordi delle ricerche precedenti
                if (priority === 0 && killers) {
                    if (killers[0] && killers[0].from === m.from && killers[0].to === m.to) {
                        priority = ORDER_KILLER_FIRST;
                    } else if (killers[1] && killers[1].from === m.from && killers[1].to === m.to) {
                        priority = ORDER_KILLER_SECOND;
                    }
                }
                if (priority === 0 && ctx) priority = historyScore(ctx, m);
            }

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

    const moves = orderMoves(game.moves({ verbose: true }), ttMove, ctx, ctx.ply);

    /*
     * Niente mosse legali: o e' matto, o e' stallo. Si riconosce qui,
     * dove la lista delle mosse e' gia' pronta, invece di chiedere
     * in_checkmate() e far rigenerare tutto da capo.
     */
    if (moves.length === 0) {
        if (!game.in_check()) return 0;
        return game.turn() === 'w' ? -(MATE_SCORE - ctx.ply) : (MATE_SCORE - ctx.ply);
    }

    /*
     * TRATTO NULLO. Sta DOPO il controllo "niente mosse legali" per una
     * ragione di correttezza trovata in revisione: in uno stallo il
     * nullo inventerebbe un tempo che non esiste, e la ricerca ridotta,
     * cieca allo stallo alle sue spalle, certificherebbe come decisa
     * una posizione che vale 0. Da qui in giu' il lato al tratto ha
     * almeno una mossa vera.
     * La radice non e' toccata: al primo livello sotto chooseMove la
     * finestra e' piena, |limite| e' infinito e il tentativo non parte
     * nemmeno, quindi ogni mossa di radice resta cercata a finestra
     * piena come prima.
     * Le guardie stanno in ordine di costo, dalla piu' economica.
     */
    if (depth >= NULL_MOVE_MIN_DEPTH && ctx.nullBanPly !== ctx.ply) {
        // Il taglio restituisce il limite della finestra: se quel
        // limite e' infinito o parla di matto, niente tratto nullo.
        const cutLimit = isMaximizing ? beta : alpha;

        if (Math.abs(cutLimit) < NULL_MATE_BOUND
            && !game.in_check()
            && nullMovePruningAllowed(game)) {
            /*
             * Il tentativo ha senso solo se la valutazione ferma sta
             * gia' oltre la finestra: altrimenti la ricerca ridotta
             * sarebbe tempo perso quasi certo.
             */
            const standPat = evaluatePosition(game, ctx.ply);
            const alreadyOutside = isMaximizing ? standPat >= beta : standPat <= alpha;

            if (alreadyOutside) {
                const snapshot = game.makeNullMove();
                const previousBan = ctx.nullBanPly;
                ctx.ply++;
                // Il figlio diretto non puo' rispondere con un altro
                // nullo: due tratti passati di fila non provano niente.
                ctx.nullBanPly = ctx.ply;
                const value = isMaximizing
                    ? minimax(game, depth - 1 - NULL_MOVE_REDUCTION, beta - 1, beta, false, ctx)
                    : minimax(game, depth - 1 - NULL_MOVE_REDUCTION, alpha, alpha + 1, true, ctx);
                ctx.nullBanPly = previousBan;
                ctx.ply--;
                game.undoNullMove(snapshot);

                /*
                 * Fail-hard: si restituisce il limite della finestra,
                 * mai il punteggio della ricerca ridotta. Cosi' nessun
                 * numero nato da un tratto passato circola nel motore
                 * ne' finisce in tavola (il ritorno salta lo storeTT
                 * di questo nodo). Su timeout il valore e' spazzatura
                 * e si butta: la funzione prosegue per la via normale.
                 */
                if (!ctx.timedOut) {
                    if (isMaximizing && value >= beta) return beta;
                    if (!isMaximizing && value <= alpha) return alpha;
                }
            }
        }
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
        if (beta <= alpha) {
            /*
             * Una cattura che taglia si ritrova da sola nell'ordinamento:
             * si ricordano solo le mosse tranquille, che altrimenti
             * finirebbero in fondo alla lista.
             */
            if (!m.captured) {
                rememberKiller(ctx, ctx.ply, m);
                bumpHistory(ctx, m, depth);
            }
            break;
        }
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
    3: { label: 'Maestro', maxDepth: 8, quiescencePlies: 2, timeBudgetMs: 2200, blunderChance: 0 }
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
     * Tavola, killer e storia vivono per tutta la scelta della mossa: il
     * giro a profondita' 4 riusa quello che ha imparato il giro a
     * profondita' 3.
     */
    const tt = new Map();
    const killers = [];
    const history = new Map();
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
            nullBanPly: -1, // ply dove il tratto nullo e' vietato (risposta a un nullo)
            tt,
            killers,
            history
        };

        let roundBest = null;
        let roundScore = isMaximizing ? -Infinity : Infinity;
        const equallyGood = [];

        // La mossa migliore del giro precedente si prova per prima.
        const ordered = orderMoves(legalMoves);
        const first = ordered.findIndex((m) => m.from === bestMove.from && m.to === bestMove.to);
        if (first > 0) ordered.unshift(ordered.splice(first, 1)[0]);

        /*
         * Alla radice nessun limite deve mai passare per un punteggio:
         * un ramo potato restituisce un limite, e un limite scambiato
         * per il punteggio della mossa fa giocare una mossa qualunque
         * con il punteggio del matto trovato da un'altra (e' gia'
         * successo in questo progetto).
         *
         * Percio' la prima mossa del giro si cerca a finestra piena e
         * stabilisce il metro. Le altre passano prima da una finestra
         * di tre punti attorno al metro, che puo' solo dire: peggiore
         * (limite, si scarta senza usarlo), pari esatto (entra fra le
         * mosse di pari punteggio), o forse migliore. Solo in questo
         * ultimo caso la mossa si ricerca a finestra piena, e nel
         * confronto entra soltanto quel punteggio pieno. Ogni numero
         * che tocca roundScore o equallyGood resta cosi' un punteggio
         * vero, come prima: cambia solo quanto costa scartare le
         * mosse peggiori.
         */
        for (const m of ordered) {
            game.move(m, FAST_MOVE);
            ctx.ply++;
            let score;
            if (roundBest === null) {
                // La prima mossa del giro: finestra piena, punteggio esatto.
                score = minimax(game, depth - 1, -Infinity, Infinity, !isMaximizing, ctx);
            } else {
                score = minimax(game, depth - 1,
                    roundScore - ROOT_SCOUT_MARGIN, roundScore + ROOT_SCOUT_MARGIN,
                    !isMaximizing, ctx);
                // Il sondaggio dice "forse migliore": solo il punteggio
                // pieno puo' entrare nel confronto. Col tempo scaduto il
                // giro verra' comunque buttato: inutile ricercare.
                const maybeBetter = isMaximizing ? score > roundScore : score < roundScore;
                if (maybeBetter && !ctx.timedOut) {
                    score = minimax(game, depth - 1, -Infinity, Infinity, !isMaximizing, ctx);
                }
            }
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
