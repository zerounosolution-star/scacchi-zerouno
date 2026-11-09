/**
 * SCHERMO INTERO
 *
 * Un bottone nell'intestazione mette il gioco a tutto schermo e lo
 * riporta indietro. Su desktop e su Android usa l'API Fullscreen del
 * browser; su iPhone Safari quell'API per le pagine non esiste, e il
 * bottone sparisce invece di fingere: li' la strada e' installare il
 * gioco come applicazione (Condividi, Aggiungi alla schermata Home),
 * che gia' parte senza barre.
 */

export function setupFullscreen() {
    const btn = document.getElementById('fullscreenBtn');
    if (!btn) return;

    const radice = document.documentElement;
    if (!radice.requestFullscreen) {
        btn.remove();
        return;
    }

    function aggiorna() {
        const attivo = Boolean(document.fullscreenElement);
        btn.setAttribute('aria-pressed', attivo ? 'true' : 'false');
        btn.title = attivo ? 'Esci dallo schermo intero' : 'Schermo intero';
        const entra = document.getElementById('fullscreenEnterIcon');
        const esci = document.getElementById('fullscreenExitIcon');
        if (entra) entra.classList.toggle('hidden', attivo);
        if (esci) esci.classList.toggle('hidden', !attivo);
    }

    btn.addEventListener('click', () => {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        } else {
            radice.requestFullscreen().catch(() => {});
        }
    });

    document.addEventListener('fullscreenchange', aggiorna);
    aggiorna();
}
