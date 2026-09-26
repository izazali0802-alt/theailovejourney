import './styles/global.css';
import { SITE_CONFIG } from './config/siteConfig.js';
import { StarfieldCanvas } from './components/StarfieldCanvas.js';
import { AmbientAudio } from './components/AmbientAudio.js';
import { LoveModal } from './components/LoveModal.js';
import { authService } from './services/authService.js';

class App {
  constructor() {
    this.appEl = document.getElementById('app');
    this.starfield = null;
    this.ambientAudio = new AmbientAudio();
    this.modal = null;
    this.currentWhisperIndex = 0;

    this.init();
  }

  init() {
    // 1. Setup Canvas Background
    const canvas = document.createElement('canvas');
    canvas.id = 'bg-canvas';
    document.body.prepend(canvas);

    // Glow Orbs
    const orb1 = document.createElement('div');
    orb1.className = 'ambient-glow ambient-glow-1';
    const orb2 = document.createElement('div');
    orb2.className = 'ambient-glow ambient-glow-2';
    document.body.prepend(orb2);
    document.body.prepend(orb1);

    this.starfield = new StarfieldCanvas(canvas);

    // 2. Render Main Application UI
    this.renderUI();

    // 3. Initialize Modal
    this.modal = new LoveModal(document.body);

    // 4. Attach Interactions
    this.attachEvents();
  }

  renderUI() {
    this.appEl.innerHTML = `
      <!-- Top Header Navigation -->
      <header class="header-bar">
        <div class="brand-logo" id="brand-home">
          <span class="brand-spark"></span>
          ${SITE_CONFIG.title}
        </div>
        <div class="header-actions">
          <button class="icon-btn" id="audio-toggle-btn" title="Toggle Ambient Harmony" aria-label="Toggle sound">
            <svg id="audio-icon-muted" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 5L6 9H2v6h4l5 4V5z"/>
              <line x1="23" y1="9" x2="17" y2="15"/>
              <line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
            <svg id="audio-icon-playing" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none;">
              <path d="M11 5L6 9H2v6h4l5 4V5z"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
          </button>
          <button class="icon-btn" id="info-btn" title="About The AI Love Journey" aria-label="Information">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </button>
        </div>
      </header>

      <!-- Center Hero Message (Primary Focus) -->
      <main class="hero-container" id="hero-click-area">
        <div class="heart-wrapper">
          <div class="heart-pulse-ring"></div>
          <svg class="heart-icon-svg" viewBox="0 0 100 100">
            <defs>
              <radialGradient id="mainHeartGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#FB7185" />
                <stop offset="100%" stop-color="#E11D48" />
              </radialGradient>
            </defs>
            <path d="M 50,85 C 50,85 15,60 15,35 C 15,22 25,12 38,12 C 45,12 50,17 50,17 C 50,17 55,12 62,12 C 75,12 85,22 85,35 C 85,60 50,85 50,85 Z" fill="url(#mainHeartGrad)" />
          </svg>
        </div>

        <h1 class="main-title">
          ${SITE_CONFIG.primaryMessage}
        </h1>

        <p class="subtitle">
          ${SITE_CONFIG.subtitle}
        </p>

        <div class="whisper-box" id="whisper-box">
          <span class="whisper-text" id="whisper-text">
            "${SITE_CONFIG.whispers[0]}"
          </span>
        </div>

        <div class="touch-hint">
          Touch screen to send love
        </div>
      </main>

      <!-- Footer Section -->
      <footer class="footer-bar">
        <div>
          &copy; ${new Date().getFullYear()} ${SITE_CONFIG.title}
        </div>
        <div>
          <button class="future-auth-btn" id="future-auth-btn">
            ${authService.isAuthenticated() ? 'My Area' : 'Member Portal (V2)'}
          </button>
        </div>
      </footer>
    `;
  }

  attachEvents() {
    // 1. Audio toggle
    const audioBtn = document.getElementById('audio-toggle-btn');
    const iconMuted = document.getElementById('audio-icon-muted');
    const iconPlaying = document.getElementById('audio-icon-playing');

    audioBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isPlaying = this.ambientAudio.toggle();
      if (isPlaying) {
        audioBtn.classList.add('active');
        iconMuted.style.display = 'none';
        iconPlaying.style.display = 'block';
      } else {
        audioBtn.classList.remove('active');
        iconMuted.style.display = 'block';
        iconPlaying.style.display = 'none';
      }
    });

    // 2. Info modal trigger
    const infoBtn = document.getElementById('info-btn');
    infoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.modal.open();
    });

    // 3. Member portal (Future V2 preview button)
    const futureAuthBtn = document.getElementById('future-auth-btn');
    futureAuthBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.modal.open();
    });

    // 4. Hero click / tap interaction
    const heroArea = document.getElementById('hero-click-area');
    heroArea.addEventListener('click', (e) => {
      this.handleLoveInteraction(e.clientX, e.clientY);
    });

    // Tap anywhere on document (excluding buttons)
    document.addEventListener('click', (e) => {
      if (!e.target.closest('button') && !e.target.closest('.modal-card')) {
        this.handleLoveInteraction(e.clientX, e.clientY);
      }
    });
  }

  handleLoveInteraction(x, y) {
    // Trigger particle burst at touch/click location
    const posX = x || window.innerWidth / 2;
    const posY = y || window.innerHeight / 2;
    this.starfield.triggerBurst(posX, posY);

    // Rotate whisper thought
    this.currentWhisperIndex = (this.currentWhisperIndex + 1) % SITE_CONFIG.whispers.length;
    const whisperEl = document.getElementById('whisper-text');
    if (whisperEl) {
      whisperEl.style.opacity = '0';
      setTimeout(() => {
        whisperEl.textContent = `"${SITE_CONFIG.whispers[this.currentWhisperIndex]}"`;
        whisperEl.style.opacity = '1';
      }, 200);
    }
  }
}

// Instantiate application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new App();
});
