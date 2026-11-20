/**
 * LA SCACCHIERA CHE SI GIRA DA SOLA (partita in due sullo stesso schermo)
 *
 * In due sullo stesso dispositivo ognuno vuole i propri pezzi in basso.
 * Prima toccava premere «Ruota» a ogni mossa; ora la scacchiera si gira
 * da sola verso chi deve muovere, e una spunta la tiene ferma per chi
 * gioca seduto di fronte all'altro.
 *
 * Questo modulo decide soltanto DA CHE PARTE va guardata la scacchiera:
 * non tocca la pagina, quindi si prova fuori dal browser
 * (tests/indue.test.mjs). Chi la gira davvero e' src/ui/orientation.js.
 */

/**
 * @param {object} situazione
 * @param {string} situazione.gameMode     modalita' della partita in corso
 * @param {boolean} situazione.autoFlip    la spunta «Gira la scacchiera a ogni mossa»
 * @param {string} situazione.turn         chi deve muovere adesso: 'w' oppure 'b'
 * @param {boolean} situazione.matchEnded  partita finita
 * @param {boolean} [situazione.busy]      c'e' un pezzo in mano o selezionato, una
 *                                         promozione aperta, o si sta rivedendo una mossa
 * @returns {'w'|'b'|null} il colore da mettere in basso, oppure null se
 *                         la scacchiera resta com'e'.
 */
export function orientationForLocalTurn({ gameMode, autoFlip, turn, matchEnded, busy = false }) {
    // Solo in due sullo stesso schermo: contro l'AI e online ognuno ha il suo lato
    if (gameMode !== 'local') return null;
    if (!autoFlip) return null;
    // A partita finita resta com'era: chi ha dato matto la guarda dal suo lato
    if (matchEnded) return null;
    // Mai sotto il dito di chi sta gia' muovendo
    if (busy) return null;
    if (turn !== 'w' && turn !== 'b') return null;
    return turn;
}
