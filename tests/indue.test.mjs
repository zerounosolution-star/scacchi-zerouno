/**
 * TEST DEL GIOCO IN DUE
 *
 *   npm test
 *
 * Dal 20 novembre 2026 giocare con una persona che si conosce sta tutto
 * in una linguetta: sullo stesso schermo (con la scacchiera che si gira
 * da sola verso chi deve muovere) oppure a distanza con un link. Queste
 * prove tengono ferme le tre cose che lo rendono semplice: la rotazione
 * automatica, l'invito, e la pagina che non rimette in mezzo quello che
 * e' stato tolto.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { orientationForLocalTurn } from '../src/game/autoflip.js';
import { inviteLink, inviteMessage, INVITE_TEXT } from '../src/online/invite.js';

const radice = join(dirname(fileURLToPath(import.meta.url)), '..');
const leggi = (percorso) => readFileSync(join(radice, percorso), 'utf8');
const pagina = leggi('index.html');

/** Il pezzo di pagina fra due segnaposto: una linguetta, il riquadro d'attesa, il piede. */
function pezzo(da, a) {
    const inizio = pagina.indexOf(da);
    const fine = pagina.indexOf(a, inizio + da.length);
    assert.ok(inizio > 0 && fine > inizio, `segnaposto non trovati: ${da} ... ${a}`);
    return pagina.slice(inizio, fine);
}

/* ------------------------------------------------------------------ */
/* La scacchiera che si gira da sola                                    */
/* ------------------------------------------------------------------ */

const inDue = { gameMode: 'local', autoFlip: true, matchEnded: false };

test('in due: la scacchiera guarda chi deve muovere', () => {
    assert.equal(orientationForLocalTurn({ ...inDue, turn: 'w' }), 'w');
    assert.equal(orientationForLocalTurn({ ...inDue, turn: 'b' }), 'b');
});

test('in due: con la spunta spenta la scacchiera resta ferma', () => {
    assert.equal(orientationForLocalTurn({ ...inDue, autoFlip: false, turn: 'b' }), null);
});

test('in due: contro l\'AI e online la scacchiera non si gira mai da sola', () => {
    for (const gameMode of ['ai', 'world-challenger', 'online']) {
        assert.equal(orientationForLocalTurn({ ...inDue, gameMode, turn: 'b' }), null, gameMode);
    }
});

test('in due: a partita finita resta dal lato di chi ha chiuso', () => {
    assert.equal(orientationForLocalTurn({ ...inDue, matchEnded: true, turn: 'b' }), null);
});

test('in due: non si gira sotto il dito di chi sta gia\' muovendo', () => {
    assert.equal(orientationForLocalTurn({ ...inDue, turn: 'b', busy: true }), null);
});

test('in due: un turno che non esiste non gira niente', () => {
    assert.equal(orientationForLocalTurn({ ...inDue, turn: undefined }), null);
    assert.equal(orientationForLocalTurn({ ...inDue, turn: 'x' }), null);
});

test('in due: la mossa mette in coda la rotazione, e l\'annulla la rimette a posto', () => {
    /*
     * Se una di queste due chiamate sparisce, la partita in due torna
     * com'era prima: «Ruota» a mano a ogni mossa.
     */
    const mossa = leggi('src/ui/input.js');
    const salva = mossa.indexOf('saveMatch();');
    const gira = mossa.indexOf('scheduleLocalAutoFlip();');
    assert.ok(salva > 0 && gira > salva, 'dopo la mossa la rotazione va messa in coda, dopo il salvataggio');

    const avvio = leggi('src/main.js');
    const annulla = avvio.slice(avvio.indexOf("getElementById('undoMoveBtn')"), avvio.indexOf("getElementById('drawGameBtn')"));
    assert.ok(annulla.includes('alignLocalBoardNow();'), 'dopo «Annulla» la scacchiera deve tornare da chi muove');
});

/* ------------------------------------------------------------------ */
/* L'invito a distanza                                                  */
/* ------------------------------------------------------------------ */

const SITO = 'https://esempio.test/scacchi/';

test('invito: il link porta dentro la stanza', () => {
    assert.equal(inviteLink(SITO, 'ZUAB12'), 'https://esempio.test/scacchi/?stanza=ZUAB12');
    // Scritto in minuscolo o con spazi attorno, e' lo stesso codice
    assert.equal(inviteLink(SITO, '  zuab12 '), 'https://esempio.test/scacchi/?stanza=ZUAB12');
});

test('invito: senza un codice vero non nasce nessun link', () => {
    // «------» e' quello che la pagina mostra finche' la stanza non esiste
    for (const finto of ['------', '', null, undefined, 'AB', 'TROPPOLUNGO1', 'ZU<b>1', 'ZU 12 3']) {
        assert.equal(inviteLink(SITO, finto), null, String(finto));
    }
});

test('invito: il messaggio e\' la frase piu\' il link, e niente altro', () => {
    const link = inviteLink(SITO, 'ZUAB12');
    assert.equal(inviteMessage(link), `${INVITE_TEXT} ${link}`);
    assert.ok(INVITE_TEXT.endsWith(':'), 'la frase introduce il link');
});

/* ------------------------------------------------------------------ */
/* La pagina: una linguetta per giocare in due                          */
/* ------------------------------------------------------------------ */

const linguettaInDue = pezzo('id="tabPanelLocal"', 'id="tabPanelOnline"');
const linguettaMondo = pezzo('id="tabPanelOnline"', '</section>');
const attesa = pezzo('id="matchmakingOverlay"', '<!-- Giocatore in basso -->');

