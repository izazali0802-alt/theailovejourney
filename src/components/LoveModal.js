import { SITE_CONFIG } from '../config/siteConfig.js';
import { authService } from '../services/authService.js';

export class LoveModal {
  constructor(container) {
    this.container = container;
    this.modalEl = null;
    this.render();
  }

  render() {
    const isAuth = authService.isAuthenticated();

    this.modalEl = document.createElement('div');
    this.modalEl.className = 'modal-overlay';
    this.modalEl.id = 'info-modal';

    this.modalEl.innerHTML = `
      <div class="modal-card">
        <button class="modal-close" id="modal-close-btn" aria-label="Close modal">&times;</button>
        <span class="modal-tag">Version 1.0 • Lightweight Sanctuary</span>
        <h2 class="modal-title">${SITE_CONFIG.title}</h2>
        <div class="modal-body">
          <p style="margin-bottom: 0.8rem;">
            A minimal, elegant digital space created to celebrate affection, calm, and connection.
          </p>
          <p style="font-size: 0.88rem; color: var(--color-text-dim);">
            ${isAuth ? 'Welcome back, loved one.' : 'Future versions will feature private personal spaces, encrypted journals, and interactive love notes.'}
          </p>
        </div>
      </div>
    `;

    this.container.appendChild(this.modalEl);

    // Event listeners
    const closeBtn = this.modalEl.querySelector('#modal-close-btn');
    closeBtn.addEventListener('click', () => this.close());
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.close();
    });
  }

  open() {
    if (this.modalEl) {
      this.modalEl.classList.add('open');
    }
  }

  close() {
    if (this.modalEl) {
      this.modalEl.classList.remove('open');
    }
  }
}
