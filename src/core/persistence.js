/**
 * PARTITA SALVATA
 *
 * La partita in corso resta in memoria del browser: chiudendo la pagina
 * per sbaglio, o ricaricandola, si riprende da dove si era rimasti.
 *
 * Si salvano le mosse, non la sola posizione: cosi' tornano anche la
 * notazione algebrica, i pezzi catturati e la regola della ripetizione.
 *
 * Si salvano soltanto le partite locali (contro l'AI, in due sullo
 * stesso dispositivo, contro uno sfidante internazionale). Le partite
 * online vivono su Firestore e le comanda l'avversario.
 */

import { chess, state } from './state.js';

const STORAGE_KEY = 'scacchi-zerouno:partita';
const SAVED_MODES = ['ai', 'local', 'world-challenger'];

/** Vero se la modalita' in corso si puo' salvare qui. */
function isSaveable() {
    return SAVED_MODES.includes(state.gameMode);
}

/** Scrive la partita in corso nella memoria del browser. */
export function saveMatch(extra = {}) {
    if (!isSaveable() || state.matchEnded) return;

    try {
        const moves = chess.history({ verbose: true }).map((m) => ({
            from: m.from,
            to: m.to,
            promotion: m.promotion || undefined
        }));

        const snapshot = {
            version: 1,
            savedAt: Date.now(),
            gameMode: state.gameMode,
            playerColor: state.playerColor,
            boardOrientation: state.boardOrientation,
            aiDifficulty: state.aiDifficulty,
            whiteTimeSeconds: state.whiteTimeSeconds,
            blackTimeSeconds: state.blackTimeSeconds,
            moves,
            ...extra
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (err) {
        // Memoria piena o disabilitata: la partita continua lo stesso
        console.warn('Partita non salvata:', err.message);
    }
}

/**
 * Legge la partita salvata.
 * @returns {object|null} null se non c'e' niente di valido da riprendere.
 */
export function readSavedMatch() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;

        const snapshot = JSON.parse(raw);
        if (!snapshot || snapshot.version !== 1) return null;
        if (!Array.isArray(snapshot.moves) || snapshot.moves.length === 0) return null;
        if (!SAVED_MODES.includes(snapshot.gameMode)) return null;

        return snapshot;
    } catch (err) {
        console.warn('Partita salvata illeggibile:', err.message);
        return null;
    }
}

/** Cancella la partita salvata. */
export function clearSavedMatch() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
        console.warn('Partita salvata non cancellata:', err.message);
    }
}

/**
 * Riporta il motore alla posizione salvata rigiocando le mosse.
 *
 * @param {object} snapshot  Da readSavedMatch().
 * @returns {boolean} false se una mossa non torna: in quel caso il
 *                    motore viene riportato alla posizione iniziale.
 */
export function replayMoves(snapshot) {
    chess.reset();

    for (const move of snapshot.moves) {
        const applied = chess.move({
            from: move.from,
            to: move.to,
            promotion: move.promotion || 'q'
        });

        if (!applied) {
            console.warn('Partita salvata incoerente: si riparte da zero');
            chess.reset();
            return false;
        }
    }

    return true;
}