test('pagina: giocare in due sta tutto in una linguetta', () => {
    for (const id of ['startLocalMatchBtn', 'localAutoFlipToggle', 'localTimeControlSelect',
        'createPrivateRoomBtn', 'joinRoomCodeInput', 'joinRoomByCodeBtn']) {
        assert.ok(linguettaInDue.includes(`id="${id}"`), `${id} deve stare nella linguetta «2 Giocatori»`);
    }
    // Una cosa in un posto solo: niente doppioni nella sala mondiale
    for (const id of ['createPrivateRoomBtn', 'joinRoomCodeInput', 'joinRoomByCodeBtn']) {
        assert.ok(!linguettaMondo.includes(`id="${id}"`), `${id} non va ripetuto nella sala mondiale`);
    }
    assert.ok(linguettaMondo.includes('id="findWorldMatchBtn"'));
});

test('pagina: la rotazione automatica parte accesa', () => {
    const spunta = linguettaInDue.match(/<input id="localAutoFlipToggle"[^>]*>/);
    assert.ok(spunta, 'spunta non trovata');
    assert.match(spunta[0], /type="checkbox"/);
    assert.match(spunta[0], /\bchecked\b/);
});

test('pagina: chi aspetta l\'amico ha un bottone solo da premere', () => {
    assert.ok(attesa.includes('id="shareInviteBtn"'), 'manca il bottone che manda il link');
    assert.ok(attesa.includes('id="waitingRoomCodeDisplay"'), 'il codice resta leggibile per chi lo detta a voce');
    assert.ok(attesa.includes('id="cancelMatchmakingBtn"'));
    const bottoni = [...attesa.matchAll(/<button\b/g)].length;
    assert.equal(bottoni, 2, 'nel riquadro d\'attesa: manda il link e annulla, nient\'altro');
});

test('pagina: tolto quello che non serviva a nessuno', () => {
    // L'identificativo tecnico non aveva nessuna funzione nel gioco
    for (const id of ['userIdDisplay', 'copyUserIdBtn', 'copyWaitingCodeBtn', 'instantWorldOpponentBtn']) {
        assert.ok(!pagina.includes(`id="${id}"`), `${id} e' tornato nella pagina`);
    }
});

test('pagina: sul telefono la mossa scritta non occupa una riga', () => {
    const campo = pagina.indexOf('id="notationMoveInput"');
    const riga = pagina.lastIndexOf('<div class="', campo);
    const classi = pagina.slice(riga, pagina.indexOf('>', riga));
    assert.match(classi, /\bhidden\b/, 'nascosta sotto la soglia del telefono');
    assert.match(classi, /\bsm:flex\b/, 'visibile dal tablet in su, dove c\'e\' una tastiera');
});

/* ------------------------------------------------------------------ */
/* Il codice non cerca pezzi di pagina che non esistono                 */
/* ------------------------------------------------------------------ */

/** Tutti i file .js sotto una cartella. */
function moduli(cartella) {
    const trovati = [];
    for (const nome of readdirSync(join(radice, cartella))) {
        const relativo = `${cartella}/${nome}`;
        if (statSync(join(radice, relativo)).isDirectory()) trovati.push(...moduli(relativo));
        else if (nome.endsWith('.js')) trovati.push(relativo);
    }
    return trovati;
}

test('pagina: ogni elemento che il codice va a prendere esiste davvero', () => {
    /*
     * Un getElementById su un pezzo tolto dalla pagina da' null, e il
     * primo .addEventListener ferma tutto l'avvio: il gioco resta una
     * scacchiera muta. Chi toglie un bottone dalla pagina deve togliere
     * anche chi lo cerca.
     */
    // Nati dal codice, non scritti nella pagina
    const CREATI_DAL_CODICE = new Set(['updateBanner']);

    const nellaPagina = new Set([...pagina.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
    const orfani = [];
    let cercati = 0;

    for (const file of moduli('src')) {
        for (const [, id] of leggi(file).matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)) {
            cercati++;
            if (!nellaPagina.has(id) && !CREATI_DAL_CODICE.has(id)) orfani.push(`${file}: ${id}`);
        }
    }

    assert.ok(cercati > 60, `pochi getElementById trovati (${cercati}): il test non sta guardando niente`);
    assert.deepEqual(orfani, [], `elementi cercati ma assenti nella pagina:\n${orfani.join('\n')}`);
});

/* ------------------------------------------------------------------ */
/* I disegni dei pezzi hanno un autore                                  */
/* ------------------------------------------------------------------ */

test('crediti: la pagina nomina l\'autore dei pezzi e la sua licenza', () => {
    /*
     * I 12 pezzi sono i disegni di Cburnett su Wikimedia Commons, con i
     * colori cambiati. La licenza CC BY-SA 3.0 chiede autore, licenza e
     * modifiche dichiarate: senza questa riga il gioco la viola.
     */
    const piede = pezzo('<footer', '</footer>');
    assert.match(piede, /Cburnett/);
    assert.match(piede, /Wikimedia Commons/);
    assert.match(piede, /CC BY-SA 3\.0/);
    assert.match(piede, /href="https:\/\/creativecommons\.org\/licenses\/by-sa\/3\.0\//, 'serve il collegamento alla licenza');
    assert.match(piede, /adattati/, 'le modifiche vanno dichiarate');
    assert.ok(!/pezzi originali/i.test(pagina), 'la pagina non puo\' dire che i pezzi sono originali');
});

test('crediti: anche il README dice di chi sono i pezzi', () => {
    const readme = leggi('README.md');
    assert.match(readme, /Cburnett/);
    assert.ok(!/grafica dei\s+pezzi sono originali/i.test(readme), 'il README dice ancora che i pezzi sono originali');
});
