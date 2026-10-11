import { apiService } from '../services/apiService.js';
import { AmbientAudio } from './AmbientAudio.js';

export class StoryViewer {
  constructor(container, onLogout, onHome) {
    this.container = container;
    this.onLogout = onLogout;
    this.onHome = onHome || onLogout;
    this.slides = [];
    this.currentIndex = 0;
    this.el = null;
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.sessionTimerId = null;
    this.ambientAudio = new AmbientAudio();
    this.keyHandler = null;

    this.init();
  }

  async init() {
    const fetchedSlides = await apiService.getSlides();

    if (!fetchedSlides) {
      // Session expired or unauthenticated
      this.onLogout();
      return;
    }

    this.slides = fetchedSlides;
    this.render();
    this.attachEventListeners();
    this.preloadNextSlide();
    this.startSessionExpiryMonitor();
  }

  render() {
    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }

    this.el = document.createElement('div');
    this.el.className = 'story-viewer-wrapper';

    if (this.slides.length === 0) {
      this.el.innerHTML = `
        <div class="empty-story-card">
          <h2>No story slides found</h2>
          <p>The administrator has not added any slides yet.</p>
          <button class="submit-btn" id="empty-exit-btn">Return to Sanctuary</button>
        </div>
      `;
      this.container.appendChild(this.el);
      this.el.querySelector('#empty-exit-btn').addEventListener('click', () => this.onLogout());
      return;
    }

    const currentSlide = this.slides[this.currentIndex];

    this.el.innerHTML = `
      <!-- Top Navigation Header -->
      <header class="story-header">
        <div class="brand-logo" id="viewer-brand-logo" style="cursor: pointer;" title="Back to Welcome">
          <span class="brand-spark"></span>
          The AI Love Journey
        </div>
        <div class="story-header-actions">
          <button class="icon-btn" id="viewer-audio-btn" title="Toggle Ambient Harmony" aria-label="Audio">
            <svg id="v-audio-muted" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
            <svg id="v-audio-playing" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none;">
              <path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
          </button>
          <button class="icon-btn" id="viewer-exit-btn" title="Exit Sanctuary / Lock Session" aria-label="Lock">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </button>
        </div>
      </header>

      <!-- Main Slide Viewing Stage -->
      <main class="story-stage" id="story-swipe-area">
        <div class="slide-card" id="slide-card-element">
          <div class="slide-image-container">
            <div class="image-preloader" id="img-preloader">
              <span class="spinner"></span>
            </div>
            <img 
              src="${currentSlide.imageUrl}" 
              alt="Story memory slide ${this.currentIndex + 1}" 
              class="slide-photo" 
              id="slide-photo-img" 
              loading="eager"
            />
          </div>

          <div class="slide-text-container">
            <p class="slide-text" id="slide-text-content">
              ${currentSlide.textContent}
            </p>
          </div>
        </div>
      </main>

      <!-- Bottom Control Bar -->
      <footer class="story-footer">
        <div class="nav-controls">
          <button 
            class="nav-btn prev-btn" 
            id="prev-slide-btn" 
            ${this.currentIndex === 0 ? 'style="visibility: hidden;"' : ''}
            aria-label="Previous Slide"
          >
            ← Back
          </button>

          <div class="progress-indicator">
            <span class="progress-text" id="progress-text">
              ${this.currentIndex + 1} / ${this.slides.length}
            </span>
            <div class="progress-dots" id="progress-dots">
              ${this.slides.map((_, idx) => `
                <span class="dot ${idx === this.currentIndex ? 'active' : ''}"></span>
              `).join('')}
            </div>
          </div>

          <button class="nav-btn next-btn" id="next-slide-btn" aria-label="Next Slide">
            ${this.currentIndex === this.slides.length - 1 ? 'Replay ❤️' : 'Next →'}
          </button>
        </div>
      </footer>
    `;

