/**
 * MULTIPLAYER IN TEMPO REALE (FIREBASE FIRESTORE)
 *
 * Connessione, autenticazione anonima, lobby, creazione e ingresso
 * nelle stanze, sincronizzazione delle mosse.
 *
 * Senza configurazione Firebase (firebase.config.js nella radice, tenuto
 * fuori da git) questo modulo non si connette e l'applicazione resta in
 * modalita' locale.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, getFirestore, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { ZeroUnoChessEngine } from '../engine/chess-engine.js';
import { WORLD_CHALLENGERS } from '../data/challengers.js';
import { APP_ID, loadFirebaseConfig, LOBBY_MAX_ROOMS } from '../config/app.config.js';
import { chess, state } from '../core/state.js';
import { playChessSound } from '../core/sound.js';
import { showToast, getPlayerNickname } from '../core/utils.js';
import { renderBoard } from '../ui/board.js';
import { updatePlayerCardsUI, startMatchTimers, applyClockIncrement } from '../ui/panels.js';
import { checkAndHandleGameOver, triggerEndOfGame } from '../ui/gameover.js';
import { startWorldChallengerMatch } from '../game/modes.js';
import { visibleLobbyRooms, displayName, isValidRoomCode } from './lobby.js';
import { findMoveToFen } from './sync.js';

/*
 * REGOLA DI QUESTO MODULO: tutto cio' che arriva da Firestore o
 * dall'indirizzo della pagina l'ha scritto qualcun altro. Si mostra
 * sempre come testo (textContent), mai come HTML, e i nomi passano da
 * displayName(). Un test in tests/online.test.mjs lo controlla.
 */

/** Titoli di fine partita scritti dall'avversario: testo corto, non un romanzo. */
function shortText(value, fallback) {
    if (typeof value !== 'string' || !value.trim()) return fallback;
    return value.trim().slice(0, 80);
}

/**
 * Mostra lo stato reale della connessione nell'intestazione.
 *
 * @param {'online'|'locale'|'errore'} mode
 * @param {string} label  Testo mostrato accanto al pallino.
 */
function setNetworkStatus(mode, label) {
    const netDot = document.getElementById('networkDot');
    const netText = document.getElementById('networkText');
    if (!netDot || !netText) return;

    netDot.className = 'zu-net-dot';
    netDot.dataset.mode = mode;
    netText.textContent = label;
}

/**
 * Avvia Firebase, se il progetto e' configurato.
 *
 * Senza configurazione l'applicazione resta giocabile in locale:
 * lo stato della rete lo dichiara apertamente invece di fingere
 * una sala mondiale che non esiste.
 */
export async function initFirebase() {
    const uidDisplay = document.getElementById('userIdDisplay');

    // La lobby mostra subito gli sfidanti AI, cosi' e' giocabile da subito
    renderGlobalLobbyUI();

    // La configurazione sta fuori da git: puo' non esserci.
    const firebaseConfig = await loadFirebaseConfig();

    if (!firebaseConfig) {
        setNetworkStatus('locale', 'Modalita Locale');
        if (uidDisplay) uidDisplay.textContent = 'ZU-' + Math.floor(1000 + Math.random() * 9000);
        return;
    }

    try {
        const app = initializeApp(firebaseConfig);
        state.auth = getAuth(app);
        state.db = getFirestore(app);

        // L'autenticazione precede qualsiasi operazione su Firestore
        await signInAnonymously(state.auth);

        onAuthStateChanged(state.auth, (user) => {
            state.currentUser = user;
            if (user) {
                setNetworkStatus('online', 'Rete Mondiale Attiva');
                if (uidDisplay) uidDisplay.textContent = user.uid;
                subscribeToGlobalLobby();
                joinRoomFromInviteLink();
            }
        });
    } catch (err) {
        console.error('Errore inizializzazione Firebase:', err);
        setNetworkStatus('errore', 'Rete non raggiungibile');
        if (uidDisplay) uidDisplay.textContent = 'ZU-' + Math.floor(1000 + Math.random() * 9000);
    }
}

