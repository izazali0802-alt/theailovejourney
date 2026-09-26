/**
 * Ambient Sound Synthesizer via Web Audio API
 * Generates a warm, ethereal, peaceful romantic chime sound without any external file.
 */
export class AmbientAudio {
  constructor() {
    this.audioCtx = null;
    this.isPlaying = false;
    this.oscillators = [];
    this.gainNode = null;
  }

  toggle() {
    if (this.isPlaying) {
      this.stop();
    } else {
      this.play();
    }
    return this.isPlaying;
  }

  play() {
    try {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.setValueAtTime(0.001, this.audioCtx.currentTime);
      // Soft fade in over 2 seconds
      this.gainNode.gain.exponentialRampToValueAtTime(0.12, this.audioCtx.currentTime + 2);
      this.gainNode.connect(this.audioCtx.destination);

      // Warm Fmaj7 / Dm9 peaceful chord frequencies (Hz)
      const chordFrequencies = [174.61, 220.00, 261.63, 329.63, 440.00];

      chordFrequencies.forEach((freq, i) => {
        const osc = this.audioCtx.createOscillator();
        const oscGain = this.audioCtx.createGain();
        
        osc.type = i % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

        // Subtle LFO modulation for organic movement
        const lfo = this.audioCtx.createOscillator();
        lfo.frequency.setValueAtTime(0.2 + i * 0.05, this.audioCtx.currentTime);
        const lfoGain = this.audioCtx.createGain();
        lfoGain.gain.setValueAtTime(1.5, this.audioCtx.currentTime);
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start();

        oscGain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
        osc.connect(oscGain);
        oscGain.connect(this.gainNode);
        osc.start();

        this.oscillators.push(osc);
      });

      this.isPlaying = true;
    } catch (e) {
      console.warn("Audio Context playback prevented:", e);
      this.isPlaying = false;
    }
  }

  stop() {
    if (this.gainNode && this.audioCtx) {
      // Gentle fade out over 1.5 seconds
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.audioCtx.currentTime);
      this.gainNode.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + 1.5);
      setTimeout(() => {
        this.oscillators.forEach(osc => osc.stop());
        this.oscillators = [];
        this.isPlaying = false;
      }, 1500);
    } else {
      this.isPlaying = false;
    }
  }
}
