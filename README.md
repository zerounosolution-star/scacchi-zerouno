# Scacchi ZeroUno

Scacchiera web del canale [ZeroUno Solution](https://youtube.com/@zerounosolution).
Si gioca contro l'intelligenza artificiale, in due sullo stesso dispositivo
oppure, quando Firebase e' configurato, contro altre persone in rete.

Nessuna libreria da installare: moduli ES nativi, Tailwind e Tone.js da CDN.
Il motore scacchistico e' scritto da zero in JavaScript puro.

---

## Avvio in locale

L'applicazione usa moduli ES: **non si apre facendo doppio click sul file**,
serve un server web, anche minimo.

```bash
npm start
```

Poi aprire <http://127.0.0.1:8099>.

In alternativa, con Node gia' installato:

```bash
npx serve .
```

## Test

```bash
npm test
```

27 prove che girano fuori dal browser, senza dipendenze.

Le regole: arrocco, presa en passant, promozione, scacco matto, stallo,
materiale insufficiente, patta per ripetizione, regola delle 50 mosse,
pezzi inchiodati, annullamento della mossa, lettura e scrittura FEN.

Il gioco dell'AI: trova il matto in una mossa, prende i pezzi lasciati in
presa, non regala la propria donna, non fa scambi in perdita e rispetta il
tetto di tempo.

---

## Struttura del progetto

```
.
├── index.html                  Solo markup: nessun CSS e nessun JavaScript inline
├── manifest.webmanifest        Installazione come applicazione (PWA)
├── sw.js                       Service worker: la pagina funziona senza rete
├── package.json                Script di avvio e di test
├── firebase.json               Hosting e percorso delle regole Firestore
├── assets/icons/               Icone dell'applicazione
├── firebase/
│   ├── firestore.rules         Regole di sicurezza del database
│   └── firestore.indexes.json  Indici Firestore
├── src/
│   ├── main.js                 Punto di ingresso: collega i controlli e avvia
│   ├── config/
│   │   ├── app.config.js       Costanti e configurazione Firebase
│   │   └── tailwind.config.js  Tema (colori avorio, antracite, bronzo)
│   ├── css/styles.css          Stili della scacchiera e dei pezzi
│   ├── core/
│   │   ├── state.js            Stato condiviso dell'applicazione
│   │   ├── sound.js            Feedback sonoro
│   │   └── utils.js            Notifiche, appunti, utilita'
│   ├── data/
│   │   ├── pieces.js           Disegni SVG dei 12 pezzi
│   │   ├── videos.js           Video del canale YouTube
│   │   └── challengers.js      Sfidanti internazionali (avversari AI)
│   ├── engine/
│   │   ├── chess-engine.js     Motore scacchistico, regole FIDE complete
│   │   ├── search.js           Ricerca della mossa (puro, testabile)
│   │   ├── ai.worker.js        La ricerca in un thread separato
│   │   └── ai.js               Ponte fra partita e ricerca
│   ├── ui/
│   │   ├── board.js            Costruzione e disegno della scacchiera
│   │   ├── input.js            Click, trascinamento, tocco, promozione
│   │   ├── keyboard.js         Gioco da tastiera e lettori di schermo
│   │   ├── panels.js           Turno, notazione, catture, orologi
│   │   └── gameover.js         Fine partita e video del canale
│   ├── game/modes.js           Avvio delle modalita' di gioco
│   └── online/firestore.js     Multiplayer in tempo reale
└── tests/
    ├── engine.test.mjs         Test delle regole
    └── search.test.mjs         Test del gioco dell'AI
```

Regola del progetto: `index.html` contiene **solo** markup. Ogni stile sta nel
CSS, ogni comportamento in un modulo sotto `src/`.

Lo stato che cambia vive in un unico oggetto (`src/core/state.js`) e si usa
sempre nella forma `state.campo`: i moduli ES esportano riferimenti in sola
lettura, quindi una variabile condivisa va letta e scritta attraverso
quell'oggetto.

---

## Modalita' di gioco

| Modalita' | Avversario | Serve la rete |
|---|---|---|
| Contro AI | Motore locale, 3 livelli | No |
| 2 Giocatori | Due persone, stesso dispositivo | No |
| Sfidante internazionale | Avversario AI con nome e punteggio | No |
| Mondiale online | Altra persona, stanza pubblica o privata | Si', con Firebase |

Gli sfidanti internazionali (Lukas Meyer, Sofia Rojas, Kenji Takahashi,
Claire Dubois) **non sono persone reali**: sono l'AI locale con un nome e un
punteggio. Nell'elenco sono contrassegnati "AI". Il contatore della lobby
conta solo le persone vere in attesa.

---

## Si gioca anche senza mouse

| Tasto | Cosa fa |
|---|---|
| Tab | Porta il fuoco sulla scacchiera |
| Frecce | Spostano la casella attiva |
| Invio o Spazio | Selezionano un pezzo, poi muovono |
| Esc | Annulla la selezione |
| Home / Fine | Prima e ultima colonna della traversa |

Ogni casella si annuncia ai lettori di schermo con il proprio nome e il
pezzo che ci sta sopra ("E4, pedone bianco", "D5, vuota, mossa possibile").

---

## L'avversario artificiale

La ricerca sta in [`src/engine/search.js`](src/engine/search.js): minimax con
potatura alfa-beta, ordinamento delle mosse MVV-LVA, ricerca di quiescenza
sulle catture e approfondimento progressivo con tetto di tempo.

| Livello | Profondita' massima | Tempo per mossa |
|---|---|---|
| 1 — Principiante | 1 | 0,15 s, con errori voluti |
| 2 — Club | 4 | 0,9 s |
| 3 — Maestro | 6 | 2,2 s |

La profondita' effettiva dipende da quanto riesce a scendere nel tempo
concesso: la ricerca tiene sempre la mossa migliore dell'ultimo livello
completato.

Il calcolo gira in un Web Worker ([`ai.worker.js`](src/engine/ai.worker.js)),
quindi la pagina non si blocca mentre l'AI pensa: orologi, animazioni e
bottoni continuano a rispondere. Se il browser non concede i worker, la
ricerca passa nel thread principale con un tetto di tempo piu' basso.

---

## Funzionamento senza rete

[`sw.js`](sw.js) tiene in cache la pagina e i moduli: dopo la prima visita si
gioca contro l'AI e in due anche senza connessione, e l'applicazione si puo'
installare sul telefono.

**Dopo ogni modifica ai file, alzare `CACHE_VERSION` in `sw.js`**, altrimenti
chi ha gia' visitato il sito continua a vedere la versione vecchia.

Il service worker funziona solo su HTTPS o su localhost. Aprendo i file con
un doppio click non si attiva.

---

## Attivare il multiplayer online

Senza configurazione l'applicazione resta giocabile in locale e lo dichiara
nell'intestazione ("Modalita Locale"). Per attivare le partite fra persone:

1. Creare un progetto su <https://console.firebase.google.com> (piano Spark,
   gratuito, senza carta di credito).
