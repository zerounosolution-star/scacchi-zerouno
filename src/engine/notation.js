/**
 * LETTURA DELLA MOSSA SCRITTA
 *
 * Trasforma quello che scrive chi gioca ("e4", "Nf6", "O-O", "e2e4")
 * nella mossa corrispondente, se e' legale in quella posizione.
 *
 * Modulo puro: riceve il motore, non tocca il DOM e non conosce lo stato
 * dell'applicazione. Per questo si prova con `npm test`.
 *
 * La notazione accettata e' la stessa che l'applicazione scrive nel
 * taccuino: lettere inglesi dei pezzi (K Q R B N). In italiano la R
 * vorrebbe dire re e qui vuol dire torre, quindi mescolare le due
 * notazioni creerebbe mosse ambigue.
 */

/** Toglie quello che non cambia la mossa: scacco, punteggiatura, spazi. */
function normalize(text) {
    return String(text || '')
        .trim()
        .replace(/[+#?!\s]/g, '')
        .replace(/0/g, 'O');
}

/**
 * La notazione di una mossa legale.
 * La calcola il motore: si gioca la mossa, si legge, si torna indietro.
 *
 * @param {ZeroUnoChessEngine} game
 * @param {object} move  Mossa uscita da moves({ verbose: true }).
 * @returns {string|null}
 */
function notationOf(game, move) {
    const done = game.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });
    if (!done) return null;
    const san = done.san;
    game.undo();
    return san;
}

/**
 * Cerca fra le mosse legali quella scritta.
 *
 * @param {ZeroUnoChessEngine} game
 * @param {string} text
 * @returns {{move: object, promotion: string|null}|{error: string}}
 */
export function findMoveFromNotation(game, text) {
    const wanted = normalize(text);
    if (!wanted) return { error: 'vuoto' };

    const legal = game.moves({ verbose: true });

    // 1. Le due case: e2e4, e2-e4, e7xd8, e7e8q
    const coord = wanted.match(/^([a-h][1-8])[x-]?([a-h][1-8])([qrbnQRBN])?$/);
    if (coord) {
        const move = legal.find((m) => m.from === coord[1] && m.to === coord[2]);
        if (!move) return { error: 'illegale' };
        return { move, promotion: coord[3] ? coord[3].toLowerCase() : null };
    }

    /*
     * 2. Notazione algebrica. Prima si confronta rispettando maiuscole e
     * minuscole, perche' "b4" (pedone) e "B4" (alfiere) sono due mosse
     * diverse. Solo se nessuna corrisponde si riprova ignorandole, per
     * chi scrive tutto minuscolo.
     */
    /*
     * Il pezzo di una promozione si confronta a parte. Il motore genera
     * una sola mossa di promozione e la scrive sempre "=Q": chi vuole un
     * cavallo scrive "a8=N", che deve trovare la stessa mossa con un
     * pezzo diverso.
     */
    const promotion = promotionFrom(wanted);
    const wantedBase = withoutPromotion(wanted);

    const notations = legal.map((move) => ({
        move,
        san: withoutPromotion(normalize(notationOf(game, move)))
    }));

    const exact = notations.filter((entry) => entry.san === wantedBase);
    if (exact.length > 0) return resolve(exact, promotion);

    const loose = notations.filter((entry) => entry.san.toLowerCase() === wantedBase.toLowerCase());
    if (loose.length > 0) return resolve(loose, promotion);

    return { error: 'illegale' };
}

/**
 * Sceglie fra le mosse che hanno la stessa notazione.
 *
 * Due casi diversi: pezzi diversi che arrivano sulla stessa casa (allora
 * la notazione e' davvero ambigua), oppure lo stesso pedone che promuove
 * in pezzi diversi, che hanno tutte la stessa notazione una volta tolto
 * il pezzo finale.
 *
 * @param {Array<{move: object}>} candidates
 * @param {string|null} promotion
 */
function resolve(candidates, promotion) {
    if (candidates.length === 1) return { move: candidates[0].move, promotion };

    const first = candidates[0].move;
    const stessaStrada = candidates.every((c) => c.move.from === first.from && c.move.to === first.to);
    if (!stessaStrada) return { error: 'ambigua' };

    if (promotion) {
        const scelta = candidates.find((c) => c.move.promotion === promotion);
        return scelta ? { move: scelta.move, promotion } : { error: 'illegale' };
    }

    // Nessun pezzo indicato: lo chiede la finestra di promozione
    return { move: first, promotion: null };
}

/** Il pezzo scelto in una promozione scritta, per esempio "e8=Q". */
function promotionFrom(wanted) {
    const match = wanted.match(/=([QRBNqrbn])$/);
    return match ? match[1].toLowerCase() : null;
}

/** La stessa notazione senza il pezzo di promozione. */
function withoutPromotion(text) {
    return text.replace(/=[QRBNqrbn]$/, '');
}
