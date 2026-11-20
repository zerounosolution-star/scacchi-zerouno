/**
 * LE CLASSI USATE DAL GIOCO, E LA LORO IMPRONTA
 *
 * Il foglio src/css/tailwind.css contiene solo gli stili delle classi che
 * Tailwind trova nella pagina e nei moduli al momento della costruzione.
 * Una classe aggiunta dopo, senza ricostruire, resta senza stile e nessuno
 * se ne accorge finche' non la guarda.
 *
 * Qui si raccolgono le classi scritte nel codice e se ne calcola
 * un'impronta. `npm run css` la salva in tailwind/classi.json; un test la
 * ricalcola: se non coincide, le classi sono cambiate dopo l'ultima
 * costruzione e il foglio va rifatto.
 *
 * Lo usano sia la costruzione (costruisci.mjs) sia il test
 * (tests/pagina.test.mjs): una sola definizione di «quali classi».
 */

import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, extname } from 'node:path';

/** Tutti i file .js sotto una cartella, in ordine stabile. */
function moduli(cartella) {
    const trovati = [];
    for (const voce of readdirSync(cartella, { withFileTypes: true })) {
        const percorso = join(cartella, voce.name);
        if (voce.isDirectory()) trovati.push(...moduli(percorso));
        else if (extname(voce.name) === '.js') trovati.push(percorso);
    }
    return trovati.sort();
}

/**
 * Le classi scritte per intero nel codice: negli attributi class="..."
 * della pagina e dei moduli, in className = '...' e in classList.add /
 * remove / toggle('...'). I pezzi variabili (${...}) si saltano.
 *
 * @param {string} radice  La cartella del progetto.
 * @returns {string[]} classi uniche, in ordine alfabetico.
 */
export function raccogliClassi(radice) {
    const classi = new Set();
    const aggiungi = (valore) => {
        for (const classe of valore.split(/\s+/)) {
            if (classe && !classe.includes('${') && !classe.includes('}')) classi.add(classe);
        }
    };

    const testi = [readFileSync(join(radice, 'index.html'), 'utf8')];
    for (const file of moduli(join(radice, 'src'))) testi.push(readFileSync(file, 'utf8'));

    for (const testo of testi) {
        for (const [, valore] of testo.matchAll(/\bclass\s*=\s*"([^"]*)"/g)) aggiungi(valore);
        for (const [, valore] of testo.matchAll(/\bclassName\s*=\s*'([^']*)'/g)) aggiungi(valore);
        for (const [, valore] of testo.matchAll(/\bclassList\.(?:add|remove|toggle)\(\s*'([^']*)'/g)) aggiungi(valore);
    }

    return [...classi].sort();
}

/** L'impronta di un elenco di classi. */
export function improntaDelleClassi(classi) {
    return createHash('sha256').update(classi.join('\n')).digest('hex');
}
