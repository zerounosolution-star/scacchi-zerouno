/**
 * PROVE DELLE REGOLE DI SICUREZZA, NELL'EMULATORE
 *
 *     npm run regole
 *
 * Mette in moto l'emulatore di Firestore con firebase/firestore.rules e gli
 * manda, come farebbe il gioco, tutte le scritture che il gioco fa davvero
 * (devono passare) e una serie di scritture scorrette (devono essere
 * rifiutate). Niente arriva al database vero: il progetto si chiama
 * «demo-…» e l'emulatore vive solo sul computer.
 *
 * Non usa librerie: parla all'emulatore con fetch, e si presenta come un
 * utente con un gettone non firmato, che l'emulatore accetta apposta.
 *
 * I pacchetti qui sotto ricopiano quelli di src/online/firestore.js. Se il
 * gioco cambia cio' che scrive, vanno cambiati anche qui: tests/regole.test.mjs
 * (che gira con `npm test`) controlla che i nomi dei campi coincidano.
 */

import test, { before } from 'node:test';
import assert from 'node:assert/strict';

import { ZeroUnoChessEngine } from '../src/engine/chess-engine.js';

const HOST = process.env.FIRESTORE_EMULATOR_HOST;
const PROGETTO = process.env.GCLOUD_PROJECT || 'demo-scacchi-zerouno';
const DOCUMENTI = `http://${HOST}/v1/projects/${PROGETTO}/databases/(default)/documents`;
const PARTITE = 'artifacts/scacchi-zerouno-world/public/data/chess_matches';

const ANNA = 'utente-anna';      // crea le stanze: gioca col bianco
const BRUNO = 'utente-bruno';    // entra: gioca col nero
const CARLA = 'utente-carla';    // terza persona: non gioca
const FEN_INIZIALE = new ZeroUnoChessEngine().fen();

/* ------------------------------ attrezzi ------------------------------ */

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

/** Gettone non firmato: l'emulatore lo prende per buono, il database vero no. */
function gettone(uid) {
    const ora = Math.floor(Date.now() / 1000);
    return `${b64({ alg: 'none', type: 'JWT' })}.${b64({
        iss: `https://securetoken.google.com/${PROGETTO}`, aud: PROGETTO,
        iat: ora, exp: ora + 3600, auth_time: ora, sub: uid, user_id: uid,
        firebase: { sign_in_provider: 'anonymous', identities: {} }
    })}.`;
}

/** Chi fa la richiesta: un utente, nessuno (null) o l'amministratore che salta le regole. */
function intestazioni(chi) {
    const h = { 'Content-Type': 'application/json' };
    if (chi === 'amministratore') h.Authorization = 'Bearer owner';
    else if (chi) h.Authorization = `Bearer ${gettone(chi)}`;
    return h;
}

/** Un valore JavaScript nel formato di Firestore, come lo manda il gioco. */
function valore(v) {
    if (v === null) return { nullValue: null };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (typeof v === 'string') return { stringValue: v };
    throw new Error('tipo non previsto nel test: ' + typeof v);
}
const campi = (oggetto) => Object.fromEntries(Object.entries(oggetto).map(([k, v]) => [k, valore(v)]));

async function chiedi(metodo, url, chi, corpo) {
    const risposta = await fetch(url, { method: metodo, headers: intestazioni(chi), body: corpo ? JSON.stringify(corpo) : undefined });
    let testo = null;
    try { testo = await risposta.json(); } catch (e) { /* risposta senza corpo */ }
    return { stato: risposta.status, corpo: testo };
}

const percorso = (id, raccolta = PARTITE) => `${DOCUMENTI}/${raccolta}/${encodeURIComponent(id)}`;

/** Come setDoc: scrive il documento intero (lo crea se non c'e'). */
const scrivi = (chi, id, dati, raccolta) => chiedi('PATCH', percorso(id, raccolta), chi, { fields: campi(dati) });

/** Come updateDoc: cambia solo i campi indicati di un documento che esiste. */
function aggiorna(chi, id, parziale) {
    const maschera = Object.keys(parziale).map((k) => `updateMask.fieldPaths=${k}`).join('&');
    return chiedi('PATCH', `${percorso(id)}?${maschera}&currentDocument.exists=true`, chi, { fields: campi(parziale) });
}

const leggi = (chi, id, raccolta) => chiedi('GET', percorso(id, raccolta), chi);
const cancella = (chi, id) => chiedi('DELETE', percorso(id), chi);

/** Come la sala del gioco: le stanze piu' recenti, con un limite. */
function elenca(chi, limite) {
    const domanda = { from: [{ collectionId: 'chess_matches' }], orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }] };
    if (limite !== undefined) domanda.limit = limite;
    return chiedi('POST', `${DOCUMENTI}/artifacts/scacchi-zerouno-world/public/data:runQuery`, chi, { structuredQuery: domanda });
}

const svuota = () => fetch(`http://${HOST}/emulator/v1/projects/${PROGETTO}/databases/(default)/documents`, { method: 'DELETE' });