/*
 * Il link d'invito: ?stanza=CODICE.
 *
 * Chi riceve l'invito non deve scrivere niente: apre il link, l'accesso
 * anonimo parte, e appena la rete e' pronta si entra nella stanza.
 * Il parametro viene tolto dall'indirizzo subito, cosi' una ricarica
 * non riprova a entrare in una stanza ormai finita.
 */
let inviteConsumed = false;

function joinRoomFromInviteLink() {
    if (inviteConsumed) return;
    inviteConsumed = true;

    let code = null;
    try {
        const params = new URLSearchParams(window.location.search);
        code = (params.get('stanza') || '').trim().toUpperCase();
        if (code) {
            params.delete('stanza');
            const resto = params.toString();
            window.history.replaceState({}, '', window.location.pathname + (resto ? '?' + resto : ''));
        }
    } catch (err) {
        return;
    }

    if (!code) return;

    // Il codice viene dall'indirizzo: se non ha la forma di un codice
    // stanza non si usa e non si ripete a schermo.
    if (!isValidRoomCode(code)) {
        showToast("Il link d'invito non è valido");
        return;
    }

    showToast(`Invito ricevuto: entro nella stanza ${code}`);
    joinOnlineMatchById(code);
}

export function subscribeToGlobalLobby() {
    if (!state.currentUser || !state.db) return;
    if (state.lobbyUnsubscribe) state.lobbyUnsubscribe();

    const matchesColRef = collection(state.db, 'artifacts', APP_ID, 'public', 'data', 'chess_matches');

    /*
     * Ogni documento consegnato dall'ascolto costa una lettura a ogni
     * persona collegata alla lobby. Il limite tiene i consumi dentro il
     * piano gratuito di Firestore. `orderBy` su un solo campo usa un
     * indice automatico: non serve crearne uno a mano in console.
     * Lo stato della stanza si filtra poi in memoria.
     */
    const lobbyQuery = query(matchesColRef, orderBy('createdAt', 'desc'), limit(LOBBY_MAX_ROOMS));

    state.lobbyUnsubscribe = onSnapshot(
        lobbyQuery,
        (snapshot) => {
            const received = [];
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                if (data) received.push({ ...data, id: docSnap.id });
            });
            /*
             * Cosa si mostra lo decide lobby.js: stanze in attesa, recenti,
             * non private (tranne la propria), con nome e codice ripuliti.
             */
            const myUid = state.currentUser ? state.currentUser.uid : null;
            state.availableWaitingRooms = visibleLobbyRooms(received, myUid, Date.now());
            renderGlobalLobbyUI();
        },
        (err) => {
            console.error("Errore lettura lobby globale:", err);
        }
    );
}

export function renderGlobalLobbyUI() {
    const listEl = document.getElementById('openRoomsList');
    const badgeEl = document.getElementById('openRoomsCountBadge');
    if (!listEl || !badgeEl) return;

    // Il contatore dice solo la verita': conta le persone reali in attesa.
    // Gli sfidanti internazionali sono avversari AI e restano elencati a parte.
    const realRooms = state.availableWaitingRooms.length;
    badgeEl.textContent = realRooms === 1 ? '1 persona in attesa' : `${realRooms} persone in attesa`;

    listEl.replaceChildren();

    // 1. Stanze create da altri utenti reali su Firebase
    state.availableWaitingRooms.forEach((room) => {
        const isOwnRoom = Boolean(state.currentUser && room.whiteUid === state.currentUser.uid);
        listEl.appendChild(buildLobbyRow({
            kind: 'human',
            live: true,
            name: displayName(room.whiteName),
            metas: [`Stanza #${room.id}`],
            buttonLabel: isOwnRoom ? 'In attesa...' : 'Entra Ora',
            onClick: () => {
                if (!isOwnRoom) joinOnlineMatchById(room.id);
            }
        }));
    });

    // 2. Sfidanti internazionali: avversari AI, sempre pronti a giocare
    WORLD_CHALLENGERS.forEach((challenger) => {
        listEl.appendChild(buildLobbyRow({
            kind: 'ai',
            name: challenger.name,
            tag: 'AI',
            metas: [challenger.country, `(${challenger.elo})`],
            buttonLabel: 'Sfida Ora',
            quiet: true,
            onClick: () => startWorldChallengerMatch(challenger)
        }));
    });
}

