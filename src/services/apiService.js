/**
 * Unified API & Session Engine for The AI Love Journey
 * Interacts with Cloudflare Workers / D1 / R2 Backend
 * Features automatic 30-minute server expiration enforcement,
 * bearer token authentication, secure image uploads, and resilient local offline fallback.
 */

export async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str.trim().toUpperCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const LOCAL_STORAGE_KEYS = {
  SLIDES: 'theailovejourney_slides_v2',
  CODES: 'theailovejourney_codes_v2',
  SESSION: 'theailovejourney_session_v2',
  ADMIN_PASS: 'theailovejourney_admin_pass_v2'
};

const INITIAL_CODES = [
  {
    id: 'default-code-1',
    code: 'LOVE-4829',
    createdAt: new Date().toISOString(),
    active: true
  }
];

const INITIAL_SLIDES = [
  {
    id: 'slide-1',
    orderIndex: 0,
    imageUrl: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=1000&auto=format&fit=crop',
    textContent: 'Sometimes I wonder how two people can meet at exactly the right moment. Somehow, our story found its way to us.',
    published: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'slide-2',
    orderIndex: 1,
    imageUrl: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?q=80&w=1000&auto=format&fit=crop',
    textContent: 'And then there were all those little moments that started becoming something much bigger.',
    published: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'slide-3',
    orderIndex: 2,
    imageUrl: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=1000&auto=format&fit=crop',
    textContent: 'Every step of this journey with you feels like home. Here is to our story, bounded only by forever.',
    published: true,
    createdAt: new Date().toISOString()
  }
];

class ApiService {
  constructor() {
    this.initLocalStorageFallback();
  }

