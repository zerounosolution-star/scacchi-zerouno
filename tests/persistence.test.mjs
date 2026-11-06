/**
 * TEST DELLA PARTITA SALVATA
 *
 * Qui si prova la parte che non dipende dal browser: rigiocare le
 * mosse salvate e rifiutare un salvataggio incoerente.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { replayMoves } from '../src/core/persistence.js';
import { chess } from '../src/core/state.js';

test('rigioca le mosse salvate e ricostruisce la posizione', () => {
    const snapshot = {
        version: 1,
        gameMode: 'ai',
        moves: [
            { from: 'e2', to: 'e4' },
            { from: 'e7', to: 'e5' },
            { from: 'g1', to: 'f3' }
        ]
    };

    assert.equal(replayMoves(snapshot), true);
    assert.equal(chess.fen(), 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2');
    assert.deepEqual(chess.history(), ['e4', 'e5', 'Nf3']);
});

test('rigioca anche una promozione', () => {
    const snapshot = {
        version: 1,
        gameMode: 'local',
        // 1.e4 d5 2.exd5 Cf6 3.d6 Ce4 4.dxc7 Cc5 5.cxb8=C
        moves: [
            { from: 'e2', to: 'e4' }, { from: 'd7', to: 'd5' },
            { from: 'e4', to: 'd5' }, { from: 'g8', to: 'f6' },
            { from: 'd5', to: 'd6' }, { from: 'f6', to: 'e4' },
            { from: 'd6', to: 'c7' }, { from: 'e4', to: 'c5' },
            { from: 'c7', to: 'b8', promotion: 'n' }
        ]
    };

    assert.equal(replayMoves(snapshot), true);
    assert.equal(chess.get('b8').type, 'n', 'il pedone promosso a cavallo resta cavallo');
    assert.equal(chess.get('b8').color, 'w');
    assert.equal(chess.history().at(-1), 'cxb8=N');
});

test('un salvataggio incoerente viene rifiutato e la scacchiera torna a nuova', () => {
    const snapshot = {
        version: 1,
        gameMode: 'ai',
        moves: [
            { from: 'e2', to: 'e4' },
            { from: 'e7', to: 'e5' },
            { from: 'a1', to: 'a8' } // torre che salta i propri pezzi: impossibile
        ]
    };

    assert.equal(replayMoves(snapshot), false);
    assert.equal(chess.fen(), 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    assert.equal(chess.history().length, 0);
});
