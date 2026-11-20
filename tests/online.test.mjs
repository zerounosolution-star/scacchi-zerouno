/**
 * TEST DEL GIOCO ONLINE
 *
 *   npm test
 *
 * La parte online non aveva nessuna prova, ed e' quella dove i difetti
 * costano di piu': i dati li scrivono altre persone. Qui si prova tutto
 * cio' che non ha bisogno ne' del browser ne' della rete.
 *
 * Ogni prova nasce da un difetto vero, trovato il 20 novembre 2026:
 * - un nome di stanza scritto apposta eseguiva codice sullo schermo di
 *   chiunque avesse la sala aperta, e cosi' un link d'invito truccato;
 * - le stanze private comparivano nella sala pubblica;
 * - la mossa dell'avversario azzerava la storia della partita (lista
 *   mosse vuota, orologio fermo, niente patta per ripetizione).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ZeroUnoChessEngine } from '../src/engine/chess-engine.js';
import { findMoveToFen } from '../src/online/sync.js';
import {
    visibleLobbyRooms, displayName, isValidRoomCode,
    LOBBY_ROOM_MAX_AGE_MS, MAX_DISPLAY_NAME_LENGTH
} from '../src/online/lobby.js';

const radice = join(dirname(fileURLToPath(import.meta.url)), '..');
const leggi = (percorso) => readFileSync(join(radice, percorso), 'utf8');

/* ------------------------------------------------------------------ */
/* La mossa dell'avversario ricostruita dalla posizione                */
/* ------------------------------------------------------------------ */

/** Gioca le mosse su un motore nuovo e restituisce la posizione. */
function fenDopo(mosse, da = null) {
    const motore = new ZeroUnoChessEngine();
    if (da) motore.load(da);
    for (const m of mosse) assert.ok(motore.move(m), `mossa non valida nel test: ${JSON.stringify(m)}`);
    return motore.fen();
}

test('online: trova la mossa semplice che porta alla posizione ricevuta', () => {
    const inizio = new ZeroUnoChessEngine().fen();
    const arrivo = fenDopo([{ from: 'e2', to: 'e4' }]);
    assert.deepEqual(findMoveToFen(inizio, arrivo), { from: 'e2', to: 'e4' });
});

test('online: due giocatori si scambiano le mosse e la storia resta intera', () => {
    // Quello che fa il gioco: ognuno gioca la sua mossa, l'altro riceve
    // solo la posizione e deve ricostruire la mossa.
    const bianco = new ZeroUnoChessEngine();
    const nero = new ZeroUnoChessEngine();
    const partita = [
        { from: 'e2', to: 'e4' }, { from: 'e7', to: 'e5' },
        { from: 'g1', to: 'f3' }, { from: 'b8', to: 'c6' },
        { from: 'f1', to: 'c4' }, { from: 'g8', to: 'f6' }
    ];

    partita.forEach((mossa, i) => {
        const chiMuove = i % 2 === 0 ? bianco : nero;
        const chiRiceve = i % 2 === 0 ? nero : bianco;

        assert.ok(chiMuove.move(mossa));
        const ricostruita = findMoveToFen(chiRiceve.fen(), chiMuove.fen());
        assert.ok(ricostruita, `mossa ${i + 1} non ricostruita`);
        assert.ok(chiRiceve.move(ricostruita));
        assert.equal(chiRiceve.fen(), chiMuove.fen());
    });

    // Il difetto: qui la storia valeva 0 o 1. Deve valere 6 per tutti e due.
    assert.equal(bianco.history().length, 6);
    assert.equal(nero.history().length, 6);
    assert.equal(nero.pgn(), '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6');
    assert.equal(bianco.pgn(), nero.pgn());
});

test('online: ricostruisce cattura, arrocco e presa al varco', () => {
    // Cattura
    let prima = fenDopo([{ from: 'e2', to: 'e4' }, { from: 'd7', to: 'd5' }]);
    let dopo = fenDopo([{ from: 'e4', to: 'd5' }], prima);
    assert.deepEqual(findMoveToFen(prima, dopo), { from: 'e4', to: 'd5' });

    // Arrocco corto del bianco
    prima = fenDopo([
        { from: 'e2', to: 'e4' }, { from: 'e7', to: 'e5' },
        { from: 'g1', to: 'f3' }, { from: 'b8', to: 'c6' },
        { from: 'f1', to: 'c4' }, { from: 'f8', to: 'c5' }
    ]);
    dopo = fenDopo([{ from: 'e1', to: 'g1' }], prima);
    assert.deepEqual(findMoveToFen(prima, dopo), { from: 'e1', to: 'g1' });

    // Presa al varco
    prima = fenDopo([
        { from: 'e2', to: 'e4' }, { from: 'a7', to: 'a6' },
        { from: 'e4', to: 'e5' }, { from: 'd7', to: 'd5' }
    ]);
    dopo = fenDopo([{ from: 'e5', to: 'd6' }], prima);
    assert.deepEqual(findMoveToFen(prima, dopo), { from: 'e5', to: 'd6' });
});