2. Attivare **Firestore Database** e, in Authentication, il metodo
   **Anonimo**.
3. Copiare la configurazione web del progetto (Impostazioni progetto > Le tue
   app > Configurazione SDK) dentro `FIREBASE_CONFIG` in
   [`src/config/app.config.js`](src/config/app.config.js).
4. Pubblicare le regole di sicurezza:

```bash
firebase deploy --only firestore:rules
```

Le chiavi Firebase del client sono pubbliche per definizione: la sicurezza dei
dati dipende dalle regole in [`firebase/firestore.rules`](firebase/firestore.rules),
non dal segreto delle chiavi.

### Consumi

Il piano gratuito Firestore concede circa 50.000 letture e 20.000 scritture al
giorno. Ogni documento consegnato dalla lobby costa una lettura a ogni persona
collegata: per questo l'ascolto della lobby e' limitato a
`LOBBY_MAX_ROOMS` stanze (25) e le stanze finite vengono cancellate.

---

## Pubblicazione

**Firebase Hosting**

```bash
firebase deploy --only hosting
```

**GitHub Pages**: caricare il repository su GitHub e attivare Pages sul ramo
principale, cartella radice. Il sito risponde su `https://<utente>.github.io/<repo>/`.

In entrambi i casi serve HTTPS, altrimenti l'installazione come applicazione
(PWA) non viene proposta.

---

## Crediti

Progetto di ZeroUno Solution. Motore scacchistico, interfaccia e grafica dei
pezzi sono originali: nessuna libreria di scacchi esterna.
