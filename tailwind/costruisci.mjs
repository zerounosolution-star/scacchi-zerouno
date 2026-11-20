/**
 * COSTRUISCE IL FOGLIO DI STILE DI TAILWIND
 *
 *     npm run css
 *
 * Legge index.html e i moduli di src/, e scrive in src/css/tailwind.css
 * gli stili delle classi Tailwind che ci trova. Poi salva in
 * tailwind/classi.json l'impronta delle classi usate, cosi' un test si
 * accorge se la pagina cambia senza che il foglio venga rifatto.
 *
 * Tailwind non si installa nel progetto: si scarica al momento, sempre
 * nella stessa versione. Il foglio si costruisce in un file a parte e
 * prende il posto di quello vecchio solo se e' riuscito bene: una
 * costruzione fallita a meta' non lascia il gioco senza stili.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { raccogliClassi, improntaDelleClassi } from './classi.mjs';

/** La versione che il sito di Tailwind serviva quando gli stili sono stati portati in casa. */
const TAILWIND = '3.4.17';

const radice = join(dirname(fileURLToPath(import.meta.url)), '..');
const foglio = join(radice, 'src', 'css', 'tailwind.css');
const registro = join(radice, 'tailwind', 'classi.json');

const cartellaProvvisoria = mkdtempSync(join(tmpdir(), 'scacchi-tailwind-'));
const provvisorio = join(cartellaProvvisoria, 'tailwind.css');

try {
    // Un comando solo, scritto per intero: su Windows npx e' un file .cmd e
    // parte soltanto attraverso la shell.
    const comando = `npx --yes tailwindcss@${TAILWIND} -c tailwind/tailwind.config.js -i tailwind/input.css -o "${provvisorio}"`;
    const esito = spawnSync(comando, { cwd: radice, shell: true, stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' });

    if (esito.status !== 0) {
        console.error('Tailwind non e\' riuscito a costruire il foglio:\n' + (esito.stderr || '').trim());
        process.exit(1);
    }

    const nuovo = existsSync(provvisorio) ? readFileSync(provvisorio, 'utf8') : '';
    if (!nuovo.includes('--tw-') || nuovo.length < 5000) {
        console.error('Il foglio costruito e\' vuoto o incompleto: quello vecchio resta al suo posto.');
        process.exit(1);
    }

    const vecchio = existsSync(foglio) ? readFileSync(foglio, 'utf8') : '';
    if (nuovo !== vecchio) writeFileSync(foglio, nuovo);

    const classi = raccogliClassi(radice);
    const scheda = JSON.stringify({ tailwind: TAILWIND, classi: classi.length, impronta: improntaDelleClassi(classi) }, null, 2) + '\n';
    const schedaVecchia = existsSync(registro) ? readFileSync(registro, 'utf8') : '';
    if (scheda !== schedaVecchia) writeFileSync(registro, scheda);

    console.log(`Foglio di Tailwind ${nuovo === vecchio ? 'gia\' aggiornato' : 'ricostruito'} (${nuovo.length} caratteri, ${classi.length} classi nel codice).`);
} finally {
    rmSync(cartellaProvvisoria, { recursive: true, force: true });
}
