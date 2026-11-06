/**
 * TEST DEL SERVICE WORKER
 *
 *   npm test
 *
 * Il guasto da evitare e' sempre lo stesso: si aggiunge un modulo, ci si
 * dimentica di metterlo nella lista di sw.js, e senza rete l'applicazione
 * si apre a meta'. Un errore che si vede solo in aereo.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const radice = join(dirname(fileURLToPath(import.meta.url)), '..');
const serviceWorker = readFileSync(join(radice, 'sw.js'), 'utf8');

/** Tutti i file di codice sotto src/, come percorsi del sito. */
function moduliDelProgetto(cartella = 'src') {
    const risultati = [];
    for (const voce of readdirSync(join(radice, cartella), { withFileTypes: true })) {
        const percorso = `${cartella}/${voce.name}`;
        if (voce.isDirectory()) risultati.push(...moduliDelProgetto(percorso));
        else if (['.js', '.css'].includes(extname(voce.name))) risultati.push(`./${percorso}`);
    }
    return risultati;
}

test('service worker: ogni modulo del progetto e\' in cache', () => {
    const moduli = moduliDelProgetto();
    assert.ok(moduli.length > 10, 'nessun modulo trovato: il test non sta guardando niente');

    const mancanti = moduli.filter((m) => !serviceWorker.includes(`'${m}'`));
    assert.deepEqual(mancanti, [], `moduli non elencati in sw.js: ${mancanti.join(', ')}`);
});

test('service worker: ci sono anche pagina, manifesto e icone', () => {
    for (const file of ['./index.html', './manifest.webmanifest', './assets/icons/icon-192.png', './assets/icons/icon-512.png']) {
        assert.ok(serviceWorker.includes(`'${file}'`), `manca in sw.js: ${file}`);
    }
});

test('service worker: i file di terze parti si scaricano all\'installazione', () => {
    /*
     * Alla prima visita il service worker non controlla ancora la pagina:
     * Tailwind e Tone.js non passerebbero da lui e senza rete la pagina
     * resterebbe senza impaginazione.
     */
    assert.match(serviceWorker, /CDN_SHELL\s*=/);
    assert.ok(serviceWorker.includes('cdn.tailwindcss.com'), 'Tailwind non e\' fra i file di terze parti');
    assert.ok(serviceWorker.includes('cdnjs.cloudflare.com'), 'Tone.js non e\' fra i file di terze parti');
});

test('service worker: la versione della cache e\' dichiarata', () => {
    const match = serviceWorker.match(/const CACHE_VERSION = '([^']+)'/);
    assert.ok(match, 'CACHE_VERSION non trovata');
    assert.match(match[1], /^v\d+$/, `versione fuori formato: ${match[1]}`);
});