function rifiutata(r) {
    if (r.stato === 403) return true;
    const primo = Array.isArray(r.corpo) ? r.corpo[0] : r.corpo;
    return Boolean(primo && primo.error && (primo.error.code === 403 || primo.error.status === 'PERMISSION_DENIED'));
}

async function permesso(promessa, cosa) {
    const r = await promessa;
    assert.ok(r.stato === 200 && !rifiutata(r), `${cosa}: doveva PASSARE, risposta ${r.stato} ${JSON.stringify(r.corpo).slice(0, 220)}`);
    return r;
}

async function negato(promessa, cosa) {
    const r = await promessa;
    assert.ok(rifiutata(r), `${cosa}: doveva essere RIFIUTATA, risposta ${r.stato} ${JSON.stringify(r.corpo).slice(0, 220)}`);
    return r;
}

/* --------- i pacchetti che il gioco scrive (src/online/firestore.js) --------- */

/** createOnlineRoom */
const stanzaNuova = (uid, extra = {}) => {
    const ora = Date.now();
    return {
        status: 'waiting', isPrivate: false, fen: FEN_INIZIALE, pgn: '', lastFrom: null, lastTo: null,
        whiteUid: uid, whiteName: 'Anna', blackUid: null, blackName: 'In attesa di avversario...',
        winnerTitle: null, winnerSubtitle: null, createdAt: ora, updatedAt: ora, ...extra
    };
};
/** joinOnlineMatchById */
const ingresso = (uid, nome = 'Bruno') => ({ blackUid: uid, blackName: nome, status: 'active', updatedAt: Date.now() });
/** syncOnlineMove */
const mossa = (motore, fatta) => ({ fen: motore.fen(), pgn: motore.pgn(), lastFrom: fatta.from, lastTo: fatta.to, updatedAt: Date.now() });
/** finishOnlineMatch */
const chiusura = (titolo = 'Vittoria del Bianco per Abbandono', sotto = 'Partita conclusa per resa') =>
    ({ status: 'finished', winnerTitle: titolo, winnerSubtitle: sotto, updatedAt: Date.now() });

let contatore = 0;
/** Un codice stanza nuovo a ogni chiamata, fatto come quelli del gioco. */
const codice = () => 'ZU' + String(1000 + (contatore++)).slice(-4).replace(/0/g, 'A').replace(/1/g, 'B');

/** Prepara, saltando le regole, una stanza gia' nello stato che serve alla prova. */
async function prepara(stato = 'waiting', extra = {}) {
    const id = codice();
    const dati = stanzaNuova(ANNA, extra);
    if (stato !== 'waiting') Object.assign(dati, { blackUid: BRUNO, blackName: 'Bruno', status: stato });
    if (stato === 'finished') Object.assign(dati, { winnerTitle: 'Partita Patta per Accordo', winnerSubtitle: 'I giocatori hanno concordato la patta' });
    Object.assign(dati, extra);
    const r = await scrivi('amministratore', id, dati);
    assert.equal(r.stato, 200, 'preparazione della prova non riuscita: ' + JSON.stringify(r.corpo));
    return id;
}

before(async () => {
    assert.ok(HOST, 'Emulatore non avviato: queste prove si lanciano con «npm run regole», non da sole.');
    await svuota();
});

