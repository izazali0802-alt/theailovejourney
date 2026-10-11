import { apiService } from '../services/apiService.js';

export class AdminDashboard {
  constructor(container, onLogout, onPreview) {
    this.container = container;
    this.onLogout = onLogout;
    this.onPreview = onPreview;
    this.isAuthenticated = apiService.isAdmin();
    this.slides = [];
    this.codes = [];
    this.el = null;
    this.activeTab = 'slides'; // 'slides' | 'codes'

    this.init();
  }

  async init() {
    if (this.isAuthenticated) {
      await this.loadData();
    }
    this.render();
  }

  async loadData() {
    const fetchedSlides = await apiService.getSlides();
    this.slides = fetchedSlides || [];
    this.codes = await apiService.getAccessCodes();
  }

  render() {
    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }

    this.el = document.createElement('div');
    this.el.className = 'admin-wrapper';

    if (!this.isAuthenticated) {
      this.renderLoginScreen();
    } else {
      this.renderDashboardScreen();
    }

    this.container.appendChild(this.el);
  }

  renderLoginScreen() {
    this.el.innerHTML = `
      <div class="admin-login-card">
        <div class="access-heart-icon">🔒</div>
        <h1 class="access-title">Administrator Portal</h1>
        <p class="access-subtitle">Enter your password to manage love story slides and access codes.</p>

        <div class="access-alert" id="admin-alert" style="display: none;"></div>

        <form id="admin-login-form" class="access-form">
          <div class="input-group">
            <label class="input-label" for="admin-password-input">Admin Password</label>
            <input type="password" id="admin-password-input" class="code-input" placeholder="••••••••" required />
          </div>

          <button type="submit" class="submit-btn" id="admin-submit-btn">
            <span>Unlock Dashboard</span>
          </button>
        </form>

        <div class="access-footer">
          <button type="button" class="admin-link-btn" id="admin-exit-btn">← Back to Site</button>
        </div>
      </div>
    `;

    const form = this.el.querySelector('#admin-login-form');
    const alertBox = this.el.querySelector('#admin-alert');
    const exitBtn = this.el.querySelector('#admin-exit-btn');
    const submitBtn = this.el.querySelector('#admin-submit-btn');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      alertBox.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.querySelector('span').textContent = 'Authenticating...';

      const password = this.el.querySelector('#admin-password-input').value;
      const res = await apiService.verifyAdminPassword(password);

      if (res.success) {
        this.isAuthenticated = true;
        await this.loadData();
        this.render();
      } else {
        alertBox.textContent = res.message || 'Incorrect admin password.';
        alertBox.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.querySelector('span').textContent = 'Unlock Dashboard';
      }
    });

    exitBtn.addEventListener('click', () => this.onLogout());
  }

  renderDashboardScreen() {
    this.el.innerHTML = `
      <header class="admin-header">
        <div class="brand-logo">
          <span class="brand-spark"></span>
          The AI Love Journey — Admin
        </div>
        <div class="admin-header-actions">
          <button class="nav-btn-sm" id="admin-preview-btn">👁️ Preview Story</button>
          <button class="nav-btn-sm danger" id="admin-logout-btn">Logout</button>
        </div>
      </header>

      <main class="admin-container">
        <!-- Dashboard Navigation Tabs -->
        <div class="admin-tabs">
          <button class="tab-btn ${this.activeTab === 'slides' ? 'active' : ''}" id="tab-slides">
            🖼️ Story Slides (${this.slides.length})
          </button>
          <button class="tab-btn ${this.activeTab === 'codes' ? 'active' : ''}" id="tab-codes">
            🔑 Access Codes (${this.codes.length})
          </button>
        </div>

        <!-- Tab Content -->
        <div class="admin-content">
          ${this.activeTab === 'slides' ? this.renderSlidesTab() : this.renderCodesTab()}
        </div>
      </main>

      <!-- Slide Modal (Add/Edit) -->
      <div class="modal-overlay" id="slide-modal">
        <div class="modal-card">
          <button class="modal-close" id="modal-cancel-btn">&times;</button>
          <h2 class="modal-title" id="modal-form-title">Add Story Slide</h2>
          <form id="slide-editor-form" class="modal-form">
            <input type="hidden" id="edit-slide-id" />
            
            <div class="input-group">
              <label class="input-label">Upload Photo or Photo URL</label>
              <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                <input 
                  type="file" 
                  id="slide-file-input" 
                  accept="image/*" 
                  style="display: none;" 
                />
                <button type="button" class="nav-btn-sm" id="select-file-btn" style="flex: 1; padding: 0.6rem;">
                  📁 Choose Local Photo File
                </button>
              </div>
              <input 
                type="text" 
                id="slide-img-url" 
                class="modal-input" 
                placeholder="Or paste image URL (https://...)" 
                required 
              />
              <div id="image-upload-status" style="font-size: 0.8rem; color: var(--color-text-dim); display: none;"></div>
              <!-- Preview thumbnail in modal -->
              <div id="modal-thumb-preview" style="margin-top: 0.5rem; display: none;">
                <img id="modal-thumb-img" src="" alt="Preview" style="max-height: 120px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);" />
              </div>
            </div>

            <div class="input-group">
              <label class="input-label" for="slide-text-input">Story Text (2–3 sentences)</label>
              <textarea 
                id="slide-text-input" 
                class="modal-textarea" 
                rows="4" 
                placeholder="Enter 2–3 romantic, heartfelt sentences..." 
                required
              ></textarea>
            </div>

            <button type="submit" class="submit-btn" id="modal-save-btn">
              <span>Save Slide</span>
            </button>
          </form>
        </div>
      </div>
    `;

    this.attachDashboardEvents();
  }

  renderSlidesTab() {
    return `
      <div class="tab-header">
        <div>
          <h2 style="font-family: var(--font-serif); font-size: 1.5rem; color: var(--color-rose-gold);">Manage Story Slides</h2>
          <p style="font-size: 0.85rem; color: var(--color-text-muted);">Photos and heartfelt text displayed to authenticated visitors in sequence.</p>
        </div>
        <button class="submit-btn-sm" id="add-slide-btn">+ Add Slide</button>
      </div>

      <div class="slides-grid">
        ${this.slides.length === 0 ? '<p class="muted-text" style="padding: 2rem; text-align: center;">No slides in story yet. Click "+ Add Slide" to create the first slide.</p>' : ''}
        ${this.slides.map((slide, idx) => `
          <div class="slide-item-card">
            <div class="slide-item-order">#${idx + 1}</div>
            <img src="${slide.imageUrl}" alt="Thumbnail #${idx + 1}" class="slide-item-thumb" />
            <div class="slide-item-body">
              <p class="slide-item-text">${slide.textContent}</p>
            </div>
            <div class="slide-item-actions">
              <button class="action-btn" data-action="up" data-id="${slide.id}" ${idx === 0 ? 'disabled' : ''} title="Move Up">↑</button>
              <button class="action-btn" data-action="down" data-id="${slide.id}" ${idx === this.slides.length - 1 ? 'disabled' : ''} title="Move Down">↓</button>
              <button class="action-btn edit" data-action="edit" data-id="${slide.id}">Edit</button>
              <button class="action-btn danger" data-action="delete" data-id="${slide.id}">Delete</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderCodesTab() {
    return `
      <div class="tab-header">
        <div>
          <h2 style="font-family: var(--font-serif); font-size: 1.5rem; color: var(--color-rose-gold);">Manage Access Codes</h2>
          <p style="font-size: 0.85rem; color: var(--color-text-muted);">Temporary access codes granting 30-minute viewing sessions to visitors.</p>
        </div>
        <button class="submit-btn-sm" id="gen-code-btn">+ Generate Code</button>
      </div>

      <div class="codes-table-wrapper">
        <table class="codes-table">
          <thead>
            <tr>
              <th>Access Code</th>
              <th>Created Date</th>
              <th>Session Duration</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${this.codes.map(c => `
              <tr>
                <td class="code-font">${c.code}</td>
                <td>${new Date(c.createdAt).toLocaleDateString()} ${new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                <td>30 Minutes</td>
                <td><span class="badge ${c.active ? 'active' : 'revoked'}">${c.active ? 'Active' : 'Revoked'}</span></td>
                <td>
                  ${c.active ? `
                    <button class="action-btn danger" data-action="revoke-code" data-id="${c.id}">Revoke</button>
                  ` : '<span class="muted-text">Revoked</span>'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  attachDashboardEvents() {
    // Header Actions
    const logoutBtn = this.el.querySelector('#admin-logout-btn');
    const previewBtn = this.el.querySelector('#admin-preview-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await apiService.logout();
        this.onLogout();
      });
    }
    if (previewBtn) {
      previewBtn.addEventListener('click', () => this.onPreview());
    }

    // Tab Switchers
    const tabSlides = this.el.querySelector('#tab-slides');
    const tabCodes = this.el.querySelector('#tab-codes');
    if (tabSlides) tabSlides.addEventListener('click', () => { this.activeTab = 'slides'; this.render(); });
    if (tabCodes) tabCodes.addEventListener('click', () => { this.activeTab = 'codes'; this.render(); });

    // Slide Modal Controls
    const addSlideBtn = this.el.querySelector('#add-slide-btn');
    const slideModal = this.el.querySelector('#slide-modal');
    const modalCancel = this.el.querySelector('#modal-cancel-btn');
    const slideForm = this.el.querySelector('#slide-editor-form');
    const imgUrlInput = this.el.querySelector('#slide-img-url');
    const fileInput = this.el.querySelector('#slide-file-input');
    const selectFileBtn = this.el.querySelector('#select-file-btn');
    const uploadStatus = this.el.querySelector('#image-upload-status');
    const thumbPreview = this.el.querySelector('#modal-thumb-preview');
    const thumbImg = this.el.querySelector('#modal-thumb-img');

    if (addSlideBtn) {
      addSlideBtn.addEventListener('click', () => {
        this.el.querySelector('#modal-form-title').textContent = 'Add Story Slide';
        this.el.querySelector('#edit-slide-id').value = '';
        imgUrlInput.value = '';
        this.el.querySelector('#slide-text-input').value = '';
        if (thumbPreview) thumbPreview.style.display = 'none';
        slideModal.classList.add('open');
      });
    }

    if (modalCancel) {
      modalCancel.addEventListener('click', () => slideModal.classList.remove('open'));
    }

    // Photo File Selection & Upload (R2 Media / Fallback)
    if (selectFileBtn && fileInput) {
      selectFileBtn.addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        uploadStatus.style.display = 'block';
        uploadStatus.textContent = 'Uploading photo...';

        const result = await apiService.uploadPhoto(file);
        if (result.success && result.url) {
          imgUrlInput.value = result.url;
          uploadStatus.textContent = 'Photo uploaded successfully!';
          if (thumbPreview && thumbImg) {
            thumbImg.src = result.url;
            thumbPreview.style.display = 'block';
          }
        } else {
          uploadStatus.textContent = result.message || 'Upload failed.';
        }
      });
    }

    // Preview URL on typing
    if (imgUrlInput) {
      imgUrlInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (val && thumbPreview && thumbImg) {
          thumbImg.src = val;
          thumbPreview.style.display = 'block';
        } else if (thumbPreview) {
          thumbPreview.style.display = 'none';
        }
      });
    }

    // Slide Editor Form Submit
    if (slideForm) {
      slideForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = this.el.querySelector('#modal-save-btn');
        saveBtn.disabled = true;
        saveBtn.querySelector('span').textContent = 'Saving...';

        const id = this.el.querySelector('#edit-slide-id').value;
        const imageUrl = imgUrlInput.value.trim();
        const textContent = this.el.querySelector('#slide-text-input').value.trim();

        await apiService.saveSlide({ id, imageUrl, textContent });
        slideModal.classList.remove('open');
        await this.loadData();
        this.render();
      });
    }

    // Slide Action Delegate (up, down, edit, delete, revoke-code)
    this.el.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === 'up' || action === 'down') {
        const idx = this.slides.findIndex(s => s.id === id);
        if (idx !== -1) {
          const targetIdx = action === 'up' ? idx - 1 : idx + 1;
          if (targetIdx >= 0 && targetIdx < this.slides.length) {
            const temp = this.slides[idx];
            this.slides[idx] = this.slides[targetIdx];
            this.slides[targetIdx] = temp;
            await apiService.reorderSlides(this.slides.map(s => s.id));
            await this.loadData();
            this.render();
          }
        }
      } else if (action === 'edit') {
        const slide = this.slides.find(s => s.id === id);
        if (slide) {
          this.el.querySelector('#modal-form-title').textContent = 'Edit Story Slide';
          this.el.querySelector('#edit-slide-id').value = slide.id;
          imgUrlInput.value = slide.imageUrl;
          this.el.querySelector('#slide-text-input').value = slide.textContent;
          if (thumbPreview && thumbImg) {
            thumbImg.src = slide.imageUrl;
            thumbPreview.style.display = 'block';
          }
          slideModal.classList.add('open');
        }
      } else if (action === 'delete') {
        if (confirm('Delete this story slide?')) {
          await apiService.deleteSlide(id);
          await this.loadData();
          this.render();
        }
      } else if (action === 'revoke-code') {
        if (confirm('Revoke this access code? Visitors will no longer be able to log in with it.')) {
          await apiService.revokeAccessCode(id);
          await this.loadData();
          this.render();
        }
      }
    });

    // Generate Code Button
    const genCodeBtn = this.el.querySelector('#gen-code-btn');
    if (genCodeBtn) {
      genCodeBtn.addEventListener('click', async () => {
        const custom = prompt('Enter custom code or leave empty to auto-generate (e.g. LOVE-8492):');
        await apiService.generateAccessCode(custom ? custom.trim() : null);
        await this.loadData();
        this.render();
      });
    }
  }

  destroy() {
    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
  }
}
