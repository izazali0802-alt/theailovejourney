import { apiService } from '../services/apiService.js';

export class AccessScreen {
  constructor(container, onAuthenticated, onOpenAdmin, onBackToLanding) {
    this.container = container;
    this.onAuthenticated = onAuthenticated;
    this.onOpenAdmin = onOpenAdmin;
    this.onBackToLanding = onBackToLanding;
    this.el = null;
    this.render();
  }

  render() {
    this.el = document.createElement('div');
    this.el.className = 'access-screen-wrapper';

    this.el.innerHTML = `
      <div class="access-card">
        <div class="access-heart-icon" id="access-heart">
          <svg viewBox="0 0 100 100" width="60" height="60">
            <defs>
              <radialGradient id="accessHeartGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#FB7185" />
                <stop offset="100%" stop-color="#E11D48" />
              </radialGradient>
            </defs>
            <path d="M 50,85 C 50,85 15,60 15,35 C 15,22 25,12 38,12 C 45,12 50,17 50,17 C 50,17 55,12 62,12 C 75,12 85,22 85,35 C 85,60 50,85 50,85 Z" fill="url(#accessHeartGrad)" />
          </svg>
        </div>

        <h1 class="access-title">The AI Love Journey</h1>
        <p class="access-subtitle">A private sanctuary of personal memories & quiet warmth.</p>

        <div class="access-alert" id="access-alert" style="display: none;"></div>

        <form id="access-form" class="access-form">
          <div class="input-group">
            <label for="code-input" class="input-label">Enter Access Code</label>
            <input 
              type="text" 
              id="code-input" 
              class="code-input" 
              placeholder="e.g. LOVE-4829" 
              autocomplete="off"
              spellcheck="false"
              required 
            />
          </div>

          <button type="submit" class="submit-btn" id="submit-code-btn">
            <span>Continue ❤️</span>
          </button>
        </form>

        <div class="access-footer">
          <button type="button" class="admin-link-btn" id="landing-back-btn">
            ← Home
          </button>
          <span style="color: var(--color-text-dim); font-size: 0.8rem; margin: 0 0.5rem;">•</span>
          <button type="button" class="admin-link-btn" id="admin-login-link">
            🔒 Admin Portal
          </button>
        </div>
      </div>
    `;

    this.container.appendChild(this.el);
    this.attachEvents();
  }

  attachEvents() {
    const form = this.el.querySelector('#access-form');
    const codeInput = this.el.querySelector('#code-input');
    const alertBox = this.el.querySelector('#access-alert');
    const submitBtn = this.el.querySelector('#submit-code-btn');
    const adminBtn = this.el.querySelector('#admin-login-link');
    const backBtn = this.el.querySelector('#landing-back-btn');

    // Auto-uppercase formatting as user types
    codeInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      alertBox.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.querySelector('span').textContent = 'Verifying...';

      const code = codeInput.value.trim();
      const res = await apiService.verifyAccessCode(code);

      if (res.success) {
        this.onAuthenticated();
      } else {
        alertBox.textContent = res.message || 'Invalid or revoked access code.';
        alertBox.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.querySelector('span').textContent = 'Continue ❤️';
      }
    });

    adminBtn.addEventListener('click', () => {
      this.onOpenAdmin();
    });

    if (backBtn && this.onBackToLanding) {
      backBtn.addEventListener('click', () => {
        this.onBackToLanding();
      });
    }
  }

  destroy() {
    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
  }
}