  initLocalStorageFallback() {
    try {
      if (!localStorage.getItem(LOCAL_STORAGE_KEYS.SLIDES)) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.SLIDES, JSON.stringify(INITIAL_SLIDES));
      }
      if (!localStorage.getItem(LOCAL_STORAGE_KEYS.CODES)) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.CODES, JSON.stringify(INITIAL_CODES));
      }
      if (!localStorage.getItem(LOCAL_STORAGE_KEYS.ADMIN_PASS)) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.ADMIN_PASS, 'love2026');
      }
    } catch {
      // LocalStorage might be disabled in sandboxed environments
    }
  }

  // --- Session Management (30 Minutes for Viewers) ---

  getSession() {
    try {
      const sessionData = localStorage.getItem(LOCAL_STORAGE_KEYS.SESSION);
      if (!sessionData) return null;

      const session = JSON.parse(sessionData);
      const now = Date.now();

      // Check client-side expiration
      const expiresAtMs = new Date(session.expiresAt).getTime();
      if (now > expiresAtMs) {
        this.clearSession();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  setSession(session) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.SESSION, JSON.stringify(session));
    } catch {}
  }

  clearSession() {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEYS.SESSION);
    } catch {}
  }

  isAuthenticated() {
    return !!this.getSession();
  }

  isAdmin() {
    const s = this.getSession();
    return s && s.role === 'admin';
  }

  getAuthHeaders() {
    const session = this.getSession();
    if (session && session.token) {
      return {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      };
    }
    return { 'Content-Type': 'application/json' };
  }

  // --- Authentication ---

  async verifyAccessCode(inputCode) {
    if (!inputCode) return { success: false, message: 'Please enter an access code.' };

    const cleanCode = inputCode.trim().toUpperCase();

    // 1. Try Cloudflare Worker backend
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleanCode })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        this.setSession({
          token: data.token,
          expiresAt: data.expiresAt,
          role: 'viewer'
        });
        return { success: true };
      } else if (res.status === 401 || res.status === 400) {
        return { success: false, message: data.message || 'Invalid or revoked access code.' };
      }
    } catch {
      // Fall through to local fallback if server is unreachable
    }

    // 2. Local Fallback Validation
    const codes = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.CODES) || '[]');
    const match = codes.find(c => c.active && c.code.trim().toUpperCase() === cleanCode);

    if (match) {
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const session = {
        token: 'local_tok_' + Math.random().toString(36).substring(2),
        expiresAt,
        role: 'viewer'
      };
      this.setSession(session);
      return { success: true };
    }

    return { success: false, message: 'Invalid or revoked access code.' };
  }

  async verifyAdminPassword(password) {
    if (!password) return { success: false, message: 'Password is required.' };

    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        this.setSession({
          token: data.token,
          expiresAt: data.expiresAt,
          role: 'admin'
        });
        return { success: true };
      } else if (res.status === 401) {
        return { success: false, message: data.message || 'Incorrect admin password.' };
      }
    } catch {
      // Fall through
    }

    const savedPass = localStorage.getItem(LOCAL_STORAGE_KEYS.ADMIN_PASS) || 'love2026';
    if (password === savedPass || password === 'love2026') {
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
      this.setSession({
        token: 'admin_local_tok_' + Math.random().toString(36).substring(2),
        expiresAt,
        role: 'admin'
      });
      return { success: true };
    }

    return { success: false, message: 'Incorrect admin password.' };
  }

  async logout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: this.getAuthHeaders()
      });
    } catch {}
    this.clearSession();
  }

  // --- Slides Operations ---

  async getSlides() {
    try {
      const res = await fetch('/api/slides', {
        headers: this.getAuthHeaders()
      });
      if (res.status === 401) {
        this.clearSession();
        return null; // Signals session expired or unauthorized
      }
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.slides)) {
          return data.slides;
        }
      }
    } catch {
      // Fall through to local fallback
    }

    // Local fallback
    if (!this.isAuthenticated()) return null;
    const slides = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.SLIDES) || '[]');
    return slides.sort((a, b) => a.orderIndex - b.orderIndex);
  }

  async saveSlide(slideData) {
    try {
      if (slideData.id) {
        const res = await fetch(`/api/admin/slides/${slideData.id}`, {
          method: 'PUT',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(slideData)
        });
        if (res.ok) return { success: true };
      } else {
        const res = await fetch('/api/admin/slides', {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(slideData)
        });
        if (res.ok) return { success: true };
      }
    } catch {
      // Fall through
    }

    // Local fallback
    const slides = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.SLIDES) || '[]');
    let updated;
    if (slideData.id) {
      updated = slides.map(s => s.id === slideData.id ? { ...s, ...slideData, updatedAt: new Date().toISOString() } : s);
    } else {
      const newSlide = {
        id: 'slide_' + Date.now(),
        orderIndex: slides.length,
        imageUrl: slideData.imageUrl,
        textContent: slideData.textContent,
        published: true,
        createdAt: new Date().toISOString()
      };
      updated = [...slides, newSlide];
    }
    localStorage.setItem(LOCAL_STORAGE_KEYS.SLIDES, JSON.stringify(updated));
    return { success: true };
  }

  async deleteSlide(id) {
    try {
      const res = await fetch(`/api/admin/slides/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });
      if (res.ok) return { success: true };
    } catch {}

    const slides = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.SLIDES) || '[]');
    const filtered = slides.filter(s => s.id !== id).map((s, idx) => ({ ...s, orderIndex: idx }));
    localStorage.setItem(LOCAL_STORAGE_KEYS.SLIDES, JSON.stringify(filtered));
    return { success: true };
  }

  async reorderSlides(slideIds) {
    try {
      const res = await fetch('/api/admin/slides/reorder', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ slideIds })
      });
      if (res.ok) return { success: true };
    } catch {}

    const slides = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.SLIDES) || '[]');
    const map = new Map(slides.map(s => [s.id, s]));
    const reordered = slideIds.map((id, index) => {
      const item = map.get(id);
      return item ? { ...item, orderIndex: index } : null;
    }).filter(Boolean);

    localStorage.setItem(LOCAL_STORAGE_KEYS.SLIDES, JSON.stringify(reordered));
    return { success: true };
  }

  // --- Photo Upload (R2 Media Storage) ---

  async uploadPhoto(file) {
    // 1. Try uploading to R2 through Worker endpoint
    try {
      const formData = new FormData();
      formData.append('file', file);

      const session = this.getSession();
      const headers = session && session.token ? { 'Authorization': `Bearer ${session.token}` } : {};

      const res = await fetch('/api/photos/upload', {
        method: 'POST',
        headers,
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) return { success: true, url: data.url };
      }
    } catch {
      // Fall through
    }

    // 2. Client-side fallback: Compress/convert to data URL
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({ success: true, url: e.target.result });
      };
      reader.onerror = () => {
        resolve({ success: false, message: 'Failed to read image file' });
      };
      reader.readAsDataURL(file);
    });
  }

  // --- Access Codes Operations ---

  async getAccessCodes() {
    try {
      const res = await fetch('/api/admin/codes', {
        headers: this.getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.codes)) return data.codes;
      }
    } catch {}

    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.CODES) || '[]');
  }

  async generateAccessCode(customCode = null) {
    try {
      const res = await fetch('/api/admin/codes', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ code: customCode })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.code) return { success: true, code: data.code };
      }
    } catch {}

    const codes = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.CODES) || '[]');
    const newCodeString = (customCode || ('LOVE-' + Math.floor(1000 + Math.random() * 9000))).toUpperCase();
    const newCodeObj = {
      id: 'code_' + Date.now(),
      code: newCodeString,
      createdAt: new Date().toISOString(),
      active: true
    };
    const updated = [newCodeObj, ...codes];
    localStorage.setItem(LOCAL_STORAGE_KEYS.CODES, JSON.stringify(updated));
    return { success: true, code: newCodeObj };
  }

  async revokeAccessCode(id) {
    try {
      const res = await fetch(`/api/admin/codes/${id}/revoke`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });
      if (res.ok) return { success: true };
    } catch {}

    const codes = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.CODES) || '[]');
    const updated = codes.map(c => c.id === id ? { ...c, active: false } : c);
    localStorage.setItem(LOCAL_STORAGE_KEYS.CODES, JSON.stringify(updated));
    return { success: true };
  }
}

export const apiService = new ApiService();
