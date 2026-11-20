/**
 * LA MOSSA DELL'AVVERSARIO, RICOSTRUITA DALLA POSIZIONE
 *
 * Su Firestore viaggia la posizione (FEN), non la mossa. Caricare la
 * FEN cosi' com'e' fa ripartire il motore da zero: si perdono la lista
 * delle mosse, i pezzi catturati, la patta per ripetizione, e
 * l'orologio — che parte "dopo la prima mossa" — resta fermo.
 *
 * Qui si cerca invece la mossa legale che porta dalla posizione che
 * abbiamo sulla scacchiera a quella ricevuta. Se c'e', chi chiama la
 * gioca sul motore vero e la storia della partita resta intera.
 *
 * Nessun accesso alla pagina e nessuna rete: si prova con `npm test`.
 */

import { ZeroUnoChessEngine } from '../engine/chess-engine.js';

const PROMOTION_PIECES = ['q', 'r', 'b', 'n'];

/**
 * La mossa legale che trasforma `currentFen` in `targetFen`.
 *
 * @param {string} currentFen  La posizione che abbiamo adesso.
 * @param {string} targetFen   La posizione arrivata dalla rete.
 * @returns {{from: string, to: string, promotion?: string}|null}
 *          null se nessuna mossa singola ci arriva: in quel caso chi
 *          chiama carica la posizione cosi' com'e' (ingresso a partita
 *          iniziata, o scacchiere davvero disallineate).
 */
export function findMoveToFen(currentFen, targetFen) {
    if (!currentFen || !targetFen || currentFen === targetFen) return null;

    // Motore di servizio: quello della partita non si tocca mai qui
    const probe = new ZeroUnoChessEngine();
    if (!probe.load(currentFen)) return null;

    for (const candidate of probe.moves({ verbose: true })) {
        const isPromotion = Boolean(candidate.flags && candidate.flags.includes('p'));
        const choices = isPromotion ? PROMOTION_PIECES : [undefined];

        for (const promotion of choices) {
            const input = { from: candidate.from, to: candidate.to };
            if (promotion) input.promotion = promotion;

            if (!probe.move(input)) continue;
            const reached = probe.fen();
            probe.undo();

            if (reached === targetFen) return input;
        }
    }

    return null;
}
