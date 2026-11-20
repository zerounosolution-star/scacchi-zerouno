/**
 * LANCIA LE PROVE DELLE REGOLE NELL'EMULATORE
 *
 *     npm run regole
 *
 * Servono due cose sul computer, che non stanno nel progetto:
 * - lo strumento `firebase` (firebase-tools), gia' installato;
 * - Java 21 o successivo, perche' l'emulatore di Firestore e' scritto in Java.
 *
 * Java si cerca prima nel PATH, poi nella cartella degli strumenti di casa
 * (%LOCALAPPDATA%\ZeroUno-strumenti\jre-21), dove il 20 novembre 2026 e'
 * stata messa una copia portatile di Eclipse Temurin: non e' installata nel
 * sistema, e' solo una cartella. Se manca, il messaggio dice cosa fare.
 *
 * Niente arriva al database vero: il progetto usato qui si chiama «demo-…»
 * e l'emulatore vive solo su questo computer.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const radice = join(dirname(fileURLToPath(import.meta.url)), '..');
const ambiente = { ...process.env };

const haJava = () => spawnSync('java -version', { shell: true, env: ambiente, stdio: 'ignore' }).status === 0;

if (!haJava()) {
    const diCasa = join(process.env.LOCALAPPDATA || '', 'ZeroUno-strumenti', 'jre-21', 'bin');
    if (existsSync(diCasa)) {
        const chiave = Object.keys(ambiente).find((k) => k.toLowerCase() === 'path') || 'PATH';
        ambiente[chiave] = diCasa + delimiter + (ambiente[chiave] || '');
    }
}

if (!haJava()) {
    console.error('Java non trovato. L\'emulatore di Firestore ne ha bisogno (versione 21 o successiva).');
    console.error('Scaricare la versione JRE di Eclipse Temurin 21 da https://adoptium.net e scompattarla in');
    console.error('%LOCALAPPDATA%\\ZeroUno-strumenti\\jre-21, oppure installare Java nel sistema.');
    process.exit(1);
}

const esito = spawnSync(
    'firebase emulators:exec --only firestore --project demo-scacchi-zerouno "node --test firebase/regole.test.mjs"',
    { cwd: radice, shell: true, env: ambiente, stdio: 'inherit' }
);
process.exit(esito.status === null ? 1 : esito.status);
