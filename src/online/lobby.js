/**
 * QUALI STANZE SI VEDONO NELLA SALA
 *
 * Tutto quello che arriva da Firestore l'ha scritto un'altra persona:
 * qui si decide cosa merita di comparire nella sala, e in che forma.
 *
 * - Le stanze private non si mostrano a nessuno, tranne a chi le ha
 *   create: ci si entra solo con il codice o con il link d'invito.
 * - Una stanza vecchia, o con una data nel futuro, non resta in cima
 *   alla lista per sempre.
 * - Il nome e il codice si ripuliscono: sono testo altrui.
 *
 * Nessun accesso alla pagina e nessuna rete: si prova con `npm test`.
 */

/** Dopo mezz'ora una stanza in attesa non si mostra piu'. */
export const LOBBY_ROOM_MAX_AGE_MS = 30 * 60 * 1000;

/** Tolleranza per gli orologi dei dispositivi che vanno avanti. */
const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

/** Lunghezza massima di un nome mostrato (la stessa del campo del nome). */
export const MAX_DISPLAY_NAME_LENGTH = 22;

/** Un codice stanza fatto come li fa generateRoomCode(): lettere e cifre. */
const ROOM_CODE_PATTERN = /^[A-Z0-9]{4,8}$/;

/** Vero se il codice ha la forma di un codice stanza. */
export function isValidRoomCode(code) {
    return typeof code === 'string' && ROOM_CODE_PATTERN.test(code);
}

/**
 * Un nome altrui reso mostrabile: testo semplice, senza caratteri di
 * controllo, non piu' lungo del campo del nome. Mai vuoto.
 *
 * @param {unknown} name
 * @param {string} [fallback]
 * @returns {string}
 */
export function displayName(name, fallback = 'Scacchista') {
    if (typeof name !== 'string') return fallback;
    const pulito = name.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!pulito) return fallback;
    return pulito.length > MAX_DISPLAY_NAME_LENGTH
        ? pulito.slice(0, MAX_DISPLAY_NAME_LENGTH)
        : pulito;
}

/**
 * Le stanze da mostrare nella sala, dalla piu' recente.
 *
 * @param {Array<object>} rooms  Documenti letti da Firestore, con `id`.
 * @param {string|null} myUid    Chi sta guardando la sala.
 * @param {number} now           Date.now() di chi guarda.
 * @returns {Array<object>} copie ripulite, mai gli oggetti ricevuti.
 */
export function visibleLobbyRooms(rooms, myUid, now) {
    if (!Array.isArray(rooms)) return [];

    return rooms
        .filter((room) => {
            if (!room || room.status !== 'waiting') return false;
            if (!isValidRoomCode(room.id)) return false;
            if (typeof room.whiteUid !== 'string' || !room.whiteUid) return false;

            const createdAt = room.createdAt;
            if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) return false;
            if (now - createdAt >= LOBBY_ROOM_MAX_AGE_MS) return false;
            if (createdAt - now > CLOCK_SKEW_TOLERANCE_MS) return false;

            // Privata: la vede solo chi l'ha creata
            if (room.isPrivate === true && room.whiteUid !== myUid) return false;

            return true;
        })
        .map((room) => ({
            id: room.id,
            whiteUid: room.whiteUid,
            whiteName: displayName(room.whiteName),
            isPrivate: room.isPrivate === true,
            createdAt: room.createdAt
        }))
        .sort((a, b) => b.createdAt - a.createdAt);
}
