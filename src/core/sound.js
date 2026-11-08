/**
 * SISTEMA SONORO (TONE.JS)
 *
 * Feedback sonoro discreto per mosse, catture, scacco e fine partita.
 * Tone.js e' caricato da CDN in index.html e vive su `window.Tone`.
 */

import { state } from './state.js';

export function playChessSound(type = 'move') {
    if (!state.soundEnabled || typeof Tone === 'undefined') return;
    try {
        if (Tone.context.state !== 'running') {
            /*
             * resume() e' una promessa: suonare subito significherebbe
             * suonare a contesto ancora fermo, e la prima nota della
             * partita andrebbe persa in silenzio. Si suona DOPO.
             */
            Tone.context.resume().then(() => trigger(type)).catch(() => {});
            return;
        }
        trigger(type);
    } catch (e) {
        // Browser senza audio o con l'audio bloccato: si gioca in silenzio
    }
}

/**
 * Il colpo vero e proprio.
 *
 * Note medio-alte e volume pieno: le casse dei portatili tagliano i
 * bassi, e un C3 a -12 dB era un tocco che nessuno sentiva. Il legno
 * del pezzo sta nel MembraneSynth, la differenza fra gli eventi sta
 * nell'altezza e nella forza del colpo.
 */
function trigger(type) {
    if (!state.moveSynth) {
        state.moveSynth = new Tone.MembraneSynth({
            pitchDecay: 0.03,
            octaves: 3,
            envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.08 }
        }).toDestination();
        state.moveSynth.volume.value = -4;
    }

    const now = Tone.now();
    if (type === 'move') {
        state.moveSynth.triggerAttackRelease('C4', '16n', now, 0.7);
    } else if (type === 'capture') {
        state.moveSynth.triggerAttackRelease('G3', '8n', now, 1);
    } else if (type === 'check') {
        state.moveSynth.triggerAttackRelease('E5', '16n', now, 0.9);
    } else if (type === 'end') {
        // Due note: una chiusura, non un semplice tocco
        state.moveSynth.triggerAttackRelease('C4', '16n', now, 0.9);
        state.moveSynth.triggerAttackRelease('G4', '8n', now + 0.13, 0.9);
    }
}