/* ====================================================================== */
/* 1. Quello che il gioco fa davvero deve passare                          */
/* ====================================================================== */

test('gioco: creare una stanza pubblica e una privata', async () => {
    await permesso(scrivi(ANNA, codice(), stanzaNuova(ANNA)), 'stanza pubblica');
    await permesso(scrivi(ANNA, codice(), stanzaNuova(ANNA, { isPrivate: true })), 'stanza privata');
    // Un nome lungo quanto il campo del gioco (22 caratteri) e il nome automatico
    await permesso(scrivi(ANNA, codice(), stanzaNuova(ANNA, { whiteName: 'N'.repeat(22) })), 'nome di 22 caratteri');
    await permesso(scrivi(ANNA, codice(), stanzaNuova(ANNA, { whiteName: 'Giocatore_ABCD' })), 'nome automatico');
});

test('gioco: leggere una stanza col codice e vedere la sala', async () => {
    const id = await prepara('waiting');
    await permesso(leggi(ANNA, id), 'chi l\'ha creata legge la stanza');
    await permesso(leggi(BRUNO, id), 'chi ha il codice legge la stanza');
    await permesso(leggi(CARLA, id), 'chi guarda legge la stanza');
    const sala = await permesso(elenca(BRUNO, 25), 'la sala con il limite del gioco (25)');
    assert.ok(Array.isArray(sala.corpo) && sala.corpo.some((r) => r.document), 'la sala non ha restituito stanze');
});

test('gioco: entrare in una stanza aperta', async () => {
    const id = await prepara('waiting');
    await permesso(aggiorna(BRUNO, id, ingresso(BRUNO)), 'Bruno entra come nero');
    const dopo = await leggi('amministratore', id);
    assert.equal(dopo.corpo.fields.blackUid.stringValue, BRUNO);
    assert.equal(dopo.corpo.fields.status.stringValue, 'active');
});

test('gioco: una partita intera, mossa dopo mossa, fino alla resa', async () => {
    const id = codice();
    await permesso(scrivi(ANNA, id, stanzaNuova(ANNA)), 'creazione');
    await permesso(aggiorna(BRUNO, id, ingresso(BRUNO)), 'ingresso');

    const motore = new ZeroUnoChessEngine();
    const partita = [
        ['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3'], ['b8', 'c6'], ['f1', 'c4'], ['f8', 'c5'],
        ['e1', 'g1'],                                   // arrocco
        ['g8', 'f6'], ['d2', 'd4'], ['e5', 'd4'],       // cattura
        ['e4', 'e5'], ['d7', 'd5'], ['e5', 'd6']        // presa al varco
    ];
    for (const [i, [da, a]] of partita.entries()) {
        const fatta = motore.move({ from: da, to: a });
        assert.ok(fatta, `mossa ${i + 1} non valida nel test`);
        await permesso(aggiorna(i % 2 === 0 ? ANNA : BRUNO, id, mossa(motore, fatta)), `mossa ${i + 1} (${fatta.san})`);
    }
    await permesso(aggiorna(BRUNO, id, chiusura()), 'Bruno si arrende');
    const dopo = await leggi('amministratore', id);
    assert.equal(dopo.corpo.fields.status.stringValue, 'finished');
    assert.equal(dopo.corpo.fields.pgn.stringValue, motore.pgn());
});

test('gioco: una partita lunga non supera i limiti (120 mosse, promozioni comprese)', async () => {
    const id = await prepara('active');
    // Una posizione con promozione e una notazione lunga quanto una partita vera
    const motore = new ZeroUnoChessEngine();
    motore.load('4k3/P7/8/8/8/8/7p/4K3 w - - 0 60');
    const promossa = motore.move({ from: 'a7', to: 'a8', promotion: 'q' });
    await permesso(aggiorna(ANNA, id, { ...mossa(motore, promossa), pgn: '1. e4 e5 '.repeat(240).trim() }), 'promozione con notazione lunga');
});

test('gioco: patta, e chi ha creato la stanza che chiude mentre aspetta', async () => {
    const attiva = await prepara('active');
    await permesso(aggiorna(ANNA, attiva, chiusura('Partita Patta per Accordo', 'I giocatori hanno concordato la patta')), 'patta');
    const inAttesa = await prepara('waiting');
    await permesso(aggiorna(ANNA, inAttesa, chiusura()), 'chiusura mentre si aspetta');
});

