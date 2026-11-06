/**
 * SERVICE WORKER DI SCACCHI ZEROUNO
 *
 * Fa funzionare l'applicazione anche senza rete: le partite contro l'AI
 * e in due sullo stesso dispositivo non hanno bisogno di internet, e
 * dopo la prima visita non devono piu' scaricare nulla.
 *
 * Strategie:
 * - navigazione (la pagina): prima la rete, la copia in cache se la
 *   rete manca. Cosi' una versione nuova arriva subito quando c'e'
 *   connessione.
 * - file dell'applicazione: si serve la copia in cache e intanto si
 *   scarica l'aggiornamento, che vale dal caricamento successivo.
 * - CDN (Tailwind, Tone.js, caratteri): si tiene la copia scaricata.
 *
 * ATTENZIONE: dopo aver modificato i file del progetto, alzare
 * CACHE_VERSION, altrimenti i visitatori abituali continuano a vedere
 * la versione vecchia fino alla scadenza della cache del browser.
 */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `scacchi-zerouno-${CACHE_VERSION}`;

/** File indispensabili per giocare senza rete. */
const APP_SHELL = [
    './',
    './index.html',
    './manifest.webmanifest',
    './assets/icons/favicon.svg',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png',
    './src/main.js',
    './src/config/app.config.js',
    './src/config/tailwind.config.js',
    './src/css/styles.css',
    './src/core/state.js',
    './src/core/sound.js',
    './src/core/utils.js',
    './src/core/persistence.js',
    './src/data/pieces.js',
    './src/data/videos.js',
    './src/data/challengers.js',
    './src/engine/chess-engine.js',
    './src/engine/search.js',
    './src/engine/ai.js',
    './src/engine/ai.worker.js',
    './src/ui/board.js',
    './src/ui/input.js',
    './src/ui/keyboard.js',
    './src/ui/panels.js',
    './src/ui/gameover.js',
    './src/game/modes.js',
    './src/online/firestore.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        // addAll fallisce in blocco se un file manca: meglio uno per uno
        await Promise.all(APP_SHELL.map((url) => cache.add(url).catch(() => null)));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(
            names
                .filter((name) => name.startsWith('scacchi-zerouno-') && name !== CACHE_NAME)
                .map((name) => caches.delete(name))
        );
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Le partite online devono sempre passare dalla rete
    if (url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('firebaseio.com')) {
        return;
    }

    // La pagina: prima la rete, poi la cache
    if (request.mode === 'navigate') {
        event.respondWith((async () => {
            try {
                const fresh = await fetch(request);
                const cache = await caches.open(CACHE_NAME);
                cache.put('./index.html', fresh.clone());
                return fresh;
            } catch (err) {
                const cached = await caches.match('./index.html');
                return cached || Response.error();
            }
        })());
        return;
    }

    // Tutto il resto: copia in cache subito, aggiornamento in sottofondo
    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);

        const network = fetch(request)
            .then((response) => {
                if (response && (response.ok || response.type === 'opaque')) {
                    cache.put(request, response.clone());
                }
                return response;
            })
            .catch(() => null);

        return cached || (await network) || Response.error();
    })());
});
