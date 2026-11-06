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
    const borderClass = type === 'gold' ? 'border-bronze-400' : 'border-ivory-300';
    toast.className = `pointer-events-auto bg-anthracite-900 text-ivory-50 border ${borderClass} px-4 py-2.5 rounded-xl shadow-lg text-xs font-medium flex items-center gap-2 transition-all duration-300`;
    toast.innerHTML = `<span class="w-2 h-2 rounded-full bg-bronze-400 shrink-0"></span><span>${message}</span>`;
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