test('online: riconosce a quale pezzo si e\' promosso', () => {
    // Pedone bianco in a7, casa a8 libera: quattro promozioni possibili
    const prima = '4k3/P7/8/8/8/8/8/4K3 w - - 0 1';

    for (const pezzo of ['q', 'r', 'b', 'n']) {
        const dopo = fenDopo([{ from: 'a7', to: 'a8', promotion: pezzo }], prima);
        assert.deepEqual(
            findMoveToFen(prima, dopo),
            { from: 'a7', to: 'a8', promotion: pezzo },
            `promozione a ${pezzo} non riconosciuta`
        );
    }
});

test('online: nessuna mossa singola porta li\' -> null, e il motore non si tocca', () => {
    const inizio = new ZeroUnoChessEngine().fen();
    const lontano = fenDopo([{ from: 'e2', to: 'e4' }, { from: 'e7', to: 'e5' }]);

    assert.equal(findMoveToFen(inizio, lontano), null);   // due mosse di distanza
    assert.equal(findMoveToFen(lontano, inizio), null);   // indietro non si torna
    assert.equal(findMoveToFen(inizio, inizio), null);    // stessa posizione
    assert.equal(findMoveToFen(inizio, 'non e\' una posizione'), null);
    assert.equal(findMoveToFen('', lontano), null);
    assert.equal(findMoveToFen(inizio, ''), null);
});

/* ------------------------------------------------------------------ */
/* Cosa si vede nella sala                                              */
/* ------------------------------------------------------------------ */

const ORA = 1_800_000_000_000;
const IO = 'uid-mio';

/** Una stanza in attesa, valida, creata un minuto fa da un'altra persona. */
function stanza(extra = {}) {
    return {
        id: 'ZUAB12', status: 'waiting', isPrivate: false,
        whiteUid: 'uid-altro', whiteName: 'Marco', createdAt: ORA - 60_000,
        ...extra
    };
}

test('sala: la stanza privata di un altro NON si vede, la propria si\'', () => {
    const viste = visibleLobbyRooms([
        stanza({ id: 'ZUPUB1' }),
        stanza({ id: 'ZUPRV1', isPrivate: true }),
        stanza({ id: 'ZUMIA1', isPrivate: true, whiteUid: IO })
    ], IO, ORA);

    assert.deepEqual(viste.map((r) => r.id).sort(), ['ZUMIA1', 'ZUPUB1']);
});

test('sala: solo stanze in attesa e recenti; una data nel futuro non resta in cima', () => {
    const viste = visibleLobbyRooms([
        stanza({ id: 'ZUOK01' }),
        stanza({ id: 'ZUACT1', status: 'active' }),
        stanza({ id: 'ZUFIN1', status: 'finished' }),
        stanza({ id: 'ZUOLD1', createdAt: ORA - LOBBY_ROOM_MAX_AGE_MS }),
        stanza({ id: 'ZUFUT1', createdAt: ORA + 365 * 24 * 3600 * 1000 }),
        stanza({ id: 'ZUNAN1', createdAt: 'ieri' }),
        stanza({ id: 'ZUNOU1', whiteUid: null }),
        null
    ], IO, ORA);

    assert.deepEqual(viste.map((r) => r.id), ['ZUOK01']);
});

test('sala: un orologio avanti di poco non nasconde la stanza', () => {
    const viste = visibleLobbyRooms([stanza({ createdAt: ORA + 60_000 })], IO, ORA);
    assert.equal(viste.length, 1);
});

test('sala: dalla piu\' recente, e senza toccare gli oggetti ricevuti', () => {
    const ricevute = [
        stanza({ id: 'ZUVEC1', createdAt: ORA - 600_000 }),
        stanza({ id: 'ZUNUO1', createdAt: ORA - 1_000 })
    ];
    const viste = visibleLobbyRooms(ricevute, IO, ORA);

    assert.deepEqual(viste.map((r) => r.id), ['ZUNUO1', 'ZUVEC1']);
    assert.notEqual(viste[0], ricevute[1]);
    assert.deepEqual(visibleLobbyRooms('non una lista', IO, ORA), []);
});

test('sala: un codice stanza fatto apposta non entra nella sala', () => {
    const cattivi = ['<img src=x onerror=alert(1)>', 'ZU AB', 'zuab12', 'A', 'TROPPOLUNGO1', '', 42, null];
    for (const id of cattivi) {
        assert.equal(isValidRoomCode(id), false, `accettato: ${String(id)}`);
        assert.deepEqual(visibleLobbyRooms([stanza({ id })], IO, ORA), []);
    }
    assert.equal(isValidRoomCode('ZUAB12'), true);
    assert.equal(isValidRoomCode('ZU4819'), true);
});