/**
 * Una riga della sala, costruita pezzo per pezzo.
 *
 * Ogni scritta entra con textContent: il nome di una stanza lo sceglie
 * chi la crea, e non deve mai poter diventare codice nella pagina di
 * chi guarda la sala.
 */
function buildLobbyRow({ kind, live = false, name, tag = null, metas = [], buttonLabel, quiet = false, onClick }) {
    const span = (className, text) => {
        const el = document.createElement('span');
        el.className = className;
        if (text !== undefined) el.textContent = text;
        return el;
    };

    const row = document.createElement('div');
    row.className = 'zu-lobby-row';
    row.dataset.kind = kind;

    const main = span('zu-lobby-main');
    if (live) main.appendChild(span('zu-lobby-live'));
    main.appendChild(span('zu-lobby-name', name));
    if (tag) main.appendChild(span('zu-lobby-tag', tag));
    metas.forEach((meta) => main.appendChild(span('zu-lobby-meta', meta)));

    const button = document.createElement('button');
    button.type = 'button';
    button.className = quiet ? 'zu-lobby-btn zu-lobby-btn--quiet' : 'zu-lobby-btn';
    button.textContent = buttonLabel;
    button.addEventListener('click', onClick);

    row.append(main, button);
    return row;
}

export function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'ZU';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

export async function findOrCreateWorldMatch() {
    // Se c'è una stanza reale aperta su Firebase da un altro utente, unisciti subito
    if (state.currentUser && state.db) {
        const openRoom = state.availableWaitingRooms.find(r => r.whiteUid !== state.currentUser.uid && !r.isPrivate);
        if (openRoom) {
            await joinOnlineMatchById(openRoom.id);
            return;
        }
    }
    // Altrimenti avvia immediatamente una partita contro uno sfidante internazionale così la scacchiera è subito giocabile col mouse
    startWorldChallengerMatch();
}

