/**
 * L'INVITO A UN AMICO
 *
 * Giocare a distanza con una persona che si conosce passa da un link:
 * chi lo apre entra nella stanza senza scrivere niente. Qui si costruiscono
 * il link e la frase che lo accompagna. Niente pagina e niente rete: si
 * prova fuori dal browser (tests/indue.test.mjs).
 */

import { isValidRoomCode } from './lobby.js';

/** La frase che accompagna il link: la stessa per chi condivide e per chi copia. */
export const INVITE_TEXT = 'Ti sfido a scacchi! Apri questo link ed entri subito nella mia stanza:';

/**
 * Il link che porta l'amico dentro la stanza.
 *
 * @param {string} siteUrl  indirizzo del gioco, con la barra finale
 * @param {string} code     codice della stanza
 * @returns {string|null} null se il codice non ha la forma di un codice
 *                        stanza: meglio nessun link che un link rotto.
 */
export function inviteLink(siteUrl, code) {
    const pulito = String(code || '').trim().toUpperCase();
    if (!isValidRoomCode(pulito)) return null;
    return `${siteUrl}?stanza=${pulito}`;
}

/** L'invito intero, pronto da incollare in un messaggio. */
export function inviteMessage(link) {
    return `${INVITE_TEXT} ${link}`;
}
