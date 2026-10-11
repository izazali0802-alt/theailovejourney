import worker from './src/worker.js';

// Mock D1 Database implementation using in-memory store for unit test
class MockD1 {
  constructor() {
    this.slides = [
      {
        id: 'slide-1',
        order_index: 0,
        image_url: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7',
        text_content: 'Sometimes I wonder how two people can meet at exactly the right moment. Somehow, our story found its way to us.',
        published: 1,
        created_at: new Date().toISOString()
      },
      {
        id: 'slide-2',
        order_index: 1,
        image_url: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486',
        text_content: 'And then there were all those little moments that started becoming something much bigger.',
        published: 1,
        created_at: new Date().toISOString()
      }
    ];
    this.codes = [
      {
        id: 'code-1',
        // SHA-256 of LOVE-4829
        code_hash: '054c77c08def8402c1ac37c1b15449c66dd15b1ec7197883aa5d8f05aedaf05d',
        code_display: 'LOVE-4829',
        is_active: 1,
        created_at: new Date().toISOString()
      }
    ];
    this.sessions = [];
  }

  prepare(query) {
    const self = this;
    return {
      params: [],
      bind(...args) {
        this.params = args;
        return this;
      },
      async first() {
        if (query.includes('FROM access_codes WHERE code_hash = ?')) {
          return self.codes.find(c => c.code_hash === this.params[0] && c.is_active === 1) || null;
        }
        if (query.includes('FROM sessions WHERE token_hash = ?')) {
          const now = new Date().toISOString();
          return self.sessions.find(s => s.token_hash === this.params[0] && s.expires_at > now) || null;
        }
        return null;
      },
      async all() {
        if (query.includes('FROM slides')) {
          return { results: [...self.slides].sort((a, b) => a.order_index - b.order_index) };
        }
        if (query.includes('FROM access_codes')) {
          return { results: self.codes };
        }
        return { results: [] };
      },
      async run() {
        if (query.includes('INSERT INTO sessions')) {
          self.sessions.push({
            id: this.params[0],
            token_hash: this.params[1],
            role: this.params[2],
            expires_at: this.params[3]
          });
          return { success: true };
        }
        if (query.includes('INSERT INTO slides')) {
          self.slides.push({
            id: this.params[0],
            order_index: this.params[1],
            image_url: this.params[2],
            text_content: this.params[3],
            published: this.params[4]
          });
          return { success: true };
        }
        if (query.includes('INSERT INTO access_codes')) {
          self.codes.push({
            id: this.params[0],
            code_hash: this.params[1],
            code_display: this.params[2],
            is_active: this.params[3],
            created_at: new Date().toISOString()
          });
          return { success: true };
        }
        if (query.includes('UPDATE access_codes SET is_active = 0')) {
          const item = self.codes.find(c => c.id === this.params[0]);
          if (item) item.is_active = 0;
          return { success: true };
        }
        if (query.includes('DELETE FROM slides WHERE id = ?')) {
          self.slides = self.slides.filter(s => s.id !== this.params[0]);
          return { success: true };
        }
        return { success: true };
      }
    };
  }

  async batch(statements) {
    for (const stmt of statements) {
      await stmt.run();
    }
    return [];
  }
}

// Mock R2 Bucket implementation
class MockR2 {
  constructor() {
    this.storage = new Map();
  }
  async put(key, buffer, options) {
    this.storage.set(key, { body: buffer, ...options });
    return { key };
  }
  async get(key) {
    const item = this.storage.get(key);
    if (!item) return null;
    return {
      body: item.body,
      httpEtag: 'etag_' + key,
      writeHttpMetadata(headers) {
        if (item.httpMetadata?.contentType) {
          headers.set('Content-Type', item.httpMetadata.contentType);
        }
      }
    };
  }
}

