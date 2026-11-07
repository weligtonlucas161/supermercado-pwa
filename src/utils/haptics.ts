/**
 * Audio and Haptic feedback helper for terminal/scanner simulation.
 * Uses Web Audio API oscillator (no external audio files needed) and navigator.vibrate.
 */
export function triggerScanBeep(success = true) {
  // 1. Vibration
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      if (success) {
        navigator.vibrate([40, 30, 40]);
      } else {
        navigator.vibrate([100, 50, 100]);
      }
    } catch {
      // Ignore vibration errors
    }
  }

  // 2. Synthesized Beep
  if (typeof window !== 'undefined' && (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)) {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(success ? 1760 : 350, ctx.currentTime); // High pitch (A6) or low error pitch

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (success ? 0.09 : 0.25));

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + (success ? 0.1 : 0.28));
    } catch {
      // Audio autoplay policy might silently block until user interaction
    }
  }
}
