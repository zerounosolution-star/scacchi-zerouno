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

test('ripetizione: tre volte la stessa posizione e\' patta', () => {
    const g = new ZeroUnoChessEngine();
    assert.equal(g.in_threefold_repetition(), false);

    // I cavalli vanno avanti e indietro: la posizione iniziale torna
    // una seconda e poi una terza volta.
    play(g, 'g1f3', 'g8f6', 'f3g1', 'f6g8');
    assert.equal(g.in_threefold_repetition(), false, 'alla seconda volta non e\' ancora patta');

    play(g, 'g1f3', 'g8f6', 'f3g1', 'f6g8');
    assert.equal(g.in_threefold_repetition(), true);
    assert.equal(g.in_draw(), true);
    assert.equal(g.game_over(), true);
});

test('ripetizione: annullare la mossa toglie la posizione dal conteggio', () => {
    const g = new ZeroUnoChessEngine();
    play(g, 'g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8');
    assert.equal(g.in_threefold_repetition(), true);

    g.undo();
    assert.equal(g.in_threefold_repetition(), false, 'dopo undo la posizione e\' comparsa due volte');
    assert.equal(g.game_over(), false);
});

test('ripetizione: posizioni uguali ma con diritti di arrocco diversi non contano', () => {
    const g = new ZeroUnoChessEngine();
    g.load('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    const conArrocco = g.positionKey();

    // Il re bianco esce e torna: perde i diritti di arrocco per sempre.
    play(g, 'e1e2', 'e8e7', 'e2e1', 'e7e8');
    assert.notEqual(g.positionKey(), conArrocco, 'i diritti di arrocco fanno parte della posizione');
    assert.equal(g.in_threefold_repetition(), false);
});

test('regola delle 50 mosse: a 100 semimosse e\' patta', () => {
    const g = new ZeroUnoChessEngine();
    g.load('4k3/8/8/8/8/8/8/4K2R w K - 98 60');
    play(g, 'h1h2');
    assert.equal(g.halfMoves, 99);
    assert.equal(g.in_draw(), false);
    play(g, 'e8e7');
    assert.equal(g.halfMoves, 100);
    assert.equal(g.in_draw(), true);
});

test('conteggio posizioni: si puo\' passare a un altro motore', () => {
    const partita = new ZeroUnoChessEngine();
    play(partita, 'g1f3', 'g8f6', 'f3g1', 'f6g8');
    const chiaveIniziale = partita.positionKey();

    // L'AI riceve solo una FEN: senza la storia non sa di stare ripetendo
    const analisi = new ZeroUnoChessEngine();
    analisi.load(partita.fen());
    assert.equal(analisi.positionCounts.get(chiaveIniziale), 1);

    analisi.seedPositionCounts(partita.positionCountEntries());
    assert.equal(analisi.positionCounts.get(chiaveIniziale), 2);

    // Una terza comparsa della stessa posizione chiude la partita in patta
    play(analisi, 'g1f3', 'g8f6', 'f3g1', 'f6g8');
    assert.equal(analisi.in_threefold_repetition(), true);
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

test('impronta della posizione: stessa posizione, stessa impronta', () => {
    const a = new ZeroUnoChessEngine();
    const b = new ZeroUnoChessEngine();
    play(a, 'e2e4', 'e7e5', 'g1f3');
    b.load(a.fen());

    assert.equal(typeof a.positionKey(), 'number');
    assert.ok(Number.isFinite(a.positionKey()));
    assert.equal(a.positionKey(), b.positionKey(), 'due motori devono concordare');
});

test('impronta della posizione: il turno fa parte della posizione', () => {
    const bianco = new ZeroUnoChessEngine();
    bianco.load('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    const nero = new ZeroUnoChessEngine();
    nero.load('4k3/8/8/8/8/8/8/4K3 b - - 0 1');
    assert.notEqual(bianco.positionKey(), nero.positionKey());
});

test('mossa veloce: porta alla stessa posizione della mossa normale', () => {
    /*
     * La ricerca usa move(m, { fast: true }), che salta controllo di
     * legalita', notazione e simbolo di scacco. Il risultato sulla
     * scacchiera deve restare identico, altrimenti l'AI ragiona su una
     * posizione che non esiste.
     */
    const partite = [
        ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'e1g1'],
        ['e2e4', 'd7d5', 'e4d5', 'd8d5', 'b1c3', 'd5a5'],
        ['e2e4', 'a7a6', 'e4e5', 'd7d5', 'e5d6']
    ];

    for (const mosse of partite) {
        const normale = new ZeroUnoChessEngine();
        const veloce = new ZeroUnoChessEngine();

        for (const m of mosse) {
            const from = m.slice(0, 2);
            const to = m.slice(2, 4);

            normale.move({ from, to });

            // La mossa veloce vuole l'oggetto uscito da moves()
            const legale = veloce.moves({ verbose: true }).find((x) => x.from === from && x.to === to);
            assert.ok(legale, `mossa non trovata: ${m}`);
            veloce.move(legale, { fast: true });

            assert.equal(veloce.fen(), normale.fen(), `posizioni diverse dopo ${m}`);
            assert.equal(veloce.positionKey(), normale.positionKey(), `impronte diverse dopo ${m}`);
        }

        // E tornano indietro allo stesso modo
        while (normale.history().length > 0) {
            normale.undo();
            veloce.undo();
            assert.equal(veloce.fen(), normale.fen(), 'posizioni diverse dopo undo');
        }
    }
});

test('notazione: due cavalli sulla stessa casa si distinguono per colonna', () => {
    const g = new ZeroUnoChessEngine();
    // Cavalli bianchi in c3 e g1: tutti e due arrivano in e2
    g.load('4k3/8/8/8/8/2N5/8/4K1N1 w - - 0 1');
    play(g, 'c3e2');
    assert.equal(g.history().at(-1), 'Nce2');

    g.undo();
    play(g, 'g1e2');
    assert.equal(g.history().at(-1), 'Nge2');
});

test('notazione: stessa colonna, si distingue per traversa', () => {
    const g = new ZeroUnoChessEngine();
    // Torri bianche in a1 e a8: tutte e due arrivano in a4.
    // Il re nero sta in f5, fuori dalla colonna a: la mossa non da' scacco.
    g.load('R7/8/8/5k2/8/8/8/R3K3 w - - 0 1');
    play(g, 'a1a4');
    assert.equal(g.history().at(-1), 'R1a4');

    g.undo();
    play(g, 'a8a4');
    assert.equal(g.history().at(-1), 'R8a4');
});

test('notazione: un pezzo solo non prende nessuna aggiunta', () => {
    const g = new ZeroUnoChessEngine();
    g.load('4k3/8/8/8/8/2N5/8/4K3 w - - 0 1');
    play(g, 'c3e2');
    assert.equal(g.history().at(-1), 'Ne2');
});

test('notazione: la cattura tiene la x e la disambiguazione', () => {
    const g = new ZeroUnoChessEngine();
    // Cavalli in c3 e g1, pedone nero in e2
    g.load('4k3/8/8/8/8/2N5/4p3/4K1N1 w - - 0 1');
    play(g, 'c3e2');
    assert.equal(g.history().at(-1), 'Ncxe2');
});

test('promozione: il generatore propone tutti e quattro i pezzi', () => {
    const g = new ZeroUnoChessEngine();
    g.load('8/P6k/8/8/8/8/6K1/8 w - - 0 1');

    const promozioni = g.moves({ verbose: true }).filter((m) => m.from === 'a7' && m.to === 'a8');
    assert.equal(promozioni.length, 4);
    assert.deepEqual(promozioni.map((m) => m.promotion).sort(), ['b', 'n', 'q', 'r']);
    for (const m of promozioni) assert.ok(m.flags.includes('p'));
});

test('promozione: anche catturando si puo\' scegliere il pezzo', () => {
    const g = new ZeroUnoChessEngine();
    // Pedone bianco in b7, torre nera in a8: b8 e bxa8 sono tutte promozioni
    g.load('r6k/1P6/8/8/8/8/6K1/8 w - - 0 1');

    const catture = g.moves({ verbose: true }).filter((m) => m.from === 'b7' && m.to === 'a8');
    assert.equal(catture.length, 4);
    assert.deepEqual(catture.map((m) => m.promotion).sort(), ['b', 'n', 'q', 'r']);
    for (const m of catture) assert.equal(m.captured, 'r');
});

test('promozione: la mossa veloce rispetta il pezzo scelto', () => {
    const g = new ZeroUnoChessEngine();
    g.load('8/P6k/8/8/8/8/6K1/8 w - - 0 1');

    const cavallo = g.moves({ verbose: true }).find((m) => m.to === 'a8' && m.promotion === 'n');
    g.move(cavallo, { fast: true });
    assert.equal(g.get('a8').type, 'n');
});

test('promozione: la notazione dice in che cosa si promuove', () => {
    const g = new ZeroUnoChessEngine();
    g.load('8/P6k/8/8/8/8/6K1/8 w - - 0 1');

    for (const [pezzo, atteso] of [['q', 'a8=Q'], ['r', 'a8=R'], ['b', 'a8=B'], ['n', 'a8=N']]) {
        g.load('8/P6k/8/8/8/8/6K1/8 w - - 0 1');
        g.move({ from: 'a7', to: 'a8', promotion: pezzo });
        assert.equal(g.history().at(-1), atteso);
    }
});
