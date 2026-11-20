# Controllo del progetto — 20 novembre 2026

Il titolare ha chiesto di controllare e migliorare il gioco. Questa nota dice
cosa c'era, cosa è stato corretto, come è stato provato e cosa resta proposto.

## Come stava il progetto

- 58 prove automatiche su 58 passate, nessun errore di sintassi.
- Sito pubblicato in ordine: «Rete Mondiale Attiva», nessun errore in console.
- Sicurezza del 9 novembre chiusa bene: avviso di GitHub risolto come
  «revocata», chiave nuova al suo posto, pubblicazione automatica attiva.
- Il vecchio commit con la chiave vecchia è ancora raggiungibile su GitHub per
  numero, ma la chiave è revocata: non serve più a nessuno.

## Difetti trovati e corretti

Tutti nella parte online, che non aveva nessuna prova automatica. Ognuno è
stato prima riprodotto, poi corretto, poi riprovato.

**1. Un nome di stanza poteva eseguire codice sullo schermo degli altri.**
La sala e le notifiche scrivevano come HTML il nome scelto da chi crea la
stanza. Con un nome fatto apposta, chiunque avesse la sala aperta — cioè ogni
visitatore, perché la sala si carica da sola — eseguiva il codice di uno
sconosciuto dentro la pagina del gioco. Corretto: nomi, codici e messaggi
entrano sempre come testo.

**2. Lo stesso con un link d'invito truccato.** Il codice letto dal link
finiva in una notifica scritta come HTML. Bastava mandare a qualcuno un link
al gioco preparato apposta. Corretto: il codice del link si controlla prima di
usarlo, e se non ha la forma di un codice stanza non si usa e non si mostra.

**3. Le stanze «private» comparivano nella sala di tutti**, con il bottone
«Entra Ora»: chiunque poteva prendere il posto dell'amico atteso. Corretto: la
stanza privata la vede solo chi l'ha creata; ci si entra col codice o col link.

**4. La mossa dell'avversario cancellava la storia della partita.** Online, a
ogni mossa ricevuta la lista delle mosse si svuotava, i pezzi catturati
sparivano, la patta per ripetizione non poteva scattare e l'orologio di chi
doveva muovere restava fermo. Corretto: la mossa dell'avversario viene
ricostruita e giocata, così la storia resta intera per tutti e due.

**5. La seconda partita online della stessa visita non mandava le mosse.**
Entrando in una stanza mentre se ne aveva ancora una, il gioco dimenticava il
codice della stanza nuova: le proprie mosse non arrivavano più all'avversario.
Corretto.

**6. Chi guardava una partita altrui poteva muovere i pezzi** sul proprio
schermo e premere «Abbandona». Corretto: chi guarda non muove e non chiude
niente.

**7. Cose piccole, nella stessa passata.** Rientrare col codice nella propria
stanza in attesa la cancellava; una mossa non inviata non dava nessun avviso;
una stanza con la data nel futuro restava in cima alla sala per sempre; la
configurazione con la chiave restava nella memoria del browser anche dopo un
cambio di chiave. Tutte corrette.

## Come è stato provato

- **Banco di prova con giocatori finti**: il gioco vero, servito in locale con
  un servizio online finto al posto di Firebase, e fino a quattro schede del
  browser che fanno ognuna una persona diversa. Niente è stato scritto nel
  database vero. I sette difetti sono stati riprodotti lì prima della
  correzione e sono spariti dopo.
- **Prova con il servizio vero**, in sola lettura: il gioco parte, entra in
  rete e disegna la sala senza errori.
- **17 prove automatiche nuove** (da 58 a 75), in `tests/online.test.mjs` e
  `tests/serviceworker.test.mjs`. Quattro sono guardie: lanciate contro il
  codice di prima falliscono, quindi se qualcuno reintroduce il difetto se ne
  accorge `npm test`.

