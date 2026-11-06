/**
 * FINE PARTITA E VIDEO DEL CANALE
 *
 * Riconosce matto, stallo, patta e tempo scaduto, poi apre la
 * finestra di fine partita con un video del canale ZeroUno.
 */

import { ZEROUNO_VIDEOS } from '../data/videos.js';
import { chess, state } from '../core/state.js';
import { playChessSound } from '../core/sound.js';

export function checkAndHandleGameOver() {
    if (!chess.game_over()) return false;

    let title = 'Partita Conclusa';
    let subtitle = 'Risultato Ufficiale';

    if (chess.in_checkmate()) {
        const winner = chess.turn() === 'w' ? 'Nero' : 'Bianco';
        title = `Scacco Matto — Vittoria del ${winner}`;
        subtitle = 'Vittoria per Scacco Matto';
    } else if (chess.in_stalemate()) {
        title = 'Patta per Stallo';
        subtitle = 'Nessuna mossa legale disponibile';
    } else if (chess.insufficient_material()) {
        title = 'Patta per Materiale Insufficiente';
        subtitle = 'Impossibile dare scacco matto con i pezzi rimasti';
    } else if (chess.in_threefold_repetition()) {
        title = 'Patta per Ripetizione';
        subtitle = 'La stessa posizione e\' comparsa tre volte';
    } else if (chess.halfMoves >= 100) {
        title = 'Patta per la Regola delle 50 Mosse';
        subtitle = '50 mosse senza catture e senza mosse di pedone';
    } else if (chess.in_draw()) {
        title = 'Partita Patta';
        subtitle = 'Equilibrio perfetto sulla scacchiera';
    }

    triggerEndOfGame(title, subtitle);
    return true;
}

export function pickRandomZeroUnoVideo() {
    if (ZEROUNO_VIDEOS.length === 0) return null;
    if (ZEROUNO_VIDEOS.length === 1) return ZEROUNO_VIDEOS[0];

    const candidates = ZEROUNO_VIDEOS.filter(v => v.id !== state.lastPlayedVideoId);
    const selected = candidates[Math.floor(Math.random() * candidates.length)] || ZEROUNO_VIDEOS[0];
    state.lastPlayedVideoId = selected.id;
    return selected;
}

export function loadZeroUnoVideoInModal(videoObj) {
    if (!videoObj) return;
    const iframe = document.getElementById('zeroUnoYoutubeIframe');
    const titleEl = document.getElementById('currentZeroUnoVideoTitle');
    const directLink = document.getElementById('directVideoYoutubeLink');

    titleEl.textContent = videoObj.title;
    // Autoplay con parametri ottimizzati per l'incorporamento
    iframe.src = `https://www.youtube.com/embed/${videoObj.id}?autoplay=1&rel=0&playsinline=1&modestbranding=1`;
    directLink.href = `https://www.youtube.com/watch?v=${videoObj.id}`;
}

export function triggerEndOfGame(outcomeTitle, outcomeSubtitle = 'Partita Conclusa') {
    state.matchEnded = true;
    if (state.timerInterval) clearInterval(state.timerInterval);
    playChessSound('end');

    const headline = document.getElementById('gameStatusHeadline');
    headline.textContent = outcomeTitle;
    headline.className = 'font-serif text-2xl font-semibold text-bronze-600';

    document.getElementById('modalOutcomeTitle').textContent = outcomeTitle;
    document.getElementById('modalOutcomeSubtitle').textContent = outcomeSubtitle;

    const randomVideo = pickRandomZeroUnoVideo();
    loadZeroUnoVideoInModal(randomVideo);

    document.getElementById('gameOverModal').classList.remove('hidden');
}

export function closeGameOverModal() {
    const modal = document.getElementById('gameOverModal');
    const iframe = document.getElementById('zeroUnoYoutubeIframe');
    iframe.src = ''; // Ferma l'audio del video alla chiusura della modale
    modal.classList.add('hidden');
}
