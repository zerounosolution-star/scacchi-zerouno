/**
 * L'ANNUNCIO DI BENVENUTO: UN VIDEO DEI CANALI DI CASA
 *
 * All'apertura del gioco parte un video pescato a caso dai due canali
 * (ZeroUno Solution e Agjensi Okazione), muto, dentro una carta con la
 * X ben visibile. Chiudere ferma il video: X, Esc, tocco fuori dalla
 * carta o Gioca subito.
 *
 * Non compare quando si arriva da un link d'invito (?stanza=...):
 * chi sta entrando in una partita con un amico non va fermato.
 */

import { ZEROUNO_VIDEOS, CHANNELS } from '../data/videos.js';

export function setupPromoOverlay() {
    const overlay = document.getElementById('promoOverlay');
    const closeBtn = document.getElementById('closePromoBtn');
    const iframe = document.getElementById('promoYoutubeIframe');
    if (!overlay || !closeBtn || !iframe) return;

    try {
        if (new URLSearchParams(window.location.search).has('stanza')) return;
    } catch (err) {
        // Senza URL leggibile si mostra comunque
    }

    if (ZEROUNO_VIDEOS.length === 0) return;
    const video = ZEROUNO_VIDEOS[Math.floor(Math.random() * ZEROUNO_VIDEOS.length)];
    const canale = CHANNELS[video.channel] || CHANNELS.zerouno;

    const eyebrow = document.getElementById('promoChannelEyebrow');
    if (eyebrow) eyebrow.textContent = canale.nome;

    const titleLink = document.getElementById('promoVideoLink');
    if (titleLink) {
        titleLink.href = `https://www.youtube.com/watch?v=${video.id}`;
        const span = document.getElementById('promoVideoTitle');
        if (span) span.textContent = video.title;
    }

    const subscribe = document.getElementById('promoSubscribeBtn');
    if (subscribe) subscribe.href = `${canale.url}?sub_confirmation=1`;

    // Parte da solo ma muto: niente audio a sorpresa all'apertura
    iframe.src = `https://www.youtube.com/embed/${video.id}?autoplay=1&mute=1&rel=0&playsinline=1&modestbranding=1`;
    overlay.classList.remove('hidden');

    function chiudi() {
        overlay.classList.add('hidden');
        iframe.src = ''; // ferma il video, audio compreso
        document.removeEventListener('keydown', suTasto);
    }

    function suTasto(e) {
        if (e.key === 'Escape') chiudi();
    }

    closeBtn.addEventListener('click', chiudi);
    const playBtn = document.getElementById('promoPlayBtn');
    if (playBtn) playBtn.addEventListener('click', chiudi);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) chiudi();
    });
    document.addEventListener('keydown', suTasto);
}
