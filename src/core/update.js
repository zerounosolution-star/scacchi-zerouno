/**
 * AVVISO DI NUOVA VERSIONE
 *
 * Il service worker rende il gioco usabile senza rete, ma ha un
 * rovescio: chi tiene il sito aperto continua a girare con i moduli
 * vecchi anche dopo una pubblicazione, e se ne accorge solo da
 * comportamenti strani. Qui, quando un service worker nuovo prende il
 * controllo della pagina, compare una fascia discreta: "Nuova
 * versione disponibile - Ricarica". Un clic e si riparte aggiornati.
 *
 * Niente ricarica automatica: una partita in corso non si butta via
 * per un aggiornamento. La scelta resta a chi gioca.
 */

/** Vero se la pagina era gia' controllata da un service worker. */
let eraControllata = false;

/*
 * L'ascolto parte QUI, all'importazione del modulo, non dentro la
 * registrazione: il service worker nuovo puo' prendere il controllo
 * prima di window.onload, e un ascoltatore attaccato tardi perde
 * l'evento. E' gia' successo.
 */
if ('serviceWorker' in navigator) {
    eraControllata = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (eraControllata) showUpdateBanner();
        eraControllata = true;
    });
}

function showUpdateBanner() {
    if (document.getElementById('updateBanner')) return;

    const banner = document.createElement('div');
    banner.id = 'updateBanner';
    banner.className = 'zu-update-banner';
    banner.setAttribute('role', 'status');

    const testo = document.createElement('span');
    testo.textContent = 'Nuova versione disponibile';

    const bottone = document.createElement('button');
    bottone.type = 'button';
    bottone.className = 'zu-btn zu-btn--accent zu-btn--sm';
    bottone.textContent = 'Ricarica';
    bottone.addEventListener('click', () => window.location.reload());

    const dopo = document.createElement('button');
    dopo.type = 'button';
    dopo.className = 'zu-btn zu-btn--onDark zu-btn--sm';
    dopo.textContent = 'Dopo';
    dopo.addEventListener('click', () => banner.remove());

    banner.append(testo, bottone, dopo);
    document.body.appendChild(banner);
}

/**
 * Registra il service worker e tiene d'occhio gli aggiornamenti.
 *
 * Funziona solo su HTTPS o su localhost: aperta da file:// la
 * registrazione viene saltata senza disturbare nessuno.
 */
export function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
        .register('sw.js')
        .then((reg) => {
            /*
             * Seconda via d'avviso: la registrazione vede l'arrivo di
             * un worker nuovo. Quando finisce di installarsi su una
             * pagina gia' controllata, la versione nuova e' pronta.
             */
            reg.addEventListener('updatefound', () => {
                const nuovo = reg.installing;
                if (!nuovo) return;
                nuovo.addEventListener('statechange', () => {
                    if (nuovo.state === 'activated' && navigator.serviceWorker.controller) {
                        showUpdateBanner();
                    }
                });
            });

            /*
             * Il browser controlla sw.js a ogni navigazione, ma chi
             * tiene il gioco aperto per ore non naviga: si controlla
             * da soli, a ogni ritorno sulla scheda e ogni quarto d'ora.
             */
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') reg.update().catch(() => {});
            });
            setInterval(() => reg.update().catch(() => {}), 15 * 60 * 1000);
        })
        .catch((err) => console.warn('Service worker non registrato:', err.message));
}