export async function createOnlineRoom(isPrivate = false) {
    if (!state.currentUser || !state.db) {
        showToast("Connettiti alla rete per creare una stanza online");
        return;
    }

    cleanupActiveOnlineMatch();
    const roomCode = generateRoomCode();
    const myName = displayName(getPlayerNickname());

    const matchDocRef = doc(state.db, 'artifacts', APP_ID, 'public', 'data', 'chess_matches', roomCode);
    const initialData = {
        status: 'waiting',
        isPrivate: isPrivate,
        fen: new ZeroUnoChessEngine().fen(),
        pgn: '',
        lastFrom: null,
        lastTo: null,
        whiteUid: state.currentUser.uid,
        whiteName: myName,
        blackUid: null,
        blackName: 'In attesa di avversario...',
        winnerTitle: null,
        winnerSubtitle: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    try {
        await setDoc(matchDocRef, initialData);
        state.currentMatchId = roomCode;
        state.gameMode = 'online';
        state.spectator = false;
        state.playerColor = 'w';
        state.boardOrientation = 'w';

        // Anche chi crea parte pulito: vale il reset di chi entra
        state.matchEnded = false;
        startMatchTimers();

        document.getElementById('waitingRoomCodeDisplay').textContent = roomCode;
        document.getElementById('matchmakingOverlay').classList.remove('hidden');
        document.getElementById('gameModePill').textContent = `Stanza #${roomCode}`;

        listenToActiveMatch(roomCode);
        showToast(`Stanza #${roomCode} creata. In attesa di un avversario...`, 'gold');
    } catch (e) {
        console.error("Errore creazione stanza:", e);
        showToast("Errore nella creazione della stanza online");
    }
}

export async function joinOnlineMatchById(roomCodeInput) {
    if (!state.currentUser || !state.db) {
        showToast("Servizio online non attivo");
        return;
    }

    const code = String(roomCodeInput || '').trim().toUpperCase();
    if (!isValidRoomCode(code)) {
        showToast("Inserisci un codice stanza valido");
        return;
    }

    // Rientrare nella stanza in cui si e' gia' la farebbe cancellare
    if (code === state.currentMatchId) {
        showToast(`Sei già nella stanza #${code}`);
        return;
    }

    try {
        const matchDocRef = doc(state.db, 'artifacts', APP_ID, 'public', 'data', 'chess_matches', code);
        const snap = await getDoc(matchDocRef);

        if (!snap.exists()) {
            showToast(`Stanza #${code} non trovata`);
            return;
        }

        const data = snap.data();
        const myName = displayName(getPlayerNickname());

        cleanupActiveOnlineMatch();
        state.currentMatchId = code;
        state.gameMode = 'online';
        state.spectator = false;

        if (data.whiteUid === state.currentUser.uid) {
            state.playerColor = 'w';
            state.boardOrientation = 'w';
        } else if (!data.blackUid || data.blackUid === state.currentUser.uid) {
            state.playerColor = 'b';
            state.boardOrientation = 'b';
            await updateDoc(matchDocRef, {
                blackUid: state.currentUser.uid,
                blackName: myName,
                status: 'active',
                updatedAt: Date.now()
            });
        } else {
            // La stanza ha gia' due giocatori: si guarda, non si muove
            state.spectator = true;
            state.playerColor = 'w';
            state.boardOrientation = 'w';
            showToast(`Stai osservando la partita #${code}`);
        }

        /*
         * Chi entra parte da uno stato PULITO. Senza questo reset si
         * ereditavano matchEnded e orologi della partita precedente:
         * scacchiera bloccata per sempre dopo una partita AI conclusa,
         * o tempo scaduto spurio con l'orologio vecchio ancora vivo.
         */
        state.matchEnded = false;
        startMatchTimers();

        document.getElementById('gameModePill').textContent = `Online #${code}`;
        listenToActiveMatch(code);
    } catch (e) {
        console.error("Errore ingresso stanza:", e);
        showToast("Impossibile entrare nella stanza specificata");
    }
}

export function listenToActiveMatch(roomCode) {
    if (!state.currentUser || !state.db) return;
    if (state.activeMatchUnsubscribe) state.activeMatchUnsubscribe();

    const matchDocRef = doc(state.db, 'artifacts', APP_ID, 'public', 'data', 'chess_matches', roomCode);

    state.activeMatchUnsubscribe = onSnapshot(
        matchDocRef,
        (docSnap) => {
            if (!docSnap.exists()) return;
            const data = docSnap.data();

            // I nomi li ha scritti qualcun altro: si ripuliscono prima di mostrarli
            const whiteName = displayName(data.whiteName, 'Bianco');
            const blackName = displayName(data.blackName, 'In attesa...');

            // Se il secondo giocatore si è unito, chiudiamo l'overlay di attesa
            if (data.status === 'active') {
                const overlay = document.getElementById('matchmakingOverlay');
                if (!overlay.classList.contains('hidden')) {
                    overlay.classList.add('hidden');
                    state.matchEnded = false;
                    startMatchTimers();
                    showToast(`Sfida iniziata: ${whiteName} vs ${blackName}`, 'gold');
                }
            }

            // Aggiorna i nomi dei giocatori
            updatePlayerCardsUI(whiteName, blackName);

            // Sincronizza la posizione sulla scacchiera tramite FEN
            if (typeof data.fen === 'string' && data.fen && data.fen !== chess.fen()) {
                /*
                 * Prima si cerca la MOSSA che porta alla posizione ricevuta e
                 * la si gioca: cosi' restano la lista delle mosse, i pezzi
                 * catturati, la patta per ripetizione e l'orologio, che parte
                 * solo a storia non vuota. Caricare la posizione nuda li
                 * azzerava a ogni mossa dell'avversario. Si carica cosi'
                 * com'e' solo se nessuna mossa ci arriva (ingresso a partita
                 * iniziata, scacchiere disallineate).
                 */
                const opponentMove = findMoveToFen(chess.fen(), data.fen);
                const played = opponentMove ? chess.move(opponentMove) : null;

                if (played) {
                    state.lastMoveSquares = { from: played.from, to: played.to };
                    // Anche l'orologio dell'avversario si riprende l'incremento
                    applyClockIncrement(played.color);
                } else {
                    chess.load(data.fen);
                    state.lastMoveSquares = {
                        from: typeof data.lastFrom === 'string' ? data.lastFrom : null,
                        to: typeof data.lastTo === 'string' ? data.lastTo : null
                    };
                }

                state.selectedSquare = null;
                state.legalMovesForSelected = [];
                playChessSound('move');
                renderBoard();
                checkAndHandleGameOver();
            } else if (chess.history().length === 0 && data.fen) {
                renderBoard();
            }

            // Se la partita è stata dichiarata conclusa (es. abbandono o patta concordata)
            if (data.status === 'finished' && !state.matchEnded) {
                triggerEndOfGame(
                    shortText(data.winnerTitle, 'Partita Conclusa'),
                    shortText(data.winnerSubtitle, 'Match Internazionale Terminato')
                );
            }
        },
        (err) => {
            console.error("Errore sincronizzazione partita:", err);
        }
    );
}

/**
 * Dichiara finita la partita online sul documento condiviso, cosi'
 * anche l'avversario vede il risultato. Fuori dall'online non fa nulla.
 *
 * Nata da un bug vero: i bottoni Patta e Abbandona usavano doc() e
 * updateDoc() direttamente in main.js, dove quelle funzioni non sono
 * mai state importate. La patta online lanciava ReferenceError e non
 * succedeva niente; la resa falliva in silenzio e l'avversario non
 * veniva mai avvisato.
 */
export async function finishOnlineMatch(title, subtitle) {
    if (!(state.gameMode === 'online' && state.currentMatchId && state.currentUser && state.db)) return;
    // Chi guarda non chiude la partita di altri
    if (state.spectator) return;
    try {
        const matchDocRef = doc(state.db, 'artifacts', APP_ID, 'public', 'data', 'chess_matches', state.currentMatchId);
        await updateDoc(matchDocRef, {
            status: 'finished',
            winnerTitle: title,
            winnerSubtitle: subtitle,
            updatedAt: Date.now()
        });
    } catch (e) {
        console.error('Errore chiusura partita online:', e);
    }
}

export async function syncOnlineMove(moveObj) {
    if (!state.currentUser || !state.db || !state.currentMatchId) return;
    try {
        const matchDocRef = doc(state.db, 'artifacts', APP_ID, 'public', 'data', 'chess_matches', state.currentMatchId);
        await updateDoc(matchDocRef, {
            fen: chess.fen(),
            pgn: chess.pgn(),
            lastFrom: moveObj.from,
            lastTo: moveObj.to,
            updatedAt: Date.now()
        });
    } catch (e) {
        console.error("Errore invio mossa:", e);
        // Senza avviso chi gioca crede che la mossa sia arrivata
        showToast('Mossa non inviata all\'avversario: controlla la connessione');
    }
}

export async function cleanupActiveOnlineMatch() {
    document.getElementById('matchmakingOverlay').classList.add('hidden');
    if (state.activeMatchUnsubscribe) {
        state.activeMatchUnsubscribe();
        state.activeMatchUnsubscribe = null;
    }

    /*
     * La stanza vecchia si dimentica SUBITO, prima di ogni attesa di
     * rete. Chi chiama questa funzione non la aspetta e imposta subito
     * la stanza nuova: azzerando lo stato alla fine, dopo le attese, si
     * cancellava il codice della stanza NUOVA, e da li' in poi le mosse
     * non partivano piu' verso l'avversario (seconda partita online
     * della stessa visita).
     */
    const previousMatchId = state.currentMatchId;
    state.currentMatchId = null;
    state.spectator = false;

    if (previousMatchId && state.currentUser && state.db) {
        try {
            const matchDocRef = doc(state.db, 'artifacts', APP_ID, 'public', 'data', 'chess_matches', previousMatchId);
            const snap = await getDoc(matchDocRef);
            if (snap.exists() && snap.data().status === 'waiting' && snap.data().whiteUid === state.currentUser.uid) {
                await deleteDoc(matchDocRef);
            }
        } catch (e) {
            // Ignora errori di pulizia
        }
    }
}
