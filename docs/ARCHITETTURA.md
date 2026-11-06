# Architettura di Scacchi ZeroUno

Documento di riferimento per chi mette le mani nel codice.

## Principi

1. **`index.html` contiene solo markup.** Nessun `<style>` e nessun `<script>`
   con codice dentro la pagina.
2. **Un solo motore di verita' per le regole.** Nessun altro modulo decide se
   una mossa e' legale: lo decide `src/engine/chess-engine.js`.
3. **Lo stato condiviso sta in un solo posto.** `src/core/state.js` esporta
   l'oggetto `state`. I moduli ES esportano riferimenti in sola lettura,
   quindi una variabile che cambia va letta e scritta come `state.campo`.
4. **Il motore non conosce il DOM.** E' codice puro, si prova con `npm test`
   senza aprire un browser.
5. **Niente numeri scritti a mano nel codice.** Tempi di gioco, limiti
   della lobby e configurazione stanno in `src/config/app.config.js`.
6. **Il JavaScript non scrive stringhe di classi.** Dichiara lo stato con un
   attributo (`data-state`, `data-color`, `aria-pressed`) e il disegno lo
   decide il foglio di stile. Un modulo che cambia non puo' rompere
   l'aspetto senza che si veda nel CSS.

## Flusso di una mossa

```
click o trascinamento sulla casella
        │
        ▼
ui/input.js  handlePointerDownOnSquare
        │  chiede le mosse legali
        ▼
engine/chess-engine.js  moves({ square })
        │
        ▼
ui/input.js  executeMove
        ├─► engine  move()           applica la mossa
        ├─► core/sound.js            suono di mossa o cattura
        ├─► ui/board.js  renderBoard disegna la nuova posizione
        ├─► ui/panels.js             turno, notazione, catture, orologi
        ├─► ui/gameover.js           controlla matto, stallo, patta
        ├─► online/firestore.js      se la partita e' online, sincronizza
        └─► engine/ai.js  makeAiMove se tocca all'AI
                 │
                 ▼
          ai.worker.js (thread separato)
                 │  engine/search.js  chooseMove(fen, livello)
                 ▼
          executeMove della mossa scelta
```

La ricerca riceve soltanto una FEN e restituisce una mossa: non vede ne' il
DOM ne' lo stato dell'applicazione. Per questo lo stesso file gira dentro il
worker e dentro i test.

Ogni richiesta all'AI porta un numero progressivo. Se parte una partita nuova
mentre l'AI sta pensando, la risposta vecchia arriva con un numero superato e
viene buttata; in piu' si controlla che la posizione sia ancora quella su cui
la mossa e' stata calcolata.

## Mappa delle dipendenze

```
config/app.config.js        non dipende da nessuno
data/*.js                   non dipendono da nessuno
engine/chess-engine.js      non dipende da nessuno   ← puro, testabile
        ▲
engine/search.js ───────────┤ (puro: gira anche nel worker)
engine/notation.js ─────────┤ (puro: legge la mossa scritta)
        ▲
core/state.js ──────────────┘ (crea l'istanza del motore)
        ▲
        ├── core/sound.js, core/utils.js
        ├── engine/ai.js
        ├── ui/board.js, ui/input.js, ui/panels.js, ui/gameover.js
        ├── ui/review.js, ui/moveinput.js, ui/keyboard.js
        ├── game/modes.js
        └── online/firestore.js
                ▲
            main.js  (punto di ingresso unico)
```

Fra i moduli dell'interfaccia esistono riferimenti incrociati (per esempio
`ui/input.js` chiama `engine/ai.js`, che a sua volta chiama `executeMove`).
I moduli ES reggono questi cicli perche' si tratta di dichiarazioni di
funzione, risolte al momento della chiamata e non durante il caricamento.
Se in futuro si aggiungono costanti condivise fra due moduli in ciclo,
spostarle in `config/app.config.js` o in `core/state.js`.

## Come cerca l'AI

```
chooseMove(fen, livello)
   │  carica la FEN, semina le posizioni gia' viste nella partita
   │
   ├─ profondita' 1, 2, 3 ...        approfondimento progressivo
   │     │                            si ferma quando il tempo finisce
   │     │                            e tiene l'ultimo giro completo
   │     ▼
   │  per ogni mossa alla radice: finestra piena (-inf, +inf)
   │     │
   │     ▼
   │  minimax con alfa-beta
   │     ├─ patte per regola            prima di tutto, costano poco
   │     ├─ tavola di trasposizione     posizione gia' vista?
   │     ├─ profondita' 0 → quiescenza  prosegue solo sulle catture
   │     ├─ ordinamento delle mosse     mossa della tavola, poi MVV-LVA
   │     └─ salva il risultato in tavola
   ▼
mossa, punteggio, profondita' raggiunta, nodi visitati
```

**Perche' alla radice la finestra e' piena.** Con alfa e beta ristretti un
ramo potato restituisce un limite, non il punteggio vero. Alla radice quel
limite verrebbe scambiato per il punteggio della mossa, e si finirebbe per
giocare una mossa qualunque con il punteggio del matto trovato da un'altra.
E' un errore che e' gia' successo in questo progetto.

**Impronta della posizione.** Un'impronta Zobrist a 53 bit, calcolata una
volta per posizione e tenuta da parte (`refreshPositionKey`). Serve due
volte: alla regola della ripetizione e alla tavola di trasposizione. I
numeri casuali nascono da un seme fisso, quindi due motori - anche in thread
diversi - danno la stessa impronta alla stessa posizione.

