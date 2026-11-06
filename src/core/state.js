/**
 * STATO CONDIVISO DELL'APPLICAZIONE
 *
 * Nella versione monolitica queste erano variabili globali dentro un
 * unico `<script>`. Qui vivono in un solo oggetto `state`, importabile
 * da ogni modulo: i moduli ES esportano riferimenti in sola lettura,
 * quindi lo stato che cambia deve stare dentro un oggetto condiviso.
 *
 * Regola del progetto: si legge e si scrive sempre `state.campo`,
 * mai una copia locale del valore.
 */

import { ZeroUnoChessEngine } from '../engine/chess-engine.js';
import { PLAYER_CLOCK_SECONDS } from '../config/app.config.js';

/** Istanza unica del motore scacchistico per la partita in corso. */
export const chess = new ZeroUnoChessEngine();

/**
 * Mappa persistente delle 64 caselle del DOM.
 * Le caselle si costruiscono una volta sola e non si distruggono mai:
 * ricrearle durante un click interromperebbe il trascinamento.
 */
export const squareElementsMap = new Map();

/** Stato del trascinamento di un pezzo con il mouse. */
export const dragState = {
    active: false,
    isDraggingVisual: false,
    sourceSq: null,
    pieceKey: null,
    startX: 0,
    startY: 0,
    hoveredSq: null
};

/** Stato mutevole della partita, dell'interfaccia e della rete. */
export const state = {
    // --- Partita ---
    /** 'ai' | 'online' | 'local' | 'world-challenger' */
    gameMode: 'ai',
    /** Colore controllato da chi gioca su questo dispositivo: 'w' | 'b' */
    playerColor: 'w',
    /** Colore mostrato in basso sulla scacchiera: 'w' | 'b' */
    boardOrientation: 'w',
    /** Livello dell'AI: 1 = facile, 2 = club, 3 = difficile */
    aiDifficulty: 2,
    /** Vero mentre l'AI sta cercando la mossa: impedisce ricerche sovrapposte. */
    aiThinking: false,
    matchEnded: false,

    // --- Interazione con la scacchiera ---
    selectedSquare: null,
    legalMovesForSelected: [],
    lastMoveSquares: { from: null, to: null },
    pendingPromotionMove: null,
    /**
     * Revisione di una mossa passata: { ply, game, from, to }.
     * null quando si guarda la partita vera. Il motore della revisione
     * e' separato: la partita non si tocca mai.
     */
    review: null,

    // --- Orologi ---
    whiteTimeSeconds: PLAYER_CLOCK_SECONDS,
    blackTimeSeconds: PLAYER_CLOCK_SECONDS,
    timerInterval: null,

    // --- Audio ---
    soundEnabled: true,
    moveSynth: null,

    // --- Video del canale ---
    lastPlayedVideoId: null,

    // --- Firebase e multiplayer ---
    db: null,
    auth: null,
    currentUser: null,
    currentMatchId: null,
    activeMatchUnsubscribe: null,
    lobbyUnsubscribe: null,
    availableWaitingRooms: []
};
