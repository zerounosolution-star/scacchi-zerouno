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

53 prove che girano fuori dal browser, senza dipendenze.

Le regole: arrocco, presa en passant, promozione, scacco matto, stallo,
materiale insufficiente, patta per ripetizione, regola delle 50 mosse,
pezzi inchiodati, annullamento della mossa, lettura e scrittura FEN,
notazione non ambigua quando due pezzi arrivano sulla stessa casa.

Il gioco dell'AI: trova il matto in una mossa, prende i pezzi lasciati in
presa, non regala la propria donna, non fa scambi in perdita, rispetta il
tetto di tempo, e la tavola di trasposizione non cambia i punteggi.

La mossa scritta: notazione algebrica, due case, arrocco, promozione,
mosse ambigue e scritture che non sono mosse.

Il service worker: ogni modulo del progetto e' in cache (il guasto da
evitare e' aggiungere un file e accorgersene solo senza rete).

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
│   │   ├── persistence.js      Partita salvata nel browser
│   │   └── utils.js            Notifiche, appunti, utilita'
│   ├── data/
│   │   ├── pieces.js           Disegni SVG dei 12 pezzi
│   │   ├── videos.js           Video del canale YouTube
│   │   └── challengers.js      Sfidanti internazionali (avversari AI)
│   ├── engine/
│   │   ├── chess-engine.js     Motore scacchistico, regole FIDE complete
│   │   ├── search.js           Ricerca della mossa (puro, testabile)
│   │   ├── notation.js         Legge la mossa scritta (puro, testabile)
│   │   ├── ai.worker.js        La ricerca in un thread separato
│   │   └── ai.js               Ponte fra partita e ricerca
│   ├── ui/
│   │   ├── board.js            Costruzione e disegno della scacchiera
│   │   ├── input.js            Click, trascinamento, tocco, promozione
│   │   ├── keyboard.js         Gioco da tastiera e lettori di schermo
│   │   ├── moveinput.js        Campo della mossa scritta
│   │   ├── review.js           Rivedere una mossa passata
│   │   ├── panels.js           Turno, notazione, catture, orologi
│   │   └── gameover.js         Fine partita e video del canale
│   ├── game/modes.js           Avvio delle modalita' di gioco
│   └── online/firestore.js     Multiplayer in tempo reale
└── tests/
    ├── engine.test.mjs         Test delle regole
    ├── search.test.mjs         Test del gioco dell'AI
    ├── notation.test.mjs       Test della mossa scritta
    ├── persistence.test.mjs    Test della partita salvata
    └── serviceworker.test.mjs  Test della lista dei file in cache
```

Regola del progetto: `index.html` contiene **solo** markup. Ogni stile sta nel
CSS, ogni comportamento in un modulo sotto `src/`.

Il JavaScript non scrive stringhe di classi: dichiara lo stato con un
attributo (`data-state`, `data-color`, `aria-pressed`) e il disegno lo decide
il foglio di stile. Cosi' chi cambia un modulo non rompe l'aspetto senza
accorgersene.

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

## Tre modi di muovere

| Come | Che cosa si fa |
|---|---|
| Mouse | Si clicca il pezzo e poi la casa, oppure si trascina |
| Tastiera | Frecce per spostarsi, Invio per prendere e posare, Esc per annullare |
| Scrivendo | Si scrive la mossa nel campo sotto la scacchiera e si preme Invio |

La mossa scritta accetta la notazione algebrica (`e4`, `Nf6`, `O-O`, `e8=Q`,
con o senza `+` e `#`), gli zeri al posto delle O nell'arrocco, le due case
(`e2e4`, `e2-e4`, `e7e8n`) e tutto minuscolo.

Le lettere dei pezzi sono quelle inglesi (K Q R B N), le stesse che il
taccuino scrive. In italiano la R vorrebbe dire re mentre qui vuol dire
torre: accettare tutte e due le notazioni renderebbe ambigue le mosse.

---

## Rivedere una mossa

Ogni mossa nel taccuino e' un bottone. Cliccandola, la scacchiera torna a
com'era in quel momento; l'ultima mossa giocata resta evidenziata, cosi' si
vede sempre dove si trova la partita.

La partita vera non si tocca: la posizione rivista vive in un secondo
motore. Mentre si rivede non si puo' muovere, ma gli orologi continuano a
scorrere e l'AI puo' rispondere. Si torna alla partita con Esc, con "Torna
alla partita" o cliccando l'ultima mossa.

Nelle partite online la revisione non si apre: quelle partite cominciano da
una posizione caricata e rigiocare la storia darebbe un'altra scacchiera.

---

## Tempo di gioco

Quattro tempi: 10 minuti senza incremento, 10+5, 5+3, 3+2. Il secondo numero
e' l'incremento Fischer: chi muove si riprende quei secondi. Serve a non
perdere una partita vinta proprio nel finale, dove le mosse sono tante e
quasi obbligate.

L'elenco sta in `TIME_CONTROLS`, dentro
[`src/config/app.config.js`](src/config/app.config.js): aggiungere un tempo
vuol dire aggiungere una riga. Il tempo scelto fa parte della partita
salvata.

---

## La partita non si perde

