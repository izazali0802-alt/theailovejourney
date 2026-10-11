import './styles/global.css';
import { SITE_CONFIG } from './config/siteConfig.js';
import { StarfieldCanvas } from './components/StarfieldCanvas.js';
import { AmbientAudio } from './components/AmbientAudio.js';
import { LoveModal } from './components/LoveModal.js';
import { AccessScreen } from './components/AccessScreen.js';
import { StoryViewer } from './components/StoryViewer.js';
import { AdminDashboard } from './components/AdminDashboard.js';
import { apiService } from './services/apiService.js';

class App {
  constructor() {
    this.appEl = document.getElementById('app');
    this.starfield = null;
    this.ambientAudio = new AmbientAudio();
    this.modal = null;
    this.currentWhisperIndex = 0;
    this.currentView = 'landing'; // 'landing' | 'access' | 'story' | 'admin'
    this.activeComponent = null;

    this.init();
  }

  init() {
    // 1. Setup Canvas Background & Glow Orbs
    const canvas = document.createElement('canvas');
    canvas.id = 'bg-canvas';
    document.body.prepend(canvas);

    const orb1 = document.createElement('div');
    orb1.className = 'ambient-glow ambient-glow-1';
    const orb2 = document.createElement('div');
    orb2.className = 'ambient-glow ambient-glow-2';
    document.body.prepend(orb2);
    document.body.prepend(orb1);

    this.starfield = new StarfieldCanvas(canvas);

    // 2. Initialize Info Modal
    this.modal = new LoveModal(document.body);

    // 3. Listen to Hash Changes
    window.addEventListener('hashchange', () => this.handleRouting());

    // 4. Initial Routing
    this.handleRouting();
  }

  handleRouting() {
    const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();

    if (hash === 'story') {
      if (apiService.isAuthenticated()) {
        this.navigateTo('story', false);
      } else {
        this.navigateTo('access', true);
      }
    } else if (hash === 'access') {
      this.navigateTo('access', false);
    } else if (hash === 'admin') {
      this.navigateTo('admin', false);
    } else {
      this.navigateTo('landing', false);
    }
  }

  navigateTo(view, updateHash = true) {
    this.currentView = view;
    if (updateHash) {
      const targetHash = view === 'landing' ? '' : `#/${view}`;
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
        return; // handleRouting will trigger
      }
    }

    // Clean up previous view component
    if (this.activeComponent && typeof this.activeComponent.destroy === 'function') {
      this.activeComponent.destroy();
      this.activeComponent = null;
    }

    this.appEl.innerHTML = '';

    switch (view) {
      case 'landing':
        this.renderLandingView();
        break;
      case 'access':
        this.renderAccessView();
        break;
      case 'story':
        this.renderStoryView();
        break;
      case 'admin':
        this.renderAdminView();
        break;
      default:
        this.renderLandingView();
    }
  }

  // --- 1. Landing View ---
  renderLandingView() {
    const landingContainer = document.createElement('div');
    landingContainer.className = 'landing-view-wrapper';

    landingContainer.innerHTML = `
      <!-- Top Navigation Header -->
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

      <!-- Center Hero Section -->
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

        <div class="landing-cta-container">
          <button class="submit-btn landing-enter-btn" id="landing-enter-code-btn">
            <span>Enter Your Code ❤️</span>
          </button>
        </div>

        <div class="whisper-box" id="whisper-box">
          <span class="whisper-text" id="whisper-text">
            "${SITE_CONFIG.whispers[0]}"
          </span>
        </div>

        <div class="touch-hint">
          Touch anywhere to send love
        </div>
      </main>

      <!-- Footer Bar -->
      <footer class="footer-bar">
        <div>
          &copy; ${new Date().getFullYear()} ${SITE_CONFIG.title}
        </div>
        <div>
          <button class="future-auth-btn" id="admin-portal-link-btn">
            🔒 Admin Portal
          </button>
        </div>
      </footer>
    `;

    this.appEl.appendChild(landingContainer);
    this.attachLandingEvents(landingContainer);
  }

  attachLandingEvents(container) {
    // 1. Audio toggle
    const audioBtn = container.querySelector('#audio-toggle-btn');
    const iconMuted = container.querySelector('#audio-icon-muted');
    const iconPlaying = container.querySelector('#audio-icon-playing');

    if (audioBtn) {
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
    }

    // 2. Info modal
    const infoBtn = container.querySelector('#info-btn');
    if (infoBtn) {
      infoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.modal.open();
      });
    }

    // 3. Enter Code button
    const enterBtn = container.querySelector('#landing-enter-code-btn');
    if (enterBtn) {
      enterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (apiService.isAuthenticated()) {
          this.navigateTo('story');
        } else {
          this.navigateTo('access');
        }
      });
    }

    // 4. Admin Portal link
    const adminLink = container.querySelector('#admin-portal-link-btn');
    if (adminLink) {
      adminLink.addEventListener('click', (e) => {
        e.stopPropagation();
        this.navigateTo('admin');
      });
    }

    // 5. Hero tap interaction & particle burst
    const heroArea = container.querySelector('#hero-click-area');
    if (heroArea) {
      heroArea.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
          this.handleLoveInteraction(e.clientX, e.clientY);
        }
      });
    }
  }

  // --- 2. Access View ---
  renderAccessView() {
    this.activeComponent = new AccessScreen(
      this.appEl,
      () => this.navigateTo('story'),
      () => this.navigateTo('admin'),
      () => this.navigateTo('landing')
    );
  }

  // --- 3. Story View ---
  renderStoryView() {
    this.activeComponent = new StoryViewer(
      this.appEl,
      () => this.navigateTo('access'),
      () => this.navigateTo('landing')
    );
  }

  // --- 4. Admin View ---
  renderAdminView() {
    this.activeComponent = new AdminDashboard(
      this.appEl,
      () => this.navigateTo('landing'),
      () => this.navigateTo('story')
    );
  }

  handleLoveInteraction(x, y) {
    const posX = x || window.innerWidth / 2;
    const posY = y || window.innerHeight / 2;
    if (this.starfield) {
      this.starfield.triggerBurst(posX, posY);
    }

    // Cycle whisper text
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

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  new App();
});