**Non provato:** l'installazione del service worker in un browser vero. Nel
browser di prova la registrazione su indirizzi locali non parte (succedeva già
prima di oggi). La logica nuova è coperta da una prova che mette in moto il
service worker in un ambiente finto; la conferma vera arriva alla
pubblicazione, guardando il sito.

## File toccati

- Nuovi: `src/online/lobby.js`, `src/online/sync.js`, `tests/online.test.mjs`.
- Modificati: `src/online/firestore.js`, `src/core/utils.js`,
  `src/core/state.js`, `src/main.js`, `sw.js` (versione v23),
  `tests/serviceworker.test.mjs`, `package.json`, `README.md`,
  `docs/ARCHITETTURA.md`.

Pubblicato lo stesso giorno, dopo il sì del titolare (commit `4348e66`).

## Proposte, in ordine di importanza

**A. Regole del database più strette.** Oggi il sito si difende da solo, ma
le regole in `firebase/firestore.rules` lasciano scrivere a un giocatore
scorretto dati sporchi o pesanti, e gli lasciano cambiare l'identità
dell'avversario dentro la sua partita. Si possono stringere: tipo e lunghezza
dei campi, giocatori che non si possono riscrivere, data di creazione sensata.
Per provarle prima di pubblicarle serve Java sul computer (gratuito), che oggi
non c'è: senza prova non le consegno.

**B. Togliere i due programmi presi da fuori.** La pagina carica Tailwind e
Tone.js da siti esterni a ogni visita. Tailwind in quella forma è pensato per
le prove, non per un sito pubblico (lo dice lui stesso in console), e non ha
una versione fissata: se quel sito cambia o viene manomesso, cambia il gioco.
Metterli dentro il progetto rende il sito più veloce, indipendente e più
sicuro. È un lavoro di mezza giornata con controllo visivo pagina per pagina.

**C. App Check di Firebase**, già segnato il 9 novembre: è il lucchetto contro
chi usa il database da fuori del sito, e l'unico vero freno a chi volesse
riempire la sala di stanze finte.

**D. Pulizia automatica delle partite vecchie.** I documenti delle partite
finite non vengono mai cancellati. Firestore sa cancellarli da solo dopo un
certo tempo: è un'impostazione in console, più un campo data nel documento.

**E. Immagine per le condivisioni.** Quando il link del gioco gira su
WhatsApp si vede l'icona quadrata. Un'immagine larga fatta apposta, con la
scacchiera e il nome, rende il link molto più invitante. Lavoro per Grafica.

**F. Dire che lo sfidante è un'AI.** Scegliendo «Gioca nel mondo ora» senza
nessuno in attesa parte una partita contro uno sfidante finto, con il
messaggio «Connesso con…». Nella sala è segnato «AI», nel messaggio no.
Basterebbe una parola per non far credere di giocare con una persona.

---

# Seconda parte della giornata: «sì, fai tutto»

Il titolare ha letto le proposte e ha detto di farle. Questo è lo stato a fine
giornata.

## Fatto e online

**Correzioni di sicurezza e del gioco online** (commit `4348e66`). Pubblicate
e riprovate sul sito vero: l'aggiornamento arriva con la fascia «Nuova versione
disponibile», e due giocatori veri (uno dal sito, uno da un indirizzo locale,
quindi due identità diverse) hanno giocato una partita intera con lista delle
mosse, orologio e resa. La stanza privata non compariva nella sala dell'altro.

**Tailwind e Tone.js dentro il progetto** (commit `5d1150a`), proposta B.
- Tone.js 14.8.49 in `assets/vendor`, identico all'originale: l'impronta
  coincide con quella pubblicata da cdnjs, e un test la ricontrolla.
- Tailwind non gira più nel browser: `npm run css` costruisce
  `src/css/tailwind.css` (Tailwind 3.4.17, la versione che serviva il suo
  sito). Da un programma di circa 400 kB a un foglio di 23 kB.