test('gioco: il nero che rientra nella sua partita (pagina ricaricata)', async () => {
    const id = await prepara('active');
    await permesso(aggiorna(BRUNO, id, ingresso(BRUNO, 'Bruno col nome nuovo')), 'rientro del nero');
});

test('gioco: chi ha creato la stanza la cancella se e\' in attesa o finita', async () => {
    await permesso(cancella(ANNA, await prepara('waiting')), 'cancellare una stanza in attesa');
    await permesso(cancella(ANNA, await prepara('finished')), 'cancellare una partita finita');
});

/* ====================================================================== */
/* 2. Chi non e' entrato non fa niente                                     */
/* ====================================================================== */

test('fuori: senza accesso non si legge e non si scrive', async () => {
    const id = await prepara('waiting');
    await negato(leggi(null, id), 'leggere senza accesso');
    await negato(elenca(null, 25), 'vedere la sala senza accesso');
    await negato(scrivi(null, codice(), stanzaNuova(ANNA)), 'creare senza accesso');
    await negato(aggiorna(null, id, ingresso(BRUNO)), 'entrare senza accesso');
    await negato(cancella(null, id), 'cancellare senza accesso');
});

test('fuori: tutto cio\' che non e\' una partita di questo gioco e\' chiuso', async () => {
    await negato(scrivi(ANNA, 'prova', { a: 1 }, 'altra_raccolta'), 'scrivere in un\'altra raccolta');
    await negato(leggi(ANNA, 'prova', 'altra_raccolta'), 'leggere un\'altra raccolta');
    await negato(scrivi(ANNA, codice(), stanzaNuova(ANNA), 'artifacts/altro-gioco/public/data/chess_matches'), 'creare una stanza sotto un altro nome di gioco');
});

test('fuori: la sala non si scarica tutta in un colpo', async () => {
    await prepara('waiting');
    await negato(elenca(BRUNO, undefined), 'elenco senza limite');
    await negato(elenca(BRUNO, 1000), 'elenco con limite 1000');
    await permesso(elenca(BRUNO, 50), 'elenco con limite 50');
});

/* ====================================================================== */
/* 3. Una stanza nasce pulita                                              */
/* ====================================================================== */

test('creazione: solo a proprio nome, in attesa, senza avversario gia\' messo', async () => {
    await negato(scrivi(CARLA, codice(), stanzaNuova(ANNA)), 'creare a nome di un altro');
    await negato(scrivi(ANNA, codice(), stanzaNuova(ANNA, { status: 'active' })), 'nascere gia\' attiva');
    await negato(scrivi(ANNA, codice(), stanzaNuova(ANNA, { status: 'finished' })), 'nascere gia\' finita');
    await negato(scrivi(ANNA, codice(), stanzaNuova(ANNA, { blackUid: BRUNO })), 'nascere con un avversario gia\' assegnato');
    await negato(scrivi(ANNA, codice(), stanzaNuova(ANNA, { status: 'chissa' })), 'stato inventato');
});

