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
import { initPersistentBoardDOM, renderBoard } from './ui/board.js';
import { updatePlayerCardsUI, renderTimersUI, setupTimeControlSelects } from './ui/panels.js';
import { setupReviewControls, exitReview } from './ui/review.js';
import { setupNotationInput } from './ui/moveinput.js';
import { setupSidePanel } from './ui/sidepanel.js';
import { setupNameEditing } from './ui/nameedit.js';
import { registerServiceWorker } from './core/update.js';
import { pickRandomZeroUnoVideo, loadZeroUnoVideoInModal, triggerEndOfGame, closeGameOverModal } from './ui/gameover.js';
import { startNewAiGame, startNewLocalGame, startWorldChallengerMatch, resumeSavedMatch } from './game/modes.js';
import { initFirebase, findOrCreateWorldMatch, createOnlineRoom, joinOnlineMatchById, cleanupActiveOnlineMatch } from './online/firestore.js';

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
    document.getElementById('flipBoardBtn').addEventListener('click', () => {
        state.boardOrientation = state.boardOrientation === 'w' ? 'b' : 'w';
        const currentTopName = document.getElementById('topPlayerName').textContent;
        const currentBottomName = document.getElementById('bottomPlayerName').textContent;
        if (state.boardOrientation === 'w') {
            updatePlayerCardsUI(currentTopName, currentBottomName);
        } else {
            updatePlayerCardsUI(currentBottomName, currentTopName);
        }
        renderTimersUI();
        renderBoard();
    });

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
        saveMatch();
        showToast("Mossa annullata");
    });

    // Pulsante Patta
    document.getElementById('drawGameBtn').addEventListener('click', async () => {
        if (state.matchEnded) {
            triggerEndOfGame('Partita Patta', 'Fine Partita');
            return;
        }
        const title = 'Partita Patta per Accordo';
        const subtitle = 'I giocatori hanno concordato la patta';
        if (state.gameMode === 'online' && state.currentMatchId && state.currentUser && state.db) {
            const matchDocRef = doc(state.db, 'artifacts', APP_ID, 'public', 'data', 'chess_matches', state.currentMatchId);
            await updateDoc(matchDocRef, {
                status: 'finished',
                winnerTitle: title,
                winnerSubtitle: subtitle,
                updatedAt: Date.now()
            });
        }
        triggerEndOfGame(title, subtitle);
    });

    // Pulsante Abbandona / Resa (Attiva subito il video di fine partita ZeroUno Solution)
    document.getElementById('resignGameBtn').addEventListener('click', async () => {
        const winnerColor = state.playerColor === 'w' ? 'Nero' : 'Bianco';
        const title = `Vittoria del ${winnerColor} per Abbandono`;
        const subtitle = 'Partita conclusa per resa';

        if (state.gameMode === 'online' && state.currentMatchId && state.currentUser && state.db && !state.matchEnded) {
            try {
                const matchDocRef = doc(state.db, 'artifacts', APP_ID, 'public', 'data', 'chess_matches', state.currentMatchId);
                await updateDoc(matchDocRef, {
                    status: 'finished',
                    winnerTitle: title,
                    winnerSubtitle: subtitle,
                    updatedAt: Date.now()
                });
            } catch (e) {}
        }
        triggerEndOfGame(title, subtitle);
    });

    // Pulsanti Modalità AI & Locale
    document.getElementById('startAiMatchBtn').addEventListener('click', startNewAiGame);
    document.getElementById('startLocalMatchBtn').addEventListener('click', startNewLocalGame);

    // Pulsanti Multiplayer Online
    document.getElementById('findWorldMatchBtn').addEventListener('click', findOrCreateWorldMatch);
    document.getElementById('createPrivateRoomBtn').addEventListener('click', () => createOnlineRoom(true));
    document.getElementById('joinRoomByCodeBtn').addEventListener('click', () => {
        const code = document.getElementById('joinRoomCodeInput').value;
        joinOnlineMatchById(code);
    });
    document.getElementById('cancelMatchmakingBtn').addEventListener('click', () => {
        cleanupActiveOnlineMatch();
        startNewAiGame();
    });
    document.getElementById('instantWorldOpponentBtn').addEventListener('click', () => {
        cleanupActiveOnlineMatch();
        startWorldChallengerMatch();
    });
    document.getElementById('copyWaitingCodeBtn').addEventListener('click', () => {
        const code = document.getElementById('waitingRoomCodeDisplay').textContent;
        /*
         * Non il codice nudo: un invito pronto da incollare, con il link
         * che porta l'amico dentro la stanza senza fargli scrivere niente.
         */
        const invito = `Ti sfido a scacchi! Apri questo link ed entri subito nella mia stanza: ${SITE_URL}?stanza=${code}`;
        copyTextToClipboard(invito, 'Invito copiato: incollalo al tuo amico');
    });
    document.getElementById('copyUserIdBtn').addEventListener('click', () => {
        const uid = document.getElementById('userIdDisplay').textContent;
        copyTextToClipboard(uid, "ID Giocatore copiato negli appunti");
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
    document.getElementById('addCustomVideoBtn').addEventListener('click', () => {
        const rawUrl = document.getElementById('customVideoUrlInput').value.trim();
        const customTitle = document.getElementById('customVideoTitleInput').value.trim();
        if (!rawUrl) {
            showToast("Inserisci un URL o ID video di YouTube");
            return;
        }

        // Estrae l'ID di 11 caratteri da qualsiasi link YouTube standard, youtu.be o Shorts
        let extractedId = rawUrl;
        const match = rawUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|watch\?v=|watch\?.+&v=))([^&?\/\s]{11})/);
        if (match && match[1]) {
            extractedId = match[1];
        }

        if (extractedId.length !== 11) {
            showToast("Formato ID YouTube non riconosciuto (richiesti 11 caratteri)");
            return;
        }

        const newVideo = {
            id: extractedId,
            title: customTitle || `ZeroUno Solution — Video (${extractedId})`
        };

        ZEROUNO_VIDEOS.push(newVideo);
        document.getElementById('videoPoolCount').textContent = ZEROUNO_VIDEOS.length;
        document.getElementById('customVideoUrlInput').value = '';
        document.getElementById('customVideoTitleInput').value = '';

        loadZeroUnoVideoInModal(newVideo);
        showToast("Nuovo video aggiunto e avviato!", "gold");
    });
}


// Avvio applicazione al caricamento della finestra
window.onload = async function () {
    initPersistentBoardDOM();
    setupEventListeners();

    setupReviewControls();
    setupTimeControlSelects();
    setupNotationInput();
    setupSidePanel();
    setupNameEditing();

    // Se c'era una partita a meta', si riprende; altrimenti se ne apre una nuova
    if (!resumeSavedMatch()) {
        startNewAiGame();
    }

    registerServiceWorker();
    await initFirebase();
};
