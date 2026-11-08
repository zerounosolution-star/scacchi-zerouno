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
 * Finche' vale `null`, l'applicazione funziona in modalita' locale:
 * partite contro l'AI e in due sullo stesso dispositivo, senza rete.
 *
 * Per attivare il multiplayer online reale, incollare qui l'oggetto di
 * configurazione del proprio progetto Firebase (Console Firebase >
 * Impostazioni progetto > Le tue app > Configurazione SDK):
 *
 *   export const FIREBASE_CONFIG = {
 *       apiKey: "...",
 *       authDomain: "....firebaseapp.com",
 *       projectId: "...",
 *       storageBucket: "....appspot.com",
 *       messagingSenderId: "...",
 *       appId: "..."
 *   };
 *
 * Queste chiavi sono pubbliche per progetto: la sicurezza dei dati
 * dipende dalle regole in firebase/firestore.rules, non dal segreto
 * delle chiavi.
 */
export const FIREBASE_CONFIG = {
    apiKey: "",
    authDomain: "scacchi-zerouno.firebaseapp.com",
    projectId: "scacchi-zerouno",
    storageBucket: "scacchi-zerouno.firebasestorage.app",
    messagingSenderId: "23108543498",
    appId: "1:23108543498:web:bea77cdafe6e4948a86bf3"
};

/**
 * Numero massimo di stanze lette dalla lobby in un solo ascolto.
 * Serve a tenere i consumi dentro il piano gratuito di Firestore.
 */
export const LOBBY_MAX_ROOMS = 25;
