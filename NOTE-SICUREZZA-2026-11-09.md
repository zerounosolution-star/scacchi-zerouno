# Nota di sicurezza — 9 novembre 2026

Avviso di GitHub «Action needed: Secrets detected» sul repository pubblico
`zerounosolution-star/scacchi-zerouno`.

## Cosa ha trovato GitHub

- **Avviso numero 1**, aperto l'8 novembre 2026 alle 19:02. È l'unico aperto.
- Tipo: **Google API Key**.
- Dove: `src/config/app.config.js`, dentro `FIREBASE_CONFIG`.
- Entrata con il commit `8f84f73` dell'8 novembre, «feat: la rete mondiale
  si accende», e presente in 9 commit su 45.
- La chiave finisce con **STUM**. Qui non si scrive mai intera.
- Nient'altro: nessuna seconda chiave, nessuna password, nessun certificato,
  né nei file del progetto né nello storico.

## Che chiave è, e cosa succede quando si revoca

È la **chiave Firebase del browser**: quella che fa funzionare la **sala
mondiale online** del gioco. Non è una chiave Gemini e non è una chiave di
servizio.

Cosa fa davvero: dice a Google *quale progetto Firebase sei*. Non apre i dati.
Chi tiene al sicuro le partite sono le regole in `firebase/firestore.rules`,
che sono già strette: si legge solo da autenticati, una partita la modificano
solo i due che ci giocano, tutto il resto è chiuso.

**Quindi, al momento della revoca: la sala mondiale si spegne.** Restano le
partite contro l'AI e in due sullo stesso dispositivo, e l'intestazione lo
dichiara con la scritta «Modalità Locale». L'online torna quando la chiave
nuova è al suo posto.

## Cosa deve fare il titolare, nell'ordine

**Prima la nuova, poi via la vecchia**, così non si resta mai scoperti.

1. Aprire <https://console.cloud.google.com/apis/credentials>
   (**API e servizi → Credenziali**) e scegliere in alto il progetto
   **scacchi-zerouno**.
2. **Crea credenziali → Chiave API**: nasce la chiave nuova.
3. Sulla chiave nuova, prima di usarla, mettere le limitazioni:
   - **Limitazioni per l'applicazione → Siti web (referrer HTTP)**, con
     `https://zerounosolution-star.github.io/*` e `http://127.0.0.1:8099/*`;
   - **Limitazioni per l'API → Limita chiave**, lasciando solo
     **Identity Toolkit API** e **Cloud Firestore API**.
4. Scrivere la chiave nuova **a mano**, fra le virgolette del campo `apiKey`,
   in questo file e in questa riga:

   ```
   C:\Users\Utente\Documents\Claude\Projects\Scacchi ZeroUno\firebase.config.js
   riga 14:     apiKey: "qui dentro",
   ```

   Quel file ora non entra più in git. **Non va incollata in chat a nessuno.**
5. Provare il gioco in locale: deve comparire «Rete Mondiale Attiva».
6. Solo adesso, nella stessa pagina della console, **eliminare la chiave
   vecchia** (quella che finisce con STUM).
7. Controllare una volta i consumi in Console Firebase → Utilizzo, per vedere
   se fra l'8 e il 9 novembre c'è stato traffico strano.

Poi su GitHub: **Security → Secret scanning → avviso numero 1 → Close as →
Revoked**.

## Cosa è stato fatto nel progetto (9.11.2026)

- La chiave è uscita da `src/config/app.config.js`. Al suo posto c'è
  `loadFirebaseConfig()`, che legge la configurazione da un file esterno.
- La configurazione vive in **`firebase.config.js`**, nella radice, e
  `.gitignore` lo tiene fuori da git.
- Nel repository resta il modello a campi vuoti
  **`firebase.config.ESEMPIO.js`**, con le istruzioni per chi riprende il
  progetto.
- Se quel file manca, il gioco non si rompe: resta giocabile e dichiara
  «Modalità Locale».
- **Storico ripulito**: copia di sicurezza della cartella `.git` in
  `C:\Users\Utente\Documents\Claude\Projects\_copia-git-scacchi-2026-11-09`,
  poi `git filter-branch` su tutti i 46 commit, `reflog expire` e
  `gc --prune=now`. Verificato: la stringa non è più in nessun commit e in
  nessun oggetto del repository locale.
- README e `docs/ARCHITETTURA.md` aggiornati. `CACHE_VERSION` del service
  worker alzata da `v15` a `v16`.
- Prove: `node --check` su tutti i file toccati, 58 test su 58 passati, gioco
  aperto nel browser con e senza il file di configurazione.

## Cosa resta da decidere

**1. Il `git push --force`.** Lo storico pulito è solo sul computer. Su GitHub
c'è ancora quello vecchio, con la chiave dentro. Per allinearlo serve:

```
git push --force origin main
```

È **irreversibile**: tutti i 46 commit cambiano codice sul repository
pubblico. Non è stato fatto: serve il sì scritto del titolare.
Se si cambia idea prima del push, si torna indietro rimettendo la cartella
`.git` dalla copia di sicurezza.

**2. La sala mondiale sul sito pubblicato.** Il sito è servito da GitHub Pages
dal ramo `main`, cartella radice: non c'è nessun passaggio di pubblicazione
che possa aggiungere la chiave. Siccome `firebase.config.js` non sta nel
repository, **dopo il push il sito pubblicato partirà in Modalità Locale**.
Due strade, da scegliere con calma:

- lasciare così: online solo sul computer di casa, il sito pubblico resta
  gioco contro l'AI e in due;
- aggiungere una pubblicazione con **GitHub Actions**, con la chiave messa in
  *Settings → Secrets and variables → Actions*: la chiave entra nel sito al
  momento del rilascio e non passa mai dallo storico. Mezz'ora di lavoro.

**3. App Check** (Firebase → App Check, con reCAPTCHA Enterprise): il vero
lucchetto contro chi usa la chiave da fuori. Da accendere con calma e
provare, perché configurato male blocca anche i giocatori veri.

---

Nessun account è stato toccato. Niente è stato mandato online.
