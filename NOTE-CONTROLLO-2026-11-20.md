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

Niente è stato pubblicato: le modifiche sono sul computer, in attesa del sì.

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