Ogni mossa viene salvata nella memoria del browser. Se si chiude la pagina
per sbaglio o si ricarica, alla riapertura la partita riprende da dove era
rimasta, con la notazione, i pezzi catturati e gli orologi.

Si salvano solo le partite locali: quelle online vivono su Firestore e le
comanda anche l'avversario. Il salvataggio sparisce a fine partita e quando
se ne avvia una nuova.

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
completato. Su un portatile normale esamina circa 111.000 posizioni al
secondo, e in mediogioco arriva a profondita' 4 o 5.

La stessa posizione raggiunta per ordini di mosse diversi non si ricalcola:
una tavola di trasposizione tiene da parte quello che ha gia' trovato, e la
mossa che era risultata migliore si riprova per prima. Si ricordano anche le
mosse tranquille che hanno gia' fatto saltare altri rami: a profondita' 5
fanno risparmiare dal 30% al 60% dei nodi.

Due tagli fanno il grosso del lavoro. Alla radice solo la prima mossa si
cerca per intero: le altre passano da una finestra di sondaggio che sa solo
dire peggiore, pari o forse migliore, e si ricercano per intero solo nel
terzo caso. E nei nodi interni c'e' il tratto nullo: se persino passando la
mossa il vantaggio resta, il ramo si chiude senza guardarlo. Insieme
tagliano oltre il 90% dei nodi a parita' di profondita', cioe' una o due
profondita' in piu' nello stesso tempo. In torneo, a parita' di tempo per
mossa, il primo taglio ha fatto 339 punti su 400 contro la versione senza,
e il secondo ha aggiunto altri 47 punti Elo misurati.

L'AI guarda il proprio orologio: con pochi secondi rimasti muove in fretta
invece di pensare come se avesse tutto il tempo del mondo.

E promuove anche in torre, alfiere o cavallo quando serve: ci sono posizioni
dove la donna sarebbe stallo, cioe' una partita vinta buttata via. Alla valutazione, che
contava materiale e posizione dei pezzi, si sono aggiunti pedoni doppiati,
isolati, collegati e passati, torri su colonna aperta, coppia degli alfieri e
riparo di pedoni davanti al re.

I pedoni passati poi sanno chi li scorta e chi li rincorre: il proprio re
vicino li accompagna, la torre rende di piu' da dietro, e quando il re
avversario e' fuori dal quadrato il pedone corre da solo e la valutazione
lo sa prima ancora che la ricerca veda la promozione.

Fra medio gioco e finale la valutazione passa per gradi, non di colpo: il re
smette di cercare il riparo e comincia ad andare al centro mentre i pezzi
pesanti lasciano la scacchiera. E quando l'avversario resta col re nudo,
l'AI sa come finire: prima vagava fino alla regola delle 50 mosse, e in
qualche partita arrivava a buttare via la torre perche' ormai ogni mossa
valeva zero. Ora da' matto in 12 casi su 16 invece di 10, e ci arriva in un
quarto di mosse in meno.

Ogni passo e' misurato in torneo contro la versione precedente, centinaia
di partite con aperture sorteggiate e colori invertiti: i numeri, con i
loro margini di errore, stanno in
[docs/ARCHITETTURA.md](docs/ARCHITETTURA.md).

La partita in corso viene passata alla ricerca, non solo la posizione:
cosi' l'AI sa quali posizioni sono gia' comparse e non chiude patta per
ripetizione quando sta vincendo.

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

Tailwind e Tone.js arrivano da una CDN. Alla prima visita il service worker
non controlla ancora la pagina, quindi quelle due richieste non passerebbero
da lui: vengono scaricate durante l'installazione (`CDN_SHELL` in `sw.js`).
Senza il foglio di stile di Tailwind la pagina perderebbe l'impaginazione.

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
3. Copiare [`firebase.config.ESEMPIO.js`](firebase.config.ESEMPIO.js) in
   `firebase.config.js` (stessa cartella, la radice del progetto) e riempire
   i campi con la configurazione web del proprio progetto
   (Impostazioni progetto > Le tue app > Configurazione SDK).
4. Pubblicare le regole di sicurezza:

```bash
firebase deploy --only firestore:rules
```

`firebase.config.js` **non entra in git**: `.gitignore` lo tiene fuori, cosi'
la chiave non finisce nello storico del repository pubblico. Chi clona il
progetto trova solo il modello a campi vuoti e ci mette la propria.

Le chiavi Firebase del client sono pubbliche per definizione: la sicurezza dei
dati dipende dalle regole in [`firebase/firestore.rules`](firebase/firestore.rules),
non dal segreto delle chiavi. Vanno comunque limitate nella console Google
(Credenziali > limitazioni per referrer HTTP e per API).

> **Sito pubblicato.** Il sito su GitHub Pages e' servito dal ramo `main`,
> cartella radice. Siccome `firebase.config.js` non sta nel repository, il
> sito pubblicato parte in **Modalita Locale**: AI e due giocatori sullo
> stesso dispositivo funzionano, la sala mondiale no. Per riaccenderla serve
> una pubblicazione che inserisca la chiave al momento del rilascio
> (GitHub Actions con la chiave nei Secrets). Vedi
> [`NOTE-SICUREZZA-2026-11-09.md`](NOTE-SICUREZZA-2026-11-09.md).

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