- **Prova dell'aspetto:** versione di prima e versione nuova misurate nello
  stesso browser, elemento per elemento, a sei larghezze (da 390 a 1600 px) e
  in tredici situazioni di gioco: 65.376 misure, nessuna differenza. Tutte le
  251 regole di stile di prima sono nel foglio nuovo, identiche.
- Il foglio pubblicato è byte per byte quello costruito sul computer.
- Programmi presi da fuori: nessuno. Restano esterni i caratteri (Google
  Fonts), il programma di Firebase per l'online e i video di YouTube.

**Lo sfidante internazionale dichiara di essere un'AI** (stesso commit),
proposta F. Frasi scritte dal Revisore Social: avviso d'inizio, scheda
dell'avversario, pillola, una riga sotto «Gioca nel mondo ora», la schermata
d'attesa e il suo tasto. Corretti anche tre avvisi.

**Regole del database più strette** (commit `fdb6f86`), proposta A. Pubblicate
su Firestore.
- Ora controllano anche cosa si scrive: campi, tipi, misure, giocatori che non
  si riscrivono, partita finita che non si tocca, stanza che nasce pulita.
- **Prova:** 21 prove nell'emulatore (`npm run regole`). Contro le regole di
  prima ne falliscono dieci: erano i varchi aperti.
- **Dal vivo:** dopo la pubblicazione, una partita intera fra due giocatori
  veri è passata e sei tentativi scorretti sono stati rifiutati dal database
  vero. Nessun dato di prova è rimasto.

Prove automatiche: da 58 del mattino a 85, più le 21 dell'emulatore.

## Immagine per le condivisioni: approvata e online

Proposta E, commit `68f3490`. Fatta da Grafica (1200 × 630, 91 kB), promossa
dal master-designer con due ritocchi applicati e dal Revisore Social, vista e
approvata dal titolare. Sta in `assets/og-scacchi-zerouno.jpg`. Insieme sono
cambiati il titolo e la descrizione dell'anteprima, scritti dal Revisore:
- titolo: «Scacchi ZeroUno: gioca contro l'AI, in due o online»
- descrizione: «Dal telefono o dal computer, senza registrarti. Un progetto di
  ZeroUno Solution.»

Verificato dopo la pubblicazione: la pagina vera dichiara l'immagine nuova con
le misure giuste, il file risponde ed è identico byte per byte a quello di
Grafica, il gioco funziona. Due prove automatiche tengono fermo il tutto
(da 83 a 85).

**Non verificato:** come esce davvero dentro WhatsApp, Facebook e Telegram. Lo
si vede mandando il link a qualcuno. I messaggi già mandati tengono
l'anteprima vecchia; se anche un link nuovo mostra ancora l'icona, è la
memoria dell'app: basta aggiungere `?v=2` in fondo all'indirizzo.

## Cose messe sul computer oggi

- **Java 21** (Eclipse Temurin 21.0.13.1, file ufficiale da adoptium.net,
  49 MB, impronta verificata), scompattato in
  `%LOCALAPPDATA%\ZeroUno-strumenti\jre-21`. Non è installato nel sistema:
  è una cartella, e serve solo a `npm run regole`. Si può cancellare.
- L'emulatore di Firestore, scaricato da solo dallo strumento `firebase`
  nella sua cartella di lavoro.
- Windows ha chiesto se aprire la rete a Java: la risposta giusta è «Annulla».
  L'emulatore parla solo dentro il computer.

## Resta aperto

- **App Check** di Firebase (proposta C) e **pulizia automatica delle partite
  vecchie** (proposta D): si accendono dalla console di Firebase, cioè
  dall'account del titolare.
- Dal Revisore, per un altro giro: il punteggio accanto agli sfidanti AI non
  l'ha misurato nessuno; il pallino verde sul bottone pulsa anche quando non
  c'è nessuno in attesa. («muovi col mouse!» è stato corretto la sera: vedi
  sotto.)
