/**
 * L'ANNUNCIO DI BENVENUTO
 *
 * All'apertura del gioco compare una carta coi canali di casa, chiusa
 * da una X ben visibile (o Esc, o un tocco fuori dalla carta). E' il
 * patto della piattaforma: il gioco e' gratis, la carta presenta chi
 * lo ha fatto.
 *
 * Non compare quando si arriva da un link d'invito (?stanza=...):
 * chi sta entrando in una partita con un amico non va fermato.
 */

export function setupPromoOverlay() {
    const overlay = document.getElementById('promoOverlay');
    const closeBtn = document.getElementById('closePromoBtn');
    if (!overlay || !closeBtn) return;

    try {
        if (new URLSearchParams(window.location.search).has('stanza')) return;
    } catch (err) {
        // Senza URL leggibile si mostra comunque
    }

    overlay.classList.remove('hidden');

    function chiudi() {
        overlay.classList.add('hidden');
        document.removeEventListener('keydown', suTasto);
    }

    function suTasto(e) {
        if (e.key === 'Escape') chiudi();
    }

    closeBtn.addEventListener('click', chiudi);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) chiudi();
    });
    document.addEventListener('keydown', suTasto);
}
