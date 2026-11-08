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
   │     ├─ ordinamento delle mosse     tavola, catture, promozioni,
   │     │                            killer, storia
   │     └─ salva il risultato in tavola
   ▼
mossa, punteggio, profondita' raggiunta, nodi visitati
```

**Perche' alla radice nessun limite diventa un punteggio.** Con alfa e beta
ristretti un ramo potato restituisce un limite, non il punteggio vero;
scambiato per il punteggio della mossa, fa giocare una mossa qualunque con
il punteggio del matto trovato da un'altra. E' un errore che e' gia'
successo in questo progetto. La radice percio' confronta solo punteggi
usciti da finestre piene: la prima mossa del giro si cerca a finestra piena
e fa da metro, le altre passano da una finestra di tre punti attorno al
metro (i punteggi sono interi) che puo' solo dire peggiore (limite, si
scarta senza usarlo), pari esatto, o forse migliore - e in quel caso la
mossa si ricerca a finestra piena. La condizione di accettazione, provata
con l'oracolo a profondita' fissa, e' punteggi identici a prima con meno
nodi.

Misurata: 85% di nodi in meno a parita' di profondita' (dal 72% al 92% su
dodici posizioni), punteggi identici su undici. La dodicesima, un finale di
torri, dava 8 prima e 3 dopo, con la stessa mossa: arbitrata rigiocando ogni
mossa radice con memorie vergini, la verita' e' 3. La differenza non viene
dalle finestre ma dalla dipendenza dal cammino delle patte nella tavola,
che preesiste alla modifica: una patta per ripetizione o per 50 mosse
dipende dalla strada percorsa, e la tavola la ricorda come un fatto della
posizione.

In partita l'effetto e' stato molto oltre l'atteso: 339 su 400 contro la
versione precedente (84,75%, blocchi da 100 fra il 79% e l'87,5%), cioe'
circa +300 punti Elo, quando il precedente killer+storia faceva prevedere
zero. La differenza sta nella taglia del risparmio: 30-60% non compra una
profondita' intera a 250 ms, 85% si'. Prima la radice spesso non finiva il
giro a profondita' 6 nel tempo a disposizione; adesso lo finisce sempre, e
una profondita' piena a questi livelli decide le partite.

**Potatura del tratto nullo.** Se si puo' passare il tratto e una ricerca
ridotta di due livelli dice che si resta comunque oltre la finestra, una
mossa vera lo farebbe a maggior ragione: il ramo si taglia. E' l'unico
taglio del motore che rinuncia alla certezza, e per questo e' recintato:
mai in scacco, mai con soli re e pedoni al tratto, mai nelle posizioni
della spinta al matto, mai due nulli di fila, mai quando il limite della
finestra parla di matto; il taglio restituisce il limite, mai il valore
della ricerca ridotta, e non scrive in tavola. Il tetto del livello
Maestro sale da 6 a 8, perche' adesso il tempo per quelle profondita' c'e'.

Misurato: 44% di nodi in meno a parita' di profondita' 6 (sopra la finestra
di sondaggio, che resta attiva), suite dei matti invariata a 36 su 48, e in
torneo 227 su 400 contro la versione con la sola finestra di sondaggio:
56,75%, cioe' +47 Elo con intervallo da +17 a +78. E' il primo guadagno del
progetto in cui lo zero sta fuori dall'intervallo. Le partite chiuse al
limite delle 200 semimosse scendono da 41 a 25 su 400: la profondita' in
piu' converte finali che prima morivano.

La revisione avversaria del diff (quattro lenti indipendenti, tre arbitri
per rilievo con l'ordine di confutarlo eseguendo codice) ha trovato un
difetto vero prima dell'integrazione: il blocco del nullo girava prima
della generazione delle mosse, quindi uno STALLO - zero mosse legali,
valore vero 0 - poteva essere tagliato a beta come posizione vinta, e il
bound falso risaliva al padre e finiva in tavola. Riprodotto con la
posizione KBk5/P1P5/8/8/7p/8/8/8 w: minimax a profondita' 3 con finestra
(300,400) rispondeva 400 invece di 0, e il difensore si vedeva valutare
come persa la risorsa ...Rc8 che patta. La cura e' l'ordine: il nullo sta
dopo il controllo "niente mosse legali", cosi' da li' in giu' il lato al
tratto ha sempre almeno una mossa vera. Il torneo e' stato giocato dalla
versione prima della cura, che tocca solo i nodi di stallo: rare volte, e
sempre nella direzione di correggere un punteggio sbagliato.

Il torneo di conferma sulla versione curata ha dato 215,5 su 400 (53,9%):
piu' basso del primo, ma la differenza fra due tornei da 400 ha un errore
di circa 3 punti, e la somma degli 800 fa 55,3% con lo zero fuori
dall'intervallo. Le partite al limite delle 200 semimosse: 25 su 400 in
tutti e due i tornei.

**Finali con pedoni passati.** Quattro termini attivi solo sui passati:
valore che sale del 50% verso il finale; scorta dei re (il proprio re
vicino alla casa davanti al pedone, quello avversario lontano, pesata con
l'avanzata e con la fase); torre dietro il passato alla Tarrasch (propria
+14, avversaria -14); regola del quadrato col tempo di chi muove, quando
l'avversario non ha pezzi (+400..+490, sotto donna-meno-pedone e spenta a
meno di due passi dalla promozione, a guardia del test della
sottopromozione). Tutti i termini dipendono solo da pezzi e tratto, che
stanno nella chiave Zobrist: la tavola resta onesta.

Misurato: costo 1,8% di nodi al secondo (113k a 111k); specchio esatto su
coppie di posizioni ribaltate, tempo del quadrato compreso; suite dei
matti 37 su 48 contro 36 di base (il pacchetto senza pedoni e' inerte). In
torneo 216,5 su 400 = 54,1%, cioe' +29 Elo stimati con intervallo da -2 a
+60: la soglia dichiarata (bene da 51% in su) e' superata. La metrica
primaria invece non si e' mossa: partite al limite 22 contro 25, perche'
la profondita' comprata dai due tagli aveva gia' convertito i finali
convertibili prima che il pacchetto arrivasse. Delle 22 rimaste, 15 hanno
ancora passati sulla scacchiera e 7 no: la condizione dichiarata per il
passo successivo (patta rinviata: utile se le bloccate fossero perlopiu'
SENZA passati, cioe' ripetizioni e fortezze) non si avvera, e quel passo
non parte. Il valore del pacchetto sta nel gioco generale, non nello
sbloccare i finali inchiodati.

**La fotografia della giornata.** Somma dei tre passi (finestra di
sondaggio, tratto nullo, pedoni passati), misurata una volta sola come
totale e senza attribuire meriti ai singoli: 352 su 400 contro la versione
di partenza, cioe' l'88% e circa +346 punti Elo (intervallo da +303 a
+399). I quattro blocchi: 81,5 - 87,5 - 89,5 - 93,5. Il numero non si
somma coi tornei dei singoli passi: e' la stessa strada misurata dall'alto.

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
giocatore di club guarda per primo: pedoni doppiati, isolati, collegati e
passati, torri su colonna aperta o semiaperta, coppia degli alfieri, riparo
di pedoni davanti al re.

**Fase della partita.** Il re sta al riparo a medio gioco e al centro nel
finale: due tabelle opposte. Scegliere di colpo l'una o l'altra mette un
gradino nella valutazione, e una cattura sola puo' far saltare il punteggio
del re di quasi un pedone senza che per il re sia cambiato niente. Fra
`PHASE_MIDDLEGAME` (3200 di materiale pesante, cioe' tutto in gioco) e
`PHASE_ENDGAME` (1300) le due tabelle si mescolano in proporzione, e il
riparo dei pedoni si spegne per gradi insieme a loro.

**Spinta al matto.** Con un re nudo davanti, materiale e tabelle dicono che
si sta vincendo, non come si vince. Senza una direzione il motore vaga,
arriva alla regola delle 50 mosse, e li' ogni mossa vale zero: buttare la
torre vale quanto tenerla, e capita. Due termini danno alla ricerca una
direzione anche quando il matto e' fuori dal suo orizzonte: il re perdente
lontano dal centro, il re vincente addosso. Valgono solo dove sono veri,
cioe' quando una parte e' avanti di almeno una torre e l'altra non ha
pedoni: con i pedoni in gioco spingere il re al bordo e' un consiglio
sbagliato, e in posizione pari i due termini non entrano nemmeno nel conto.

Misurato sui matti elementari (donna, torre, due alfieri e due torri contro
re nudo, quattro posizioni per famiglia, tre giri per parte): da 10-11 matti
su 16 a 12 su 16, e la conversione scende da 35 a 27 mezze mosse. In partita
vera, 400 partite contro la versione precedente, il 52,8% con un intervallo
al 95% da -11 a +49 punti Elo: tutti e quattro i blocchi da 100 sopra il
pari, ma il pari resta dentro l'intervallo. Un guadagno probabile intorno ai
20 punti Elo, non dimostrato; per dimostrarlo servirebbero circa 1100
partite. Le partite chiuse per limite di mosse restano 41 su 400, le stesse
di prima: la spinta al matto risolve il re nudo, non i finali con i pezzi.

**Il matto con i due alfieri resta non risolto**, 1 o 2 volte su 4, e qui
sotto c'e' il resoconto di un tentativo fallito, perche' valga almeno a non
rifarlo.

Il motore inchioda il re nudo in un angolo, ma gli servono piu' di 45 mosse
e la regola delle 50 ne concede meno: il matto con i due alfieri esiste in
non piu' di 19 mosse, quindi il problema non e' la direzione ma la durata.
Le posizioni vinte arrivano a 65-99 mezze mosse, cioe' a un soffio dal
limite, ed e' per questo che il risultato oscilla fra 0 e 4 su 4 da un giro
all'altro: un giro solo di misura qui non dice niente.

Tre cose provate, tutte misurate su tre giri da quattro posizioni:

1. Portare il re verso l'angolo invece che verso il bordo (si sommano le due
   distanze dal centro invece di prendere la maggiore). Con i due alfieri il
   matto si da' solo in un angolo, quindi e' la cosa giusta in teoria.
2. Togliere al re che attacca la tabella `kEnd`, che lo vuole al centro e
   vale -50 in un angolo: mentre la spinta lo chiama addosso al re nudo, la
   tabella lo tira indietro. Il conflitto fra i due termini e' reale.
3. Quattro combinazioni di pesi fra spinta verso l'angolo e avvicinamento
   dei re (8/3, 8/8, 14/6, 20/3), per vedere se con due alfieri il motore
   del progresso e' il re invece degli alfieri.

Esito: 2, 3, 4 e 3 matti su 12 per le quattro combinazioni, tutte dentro il
rumore; e la versione con le prime due modifiche fa 40 matti su 48 contro i
39 di quella senza. Niente. Le modifiche sono state annullate: il
ragionamento regge, la misura no, e qui vale la misura.

Cosa servirebbe davvero, per chi ci riprova: non una regolazione dei pesi.
Una tecnica esatta per questo materiale (una procedura scritta a mano per
K+A+A contro K), oppure una tavola di finali a quattro pezzi, oppure una
ricerca molto piu' profonda - a 150 ms per mossa qui si arriva a profondita'
5 o 6, e per vedere il matto da lontano ne servirebbero 12. Il valore
pratico e' quasi nullo: in 400 partite questo materiale non ha deciso
niente, e le 41 partite chiuse per limite di mosse sono finali con i pezzi
ancora in gioco, non re nudi.

**Ordine di prova delle mosse.** La potatura alfa-beta rende quanto prima
si prova la mossa giusta. Le fasce stanno lontane fra loro, cosi' nessun
punteggio di una fascia scavalca quella sopra:

| Fascia | Punteggio | Che cosa |
|---|---|---|
| tavola | 1.000.000 | la mossa che la tavola ricorda come migliore |
| catture | 500.000 + MVV-LVA | il pezzo piu' prezioso preso dal meno prezioso |
| promozioni | 400.000 | |
| killer | 300.000 / 290.000 | mosse tranquille che hanno gia' tagliato a questa profondita' |
| storia | 0 - 200.000 | quante volte quella mossa ha tagliato, pesata per profondita' |

Killer e storia riguardano solo le mosse tranquille: una cattura che taglia
si ritrova da sola in cima. A profondita' 5 fanno risparmiare dal 30% al 60%
dei nodi, a parita' di punteggio. Che il punteggio non cambi va verificato a
ogni modifica: un ordinamento che scarta mosse invece di riordinarle
restituisce risultati diversi, e lo fa in silenzio.

**Nodi risparmiati non vuol dire partite vinte.** L'ordinamento e' stato
misurato anche in partite, non solo in nodi: 400 partite contro la versione
precedente, 250 ms per mossa, aperture sorteggiate e giocate due volte a
colori invertiti perche' il vantaggio dell'apertura si annulli. Risultato
202,5 su 400, cioe' il 50,6%: pari, con un intervallo al 95% che va da -26 a
+35 punti Elo. Il risparmio di nodi e' reale e verificato, ma a 250 ms non
arriva a una profondita' intera in piu', e sotto quella soglia non si vede
sul risultato: serve a tempi di riflessione piu' lunghi. Due avvertenze per
chi misurera' la prossima volta. Le aperture sorteggiate fra mosse qualunque
pesano piu' del motore: i quattro blocchi da 100 partite sono usciti al 38%,
51,5%, 54,5% e 58,5%, che e' piu' di quanto il caso spieghi (chi quadro
13,2 su 3 gradi di liberta'). E un guadagno da 30 punti Elo chiede qualche
centinaio di partite per uscire dal rumore, un guadagno da 10 punti alcune
migliaia. Un cambiamento che tocca solo l'efficienza si giudica sui nodi a
profondita' fissa; le partite servono per i cambiamenti che toccano la
valutazione.

**Tempo di riflessione.** Il tetto del livello e' un massimo, non un
diritto. `engine/ai.js` guarda l'orologio dell'AI, spalma il tempo rimasto
su una ventina di mosse, aggiunge quasi tutto l'incremento e non tocca mai
l'ultimo secondo. Serve a non perdere per il tempo una partita vinta.

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
- La tabella della storia non invecchia: i punteggi crescono per tutta la
  scelta della mossa e un taglio trovato a profondita' 1 pesa quanto uno
  trovato dopo. Sulle ricerche lunghe conviene dimezzarli ogni tanto.
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