**Tavola di trasposizione.** Di ogni posizione si tiene profondita',
punteggio, genere del punteggio (esatto o limite) e mossa migliore. Tre
regole la tengono onesta:

- i punteggi di matto si salvano contati dal nodo, non dalla radice: la
  stessa posizione raggiunta a profondita' diverse ha distanze diverse;
- un punteggio che e' solo un limite si riusa solo quando taglia davvero
  contro la finestra corrente;
- un giro interrotto dal tempo non si salva.

Le patte si controllano prima della tavola, perche' la ripetizione dipende
dalla partita giocata e non dalla sola posizione.

**Mossa veloce.** Dentro la ricerca `move()` riceve `{ fast: true }` e salta
controllo di legalita', notazione algebrica e simbolo di scacco: la mossa e'
gia' uscita da `moves()` su quella posizione e la notazione non la legge
nessuno. Fuori dalla ricerca il controllo resta.

**Valutazione.** Materiale, tabelle posizionali, e poi quello che un
giocatore di club guarda per primo: pedoni doppiati, isolati e passati,
torri su colonna aperta o semiaperta, coppia degli alfieri, riparo di pedoni
davanti al re (solo a medio gioco: nel finale il re deve uscire).

## Modello dei dati online

Una partita e' un documento Firestore in:

```
artifacts/{APP_ID}/public/data/chess_matches/{codiceStanza}
```

| Campo | Tipo | Significato |
|---|---|---|
| `status` | stringa | `waiting`, `active`, `finished` |
| `fen` | stringa | Posizione corrente |
| `whiteUid` / `blackUid` | stringa | Identita' anonime dei due giocatori |
| `whiteName` / `blackName` | stringa | Nomi scelti nella lobby |
| `createdAt` | numero | Millisecondi, usato per ordinare la lobby |
| `isPrivate` | booleano | Le stanze private non compaiono nella lobby |

Il codice stanza (`ZU` + 4 caratteri) e' anche l'identificativo del documento:
entrare in una stanza e' una lettura diretta, non una ricerca.

## Dove intervenire

| Serve | File |
|---|---|
| Aggiungere o cambiare un tempo di gioco | `src/config/app.config.js` (`TIME_CONTROLS`) |
| Attivare il multiplayer | `src/config/app.config.js` (`FIREBASE_CONFIG`) |
| Rendere l'AI piu' forte | `src/engine/search.js` (tabella `LEVELS`, valutazione) |
| Cambiare i tempi di riflessione | `src/engine/search.js`, campo `timeBudgetMs` |
| Aggiungere un tema di scacchiera | `src/css/styles.css` + `index.html` (menu a tendina) |
| Cambiare i tasti di gioco | `src/ui/keyboard.js` |
| Cambiare l'aspetto di una casella | `src/css/styles.css`, sezione marcatori |
| Cambiare la soglia del tempo agli sgoccioli | `src/ui/panels.js`, `LOW_TIME_SECONDS` |
| Cambiare i video di fine partita | `src/data/videos.js` |
| Cambiare gli sfidanti | `src/data/challengers.js` |
| Cambiare i permessi del database | `firebase/firestore.rules` |
| Cambiare la notazione accettata quando si scrive | `src/engine/notation.js` |
| Cambiare quanto pesa un termine della valutazione | `src/engine/search.js`, costanti in cima |
| Aggiungere un modulo | `src/...` **e** la lista `APP_SHELL` in `sw.js` |

## Limiti noti

- `sw.js` non ha versionamento automatico: dopo una modifica ai file va
  alzato `CACHE_VERSION` a mano. Che tutti i moduli siano nella lista lo
  controlla un test, la versione no.
- La ricerca promuove sempre a donna: il generatore produce una sola mossa
  di promozione. Chi gioca puo' scegliere, l'AI no. La sottopromozione
  decide poche partite, ma qualcuna la decide.
- La tavola di trasposizione vive per una sola mossa e si svuota a ogni
  ricerca. Tenerla fra una mossa e l'altra darebbe ancora qualcosa, ma
  servirebbe gestire l'invecchiamento delle posizioni.
- La valutazione non conosce la mobilita' dei pezzi, le catene di pedoni,
  i pezzi inchiodati e le torri sulla settima traversa.
- L'abbandono di una partita online non viene notificato all'avversario in
  tempo reale se chi abbandona chiude il browser di colpo.
- La revisione di una mossa passata non si apre nelle partite online:
  cominciano da una posizione caricata e rigiocare la storia darebbe
  un'altra scacchiera. Il modulo se ne accorge e si rifiuta di aprirsi.
- La mossa scritta accetta solo le lettere inglesi dei pezzi (K Q R B N).
  In italiano la R vorrebbe dire re mentre qui vuol dire torre: accettare
  tutte e due le notazioni renderebbe ambigue le mosse. Per farlo
  servirebbe scegliere la lingua della notazione, non indovinarla.
- L'impronta della ripetizione comprende pezzi, turno, diritti di arrocco e
  casa di presa en passant, come fanno tutti i motori. Considera quindi
  diverse due posizioni identiche in cui la presa en passant e' segnata in
  una sola: capita di rado e sbaglia dichiarando patta un po' piu' tardi,
  mai prima.
