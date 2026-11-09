/**
 * MODELLO DELLA CONFIGURAZIONE FIREBASE
 *
 * Come si usa:
 *   1. copiare questo file e chiamare la copia  firebase.config.js
 *      (stessa cartella, la radice del progetto);
 *   2. riempire i campi con i valori del proprio progetto Firebase:
 *      Console Firebase > Impostazioni progetto > Le tue app >
 *      Configurazione SDK;
 *   3. salvare e ricaricare la pagina.
 *
 * Il file firebase.config.js non entra in git: .gitignore lo tiene fuori,
 * cosi' la chiave non finisce nello storico del repository pubblico.
 *
 * Senza quel file il gioco funziona lo stesso: partite contro l'AI e in
 * due sullo stesso dispositivo. Si spegne solo la sala mondiale online,
 * e l'intestazione lo dichiara con la scritta «Modalita Locale».
 *
 * Nota: la chiave del browser di Firebase non e' un segreto vero. Serve a
 * dire quale progetto sei, non apre i dati. Chi protegge i dati sono le
 * regole in firebase/firestore.rules. Va pero' limitata nella console
 * Google (Credenziali > limitazioni per referrer HTTP e per API), perche'
 * nessuno la usi dal proprio sito consumando il piano gratuito.
 */
export const FIREBASE_CONFIG = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
};