- Domanda del Revisore per il titolare: all'apertura e a fine partita il gioco
  mostra anche video del canale Agjensi Okazione. Con la regola «niente
  pubblicità ai clienti» restano? Se il canale è suo, va bene così.
- Idea del Revisore: un indirizzo con il nome di ZeroUno al posto di
  `zerounosolution-star.github.io`, che è la riga che la gente guarda per
  decidere se fidarsi di un link.

---

# Sera: «semplifica il gioco tra due persone, semplifica lo schermo»

Richiesta del titolare. Ha visto le immagini prima/dopo e ha detto «Sì,
pubblica» la sera stessa. La versione del service worker è la v26.

## Cosa non andava

Per giocare con una persona servivano troppi passi, sparsi in due linguette.

- **Sullo stesso telefono:** scendere sotto la scacchiera, cambiare
  linguetta, premere il bottone, risalire. Poi «Ruota» a mano a ogni mossa:
  lo diceva il gioco stesso, in un paragrafo di istruzioni.
- **A distanza:** linguetta «Mondiale Online», un nome da scrivere, un
  «identificativo» con il suo bottone Copia che non serviva a niente, due
  bottoni, un campo per il codice. Il riquadro d'attesa si chiamava «Ricerca
  avversario» e offriva tre bottoni, uno dei quali portava a giocare contro
  l'AI.
- Guardando il codice: le stanze pubbliche non le crea nessun bottone. La
  sola strada per giocare fra due persone a distanza è la stanza privata con
  il link. «Gioca nel mondo ora» porta sempre a uno sfidante AI, e lo dice.

## Cosa è cambiato

1. **Una linguetta sola per giocare in due.** «2 Giocatori» ha due gruppi:
   *Sullo stesso schermo* (tempo, una spunta, un bottone) e *A distanza* (un
   bottone per invitare, e il campo del codice per chi lo riceve a voce).
2. **La scacchiera si gira da sola** verso chi deve muovere, mezzo secondo
   dopo la mossa. Una spunta la tiene ferma. Vale anche dopo «Annulla» e
   quando si riprende una partita salvata.
3. **L'invito è un bottone:** «Manda il link». Sul telefono apre WhatsApp e
   le altre app; dove non si può, il bottone dice «Copia il link» e copia
   l'invito. Il riquadro d'attesa ha due bottoni invece di tre («Manda il
   link» e «Annulla invito») e si chiama «Invita il tuo amico». Il campo del
   codice sta dietro una riga da aprire, «Hai un codice stanza?»: serve di
   rado.
4. **«Mondiale Online» più corta:** via l'identificativo, via i doppioni.
5. **Sul telefono** non c'è più il campo della mossa scritta, e la riga
   d'istruzione dice «Tocca un pezzo, poi la casa dove va» invece di parlare
   di mouse, frecce e Invio.
