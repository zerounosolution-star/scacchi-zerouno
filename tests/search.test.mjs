/**
 * TEST DELLA RICERCA DELL'AI
 *
 *   npm test
 *
 * Prove di comportamento, non di punteggio: l'AI deve vedere il matto,
 * prendere il pezzo regalato e non lasciare pezzi in presa per niente.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { chooseMove, evaluatePosition, LEVELS } from '../src/engine/search.js';
import { ZeroUnoChessEngine } from '../src/engine/chess-engine.js';

/** Vero se la mossa proposta e' davvero legale nella posizione. */
function isLegal(fen, move) {
    const game = new ZeroUnoChessEngine();
    game.load(fen);
    return game.moves({ verbose: true }).some((m) => m.from === move.from && m.to === move.to);
}

const PARTENZA = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

test('ogni livello propone una mossa legale', () => {
    for (const level of [1, 2, 3]) {
        const move = chooseMove(PARTENZA, level, { timeBudgetMs: 300 });
        assert.ok(move, `il livello ${level} non ha proposto nulla`);
        assert.ok(isLegal(PARTENZA, move), `il livello ${level} ha proposto una mossa illegale`);
    }
});

test('vede lo scacco matto in una mossa', () => {
    // Donna in f3, alfiere in c4: Dxf7 e' matto.
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1';
    const move = chooseMove(fen, 2, { timeBudgetMs: 1000 });
    assert.equal(move.from, 'f3');
    assert.equal(move.to, 'f7');
});

test('prende la donna lasciata in presa', () => {
    const fen = 'rnb1kbnr/pppp1ppp/8/4p3/6q1/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 1';
    const move = chooseMove(fen, 2, { timeBudgetMs: 1000 });
    assert.equal(move.to, 'g4', 'la donna in g4 si prende');
});

test('evita lo scambio in perdita: non prende il pedone difeso con la donna', () => {
    // Dh5 puo' prendere in e5, ma il pedone e' difeso dal cavallo in c6.
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p2Q/8/8/PPPPPPPP/RNB1KBNR w KQkq - 0 1';
    const move = chooseMove(fen, 2, { timeBudgetMs: 1200 });
    assert.notEqual(`${move.from}${move.to}`, 'h5e5', 'la donna non va regalata al cavallo');
});

test('non lascia la propria donna in presa quando puo' + "' salvarla", () => {
    // Donna bianca in d5 attaccata dal cavallo in c6: va spostata.
    const fen = 'r1bqkbnr/pppp1ppp/2n5/3Qp3/8/8/PPPP1PPP/RNB1KBNR w KQkq - 0 1';
    const move = chooseMove(fen, 2, { timeBudgetMs: 1200 });
    const game = new ZeroUnoChessEngine();
    game.load(fen);
    game.move({ from: move.from, to: move.to });

    // Dopo la mossa, il Nero non deve poter catturare la donna gratis.
    const rispostaCheMangiaLaDonna = game.moves({ verbose: true })
        .some((m) => m.captured === 'q');
    assert.equal(rispostaCheMangiaLaDonna, false, `mossa scelta: ${move.from}${move.to}`);
});

test('rispetta il tetto di tempo', () => {
    const fen = 'r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P1B2/2PBPN2/PP1N1PPP/R2Q1RK1 w - - 0 1';
    const inizio = Date.now();
    const move = chooseMove(fen, 3, { timeBudgetMs: 500 });
    const durata = Date.now() - inizio;
    assert.ok(move, 'nessuna mossa proposta');
    assert.ok(durata < 1500, `la ricerca ha sforato il tetto di tempo: ${durata} ms`);
});

test('valutazione: posizione iniziale in equilibrio, pezzo in piu\' positivo', () => {
    const pari = new ZeroUnoChessEngine();
    assert.equal(evaluatePosition(pari), 0);

    const donnaInPiu = new ZeroUnoChessEngine();
    donnaInPiu.load('rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    assert.ok(evaluatePosition(donnaInPiu) > 800, 'una donna in piu\' vale quasi mille');
});

test('i tre livelli sono configurati in ordine crescente di forza', () => {
    assert.ok(LEVELS[1].maxDepth < LEVELS[2].maxDepth);
    assert.ok(LEVELS[2].maxDepth < LEVELS[3].maxDepth);
    assert.ok(LEVELS[2].timeBudgetMs < LEVELS[3].timeBudgetMs);
});
