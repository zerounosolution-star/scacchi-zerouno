# Nota di sicurezza — 9 novembre 2026

Avviso di GitHub «Action needed: Secrets detected» sul repository pubblico
`zerounosolution-star/scacchi-zerouno`.

## Cosa ha trovato GitHub

- **Avviso numero 1**, aperto l'8 novembre 2026 alle 19:02.
- Tipo: **Google API Key**.
- Dove: `src/config/app.config.js`, riga 69, dentro `FIREBASE_CONFIG`.
- Primo commit che la contiene: `8f84f73` dell'8 novembre 2026,
  «feat: la rete mondiale si accende».
- La chiave finisce con **STUM**. In questa nota non si scrive mai intera.
- È l'unica cosa trovata: nessun'altra chiave, password o certificato
  nel progetto, né nei file tracciati né in quelli fuori da git.

## Che tipo di chiave è

È la **chiave Firebase del browser**, quella del gioco online.

Questo tipo di chiave **serve solo a dire quale progetto Firebase sei**.
Non apre i dati. Google la chiama «identifica, non autorizza»: chi tiene i
dati al sicuro sono le regole in `firebase/firestore.rules`, non il segreto
della chiave.

Non è una chiave Gemini e non è una chiave di servizio. Quelle due non
devono mai uscire. Questa invece **viaggia dentro ogni pagina del gioco**:
chiunque apra il sito e guardi il codice della pagina la legge. È fatta così.

Le regole di Firestore del progetto sono già strette:
si legge e si scrive solo da autenticati, una partita la modificano solo
i due che ci giocano, e tutto il resto è chiuso.

## Perché nascondere la chiave qui non servirebbe

Il sito sta su **GitHub Pages, ramo `main`, cartella radice**: il sito
pubblicato *è* il repository. Non c'è nessun passaggio di compilazione,
nessun server, nessuna variabile d'ambiente.

Quindi, se la chiave esce dal repository:

- il gioco online **smette di funzionare per tutti** (restano l'AI e il
  gioco in due sullo stesso dispositivo);
- la chiave resterebbe comunque pubblica, perché è già stata vista;
- riscrivere lo storico di git non cancella quello che è già uscito.

Anche rigenerare la chiave non cambierebbe niente: la nuova chiave
finirebbe nello stesso punto, pubblica allo stesso modo.

## Cosa deve fare il titolare (10 minuti, nella console Google)

Niente panico e niente fretta: il rischio qui non è che qualcuno legga le
partite, è che qualcuno usi la chiave dal **suo** sito per consumare il
piano gratuito di Firebase.

1. Aprire <https://console.cloud.google.com/apis/credentials>
   e scegliere in alto il progetto **scacchi-zerouno**.
2. Cliccare sulla chiave che finisce con **STUM**.
3. In **Limitazioni per l'applicazione** scegliere **Siti web (referrer HTTP)**
   e aggiungere questi due indirizzi, uno per riga:
   - `https://zerounosolution-star.github.io/*`
   - `http://127.0.0.1:8099/*`  (serve per provare il gioco sul computer)
4. In **Limitazioni per l'API** scegliere **Limita chiave** e lasciare
   spuntate solo le voci che il gioco usa davvero:
   **Identity Toolkit API** e **Cloud Firestore API**.
5. Salvare, aspettare qualche minuto, poi aprire il sito e fare una
   partita online di prova.
6. Controllare una volta i consumi del progetto in Firebase
   (Console Firebase → Utilizzo), per vedere che non ci siano stati
   accessi strani fra l'8 e il 9 novembre.

Poi, su GitHub: **Security → Secret scanning → avviso numero 1 →
Close as → Used in tests / Won't fix**, con nota «chiave pubblica per
definizione, limitata per dominio». L'avviso si chiude senza toccare lo storico.

## Cosa resta aperto

- **App Check** (Firebase → App Check, con reCAPTCHA Enterprise): è il vero
  lucchetto contro chi usa la chiave da fuori. Gratuito entro una soglia
  larga, ma va acceso con calma e provato, perché se è configurato male
  blocca anche i giocatori veri. Da fare in un secondo momento.
- Controllo dei consumi Firebase dopo una settimana.

## Se invece si decidesse di togliere la chiave

Non è consigliato (vedi sopra), ma è pronto: significa accettare che il
gioco online si spenga per tutti, riscrivere tutto lo storico di git e
mandarlo su GitHub con un `push --force`, che è irreversibile.
In quel caso si fa prima una copia della cartella `.git`, si toglie il file
dallo storico con `git filter-branch`, e si rimette al suo posto un modello
a campi vuoti. Il lavoro è preparato ma **non è stato eseguito**: serve il sì
del titolare.

---

Nessun account è stato toccato. Niente è stato mandato online.
Gli unici file cambiati sono questa nota e un commento in
`src/config/app.config.js`. I 58 test del progetto passano.
