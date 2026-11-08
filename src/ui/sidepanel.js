/**
 * La sala scacchistica si ripiega verso destra.
 *
 * Sugli schermi larghi la colonna di destra toglie spazio alla
 * scacchiera. Un bottone la richiude: la scacchiera si prende lo
 * schermo, e una linguetta fissa sul bordo destro riapre la sala.
 *
 * La scelta resta tra una visita e l'altra (localStorage). Sotto la
 * larghezza da due colonne il bottone non compare: li' la sala sta
 * sotto la scacchiera e non c'e' niente da ripiegare.
 */

const STORAGE_KEY = 'zerouno_sala_chiusa';

function readSaved() {
    try {
        return localStorage.getItem(STORAGE_KEY) === '1';
    } catch (err) {
        return false;
    }
}

function writeSaved(chiusa) {
    try {
        if (chiusa) localStorage.setItem(STORAGE_KEY, '1');
        else localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
        // Senza memoria locale la scelta vale solo per questa visita
    }
}

export function setupSidePanel() {
    const layout = document.getElementById('mainLayout');
    const closeBtn = document.getElementById('collapseSalaBtn');
    const reopenBtn = document.getElementById('reopenSalaBtn');
    if (!layout || !closeBtn || !reopenBtn) return;

    function apply(chiusa) {
        layout.dataset.sala = chiusa ? 'chiusa' : 'aperta';
        closeBtn.setAttribute('aria-expanded', chiusa ? 'false' : 'true');
    }

    closeBtn.addEventListener('click', () => {
        apply(true);
        writeSaved(true);
    });

    reopenBtn.addEventListener('click', () => {
        apply(false);
        writeSaved(false);
    });

    apply(readSaved());
}
