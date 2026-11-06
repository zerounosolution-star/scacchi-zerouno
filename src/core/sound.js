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
            Tone.context.resume();
        }
        if (!state.moveSynth) {
            state.moveSynth = new Tone.MembraneSynth({
                pitchDecay: 0.02,
                octaves: 2,
                envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 }
            }).toDestination();
            state.moveSynth.volume.value = -12;
        }
        if (type === 'move') state.moveSynth.triggerAttackRelease('C3', '32n');
        else if (type === 'capture') state.moveSynth.triggerAttackRelease('G2', '16n');
        else if (type === 'check') state.moveSynth.triggerAttackRelease('E4', '16n');
        else if (type === 'end') state.moveSynth.triggerAttackRelease('A3', '8n');
    } catch (e) {
        // Ignora errori se il browser blocca l'audio prima del primo click
    }
}
