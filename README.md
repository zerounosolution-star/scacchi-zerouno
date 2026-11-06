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

Prova il motore scacchistico fuori dal browser: arrocco, presa en passant,
promozione, scacco matto, stallo, materiale insufficiente, pezzi inchiodati,
annullamento della mossa e lettura/scrittura FEN.

---

## Struttura del progetto

```
.
├── index.html                  Solo markup: nessun CSS e nessun JavaScript inline
├── manifest.webmanifest        Installazione come applicazione (PWA)
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
│   │   └── ai.js               Minimax con potatura alfa-beta
│   ├── ui/
│   │   ├── board.js            Costruzione e disegno della scacchiera
│   │   ├── input.js            Click, trascinamento, tocco, promozione
│   │   ├── panels.js           Turno, notazione, catture, orologi
│   │   └── gameover.js         Fine partita e video del canale
│   ├── game/modes.js           Avvio delle modalita' di gioco
│   └── online/firestore.js     Multiplayer in tempo reale
└── tests/engine.test.mjs       Test del motore
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
