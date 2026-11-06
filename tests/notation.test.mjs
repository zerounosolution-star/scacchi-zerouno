/**
 * TEST DELLA MOSSA SCRITTA
 *
 *   npm test
 *
 * findMoveFromNotation legge quello che scrive chi gioca e lo confronta
 * con le mosse legali. Qui si prova che riconosce le forme ammesse e che
 * rifiuta il resto, senza toccare il DOM.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { ZeroUnoChessEngine } from '../src/engine/chess-engine.js';
import { findMoveFromNotation as cerca } from '../src/engine/notation.js';

/** Il motore nella posizione voluta. */
let chess = new ZeroUnoChessEngine();

function posizione(fen) {
    chess = new ZeroUnoChessEngine();
    if (fen) assert.ok(chess.load(fen), `FEN non caricata: ${fen}`);
}

/** Scorciatoia: la ricerca lavora sul motore di questo test. */
function findMoveFromNotation(testo) {
    return cerca(chess, testo);
}

test('mossa scritta: notazione del pedone', () => {
    posizione();
    const esito = findMoveFromNotation('e4');
    assert.equal(esito.error, undefined);
    assert.equal(esito.move.from, 'e2');
    assert.equal(esito.move.to, 'e4');
});

test('mossa scritta: notazione del pezzo, anche tutta minuscola', () => {
    posizione();
    assert.equal(findMoveFromNotation('Nf3').move.from, 'g1');
    assert.equal(findMoveFromNotation('nf3').move.from, 'g1');
});

test('mossa scritta: le due case, con o senza trattino', () => {
    posizione();
    for (const testo of ['e2e4', 'e2-e4']) {
        const esito = findMoveFromNotation(testo);
        assert.equal(esito.move.from, 'e2', `fallita: ${testo}`);
        assert.equal(esito.move.to, 'e4');
    }
});

test('mossa scritta: lo scacco in fondo non disturba', () => {
    // Donna in h5, il Nero ha giocato f6: Qxf7 e' matto
    posizione('rnbqkbnr/pppp1ppp/5p2/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 0 3');
    const esito = findMoveFromNotation('Qxf7#');
    assert.equal(esito.error, undefined);
    assert.equal(esito.move.to, 'f7');
});

test('mossa scritta: arrocco, con le O o con gli zeri', () => {
    posizione('r3k2r/pppq1ppp/2npbn2/2b1p3/2B1P3/2NPBN2/PPPQ1PPP/R3K2R w KQkq - 6 8');
    for (const testo of ['O-O', '0-0']) {
        const esito = findMoveFromNotation(testo);
        assert.equal(esito.error, undefined, `fallito: ${testo}`);
        assert.equal(esito.move.from, 'e1');
        assert.equal(esito.move.to, 'g1');
    }

    const lungo = findMoveFromNotation('O-O-O');
    assert.equal(lungo.move.to, 'c1');
});

test('mossa scritta: promozione, il pezzo scelto arriva fino in fondo', () => {
    posizione('8/P6k/8/8/8/8/6K1/8 w - - 0 1');

    const donna = findMoveFromNotation('a8=Q');
    assert.equal(donna.move.to, 'a8');
    assert.equal(donna.promotion, 'q');

    const cavallo = findMoveFromNotation('a8=N');
    assert.equal(cavallo.promotion, 'n');

    // Anche nella forma con le due case
    const breve = findMoveFromNotation('a7a8n');
    assert.equal(breve.promotion, 'n');
});

test('mossa scritta: due pezzi possono farla, serve la casa di partenza', () => {
    // Cavalli bianchi in c3 e g1: tutti e due arrivano in e2
    posizione('4k3/8/8/8/8/2N5/8/4K1N1 w - - 0 1');

    // La notazione del motore ora disambigua, quindi "Ne2" non esiste piu'
    assert.equal(findMoveFromNotation('Ne2').error, 'illegale');

    assert.equal(findMoveFromNotation('Nce2').move.from, 'c3');
    assert.equal(findMoveFromNotation('Nge2').move.from, 'g1');
    assert.equal(findMoveFromNotation('g1e2').move.from, 'g1');
});

test('mossa scritta: quello che non e\' una mossa viene rifiutato', () => {
    posizione();
    assert.equal(findMoveFromNotation('').error, 'vuoto');
    assert.equal(findMoveFromNotation('   ').error, 'vuoto');
    assert.equal(findMoveFromNotation('e5').error, 'illegale');     // il pedone non ci arriva
    assert.equal(findMoveFromNotation('Qh5').error, 'illegale');    // la donna e' chiusa
    assert.equal(findMoveFromNotation('ciao').error, 'illegale');
    assert.equal(findMoveFromNotation('z9z9').error, 'illegale');
});

test('mossa scritta: cercare una mossa non cambia la partita', () => {
    posizione();
    const prima = chess.fen();
    const storiaPrima = chess.history().length;

    findMoveFromNotation('e4');
    findMoveFromNotation('Nf3');
    findMoveFromNotation('mossa inventata');

    assert.equal(chess.fen(), prima, 'la posizione e\' cambiata');
    assert.equal(chess.history().length, storiaPrima);
});