    this.container.appendChild(this.el);
  }

  attachEventListeners() {
    const prevBtn = this.el.querySelector('#prev-slide-btn');
    const nextBtn = this.el.querySelector('#next-slide-btn');
    const exitBtn = this.el.querySelector('#viewer-exit-btn');
    const brandLogo = this.el.querySelector('#viewer-brand-logo');
    const audioBtn = this.el.querySelector('#viewer-audio-btn');
    const swipeArea = this.el.querySelector('#story-swipe-area');
    const photoImg = this.el.querySelector('#slide-photo-img');
    const preloader = this.el.querySelector('#img-preloader');

    // Handle Image Loading State
    if (photoImg) {
      if (photoImg.complete) {
        if (preloader) preloader.style.display = 'none';
      } else {
        photoImg.addEventListener('load', () => {
          if (preloader) preloader.style.display = 'none';
        });
        photoImg.addEventListener('error', () => {
          if (preloader) preloader.style.display = 'none';
        });
      }
    }

    // Previous / Next Buttons
    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.prevSlide());
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.nextSlide());
    }

    // Lock / Exit Session
    if (exitBtn) {
      exitBtn.addEventListener('click', () => {
        apiService.logout();
        this.onLogout();
      });
    }

    if (brandLogo) {
      brandLogo.addEventListener('click', () => {
        this.onHome();
      });
    }

    // Audio toggle
    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        const isPlaying = this.ambientAudio.toggle();
        const muted = this.el.querySelector('#v-audio-muted');
        const playing = this.el.querySelector('#v-audio-playing');
        if (isPlaying) {
          audioBtn.classList.add('active');
          if (muted) muted.style.display = 'none';
          if (playing) playing.style.display = 'block';
        } else {
          audioBtn.classList.remove('active');
          if (muted) muted.style.display = 'block';
          if (playing) playing.style.display = 'none';
        }
      });
    }

    // Desktop Keyboard Arrow Navigation
    this.keyHandler = (e) => {
      if (e.key === 'ArrowLeft') {
        this.prevSlide();
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        this.nextSlide();
      }
    };
    window.addEventListener('keydown', this.keyHandler);

    // Mobile Touch Swipe Gesture Handling
    if (swipeArea) {
      swipeArea.addEventListener('touchstart', (e) => {
        this.touchStartX = e.changedTouches[0].screenX;
        this.touchStartY = e.changedTouches[0].screenY;
      }, { passive: true });

      swipeArea.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        const diffX = this.touchStartX - touchEndX;
        const diffY = this.touchStartY - touchEndY;

        // Ensure horizontal swipe is dominant and above 40px threshold
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
          if (diffX > 0) {
            // Swiped Left -> Advance to next slide
            this.nextSlide();
          } else {
            // Swiped Right -> Go to previous slide
            this.prevSlide();
          }
        }
      }, { passive: true });
    }
  }

  nextSlide() {
    if (this.currentIndex < this.slides.length - 1) {
      this.currentIndex++;
      this.updateSlideView('next');
    } else {
      // Replay from slide 1
      this.currentIndex = 0;
      this.updateSlideView('next');
    }
    this.preloadNextSlide();
  }

  prevSlide() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.updateSlideView('prev');
      this.preloadNextSlide();
    }
  }

  updateSlideView(direction = 'next') {
    const slide = this.slides[this.currentIndex];
    const card = this.el.querySelector('#slide-card-element');
    const photoImg = this.el.querySelector('#slide-photo-img');
    const textContent = this.el.querySelector('#slide-text-content');
    const prevBtn = this.el.querySelector('#prev-slide-btn');
    const nextBtn = this.el.querySelector('#next-slide-btn');
    const progressText = this.el.querySelector('#progress-text');
    const progressDots = this.el.querySelector('#progress-dots');
    const preloader = this.el.querySelector('#img-preloader');

    if (!card || !slide) return;

    // Smooth transition animation
    card.style.opacity = '0';
    card.style.transform = direction === 'next' ? 'translateX(18px) scale(0.99)' : 'translateX(-18px) scale(0.99)';

    setTimeout(() => {
      if (preloader) preloader.style.display = 'flex';
      photoImg.src = slide.imageUrl;
      textContent.textContent = slide.textContent;

      // Update Back Button: Disabled/Hidden on first slide
      if (prevBtn) {
        prevBtn.style.visibility = this.currentIndex === 0 ? 'hidden' : 'visible';
      }

      // Update Next Button: 'Replay ❤️' on last slide
      if (nextBtn) {
        nextBtn.textContent = this.currentIndex === this.slides.length - 1 ? 'Replay ❤️' : 'Next →';
      }

      // Update Progress Counter
      if (progressText) {
        progressText.textContent = `${this.currentIndex + 1} / ${this.slides.length}`;
      }

      // Update Progress Dots
      if (progressDots) {
        progressDots.innerHTML = this.slides.map((_, idx) => `
          <span class="dot ${idx === this.currentIndex ? 'active' : ''}"></span>
        `).join('');
      }

      card.style.opacity = '1';
      card.style.transform = 'translateX(0) scale(1)';
    }, 220);
  }

  preloadNextSlide() {
    const nextIdx = (this.currentIndex + 1) % this.slides.length;
    if (this.slides[nextIdx] && this.slides[nextIdx].imageUrl) {
      const img = new Image();
      img.src = this.slides[nextIdx].imageUrl;
    }
  }

  startSessionExpiryMonitor() {
    this.sessionTimerId = setInterval(() => {
      const session = apiService.getSession();
      if (!session) {
        clearInterval(this.sessionTimerId);
        this.showSessionExpiredNotice();
      }
    }, 4000);
  }

  showSessionExpiredNotice() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.innerHTML = `
      <div class="modal-card">
        <h2 class="modal-title">Session Expired</h2>
        <p class="modal-body" style="color: var(--color-text-muted); margin-bottom: 1.5rem; line-height: 1.5;">
          Your 30-minute quiet viewing session has concluded. Please enter a valid access code to continue viewing our story.
        </p>
        <button class="submit-btn" id="expired-ack-btn" style="width: 100%;">Re-enter Access Code</button>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#expired-ack-btn').addEventListener('click', () => {
      if (modal.parentNode) modal.parentNode.removeChild(modal);
      this.onLogout();
    });
  }

  destroy() {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
    }
    if (this.sessionTimerId) {
      clearInterval(this.sessionTimerId);
    }
    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
  }
}