test('creazione: solo i campi previsti, del tipo giusto e di misura ragionevole', async () => {
    const prove = {
        'campo in piu\'': { amministratore: true },
        'campo in piu\' pesante': { zavorra: 'x'.repeat(50000) },
        'nome lunghissimo': { whiteName: 'x'.repeat(5000) },
        'nome di 41 caratteri': { whiteName: 'x'.repeat(41) },
        'nome che non e\' testo': { whiteName: 12345 },
        'posizione con codice dentro': { fen: '<img src=x onerror=alert(1)>' },
        'posizione lunga 200 caratteri': { fen: '8/'.repeat(100) },
        'posizione che non e\' testo': { fen: 42 },
        'notazione enorme': { pgn: 'x'.repeat(30000) },
        'casa di partenza inventata': { lastFrom: 'z9' },
        'casa di arrivo lunghissima': { lastTo: 'e4'.repeat(500) },
        'titolo di fine partita lunghissimo': { winnerTitle: 'x'.repeat(500) },
        'sottotitolo lunghissimo': { winnerSubtitle: 'x'.repeat(500) },
        'privata che non e\' si\'/no': { isPrivate: 'forse' },
        'data di creazione scritta a parole': { createdAt: 'ieri' },
        'data di creazione con la virgola': { createdAt: Date.now() + 0.5 },
        'data di creazione fra un anno': { createdAt: Date.now() + 365 * 86400000 },
        'data di creazione di due giorni fa': { createdAt: Date.now() - 2 * 86400000 },
        'aggiornamento che non e\' un numero': { updatedAt: 'adesso' },
        'giocatore che non e\' testo': { whiteUid: 7 }
    };
    for (const [cosa, extra] of Object.entries(prove)) {
        await negato(scrivi(ANNA, codice(), stanzaNuova(ANNA, extra)), cosa);
    }
    // Senza un campo obbligatorio
    for (const manca of ['status', 'fen', 'whiteUid', 'createdAt']) {
        const dati = stanzaNuova(ANNA); delete dati[manca];
        await negato(scrivi(ANNA, codice(), dati), `stanza senza ${manca}`);
    }
});

test('creazione: il codice stanza deve essere fatto come quelli del gioco', async () => {
    for (const id of ['zuab12', 'A', 'TROPPOLUNGO1', 'ZU AB', 'ZU-123', '<b>', 'ZUàè12']) {
        await negato(scrivi(ANNA, id, stanzaNuova(ANNA)), `codice «${id}»`);
    }
    await permesso(scrivi(ANNA, 'ZU4819', stanzaNuova(ANNA)), 'codice ZU4819');
    await permesso(scrivi(ANNA, 'ABCD', stanzaNuova(ANNA)), 'codice di 4 caratteri');
    await permesso(scrivi(ANNA, 'ABCD1234', stanzaNuova(ANNA)), 'codice di 8 caratteri');
});

test('creazione: non si riscrive la stanza di un altro, ne\' la propria da capo', async () => {
    const id = await prepara('waiting');
    await negato(scrivi(CARLA, id, stanzaNuova(CARLA)), 'un altro riscrive la stanza a suo nome');
    await negato(scrivi(BRUNO, id, stanzaNuova(ANNA, { blackUid: BRUNO, status: 'active', fen: 'k7/8/8/8/8/8/8/K6Q w - - 0 1' })), 'entrare riscrivendo tutta la stanza');
});

/* ====================================================================== */
/* 4. Chi entra prende il posto del nero, e basta                          */
/* ====================================================================== */

test('ingresso: non si cambia altro mentre si entra', async () => {
    const prove = {
        'cambiare la posizione entrando': { fen: 'k7/8/8/8/8/8/8/K6Q w - - 0 1' },
        'rinominare il bianco entrando': { whiteName: 'Sciocco' },
        'rubare il bianco entrando': { whiteUid: BRUNO },
        'chiudere la partita entrando': { status: 'finished' },
        'restare in attesa pur entrando': { status: 'waiting' },
        'cambiare la data di creazione entrando': { createdAt: Date.now() + 1000 },
        'cambiare «privata» entrando': { isPrivate: true }
    };
    for (const [cosa, extra] of Object.entries(prove)) {
        await negato(aggiorna(BRUNO, await prepara('waiting'), { ...ingresso(BRUNO), ...extra }), cosa);
    }
});

test('ingresso: non si mette al posto del nero un\'altra persona, ne\' si entra due volte', async () => {
    await negato(aggiorna(CARLA, await prepara('waiting'), ingresso(BRUNO)), 'far entrare un altro al proprio posto');
    await negato(aggiorna(CARLA, await prepara('active'), ingresso(CARLA)), 'prendere il posto di chi e\' gia\' entrato');
    await negato(aggiorna(CARLA, await prepara('finished'), ingresso(CARLA)), 'entrare in una partita finita');
    // Stanza chiusa da chi l'ha creata mentre aspettava: il posto del nero e' vuoto ma non si entra
    const chiusa = await prepara('waiting');
    await aggiorna('amministratore', chiusa, { status: 'finished' });
    await negato(aggiorna(BRUNO, chiusa, ingresso(BRUNO)), 'entrare in una stanza chiusa prima di cominciare');
});

