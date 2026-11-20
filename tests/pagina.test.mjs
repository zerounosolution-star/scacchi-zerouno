/**
 * TEST DELLA PAGINA
 *
 *   npm test
 *
 * Dal 20 novembre 2026 la pagina non carica piu' programmi da siti
 * esterni: Tailwind e' un foglio di stile costruito una volta e Tone.js
 * e' una copia tenuta in casa. Queste prove tengono ferme tre cose:
 * nessun programma esterno rientra per sbaglio, la copia di Tone.js e'
 * quella ufficiale, e il foglio di Tailwind non resta indietro rispetto
 * alla pagina.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { raccogliClassi, improntaDelleClassi } from '../tailwind/classi.mjs';

const radice = join(dirname(fileURLToPath(import.meta.url)), '..');
const leggi = (percorso) => readFileSync(join(radice, percorso));
const pagina = leggi('index.html').toString('utf8');

test('pagina: il foglio di Tailwind e\' stato rifatto dopo l\'ultima modifica alle classi', () => {
    /*
     * `npm run css` salva l'impronta delle classi scritte nella pagina e
     * nei moduli. Se qui non coincide, qualcuno ha aggiunto o tolto una
     * classe senza ricostruire il foglio: la classe nuova resterebbe
     * senza stile. E' successo il giorno stesso del passaggio, con mt-2.
     */
    const scheda = JSON.parse(leggi('tailwind/classi.json').toString('utf8'));
    const classi = raccogliClassi(radice);
    assert.ok(classi.length > 100, 'poche classi trovate: il test non sta guardando niente');
    assert.equal(
        improntaDelleClassi(classi),
        scheda.impronta,
        'le classi usate nella pagina o nei moduli sono cambiate dopo l\'ultima costruzione del foglio: rilancia "npm run css"'
    );
});

test('pagina: nessun programma arriva da un sito esterno', () => {
    const programmi = [...pagina.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
    assert.ok(programmi.length >= 2, 'nessun <script src> trovato: il test non sta guardando niente');

    const esterni = programmi.filter((src) => /^(https?:)?\/\//i.test(src));
    assert.deepEqual(esterni, [], `programmi presi da fuori: ${esterni.join(', ')}`);
});

test('pagina: la copia di Tone.js e\' il file ufficiale, non ritoccato', () => {
    /*
     * L'impronta e' quella pubblicata da cdnjs per tone 14.8.49 / Tone.js.
     * Se il file cambia anche di un carattere, questa prova fallisce: chi
     * aggiorna Tone.js aggiorna anche l'impronta, sapendo di farlo.
     */
    const UFFICIALE = 'jduERlz7En1IUZR54bqzpNI64AbffZWR//KJgF71SJ8D8/liKFZ+s1RxmUmB+bhCnIfzebdZsULwOrbVB5f3nQ==';
    const impronta = createHash('sha512').update(leggi('assets/vendor/tone-14.8.49.js')).digest('base64');
    assert.equal(impronta, UFFICIALE);
});

test('pagina: il foglio di Tailwind viene dopo quello del progetto', () => {
    /*
     * Tailwind preso dal suo sito scriveva gli stili in fondo alla testa
     * della pagina, quindi dopo styles.css. Il foglio costruito deve
     * tenere lo stesso posto, o a parita' di peso vincerebbe l'altro.
     */
    const progetto = pagina.indexOf('href="src/css/styles.css"');
    const tailwind = pagina.indexOf('href="src/css/tailwind.css"');
    assert.ok(progetto > 0, 'styles.css non e\' collegato');
    assert.ok(tailwind > 0, 'tailwind.css non e\' collegato');
    assert.ok(progetto < tailwind, 'tailwind.css deve venire dopo styles.css');
});

/**
 * Il nome di una classe come lo scrive Tailwind dentro il foglio di stile:
 * ogni segno speciale con la barra davanti, tranne la virgola, che diventa
 * il suo codice (2c) seguito da uno spazio.
 */
function selettore(classe) {
    const corpo = classe.replace(/[^a-zA-Z0-9_-]/g, (c) => (c === ',' ? '\\2c ' : `\\${c}`));
    return /^\d/.test(corpo) ? `\\3${corpo[0]} ${corpo.slice(1)}` : corpo;
}

test('pagina: le classi Tailwind riconoscibili hanno la loro regola nel foglio costruito', () => {
    /*
     * Non tutte le classi della pagina sono di Tailwind (quelle del
     * progetto cominciano per zu-). Qui si controllano solo le forme che
     * non lasciano dubbi: quelle con una variante (sm:, hover:, ...), con
     * un valore fra parentesi quadre, o con un colore della nostra palette.
     * Se una di queste manca nel foglio, qualcuno ha aggiunto una classe
     * senza rilanciare `npm run css`.
     */
    const foglio = leggi('src/css/tailwind.css').toString('utf8');
    const classi = new Set();
    for (const [, valore] of pagina.matchAll(/\bclass\s*=\s*"([^"]*)"/g)) {
        for (const classe of valore.split(/\s+/)) if (classe) classi.add(classe);
    }
    assert.ok(classi.size > 50, 'poche classi trovate: il test non sta guardando niente');

    const sicure = [...classi].filter((c) =>
        c.includes(':') || c.includes('[') || /-(ivory|anthracite|bronze)-\d/.test(c));
    assert.ok(sicure.length > 20, 'nessuna classe Tailwind riconosciuta: il test non sta guardando niente');

    const mancanti = sicure.filter((c) => !foglio.includes(`.${selettore(c)}`));
    assert.deepEqual(mancanti, [], `classi senza regola in tailwind.css (rilancia "npm run css"): ${mancanti.join(' ')}`);
});
