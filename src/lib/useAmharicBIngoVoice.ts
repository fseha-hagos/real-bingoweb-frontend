'use client';

function playDingSound() {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {}
}

export function useAmharicBingoVoice() {
  const speak = (letter: string, number: number) => {
    if (typeof window === 'undefined') return;

    // Check mute preference
    const soundEnabled = localStorage.getItem('bingo_sound_enabled') !== 'false';
    if (!soundEnabled) return;

    // 1. Play crystal clear audio chime
    playDingSound();

    // 2. Play speech synthesis voice
    if ('speechSynthesis' in window) {
      try {
        const text = `${letter} ${number}`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'am-ET';
        utterance.rate = 0.95;
        utterance.pitch = 1.05;
        utterance.volume = 1;

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('Speech synthesis unavailable:', err);
      }
    }
  };

  return { speak };
}
