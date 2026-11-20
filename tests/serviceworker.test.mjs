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

/* ------------------------------------------------------------------ */
/* Il service worker messo in moto davvero, con un browser finto        */
/* ------------------------------------------------------------------ */

import vm from 'node:vm';
import { existsSync } from 'node:fs';

const ORIGINE = 'https://sito.test';

/**
 * Esegue sw.js dentro un ambiente che imita quello del browser e
 * restituisce gli ascoltatori che ha registrato e la lista dei file.
 */
function avviaServiceWorker() {
    const ascolti = {};
    const dispensa = { match: async () => new Response('dalla dispensa'), put: async () => {}, add: async () => {} };
    const contesto = vm.createContext({
        self: {
            addEventListener: (tipo, fn) => { ascolti[tipo] = fn; },
            location: { origin: ORIGINE },
            skipWaiting: async () => {},
            clients: { claim: async () => {} }
        },
        caches: { open: async () => dispensa, keys: async () => [], delete: async () => true },
        fetch: async () => new Response('dalla rete'),
        URL, Response, Promise, console
    });
    vm.runInContext(`${serviceWorker}\n;globalThis.__APP_SHELL = APP_SHELL;`, contesto);
    // Copia: la lista nasce in un altro ambiente e il confronto stretto la rifiuterebbe
    return { ascolti, appShell: Array.from(contesto.__APP_SHELL) };
}

/** Manda una richiesta al service worker e dice se l'ha presa in carico lui. */
function presaInCarico(ascolti, url, extra = {}) {
    let risposto = false;
    ascolti.fetch({
        request: { method: 'GET', mode: 'cors', url, ...extra },
        respondWith: (promessa) => { risposto = true; Promise.resolve(promessa).catch(() => {}); }
    });
    return risposto;
}

test('service worker: ogni file della dispensa esiste davvero', () => {
    /*
     * L'installazione salta in silenzio i file che non trova: un nome
     * scritto male non da' errore, lascia solo il gioco a meta' senza rete.
     */
    const { appShell } = avviaServiceWorker();
    assert.ok(appShell.length > 20, 'lista della dispensa vuota: il test non sta guardando niente');

    const mancanti = appShell
        .filter((voce) => voce !== './')
        .filter((voce) => !existsSync(join(radice, voce)));
    assert.deepEqual(mancanti, [], `in sw.js ma non sul disco: ${mancanti.join(', ')}`);
});

test('service worker: la configurazione con la chiave passa sempre dalla rete', () => {
    const { ascolti } = avviaServiceWorker();

    // Non la prende in carico: la richiesta va alla rete, e non finisce in dispensa
    assert.equal(presaInCarico(ascolti, `${ORIGINE}/scacchi-zerouno/firebase.config.js`), false);
    assert.equal(presaInCarico(ascolti, `${ORIGINE}/firebase.config.js`), false);

    // I file del gioco invece li serve lui
    assert.equal(presaInCarico(ascolti, `${ORIGINE}/scacchi-zerouno/src/main.js`), true);
    assert.equal(presaInCarico(ascolti, `${ORIGINE}/scacchi-zerouno/`, { mode: 'navigate' }), true);

    // Un file con lo stesso nome su un altro sito non e' la nostra configurazione
    assert.equal(presaInCarico(ascolti, 'https://altro.test/firebase.config.js'), true);

    // Come prima: le partite online e le scritture non passano dalla dispensa
    assert.equal(presaInCarico(ascolti, 'https://firestore.googleapis.com/v1/x'), false);
    assert.equal(presaInCarico(ascolti, `${ORIGINE}/scacchi-zerouno/src/main.js`, { method: 'POST' }), false);
});
