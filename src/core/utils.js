/**
 * UTILITA' CONDIVISE
 *
 * Notifiche a comparsa, copia negli appunti, nome del giocatore e
 * controllo su chi puo' muovere in questo momento.
 */

import { chess, state } from './state.js';

export function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'zu-toast';
    toast.dataset.tone = type;
    toast.innerHTML = `<span class="zu-toast-dot"></span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(6px)';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

export function copyTextToClipboard(text, confirmMessage = "Copiato negli appunti") {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        showToast(confirmMessage, 'gold');
    } catch (err) {
        showToast("Impossibile copiare automaticamente");
    }
    document.body.removeChild(textarea);
}

/** Chiave del nome scelto, ricordato tra una visita e l'altra. */
const NICKNAME_KEY = 'zerouno_nome_giocatore';

export function getPlayerNickname() {
    const input = document.getElementById('playerNicknameInput');
    const val = input ? input.value.trim() : '';
    if (val) return val;
    try {
        const saved = localStorage.getItem(NICKNAME_KEY);
        if (saved) return saved;
    } catch (err) {
        // Senza memoria locale si va avanti coi ripieghi qui sotto
    }
    if (state.currentUser && state.currentUser.uid) {
        return `Giocatore_${state.currentUser.uid.substring(0, 4).toUpperCase()}`;
    }
    return 'Scacchista_01';
}

/** Il nome salvato, o stringa vuota. */
export function getStoredNickname() {
    try {
        return localStorage.getItem(NICKNAME_KEY) || '';
    } catch (err) {
        return '';
    }
}

/** Ricorda il nome scelto; vuoto = torna al nome automatico. */
export function savePlayerNickname(name) {
    const pulito = (name || '').trim();
    try {
        if (pulito) localStorage.setItem(NICKNAME_KEY, pulito);
        else localStorage.removeItem(NICKNAME_KEY);
    } catch (err) {
        // Senza memoria locale il nome vale solo per questa visita
    }
}

export function canHumanControlCurrentTurn() {
    if (state.matchEnded) return false;
    const currentTurn = chess.turn();
    if (state.gameMode === 'local') return true;
    return currentTurn === state.playerColor;
}
