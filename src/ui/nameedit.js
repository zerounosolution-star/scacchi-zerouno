/**
 * Il nome del giocatore si cambia sul posto, nella sua fascia.
 *
 * Il nome e' dove l'utente lo legge: e' li' che lo cerca per
 * cambiarlo. Una matita discreta accanto al nome apre un campo al suo
 * posto; Invio o un clic fuori salvano, Esc annulla. Il nome finisce
 * nella memoria locale e nel campo della sala online, cosi' tutte le
 * strade (partite AI, stanze, sfide mondiali) leggono lo stesso valore.
 *
 * La matita compare solo accanto al nome con "(Tu)", cioe' il
 * giocatore umano di questa partita: mai sull'AI, mai sull'avversario
 * online (il suo nome e' suo). In una partita online gia' abbinata il
 * nome e' gia' stato mandato all'avversario: li' non si cambia.
 */

import { state } from '../core/state.js';
import { showToast, getPlayerNickname, savePlayerNickname, getStoredNickname } from '../core/utils.js';

const MAX_NAME_LENGTH = 22;

/** La coppia bottone-matita / elemento del nome di ogni fascia. */
const SEATS = [
    { btn: 'editNameBtnTop', name: 'topPlayerName' },
    { btn: 'editNameBtnBottom', name: 'bottomPlayerName' }
];

/** Il nome in questa fascia e' del giocatore umano e si puo' cambiare? */
function isEditable(nameEl) {
    if (!nameEl || !nameEl.textContent.includes('(Tu)')) return false;
    // Partita online abbinata: il nome e' gia' dall'altra parte
    if (state.gameMode === 'online' && state.currentMatchId) return false;
    return true;
}

/** Mostra o nasconde le matite secondo chi siede dove. */
export function refreshNamePencils() {
    for (const seat of SEATS) {
        const btn = document.getElementById(seat.btn);
        const nameEl = document.getElementById(seat.name);
        if (!btn || !nameEl) continue;
        btn.classList.toggle('hidden', !isEditable(nameEl));
    }
}

function startEditing(nameEl, pencilBtn) {
    if (!isEditable(nameEl)) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = MAX_NAME_LENGTH;
    input.className = 'zu-name-input';
    input.value = getPlayerNickname();
    input.setAttribute('aria-label', 'Il tuo nome');

    const etichettaPrima = nameEl.textContent;
    nameEl.classList.add('hidden');
    pencilBtn.classList.add('hidden');
    nameEl.parentNode.insertBefore(input, nameEl);
    input.focus();
    input.select();

    let chiuso = false;

    function finish(salva) {
        if (chiuso) return;
        chiuso = true;
        const nuovo = input.value.trim();
        input.remove();
        nameEl.classList.remove('hidden');

        if (salva && nuovo && nuovo !== getStoredNickname()) {
            savePlayerNickname(nuovo);
            // Un'unica fonte di verita': anche il campo della sala online
            const onlineInput = document.getElementById('playerNicknameInput');
            if (onlineInput) onlineInput.value = nuovo;
            nameEl.textContent = `${nuovo} (Tu)`;
            showToast(`Ora sei ${nuovo}`);
        } else {
            nameEl.textContent = etichettaPrima;
        }

        refreshNamePencils();
        pencilBtn.focus();
    }

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finish(true);
        else if (e.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => finish(true));
}

export function setupNameEditing() {
    for (const seat of SEATS) {
        const btn = document.getElementById(seat.btn);
        const nameEl = document.getElementById(seat.name);
        if (!btn || !nameEl) continue;
        btn.addEventListener('click', () => startEditing(nameEl, btn));
    }

    // Il nome salvato precompila il campo della sala online
    const onlineInput = document.getElementById('playerNicknameInput');
    const salvato = getStoredNickname();
    if (onlineInput && !onlineInput.value && salvato) onlineInput.value = salvato;

    refreshNamePencils();
}
