/**
 * STATISTICHE DI VISITA (GoatCounter)
 *
 * Quante persone giocano, da dove arrivano (WhatsApp, YouTube, QR,
 * link diretto) e come giocano. GoatCounter non usa cookie e non
 * traccia la persona: niente banner di consenso da aggiungere.
 *
 * Spento finche' GOATCOUNTER_CODE in app.config.js vale null: nessuno
 * script esterno viene caricato e nessun dato esce dal browser.
 *
 * Gli eventi sono agganciati ai bottoni per id, da un solo posto:
 * nessun altro modulo deve sapere che le statistiche esistono.
 */

import { GOATCOUNTER_CODE } from '../config/app.config.js';

/** Bottone -> nome dell'evento, come appare nel pannello GoatCounter. */
const EVENTI = {
    startAiMatchBtn: 'gioca-contro-ai',
    startLocalMatchBtn: 'gioca-in-due',
    findWorldMatchBtn: 'gioca-nel-mondo',
    createPrivateRoomBtn: 'stanza-creata',
    joinRoomByCodeBtn: 'stanza-entrata-col-codice',
    copyWaitingCodeBtn: 'invito-copiato',
    challengeFriendBtn: 'sfida-amico-copiata',
    promoSubscribeBtn: 'iscriviti-da-annuncio',
    subscribeChannelBtn: 'iscriviti-da-fine-partita',
    fullscreenBtn: 'schermo-intero'
};

function conta(nome) {
    try {
        if (window.goatcounter && window.goatcounter.count) {
            window.goatcounter.count({ path: nome, title: nome, event: true });
        }
    } catch (err) {
        // Le statistiche non devono mai disturbare il gioco
    }
}

export function initAnalytics() {
    if (!GOATCOUNTER_CODE) return;

    /*
     * L'invito si legge SUBITO: appena la rete e' pronta il parametro
     * ?stanza viene tolto dall'indirizzo, e lo script arriva dopo.
     */
    let daInvito = false;
    try {
        daInvito = new URLSearchParams(window.location.search).has('stanza');
    } catch (err) { /* niente */ }

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://gc.zgo.at/count.js';
    script.dataset.goatcounter = `https://${GOATCOUNTER_CODE}.goatcounter.com/count`;
    script.addEventListener('load', () => {
        if (daInvito) conta('arrivo-da-invito');
    });
    document.head.appendChild(script);

    for (const [id, nome] of Object.entries(EVENTI)) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', () => conta(nome));
    }
}
