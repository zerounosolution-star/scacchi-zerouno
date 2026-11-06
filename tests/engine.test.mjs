/**
 * TEST DEL MOTORE SCACCHISTICO
 *
 * Nessuna dipendenza esterna: usa il test runner incluso in Node.
 *
 *   node --test tests/
 *
 * Il motore e' puro (non tocca il DOM), quindi si prova fuori dal browser.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { ZeroUnoChessEngine, sqToCoords, coordsToSq } from '../src/engine/chess-engine.js';

/** Esegue una sequenza di mosse scritte come 'e2e4'. */
function play(game, ...moves) {
    for (const m of moves) {
        const done = game.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
        assert.ok(done, `mossa rifiutata: ${m}`);
    }
    return game;
}

test('coordinate: casella e conversione sono reversibili', () => {
    for (const sq of ['a1', 'h8', 'e4', 'd7']) {
        const { r, c } = sqToCoords(sq);
        assert.equal(coordsToSq(r, c), sq);
    }
});

test('posizione iniziale: 20 mosse legali e tocca al Bianco', () => {
    const g = new ZeroUnoChessEngine();
    assert.equal(g.turn(), 'w');
    assert.equal(g.moves().length, 20);
    assert.equal(g.fen(), 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
});

test('apertura italiana: FEN e notazione corrette', () => {
    const g = play(new ZeroUnoChessEngine(), 'e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6');
    assert.equal(g.fen(), 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4');
    assert.deepEqual(g.history(), ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6']);
});

test('matto del folle: riconosciuto come scacco matto', () => {
    const g = play(new ZeroUnoChessEngine(), 'f2f3', 'e7e5', 'g2g4', 'd8h4');
    assert.equal(g.in_checkmate(), true);
    assert.equal(g.game_over(), true);
    assert.equal(g.moves().length, 0);
});

test('arrocco corto del Bianco: re in g1 e torre in f1', () => {
    const g = play(new ZeroUnoChessEngine(), 'e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'e1g1');
    assert.equal(g.get('g1').type, 'k');
    assert.equal(g.get('f1').type, 'r');
    assert.equal(g.get('e1'), null);
    assert.equal(g.get('h1'), null);
    assert.equal(g.history().at(-1), 'O-O');
});

test('arrocco lungo del Nero: re in c8 e torre in d8', () => {
    const g = new ZeroUnoChessEngine();
    g.load('r3kbnr/pppqpppp/2npb3/8/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 0 1');
    play(g, 'e8c8');
    assert.equal(g.get('c8').type, 'k');
    assert.equal(g.get('d8').type, 'r');
    assert.equal(g.history().at(-1), 'O-O-O');
});

test('presa en passant: il pedone catturato sparisce', () => {
    const g = play(new ZeroUnoChessEngine(), 'e2e4', 'a7a6', 'e4e5', 'd7d5', 'e5d6');
    assert.equal(g.get('d6').type, 'p');
    assert.equal(g.get('d5'), null, 'il pedone preso en passant deve sparire da d5');
});

test('promozione a donna: il pedone diventa donna', () => {
    const g = new ZeroUnoChessEngine();
    g.load('8/P6k/8/8/8/8/6K1/8 w - - 0 1');
    play(g, 'a7a8q');
    assert.equal(g.get('a8').type, 'q');
    assert.equal(g.get('a8').color, 'w');
});

test('promozione a cavallo: la scelta viene rispettata', () => {
    const g = new ZeroUnoChessEngine();
    g.load('8/P6k/8/8/8/8/6K1/8 w - - 0 1');
    play(g, 'a7a8n');
    assert.equal(g.get('a8').type, 'n');
});

test('stallo: niente mosse legali ma nessuno scacco', () => {
    const g = new ZeroUnoChessEngine();
    g.load('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    assert.equal(g.in_check(), false);
    assert.equal(g.in_stalemate(), true);
    assert.equal(g.in_checkmate(), false);
    assert.equal(g.game_over(), true);
});

test('materiale insufficiente: re contro re e alfiere', () => {
    const g = new ZeroUnoChessEngine();
    g.load('8/8/4k3/8/8/4KB2/8/8 w - - 0 1');
    assert.equal(g.insufficient_material(), true);
    assert.equal(g.in_draw(), true);
});

test('annulla mossa: la posizione torna identica', () => {
    const g = new ZeroUnoChessEngine();
    const partenza = g.fen();
    play(g, 'e2e4', 'c7c5', 'g1f3');
    g.undo();
    g.undo();
    g.undo();
    assert.equal(g.fen(), partenza);
    assert.equal(g.history().length, 0);
});

test('mossa illegale: viene rifiutata e non cambia la posizione', () => {
    const g = new ZeroUnoChessEngine();
    const partenza = g.fen();
    assert.equal(g.move({ from: 'e2', to: 'e5' }), null);
    assert.equal(g.move({ from: 'e1', to: 'e3' }), null);
    assert.equal(g.fen(), partenza);
});

test('re inchiodato: non si puo\' esporre il proprio re allo scacco', () => {
    const g = new ZeroUnoChessEngine();
    g.load('4k3/8/8/8/8/8/4R3/4K2r w - - 0 1');
    const mosseTorre = g.moves({ verbose: true }).filter((m) => m.from === 'e2');
    for (const m of mosseTorre) {
        assert.ok(m.to.startsWith('e'), `la torre inchiodata non puo' andare in ${m.to}`);
    }
});

test('FEN: caricamento e rilettura danno la stessa stringa', () => {
    const posizioni = [
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 5',
        '8/8/8/4k3/8/8/4K3/8 w - - 12 40'
    ];
    for (const fen of posizioni) {
        const g = new ZeroUnoChessEngine();
        g.load(fen);
        assert.equal(g.fen(), fen);
    }
});