/* ====================================================================== */
/* 5. Chi non gioca non tocca la partita                                   */
/* ====================================================================== */

test('terzi: chi guarda non muove, non chiude e non cancella', async () => {
    const id = await prepara('active');
    const motore = new ZeroUnoChessEngine();
    const fatta = motore.move({ from: 'e2', to: 'e4' });
    await negato(aggiorna(CARLA, id, mossa(motore, fatta)), 'mossa di chi guarda');
    await negato(aggiorna(CARLA, id, chiusura()), 'chiusura da parte di chi guarda');
    await negato(aggiorna(CARLA, id, { whiteName: 'Carla' }), 'rinominare un giocatore da fuori');
    await negato(cancella(CARLA, id), 'cancellare la partita di altri');
    await negato(cancella(CARLA, await prepara('waiting')), 'cancellare la stanza in attesa di altri');
});

/* ====================================================================== */
/* 6. Anche i due giocatori hanno dei limiti                               */
/* ====================================================================== */

test('giocatori: non si tocca l\'identita\' della partita', async () => {
    const prove = [
        [ANNA, { blackUid: null }, 'il bianco caccia il nero'],
        [ANNA, { blackUid: CARLA }, 'il bianco sostituisce il nero'],
        [BRUNO, { whiteUid: BRUNO }, 'il nero si prende anche il bianco'],
        [BRUNO, { whiteUid: CARLA }, 'il nero sostituisce il bianco'],
        [ANNA, { createdAt: Date.now() + 5000 }, 'cambiare la data di creazione'],
        [ANNA, { isPrivate: true }, 'cambiare «privata» a partita iniziata'],
        [BRUNO, { whiteName: 'Sciocco' }, 'il nero rinomina il bianco'],
        [ANNA, { blackName: 'Sciocco' }, 'il bianco rinomina il nero'],
        [ANNA, { status: 'waiting' }, 'rimettere la partita in attesa'],
        [ANNA, { status: 'chissa' }, 'stato inventato'],
        [ANNA, { trucco: 'x' }, 'aggiungere un campo che non esiste'],
        [BRUNO, { pgn: 'x'.repeat(30000) }, 'notazione enorme'],
        [BRUNO, { fen: '<script>alert(1)</script>' }, 'posizione con codice dentro'],
        [BRUNO, { lastFrom: 'qui' }, 'casa inventata'],
        [ANNA, { winnerTitle: 'x'.repeat(500), status: 'finished' }, 'titolo di fine partita lunghissimo']
    ];
    for (const [chi, parziale, cosa] of prove) {
        await negato(aggiorna(chi, await prepara('active'), { ...parziale, updatedAt: Date.now() }), cosa);
    }
    // Ognuno puo' invece cambiare il proprio nome
    await permesso(aggiorna(ANNA, await prepara('active'), { whiteName: 'Anna M.' }), 'il bianco cambia il suo nome');
    await permesso(aggiorna(BRUNO, await prepara('active'), { blackName: 'Bruno R.' }), 'il nero cambia il suo nome');
});

test('giocatori: una partita finita non si tocca piu\'', async () => {
    const motore = new ZeroUnoChessEngine();
    const fatta = motore.move({ from: 'e2', to: 'e4' });
    await negato(aggiorna(ANNA, await prepara('finished'), mossa(motore, fatta)), 'muovere a partita finita');
    await negato(aggiorna(BRUNO, await prepara('finished'), chiusura('Ho vinto io', 'Altro finale')), 'riscrivere il risultato');
    await negato(aggiorna(ANNA, await prepara('finished'), { status: 'active', updatedAt: Date.now() }), 'riaprire la partita');
    await negato(aggiorna(BRUNO, await prepara('finished'), ingresso(BRUNO)), 'rientrare riaprendo la partita');
});

test('giocatori: la cancellazione non interrompe una partita in corso', async () => {
    await negato(cancella(ANNA, await prepara('active')), 'chi ha creato la stanza cancella la partita in corso');
    await negato(cancella(BRUNO, await prepara('active')), 'il nero cancella la partita');
    await negato(cancella(BRUNO, await prepara('finished')), 'il nero cancella la partita finita');
});
