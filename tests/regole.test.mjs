/**
 * LE REGOLE DEL DATABASE E IL GIOCO DEVONO ANDARE D'ACCORDO
 *
 *   npm test
 *
 * Le regole in firebase/firestore.rules accettano solo cio' che il gioco
 * scrive davvero. Se un giorno il gioco comincia a scrivere un campo
 * nuovo, o una posizione in un'altra forma, le regole lo rifiuterebbero e
 * il gioco online si fermerebbe in silenzio. Queste prove non hanno
 * bisogno dell'emulatore: confrontano il codice del gioco con il testo
 * delle regole, e falliscono se i due si allontanano.
 *
 * Le prove vere delle regole, quelle che le mettono sotto attacco, sono in
 * firebase/regole.test.mjs e girano con `npm run regole`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ZeroUnoChessEngine } from '../src/engine/chess-engine.js';
import { isValidRoomCode } from '../src/online/lobby.js';

const radice = join(dirname(fileURLToPath(import.meta.url)), '..');
const regole = readFileSync(join(radice, 'firebase', 'firestore.rules'), 'utf8');
const gioco = readFileSync(join(radice, 'src', 'online', 'firestore.js'), 'utf8');

/** L'espressione scritta dentro una chiamata matches('...') delle regole, dopo un certo punto. */
function espressioneDopo(segnaposto) {
    const da = regole.indexOf(segnaposto);
    assert.ok(da >= 0, `nelle regole non trovo: ${segnaposto}`);
    const trovata = regole.slice(da).match(/matches\('([^']+)'\)/);
    assert.ok(trovata, `nessuna espressione dopo: ${segnaposto}`);
    return new RegExp(trovata[1]);
}

test('regole: ogni campo che il gioco scrive e\' fra quelli ammessi', () => {
    const ammessi = new Set(regole.match(/hasOnly\(\[([^\]]+)\]\)/)[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1)));
    assert.ok(ammessi.size >= 10, 'elenco dei campi ammessi non trovato nelle regole');

    // I campi scritti dal gioco: l'oggetto della stanza nuova e ogni updateDoc
    const scritti = new Set();
    const blocchi = [gioco.match(/const initialData = \{([\s\S]*?)\n    \};/)[1]];
    for (const [, corpo] of gioco.matchAll(/updateDoc\(matchDocRef, \{([\s\S]*?)\}\);/g)) blocchi.push(corpo);
    assert.ok(blocchi.length >= 4, 'non trovo le scritture del gioco: il test non sta guardando niente');
    for (const blocco of blocchi) {
        for (const [, campo] of blocco.matchAll(/^\s*([a-zA-Z]+)\s*:/gm)) scritti.add(campo);
    }
    assert.ok(scritti.size >= 10, 'pochi campi trovati nel gioco: il test non sta guardando niente');

    const fuori = [...scritti].filter((c) => !ammessi.has(c));
    assert.deepEqual(fuori, [], `il gioco scrive campi che le regole rifiutano: ${fuori.join(', ')}`);
});

test('regole: ogni posizione che il motore puo\' scrivere passa il controllo delle regole', () => {
    const forma = espressioneDopo('function isFen');

    // Partite a caso, con un caso ripetibile: ogni posizione incontrata deve passare
    let seme = 20261120;
    const caso = () => { seme = (seme * 1103515245 + 12345) & 0x7fffffff; return seme / 0x7fffffff; };
    let viste = 0;
    let piuLunga = 0;

    for (let partita = 0; partita < 120; partita++) {
        const motore = new ZeroUnoChessEngine();
        for (let semimossa = 0; semimossa < 160 && !motore.game_over(); semimossa++) {
            const mosse = motore.moves({ verbose: true });
            const scelta = mosse[Math.floor(caso() * mosse.length)];
            const promozione = ['q', 'r', 'b', 'n'][Math.floor(caso() * 4)];
            assert.ok(motore.move({ from: scelta.from, to: scelta.to, promotion: promozione }));
            const fen = motore.fen();
            viste++;
            piuLunga = Math.max(piuLunga, fen.length);
            assert.ok(forma.test(fen), `posizione rifiutata dalle regole: ${fen}`);
        }
    }

    assert.ok(viste > 5000, `poche posizioni provate (${viste})`);
    assert.ok(piuLunga <= 100, `una posizione supera i 100 caratteri ammessi dalle regole (${piuLunga})`);
    // E il controllo non e' largo: cio' che non e' una posizione non passa
    for (const falsa of ['', 'ciao', '<img src=x onerror=alert(1)>', '8/8/8/8/8/8/8/8', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1']) {
        assert.ok(!forma.test(falsa), `passa come posizione: «${falsa}»`);
    }
});

test('regole: i codici stanza del gioco passano, e la sala e le regole usano la stessa forma', () => {
    const forma = espressioneDopo('allow create');

    // I codici come li costruisce generateRoomCode(): prefisso piu' quattro caratteri dell'alfabeto
    const alfabeto = gioco.match(/const chars = '([A-Z0-9]+)';/)[1];
    const prefisso = gioco.match(/let code = '([A-Z0-9]+)';/)[1];
    assert.ok(alfabeto.length >= 20, 'alfabeto dei codici non trovato');
    for (const c of alfabeto) {
        const codice = prefisso + c.repeat(4);
        assert.ok(forma.test(codice), `le regole rifiutano il codice ${codice}`);
        assert.ok(isValidRoomCode(codice), `la sala rifiuta il codice ${codice}`);
    }

    // Stessa idea di «codice ben fatto» nelle regole e nella sala
    for (const prova of ['ZU4819', 'ABCD', 'ABCD1234', 'zuab12', 'A', 'TROPPOLUNGO1', 'ZU AB', '<b>', '']) {
        assert.equal(forma.test(prova), isValidRoomCode(prova), `regole e sala non concordano su «${prova}»`);
    }
});
