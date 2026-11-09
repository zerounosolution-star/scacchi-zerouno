/**
 * CONFIGURAZIONE DELL'APPLICAZIONE
 *
 * Unico punto in cui si cambiano le costanti di Scacchi ZeroUno.
 * Nessun altro modulo deve contenere numeri o chiavi scritti a mano.
 */

/** Spazio dei dati su Firestore. Isola le partite di questa applicazione. */
export const APP_ID = 'scacchi-zerouno-world';

/** Tempo iniziale di ciascun giocatore, in secondi (10 minuti). */
/**
 * Tempi di gioco disponibili.
 *
 * `incrementSeconds` e' l'incremento Fischer: chi muove si riprende quei
 * secondi sull'orologio. Serve a non perdere una partita vinta per pochi
 * secondi nel finale, quando le mosse sono tante e semplici.
 */
export const TIME_CONTROLS = [
    { id: 'rapid-10', label: '10 minuti, senza incremento', seconds: 600, incrementSeconds: 0 },
    { id: 'rapid-10-5', label: '10 minuti + 5 secondi a mossa', seconds: 600, incrementSeconds: 5 },
    { id: 'blitz-5-3', label: '5 minuti + 3 secondi a mossa', seconds: 300, incrementSeconds: 3 },
    { id: 'blitz-3-2', label: '3 minuti + 2 secondi a mossa', seconds: 180, incrementSeconds: 2 }
];

/** Tempo di gioco usato finche' non se ne sceglie un altro. */
export const DEFAULT_TIME_CONTROL_ID = 'rapid-10';

/** Il tempo di gioco con questo identificativo, o quello predefinito. */
export function timeControlById(id) {
    return TIME_CONTROLS.find((c) => c.id === id)
        || TIME_CONTROLS.find((c) => c.id === DEFAULT_TIME_CONTROL_ID)
        || TIME_CONTROLS[0];
}

/** Indirizzo pubblico del sito: inviti, PGN firmato, condivisioni. */
export const SITE_URL = 'https://zerounosolution-star.github.io/scacchi-zerouno/';

/** Canale YouTube collegato al progetto. */
export const YOUTUBE_CHANNEL_URL = 'https://youtube.com/@zerounosolution';

/** Lo stesso canale, ma col prompt di iscrizione gia' aperto. */
export const YOUTUBE_SUBSCRIBE_URL = 'https://youtube.com/@zerounosolution?sub_confirmation=1';

/**
 * Configurazione del progetto Firebase.
 *
 * La chiave NON sta piu' qui dentro e non entra nello storico di git.
 * Vive in `firebase.config.js`, nella radice del progetto, che .gitignore
 * tiene fuori. Il modello a campi vuoti e' `firebase.config.ESEMPIO.js`.
 *
 * Senza quel file l'applicazione resta giocabile: partite contro l'AI e
 * in due sullo stesso dispositivo. Si spegne solo la sala mondiale, e
 * l'intestazione lo dichiara invece di fingere una rete che non c'e'.
 *
 * La chiave del browser di Firebase identifica il progetto, non apre i
 * dati: quelli li proteggono le regole in firebase/firestore.rules.
 * Va comunque limitata nella console Google (Credenziali > limitazioni
 * per referrer HTTP e per API). Vedi NOTE-SICUREZZA-2026-11-09.md.
 *
 * @returns {Promise<object|null>} la configurazione, o null se manca.
 */
export async function loadFirebaseConfig() {
    try {
        const modulo = await import('../../firebase.config.js');
        const config = modulo.FIREBASE_CONFIG;
        if (!config || !config.apiKey || !config.projectId) return null;
        return config;
    } catch {
        return null;
    }
}

/**
 * Numero massimo di stanze lette dalla lobby in un solo ascolto.
 * Serve a tenere i consumi dentro il piano gratuito di Firestore.
 */
export const LOBBY_MAX_ROOMS = 25;
