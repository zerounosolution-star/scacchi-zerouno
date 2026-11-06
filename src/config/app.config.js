/**
 * CONFIGURAZIONE DELL'APPLICAZIONE
 *
 * Unico punto in cui si cambiano le costanti di Scacchi ZeroUno.
 * Nessun altro modulo deve contenere numeri o chiavi scritti a mano.
 */

/** Spazio dei dati su Firestore. Isola le partite di questa applicazione. */
export const APP_ID = 'scacchi-zerouno-world';

/** Tempo iniziale di ciascun giocatore, in secondi (10 minuti). */
export const PLAYER_CLOCK_SECONDS = 600;

/** Canale YouTube collegato al progetto. */
export const YOUTUBE_CHANNEL_URL = 'https://youtube.com/@zerounosolution';

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
export const FIREBASE_CONFIG = null;

/**
 * Numero massimo di stanze lette dalla lobby in un solo ascolto.
 * Serve a tenere i consumi dentro il piano gratuito di Firestore.
 */
export const LOBBY_MAX_ROOMS = 25;