test('sala: il nome altrui diventa testo corto e pulito', () => {
    assert.equal(displayName('Marco'), 'Marco');
    assert.equal(displayName('  Anna   Maria  '), 'Anna Maria');
    assert.equal(displayName(''), 'Scacchista');
    assert.equal(displayName('   '), 'Scacchista');
    assert.equal(displayName(null), 'Scacchista');
    assert.equal(displayName({ toString: () => 'x' }), 'Scacchista');
    assert.equal(displayName(undefined, 'Bianco'), 'Bianco');
    assert.equal(displayName('riga1\nriga2\tfine'), 'riga1 riga2 fine');

    const lungo = displayName('x'.repeat(5000));
    assert.equal(lungo.length, MAX_DISPLAY_NAME_LENGTH);

    // Il nome resta testo: i simboli non si tolgono, si mostrano come sono.
    // A renderli innocui e' il modo in cui vengono scritti nella pagina.
    const viste = visibleLobbyRooms([stanza({ whiteName: '<b>Zoe</b>' })], IO, ORA);
    assert.equal(viste[0].whiteName, '<b>Zoe</b>');
});

/* ------------------------------------------------------------------ */
/* Guardie sul codice: il testo altrui non diventa mai HTML             */
/* ------------------------------------------------------------------ */

test('sicurezza: nei moduli online e nelle notifiche nessun testo entra come HTML', () => {
    /*
     * In questi file passano nomi, codici e messaggi scritti da altre
     * persone. L'unica scrittura di HTML ammessa e' svuotare un elemento.
     */
    const sorvegliati = [
        'src/online/firestore.js',
        'src/online/lobby.js',
        'src/online/sync.js',
        'src/core/utils.js'
    ];

    for (const file of sorvegliati) {
        const codice = leggi(file);
        const scritture = [...codice.matchAll(/\.(innerHTML|outerHTML)\s*\+?=\s*([^;\n]+)/g)];
        for (const [intera, , valore] of scritture) {
            assert.match(valore.trim(), /^(''|"")$/, `${file}: testo scritto come HTML -> ${intera.trim()}`);
        }
        assert.ok(!/insertAdjacentHTML|document\.write/.test(codice), `${file}: usa insertAdjacentHTML o document.write`);
    }
});

test('sicurezza: il codice del link d\'invito si controlla prima di usarlo', () => {
    const codice = leggi('src/online/firestore.js');
    const invito = codice.slice(codice.indexOf('function joinRoomFromInviteLink'), codice.indexOf('export function subscribeToGlobalLobby'));

    assert.ok(invito.includes('isValidRoomCode(code)'), 'il codice dell\'invito non passa da isValidRoomCode');
    assert.ok(
        invito.indexOf('isValidRoomCode(code)') < invito.indexOf('joinOnlineMatchById(code)'),
        'il controllo deve venire prima dell\'ingresso nella stanza'
    );
});

test('online: la stanza vecchia si dimentica prima di ogni attesa di rete', () => {
    /*
     * Il difetto: cleanupActiveOnlineMatch azzerava currentMatchId DOPO
     * le attese di rete, quando chi l'aveva chiamata aveva gia' scritto
     * il codice della stanza nuova. Le mosse della seconda partita non
     * partivano piu'.
     */
    const codice = leggi('src/online/firestore.js');
    const pulizia = codice.slice(codice.indexOf('export async function cleanupActiveOnlineMatch'));

    const azzera = pulizia.indexOf('state.currentMatchId = null');
    const primaAttesa = pulizia.indexOf('await ');
    assert.ok(azzera > 0, 'currentMatchId non viene azzerato');
    assert.ok(primaAttesa > 0, 'nessuna attesa trovata: il test non sta guardando niente');
    assert.ok(azzera < primaAttesa, 'currentMatchId va azzerato prima del primo await');
    assert.equal(pulizia.split('state.currentMatchId = null').length - 1, 1, 'un solo azzeramento, all\'inizio');
});

test('service worker: la configurazione con la chiave non entra in dispensa', () => {
    const sw = leggi('sw.js');
    const dispensa = sw.slice(sw.indexOf('const APP_SHELL'), sw.indexOf('];', sw.indexOf('const APP_SHELL')));

    assert.ok(!dispensa.includes('firebase.config.js'), 'firebase.config.js non deve stare in APP_SHELL');
    assert.match(sw, /pathname\.endsWith\('\/firebase\.config\.js'\)/, 'manca il passaggio diretto alla rete per firebase.config.js');
});
