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

export function getPlayerNickname() {
    const input = document.getElementById('playerNicknameInput');
    const val = input ? input.value.trim() : '';
    if (val) return val;
    if (state.currentUser && state.currentUser.uid) {
        return `Giocatore_${state.currentUser.uid.substring(0, 4).toUpperCase()}`;
    }
    return 'Scacchista_01';
}

export function canHumanControlCurrentTurn() {
    if (state.matchEnded) return false;
    const currentTurn = chess.turn();
    if (state.gameMode === 'local') return true;
    return currentTurn === state.playerColor;
}
