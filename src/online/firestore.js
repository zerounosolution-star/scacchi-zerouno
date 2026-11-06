/**
 * MULTIPLAYER IN TEMPO REALE (FIREBASE FIRESTORE)
 *
 * Connessione, autenticazione anonima, lobby, creazione e ingresso
 * nelle stanze, sincronizzazione delle mosse.
 *
 * Senza configurazione Firebase (src/config/app.config.js) questo
 * modulo non si connette e l'applicazione resta in modalita' locale.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, getFirestore, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { ZeroUnoChessEngine } from '../engine/chess-engine.js';
import { WORLD_CHALLENGERS } from '../data/challengers.js';
import { APP_ID, FIREBASE_CONFIG, LOBBY_MAX_ROOMS } from '../config/app.config.js';
import { chess, state } from '../core/state.js';
import { playChessSound } from '../core/sound.js';
import { showToast, getPlayerNickname } from '../core/utils.js';
import { renderBoard } from '../ui/board.js';
import { updatePlayerCardsUI, startMatchTimers } from '../ui/panels.js';
import { checkAndHandleGameOver, triggerEndOfGame } from '../ui/gameover.js';
import { startWorldChallengerMatch } from '../game/modes.js';

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

    const colorByMode = {
        online: 'bg-emerald-500',
        locale: 'bg-bronze-400',
        errore: 'bg-red-500'
    };
    netDot.className = `w-2 h-2 rounded-full ${colorByMode[mode] || 'bg-bronze-400'}`;
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

    if (!FIREBASE_CONFIG) {
        setNetworkStatus('locale', 'Modalita Locale');
        if (uidDisplay) uidDisplay.textContent = 'ZU-' + Math.floor(1000 + Math.random() * 9000);
        return;
    }

    try {
        const app = initializeApp(FIREBASE_CONFIG);
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
            }
        });
    } catch (err) {
        console.error('Errore inizializzazione Firebase:', err);
        setNetworkStatus('errore', 'Rete non raggiungibile');
        if (uidDisplay) uidDisplay.textContent = 'ZU-' + Math.floor(1000 + Math.random() * 9000);
    }
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
            const rooms = [];
            const now = Date.now();
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                // Filtra in memoria JS le stanze aperte negli ultimi 30 minuti
                if (data && data.status === 'waiting' && (now - (data.createdAt || 0) < 1800000)) {
                    rooms.push({ id: docSnap.id, ...data });
                }
            });
            // Ordina in memoria JS dalla più recente
            rooms.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            state.availableWaitingRooms = rooms;
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

    listEl.innerHTML = '';

    // 1. Stanze create da altri utenti reali su Firebase
    state.availableWaitingRooms.forEach((room) => {
        const isOwnRoom = state.currentUser && room.whiteUid === state.currentUser.uid;
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between bg-ivory-50 border border-bronze-400/50 rounded-lg px-3 py-1.5 text-xs';
        row.innerHTML = `
            <div class="truncate pr-2">
                <span class="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1"></span>
                <span class="font-medium text-anthracite-900">${room.whiteName || 'Scacchista'}</span>
                <span class="font-mono text-[10px] text-neutral-500 ml-1.5">Stanza #${room.id}</span>
            </div>
            <button type="button" class="px-2.5 py-1 rounded bg-anthracite-900 hover:bg-bronze-600 text-ivory-50 text-[11px] font-medium transition shrink-0 cursor-pointer">
                ${isOwnRoom ? 'In attesa...' : 'Entra Ora'}
            </button>
        `;
        row.querySelector('button').addEventListener('click', () => {
            if (!isOwnRoom) joinOnlineMatchById(room.id);
        });
        listEl.appendChild(row);
    });

    // 2. Sfidanti internazionali: avversari AI, sempre pronti a giocare
    WORLD_CHALLENGERS.forEach((challenger) => {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between bg-ivory-50/80 border border-ivory-200 rounded-lg px-3 py-1.5 text-xs';
        row.innerHTML = `
            <div class="truncate pr-2">
                <span class="font-medium text-anthracite-900">${challenger.name}</span>
                <span class="text-[10px] uppercase tracking-wider text-bronze-600 ml-1">AI</span>
                <span class="text-[11px] text-neutral-500 ml-1">${challenger.country}</span>
                <span class="font-mono text-[10px] text-bronze-600 ml-1">(${challenger.elo})</span>
            </div>
            <button type="button" class="px-2.5 py-1 rounded bg-ivory-200 hover:bg-anthracite-900 hover:text-ivory-50 text-anthracite-900 text-[11px] font-medium transition shrink-0 cursor-pointer">
                Sfida Ora
            </button>
        `;
        row.querySelector('button').addEventListener('click', () => {
            startWorldChallengerMatch(challenger);
        });
        listEl.appendChild(row);
    });
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
    const myName = getPlayerNickname();

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
        state.playerColor = 'w';
        state.boardOrientation = 'w';

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

    const code = roomCodeInput.trim().toUpperCase();
    if (!code) {
        showToast("Inserisci un codice stanza valido");
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
        const myName = getPlayerNickname();

        cleanupActiveOnlineMatch();
        state.currentMatchId = code;
        state.gameMode = 'online';

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
            // Spettatore se la stanza ha già due giocatori
            state.playerColor = 'w';
            state.boardOrientation = 'w';
            showToast(`Stai osservando la partita #${code}`);
        }

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

            // Se il secondo giocatore si è unito, chiudiamo l'overlay di attesa
            if (data.status === 'active') {
                const overlay = document.getElementById('matchmakingOverlay');
                if (!overlay.classList.contains('hidden')) {
                    overlay.classList.add('hidden');
                    state.matchEnded = false;
                    startMatchTimers();
                    showToast(`Sfida iniziata: ${data.whiteName} vs ${data.blackName}`, 'gold');
                }
            }

            // Aggiorna i nomi dei giocatori
            updatePlayerCardsUI(
                data.whiteName || 'Bianco',
                data.blackName || 'In attesa...'
            );

            // Sincronizza la posizione sulla scacchiera tramite FEN
            if (data.fen && data.fen !== chess.fen()) {
                chess.load(data.fen);
                state.lastMoveSquares = { from: data.lastFrom || null, to: data.lastTo || null };
                playChessSound('move');
                renderBoard();
                checkAndHandleGameOver();
            } else if (chess.history().length === 0 && data.fen) {
                renderBoard();
            }

            // Se la partita è stata dichiarata conclusa (es. abbandono o patta concordata)
            if (data.status === 'finished' && !state.matchEnded) {
                triggerEndOfGame(
                    data.winnerTitle || 'Partita Conclusa',
                    data.winnerSubtitle || 'Match Internazionale Terminato'
                );
            }
        },
        (err) => {
            console.error("Errore sincronizzazione partita:", err);
        }
    );
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
    }
}

export async function cleanupActiveOnlineMatch() {
    document.getElementById('matchmakingOverlay').classList.add('hidden');
    if (state.activeMatchUnsubscribe) {
        state.activeMatchUnsubscribe();
        state.activeMatchUnsubscribe = null;
    }
    if (state.currentMatchId && state.currentUser && state.db) {
        try {
            const matchDocRef = doc(state.db, 'artifacts', APP_ID, 'public', 'data', 'chess_matches', state.currentMatchId);
            const snap = await getDoc(matchDocRef);
            if (snap.exists() && snap.data().status === 'waiting' && snap.data().whiteUid === state.currentUser.uid) {
                await deleteDoc(matchDocRef);
            }
        } catch (e) {
            // Ignora errori di pulizia
        }
    }
    state.currentMatchId = null;
}
