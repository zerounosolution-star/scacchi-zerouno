/**
 * SERVICE WORKER DI SCACCHI ZEROUNO
 *
 * Fa funzionare l'applicazione anche senza rete: le partite contro l'AI
 * e in due sullo stesso dispositivo non hanno bisogno di internet, e
 * dopo la prima visita non devono piu' scaricare nulla.
 *
 * Strategie:
 * - pagina e file del gioco: si servono dalla dispensa della versione
 *   corrente, tutti della stessa generazione. La versione nuova arriva
 *   quando il service worker nuovo si installa, e una fascia propone
 *   la ricarica.
 * - tutto il resto (caratteri, anteprime dei video): rete, con copia
 *   in dispensa per l'uso senza rete.
 * - partite online, statistiche e configurazione con la chiave: sempre
 *   dalla rete, mai dalla dispensa.
 *
 * Dal 20 novembre 2026 Tailwind e Tone.js non arrivano piu' da siti
 * esterni: sono file del progetto come gli altri, e stanno nella lista
 * qui sotto.
 *
 * ATTENZIONE: dopo aver modificato i file del progetto, alzare
 * CACHE_VERSION, altrimenti i visitatori abituali continuano a vedere
 * la versione vecchia fino alla scadenza della cache del browser.
 */

const CACHE_VERSION = 'v24';
const CACHE_NAME = `scacchi-zerouno-${CACHE_VERSION}`;

/** File indispensabili per giocare senza rete. */
const APP_SHELL = [
    './',
    './index.html',
    './manifest.webmanifest',
    './assets/icons/favicon.svg',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png',
    './assets/vendor/tone-14.8.49.js',
    './src/main.js',
    './src/config/app.config.js',
    './src/css/styles.css',
    './src/css/tailwind.css',
    './src/core/state.js',
    './src/core/sound.js',
    './src/core/utils.js',
    './src/core/update.js',
    './src/core/analytics.js',
    './src/core/persistence.js',
    './src/data/pieces.js',
    './src/data/videos.js',
    './src/data/challengers.js',
    './src/engine/chess-engine.js',
    './src/engine/search.js',
    './src/engine/ai.js',
    './src/engine/ai.worker.js',
    './src/engine/notation.js',
    './src/ui/board.js',
    './src/ui/input.js',
    './src/ui/keyboard.js',
    './src/ui/moveinput.js',
    './src/ui/nameedit.js',
    './src/ui/fullscreen.js',
    './src/ui/promo.js',
    './src/ui/sidepanel.js',
    './src/ui/review.js',
    './src/ui/panels.js',
    './src/ui/gameover.js',
    './src/game/modes.js',
    './src/online/firestore.js',
    './src/online/lobby.js',
    './src/online/sync.js'
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
    // Anche i conteggi delle statistiche: mai dalla cache, mai in cache
    if (url.hostname.endsWith('goatcounter.com') || url.hostname === 'gc.zgo.at') {
        return;
    }

    if (url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('firebaseio.com')) {
        return;
    }

    /*
     * La configurazione Firebase (con la chiave) non entra in dispensa:
     * passa sempre dalla rete. Se la chiave viene cambiata, chi torna sul
     * sito deve ricevere quella nuova subito, non restare con la vecchia
     * fino alla versione successiva. Senza rete il file non arriva e il
     * gioco parte in Modalita Locale, che e' la verita'.
     */
    if (url.origin === self.location.origin && url.pathname.endsWith('/firebase.config.js')) {
        return;
    }

    /*
     * PAGINA E MODULI VIAGGIANO INSIEME, DALLA STESSA GENERAZIONE.
     *
     * Prima la pagina arrivava dalla rete e i moduli dalla cache: nella
     * finestra di un aggiornamento il browser mischiava HTML nuovo e
     * JavaScript vecchio, e ogni volta qualcosa si rompeva in modo
     * strano (e' successo tre volte in un giorno). Ora tutto cio' che
     * sta nella dispensa della versione corrente si serve DALLA
     * dispensa: una versione intera e coerente. La versione nuova
     * arriva solo quando il service worker nuovo si installa, e la
     * fascia "Nuova versione disponibile" propone la ricarica: il
     * passaggio e' atomico.
     */
    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);

        // La navigazione si serve dalla copia della pagina in dispensa
        if (request.mode === 'navigate') {
            const cached = await cache.match('./index.html');
            if (cached) return cached;
            try {
                return await fetch(request);
            } catch (err) {
                return Response.error();
            }
        }

        const cached = await cache.match(request, { ignoreSearch: false });
        if (cached) return cached;

        /*
         * Fuori dispensa (per esempio le anteprime dei video): rete,
         * con copia in cache per l'uso senza rete.
         */
        try {
            const response = await fetch(request);
            if (response && (response.ok || response.type === 'opaque')) {
                cache.put(request, response.clone());
            }
            return response;
        } catch (err) {
            return Response.error();
        }
    })());
});
