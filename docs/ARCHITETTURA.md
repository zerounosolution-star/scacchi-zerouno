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
5. **Niente numeri scritti a mano nel codice.** Durata degli orologi, limiti
   della lobby e configurazione stanno in `src/config/app.config.js`.

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
```

## Mappa delle dipendenze

```
config/app.config.js        non dipende da nessuno
data/*.js                   non dipendono da nessuno
engine/chess-engine.js      non dipende da nessuno   ← puro, testabile
        ▲
core/state.js ──────────────┘ (crea l'istanza del motore)
        ▲
        ├── core/sound.js, core/utils.js
        ├── engine/ai.js
        ├── ui/board.js, ui/input.js, ui/panels.js, ui/gameover.js
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
| Cambiare la durata degli orologi | `src/config/app.config.js` |
| Attivare il multiplayer | `src/config/app.config.js` (`FIREBASE_CONFIG`) |
| Rendere l'AI piu' forte | `src/engine/ai.js` (profondita' e valutazione) |
| Aggiungere un tema di scacchiera | `src/css/styles.css` + `index.html` (menu a tendina) |
| Cambiare i video di fine partita | `src/data/videos.js` |
| Cambiare gli sfidanti | `src/data/challengers.js` |
| Cambiare i permessi del database | `firebase/firestore.rules` |

## Limiti noti

- L'AI gira nello stesso thread dell'interfaccia: a profondita' 3 la pagina
  puo' restare ferma per qualche decimo di secondo. Per salire di livello
  serve spostarla in un Web Worker.
- Non c'e' incremento di tempo (modalita' Fischer): solo orologi a scalare.
- **La patta per ripetizione non e' implementata.** Il metodo
  `in_threefold_repetition()` del motore restituisce sempre `false`: e' un
  segnaposto. La regola delle 50 mosse funziona (`halfMoves >= 100`).
  Per completare la regola FIDE serve tenere il conto delle posizioni gia'
  viste, confrontando la parte di FEN senza i contatori di mossa.
- L'abbandono di una partita online non viene notificato all'avversario in
  tempo reale se chi abbandona chiude il browser di colpo.
