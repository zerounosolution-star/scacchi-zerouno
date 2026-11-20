/**
 * UTILITA' CONDIVISE
 *
 * Notifiche a comparsa, copia negli appunti, nome del giocatore e
 * controllo su chi puo' muovere in questo momento.
 */

import { chess, state } from './state.js';

/**
 * Notifica a comparsa.
 *
 * Il messaggio e' SEMPRE testo, mai HTML: dentro ci finiscono il nome
 * dell'avversario e il codice letto dal link d'invito, cioe' parole
 * scritte da altri. Scritto come HTML, un nome fatto apposta
 * eseguirebbe codice nella pagina di chi lo legge.
 *
 * @param {string} message
 * @param {'info'|'gold'} [type]
 */
export function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'zu-toast';
    toast.dataset.tone = type;

    const dot = document.createElement('span');
    dot.className = 'zu-toast-dot';
    const text = document.createElement('span');
    text.textContent = String(message);
    toast.append(dot, text);

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
    // Chi guarda una partita altrui non muove i pezzi di nessuno
    if (state.gameMode === 'online' && state.spectator) return false;
    const currentTurn = chess.turn();
    if (state.gameMode === 'local') return true;
    return currentTurn === state.playerColor;
}