6. **La scacchiera torna in vista** dopo aver avviato una partita dalla sala.
7. Nomi più corti nella partita in due («Giocatore 1», «Giocatore 2»: il
   colore lo dice già l'etichetta) e l'avviso giusto: «Partita in due
   avviata: inizia il Bianco!».

## Una correzione che non c'entra con la semplicità

Il Revisore e il Developer hanno segnalato che i disegni dei pezzi non sono
nostri: sono di **Cburnett**, su Wikimedia Commons. Verificato: il tracciato
del pedone ha gli stessi numeri di `Chess_plt45.svg`. La licenza (CC BY-SA
3.0) chiede di nominare autore e licenza e di dichiarare le modifiche. Il
piede della pagina diceva «pezzi originali»: ora dice di chi sono, con i due
collegamenti. Corretto anche il README. Un test tiene ferma la riga.

## Come è stato provato

- 103 prove automatiche su 103 (erano 85). Nuove: la rotazione
  automatica in tutti i casi, il link d'invito, la linguetta, e una guardia
  generale: ogni elemento che il codice va a prendere deve esistere nella
  pagina.
- Nel browser, con il banco di prova a Firebase finto (nessun dato esce dal
  computer): partita in due con rotazione, spunta spenta e riaccesa, «Annulla»,
  ripresa dopo una ricarica; invito con due schede, mosse nei due sensi;
  bottone «Manda il link» con una condivisione finta, per vedere cosa parte.
- **Sul database vero**, prima di pubblicare: la versione di lavoro (sul
  computer) ha invitato, il sito pubblicato (versione di prima, schermo da
  telefono) è entrato dal link. Due giocatori anonimi diversi. Mosse nei due
  sensi, resa, fine partita vista dall'altra parte, nessun errore nelle due
  pagine. La stanza di prova è stata cancellata. Quindi le regole del
  database accettano quello che scrive la versione nuova, e le due versioni
  si parlano: chi ha ancora la vecchia può giocare con chi ha la nuova.
- Le 21 prove delle regole nell'emulatore: 21 su 21.
- Foto prima/dopo fatte con Chrome senza finestra, a schermo da telefono e da
  computer: stanno nel progetto del sito, in
  `anteprime/2026-11-20-scacchi-semplice/`.
- **Non provato:** il foglio di condivisione vero di un telefono (WhatsApp),
  e il tocco su un telefono vero. Si guardano dopo la pubblicazione.

## I due controlli prima di mostrarlo al titolare

- **Revisore Social: verde.** Quattro rifiniture a scelta. Applicate: il
  bottone del riquadro dice «Annulla invito» (sotto la scacchiera c'è già un
  «Annulla», quello della mossa); «In attesa…» con i puntini in un carattere
  solo; nel piede «Colori e linee adattati». La quarta (scrivere la casa in
  minuscolo) è stata risolta accorciando: sul telefono la riga dice solo
  «Tocca una casa evidenziata», perché la casa scelta la dice già
  l'etichetta accanto.
- **master-designer: passa, con due ritocchi**, tutti e due applicati:
  «Annulla invito», e la nota sotto «Invita un amico con un link» a 13 px
  come la nota gemella della sala mondiale.
- Proposte del master-designer per il titolare, non applicate: in una partita
  in due togliere «Ruota» quando la scacchiera si gira da sola, e togliere
  «Patta» (due persone sedute insieme si mettono d'accordo a voce).

## Segnalato dai colleghi, non fatto

- **Privacy** (Revisore): i video arrivano da youtube.com e non da
  youtube-nocookie.com, e nel gioco non c'è un collegamento alla pagina della
  privacy. È un lavoro a parte, serve il sì del titolare.
- **Video del canale Agjensi Okazione:** domanda ancora aperta, vedi sopra.
  Finché non risponde, il Developer non mette il gioco nella pagina del sito.
- **Rivincita:** dopo una partita a distanza, «Nuova partita» porta a uno
  sfidante AI. Per rigiocare con l'amico serve un invito nuovo.

## Online la sera

Pubblicato il 20 novembre alle 19:10 (commit `fcd80eb`), dopo il «Sì,
pubblica» del titolare. Controllato sul sito vero:

- quindici file cambiati confrontati con quelli sul computer: identici, byte
  per byte. Il service worker è alla v26;
- chi aveva la versione di prima vede la fascia «Nuova versione disponibile»,
  preme «Ricarica» e ha quella nuova;
- una partita a due fra due giocatori anonimi diversi, tutti e due sulla
  versione nuova: invito, ingresso dal link, mosse nei due sensi, resa.
  Nessun errore nelle due pagine. Stanza di prova cancellata;
- la partita in due sullo stesso schermo: la scacchiera si gira dopo la mossa
  e torna indietro con «Annulla».

Resta da guardare con un telefono vero: il bottone «Manda il link» deve
aprire WhatsApp e le altre app.
