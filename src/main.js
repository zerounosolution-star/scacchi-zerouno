/**
 * PUNTO DI INGRESSO DELL'APPLICAZIONE
 *
 * Collega i controlli dell'interfaccia e avvia la prima partita.
 */

import { ZEROUNO_VIDEOS } from './data/videos.js';
import { APP_ID, SITE_URL } from './config/app.config.js';
import { chess, state } from './core/state.js';
import { saveMatch, readSavedMatch, clearSavedMatch } from './core/persistence.js';
import { showToast, copyTextToClipboard } from './core/utils.js';
import { initPersistentBoardDOM, renderBoard, scrollBoardIntoView } from './ui/board.js';
import { setupTimeControlSelects } from './ui/panels.js';
import { flipBoard, alignLocalBoardNow, setupAutoFlipToggle } from './ui/orientation.js';
import { inviteLink, inviteMessage, INVITE_TEXT } from './online/invite.js';
import { setupReviewControls, exitReview } from './ui/review.js';
import { setupNotationInput } from './ui/moveinput.js';
import { setupSidePanel } from './ui/sidepanel.js';
import { setupNameEditing } from './ui/nameedit.js';
import { registerServiceWorker } from './core/update.js';
import { setupFullscreen } from './ui/fullscreen.js';
import { setupPromoOverlay } from './ui/promo.js';
import { initAnalytics } from './core/analytics.js';
import { pickRandomZeroUnoVideo, loadZeroUnoVideoInModal, triggerEndOfGame, closeGameOverModal } from './ui/gameover.js';
import { startNewAiGame, startNewLocalGame, startWorldChallengerMatch, resumeSavedMatch } from './game/modes.js';
import { initFirebase, findOrCreateWorldMatch, createOnlineRoom, joinOnlineMatchById, cleanupActiveOnlineMatch, finishOnlineMatch } from './online/firestore.js';

/**
 * Chi guarda una partita altrui non puo' ne' arrendersi ne' proporre
 * la patta: non e' la sua partita. Lo dice e si ferma.
 */
function isWatchingOnly() {
    if (state.gameMode === 'online' && state.spectator) {
        showToast('Stai solo guardando: questo tasto è per chi gioca.');
        return true;
    }
    return false;
}