async function runTests() {
  console.log('🧪 Starting Cloudflare Worker Backend Unit Tests...\n');

  const env = {
    DB: new MockD1(),
    PHOTOS: new MockR2(),
    ADMIN_PASSWORD: 'love2026'
  };

  let viewerToken = null;
  let adminToken = null;

  // Test 1: Unauthenticated request to /api/slides (Must return 401)
  console.log('Test 1: Unauthenticated GET /api/slides');
  const res1 = await worker.fetch(new Request('http://localhost/api/slides'), env);
  console.log(`Status: ${res1.status} (Expected 401)`);
  if (res1.status !== 401) throw new Error('Test 1 Failed: Expected 401 Unauthorized');
  console.log('✓ PASS: Slides protected from unauthenticated access\n');

  // Test 2: Invalid access code
  console.log('Test 2: POST /api/auth/verify-code with INVALID code');
  const res2 = await worker.fetch(new Request('http://localhost/api/auth/verify-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'WRONG-1234' })
  }), env);
  console.log(`Status: ${res2.status} (Expected 401)`);
  if (res2.status !== 401) throw new Error('Test 2 Failed: Expected 401 for wrong code');
  console.log('✓ PASS: Wrong code rejected\n');

  // Test 3: Valid access code LOVE-4829
  console.log('Test 3: POST /api/auth/verify-code with LOVE-4829');
  const res3 = await worker.fetch(new Request('http://localhost/api/auth/verify-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'LOVE-4829' })
  }), env);
  console.log(`Status: ${res3.status} (Expected 200)`);
  const data3 = await res3.json();
  console.log('Response token:', data3.token, 'Expires:', data3.expiresAt);
  if (res3.status !== 200 || !data3.token) throw new Error('Test 3 Failed');
  viewerToken = data3.token;
  console.log('✓ PASS: Valid code creates 30-minute session\n');

  // Test 4: Authenticated GET /api/slides with viewer session
  console.log('Test 4: Authenticated GET /api/slides');
  const res4 = await worker.fetch(new Request('http://localhost/api/slides', {
    headers: { 'Authorization': `Bearer ${viewerToken}` }
  }), env);
  console.log(`Status: ${res4.status} (Expected 200)`);
  const data4 = await res4.json();
  console.log(`Slides returned: ${data4.slides.length}`);
  if (res4.status !== 200 || data4.slides.length !== 2) throw new Error('Test 4 Failed');
  console.log('✓ PASS: Viewer can access story slides\n');

  // Test 5: Admin Login
  console.log('Test 5: POST /api/auth/admin-login');
  const res5 = await worker.fetch(new Request('http://localhost/api/auth/admin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'love2026' })
  }), env);
  console.log(`Status: ${res5.status} (Expected 200)`);
  const data5 = await res5.json();
  if (res5.status !== 200 || !data5.token) throw new Error('Test 5 Failed');
  adminToken = data5.token;
  console.log('✓ PASS: Admin logged in successfully\n');

  // Test 6: Admin creates a new slide
  console.log('Test 6: POST /api/admin/slides');
  const res6 = await worker.fetch(new Request('http://localhost/api/admin/slides', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      imageUrl: 'https://example.com/test-photo.jpg',
      textContent: 'Slide 3 created by admin test.',
      orderIndex: 2
    })
  }), env);
  console.log(`Status: ${res6.status} (Expected 200)`);
  if (res6.status !== 200) throw new Error('Test 6 Failed');
  console.log('✓ PASS: Admin slide creation works\n');

  // Test 7: Admin generates a new access code
  console.log('Test 7: POST /api/admin/codes');
  const res7 = await worker.fetch(new Request('http://localhost/api/admin/codes', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ code: 'LOVE-9999' })
  }), env);
  console.log(`Status: ${res7.status} (Expected 200)`);
  const data7 = await res7.json();
  console.log('New code created:', data7.code);
  if (res7.status !== 200 || data7.code.code !== 'LOVE-9999') throw new Error('Test 7 Failed');
  console.log('✓ PASS: Admin code generation works\n');

  // Test 8: Viewer attempts to log in with newly generated code
  console.log('Test 8: POST /api/auth/verify-code with LOVE-9999');
  const res8 = await worker.fetch(new Request('http://localhost/api/auth/verify-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'LOVE-9999' })
  }), env);
  console.log(`Status: ${res8.status} (Expected 200)`);
  if (res8.status !== 200) throw new Error('Test 8 Failed');
  console.log('✓ PASS: New code validates properly\n');

  // Test 9: Admin revokes the code
  console.log('Test 9: POST /api/admin/codes/:id/revoke');
  const res9 = await worker.fetch(new Request(`http://localhost/api/admin/codes/${data7.code.id}/revoke`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  }), env);
  console.log(`Status: ${res9.status} (Expected 200)`);
  if (res9.status !== 200) throw new Error('Test 9 Failed');
  console.log('✓ PASS: Code revoked\n');

  // Test 10: Revoked code can no longer log in
  console.log('Test 10: Verify revoked code is rejected');
  const res10 = await worker.fetch(new Request('http://localhost/api/auth/verify-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'LOVE-9999' })
  }), env);
  console.log(`Status: ${res10.status} (Expected 401)`);
  if (res10.status !== 401) throw new Error('Test 10 Failed: Revoked code should be 401');
  console.log('✓ PASS: Revoked code rejected\n');

  // Test 11: Photo upload to R2
  console.log('Test 11: POST /api/photos/upload');
  const fakeImageBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
  const res11 = await worker.fetch(new Request('http://localhost/api/photos/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'image/jpeg'
    },
    body: fakeImageBytes
  }), env);
  console.log(`Status: ${res11.status} (Expected 200)`);
  const data11 = await res11.json();
  console.log('Photo uploaded key:', data11.key, 'url:', data11.url);
  if (res11.status !== 200 || !data11.key) throw new Error('Test 11 Failed');
  console.log('✓ PASS: Admin R2 photo upload succeeded\n');

  // Test 12: Private Photo Access without token (Must return 401)
  console.log('Test 12: GET /api/photos/:key without token');
  const res12 = await worker.fetch(new Request(`http://localhost${data11.url}`), env);
  console.log(`Status: ${res12.status} (Expected 401)`);
  if (res12.status !== 401) throw new Error('Test 12 Failed: Expected 401 for private photo');
  console.log('✓ PASS: Photos are strictly private and protected\n');

  // Test 13: Private Photo Access with viewer token (Must return 200)
  console.log('Test 13: GET /api/photos/:key with viewer token');
  const res13 = await worker.fetch(new Request(`http://localhost${data11.url}`, {
    headers: { 'Authorization': `Bearer ${viewerToken}` }
  }), env);
  console.log(`Status: ${res13.status} (Expected 200)`);
  if (res13.status !== 200) throw new Error('Test 13 Failed');
  console.log('✓ PASS: Authenticated viewer can stream private photo\n');

  console.log('🎉 ALL 13 BACKEND SECURITY & LOGIC TESTS PASSED WITH 100% SUCCESS!');
}

runTests().catch(err => {
  console.error('❌ Test run failed:', err);
  process.exit(1);
});
