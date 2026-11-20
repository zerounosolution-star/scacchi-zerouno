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
- Dal Revisore, per un altro giro: a chi avvia la partita in due il gioco dice
  «muovi col mouse!», che sul telefono è sbagliato; il punteggio accanto agli
  sfidanti AI non l'ha misurato nessuno; il pallino verde sul bottone pulsa
  anche quando non c'è nessuno in attesa.
- Domanda del Revisore per il titolare: all'apertura e a fine partita il gioco
  mostra anche video del canale Agjensi Okazione. Con la regola «niente
  pubblicità ai clienti» restano? Se il canale è suo, va bene così.
- Idea del Revisore: un indirizzo con il nome di ZeroUno al posto di
  `zerounosolution-star.github.io`, che è la riga che la gente guarda per
  decidere se fidarsi di un link.