export function setupEventListeners() {
    // Cambio Tema Scacchiera
    document.getElementById('boardThemeSelect').addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'classic') document.documentElement.removeAttribute('data-board-theme');
        else document.documentElement.setAttribute('data-board-theme', val);
    });

    // Toggle Suoni
    document.getElementById('soundToggleBtn').addEventListener('click', () => {
        state.soundEnabled = !state.soundEnabled;
        document.getElementById('soundOnIcon').classList.toggle('hidden', !state.soundEnabled);
        document.getElementById('soundOffIcon').classList.toggle('hidden', state.soundEnabled);
        showToast(state.soundEnabled ? "Effetti sonori attivati" : "Effetti sonori disattivati");
    });

    // Tabs Modalità di Gioco
    const tabButtons = document.querySelectorAll('.mode-tab-btn');
    const panels = {
        online: document.getElementById('tabPanelOnline'),
        ai: document.getElementById('tabPanelAi'),
        local: document.getElementById('tabPanelLocal')
    };

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.modeTab;
            // Quale modalita' e' scelta lo dice un attributo, non una
            // stringa di classi: il disegno sta nel foglio di stile.
            tabButtons.forEach(b => b.setAttribute('aria-pressed', 'false'));
            btn.setAttribute('aria-pressed', 'true');

            Object.keys(panels).forEach(k => {
                panels[k].classList.toggle('hidden', k !== target);
            });
        });
    });

    // Controlli Partita Sotto Scacchiera
    // Girare la scacchiera sta in un posto solo: src/ui/orientation.js
    document.getElementById('flipBoardBtn').addEventListener('click', flipBoard);

    document.getElementById('newGameQuickBtn').addEventListener('click', () => {
        if (state.gameMode === 'local') startNewLocalGame();
        else if (state.gameMode === 'world-challenger') startWorldChallengerMatch();
        else if (state.gameMode === 'online') findOrCreateWorldMatch();
        else startNewAiGame();
    });

    // Pulsante Annulla Mossa (Undo)
    document.getElementById('undoMoveBtn').addEventListener('click', () => {
        if (state.gameMode === 'online') {
            showToast("Impossibile annullare mosse in una stanza online con codice");
            return;
        }
        if (chess.history().length === 0) return;

        if (state.gameMode === 'ai' || state.gameMode === 'world-challenger') {
            // Annulla sia la mossa dell'AI sia quella del giocatore
            chess.undo();
            chess.undo();
        } else {
            chess.undo();
        }
        state.matchEnded = false;
        state.selectedSquare = null;
        state.legalMovesForSelected = [];
        // La mossa che si stava rivedendo potrebbe non esistere piu'
        exitReview();
        const hist = chess.history({ verbose: true });
        const last = hist[hist.length - 1];
        state.lastMoveSquares = last ? { from: last.from, to: last.to } : { from: null, to: null };
        renderBoard();
        // In due sullo stesso schermo tocca di nuovo a chi aveva mosso: la scacchiera lo segue
        alignLocalBoardNow();
        saveMatch();
        showToast("Mossa annullata");
    });

    // Pulsante Patta
    document.getElementById('drawGameBtn').addEventListener('click', async () => {
        if (isWatchingOnly()) return;
        if (state.matchEnded) {
            triggerEndOfGame('Partita Patta', 'Fine Partita');
            return;
        }
        const title = 'Partita Patta per Accordo';
        const subtitle = 'I giocatori hanno concordato la patta';
        await finishOnlineMatch(title, subtitle);
        triggerEndOfGame(title, subtitle);
    });

    // Pulsante Abbandona / Resa (Attiva subito il video di fine partita ZeroUno Solution)
    document.getElementById('resignGameBtn').addEventListener('click', async () => {
        if (isWatchingOnly()) return;
        const winnerColor = state.playerColor === 'w' ? 'Nero' : 'Bianco';
        const title = `Vittoria del ${winnerColor} per Abbandono`;
        const subtitle = 'Partita conclusa per resa';

        if (!state.matchEnded) await finishOnlineMatch(title, subtitle);
        triggerEndOfGame(title, subtitle);
    });

    /*
     * Chi sceglie come giocare dalla sala vuole vedere la scacchiera. Sul
     * telefono la sala sta sotto: senza questo si resta a guardare il
     * bottone appena premuto.
     */
    const avvia = (azione) => () => {
        azione();
        scrollBoardIntoView();
    };

    // Contro l'AI, e in due sullo stesso schermo
    document.getElementById('startAiMatchBtn').addEventListener('click', avvia(startNewAiGame));
    document.getElementById('startLocalMatchBtn').addEventListener('click', avvia(startNewLocalGame));

    /*
     * In due a distanza: una stanza privata e un link da mandare. Qui la
     * scacchiera torna in vista solo se la stanza si apre davvero (lo fa
     * firestore.js): con un codice sbagliato si resta dove si stava scrivendo.
     */
    document.getElementById('createPrivateRoomBtn').addEventListener('click', () => createOnlineRoom(true));
    document.getElementById('joinRoomByCodeBtn').addEventListener('click', () => {
        const code = document.getElementById('joinRoomCodeInput').value;
        joinOnlineMatchById(code);
    });

    // Sala mondiale
    document.getElementById('findWorldMatchBtn').addEventListener('click', avvia(findOrCreateWorldMatch));
    document.getElementById('cancelMatchmakingBtn').addEventListener('click', () => {
        cleanupActiveOnlineMatch();
        startNewAiGame();
    });
    /*
     * L'invito all'amico: un link che lo porta dentro la stanza senza
     * fargli scrivere niente. Sul telefono si apre il foglio di
     * condivisione (WhatsApp e le altre app); dove non c'e', l'invito
     * finisce negli appunti, pronto da incollare.
     */
    const shareInviteBtn = document.getElementById('shareInviteBtn');
    const puoCondividere = typeof navigator.share === 'function'
        && Boolean(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    if (!puoCondividere) shareInviteBtn.textContent = 'Copia il link';

    shareInviteBtn.addEventListener('click', async () => {
        const code = document.getElementById('waitingRoomCodeDisplay').textContent;
        const link = inviteLink(SITE_URL, code);
        if (!link) return;

        if (puoCondividere) {
            try {
                await navigator.share({ title: 'Scacchi ZeroUno', text: INVITE_TEXT, url: link });
                return;
            } catch (err) {
                // Chi chiude il foglio senza mandare non vuole altro
                if (err && err.name === 'AbortError') return;
                // Qualsiasi altro intoppo: si ripiega sugli appunti
            }
        }
        copyTextToClipboard(inviteMessage(link), 'Invito copiato: incollalo al tuo amico');
    });
    document.getElementById('copyPgnBtn').addEventListener('click', () => {
        // A zero mosse non c'e' niente da copiare: il bottone e' spento (C5)
        if (chess.history().length === 0) return;
        const pgn = `${chess.pgn()}

{Giocata su Scacchi ZeroUno: ${SITE_URL}}`;
        copyTextToClipboard(pgn, "Notazione PGN copiata negli appunti");
    });

    document.getElementById('challengeFriendBtn').addEventListener('click', () => {
        copyTextToClipboard(
            `Ti sfido a scacchi su Scacchi ZeroUno! Si gioca qui, gratis e senza registrarsi: ${SITE_URL}`,
            'Sfida copiata: incollala a chi vuoi'
        );
    });

    // Pulsanti Modale Video ZeroUno Solution
    document.getElementById('openVideoPreviewBtn').addEventListener('click', () => {
        triggerEndOfGame('Pausa Formativa ZeroUno Solution', 'Consiglio Tecnologico Selezionato');
    });
    document.getElementById('triggerEndVideoTestBtn').addEventListener('click', () => {
        triggerEndOfGame('Pausa Formativa ZeroUno Solution', 'Consiglio Tecnologico Selezionato');
    });
    document.getElementById('nextRandomVideoBtn').addEventListener('click', () => {
        const v = pickRandomZeroUnoVideo();
        loadZeroUnoVideoInModal(v);
    });
    document.getElementById('closeGameOverModalBtn').addEventListener('click', closeGameOverModal);
    document.getElementById('modalReviewBoardBtn').addEventListener('click', closeGameOverModal);
    document.getElementById('modalPlayAgainBtn').addEventListener('click', () => {
        closeGameOverModal();
        if (state.gameMode === 'local') startNewLocalGame();
        else if (state.gameMode === 'online') findOrCreateWorldMatch();
        else startNewAiGame();
    });

    // Aggiunta nuovo video YouTube di ZeroUno Solution
    }


// Avvio applicazione al caricamento della finestra
window.onload = async function () {
    initPersistentBoardDOM();
    setupEventListeners();

    setupReviewControls();
    setupTimeControlSelects();
    setupNotationInput();
    setupSidePanel();
    // Prima di riprendere una partita salvata: in due decide da che parte guardarla
    setupAutoFlipToggle();
    setupNameEditing();
    setupFullscreen();
    setupPromoOverlay();
    initAnalytics();

    // Se c'era una partita a meta', si riprende; altrimenti se ne apre una nuova
    if (!resumeSavedMatch()) {
        startNewAiGame();
    }

    registerServiceWorker();
    await initFirebase();
};
