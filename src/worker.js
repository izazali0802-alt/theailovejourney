/**
 * The AI Love Journey — Cloudflare Worker Router
 * Architecture: Cloudflare Workers with Static Assets, D1 Database, and R2 Media Storage
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS Configuration
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Serve API Routes
    if (path.startsWith('/api/')) {
      try {
        const response = await handleApiRequest(request, env, url, corsHeaders);
        return response;
      } catch (err) {
        console.error('API Error:', err);
        return jsonResponse({ error: err.message || 'Internal Server Error' }, 500, corsHeaders);
      }
    }

    // Static Asset Delivery via env.ASSETS
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('The AI Love Journey API', { status: 200 });
  }
};

/**
 * Handle all API routing with authentication and security enforcement
 */
async function handleApiRequest(request, env, url, corsHeaders) {
  const method = request.method;
  const subpath = url.pathname.replace(/^\/api\/?/, '');

  // 1. Auth: Verify Access Code (Viewer Login)
  if (subpath === 'auth/verify-code' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const code = (body.code || '').trim().toUpperCase();
    if (!code) {
      return jsonResponse({ success: false, message: 'Please enter an access code.' }, 400, corsHeaders);
    }

    const codeHash = await sha256(code);
    if (env.DB) {
      const stmt = env.DB.prepare('SELECT * FROM access_codes WHERE code_hash = ? AND is_active = 1');
      const row = await stmt.bind(codeHash).first();

      if (row) {
        const session = await createSession(env.DB, 'viewer', 30 * 60); // 30 minutes
        const cookieHeader = `session_token=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=1800`;
        return jsonResponse(
          { success: true, token: session.token, expiresAt: session.expiresAt, role: 'viewer' },
          200,
          { ...corsHeaders, 'Set-Cookie': cookieHeader }
        );
      }
    }
    return jsonResponse({ success: false, message: 'Invalid or revoked access code.' }, 401, corsHeaders);
  }

  // 2. Auth: Admin Login
  if (subpath === 'auth/admin-login' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const password = body.password;
    const adminPass = env.ADMIN_PASSWORD || 'love2026';

    if (password === adminPass) {
      const session = await createSession(env.DB, 'admin', 12 * 60 * 60); // 12 hours
      const cookieHeader = `session_token=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`;
      return jsonResponse(
        { success: true, token: session.token, expiresAt: session.expiresAt, role: 'admin' },
        200,
        { ...corsHeaders, 'Set-Cookie': cookieHeader }
      );
    }
    return jsonResponse({ success: false, message: 'Incorrect admin password.' }, 401, corsHeaders);
  }

  // 3. Auth: Check Current Session (Me)
  if (subpath === 'auth/me' && method === 'GET') {
    const session = await getSession(env, request, url);
    if (session) {
      return jsonResponse({ authenticated: true, role: session.role, expiresAt: session.expires_at }, 200, corsHeaders);
    }
    return jsonResponse({ authenticated: false }, 401, corsHeaders);
  }

  // 4. Auth: Logout
  if (subpath === 'auth/logout' && method === 'POST') {
    const token = extractToken(request, url);
    if (token && env.DB) {
      const tokenHash = await sha256(token);
      await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run().catch(() => {});
    }
    const clearCookie = 'session_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
    return jsonResponse({ success: true }, 200, { ...corsHeaders, 'Set-Cookie': clearCookie });
  }

  // 5. Slides: Viewer & Admin (PROTECTED ROUTE - REQUIRES SESSION)
  if (subpath === 'slides' && method === 'GET') {
    const session = await getSession(env, request, url);
    if (!session) {
      return jsonResponse(
        { error: 'Unauthorized: Private story content requires a valid viewing session code.' },
        401,
        corsHeaders
      );
    }

    if (env.DB) {
      const query = session.role === 'admin'
        ? 'SELECT * FROM slides ORDER BY order_index ASC'
        : 'SELECT * FROM slides WHERE published = 1 ORDER BY order_index ASC';
      const { results } = await env.DB.prepare(query).all();
      const slides = (results || []).map(r => ({
        id: r.id,
        orderIndex: r.order_index,
        imageUrl: r.image_url,
        textContent: r.text_content,
        published: !!r.published,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
      return jsonResponse({ slides }, 200, corsHeaders);
    }
    return jsonResponse({ slides: [] }, 200, corsHeaders);
  }

  // 6. Admin Slides: Create Slide
  if (subpath === 'admin/slides' && method === 'POST') {
    const session = await getSession(env, request, url);
    if (!session || session.role !== 'admin') {
      return jsonResponse({ error: 'Admin access required.' }, 403, corsHeaders);
    }

    const body = await request.json().catch(() => ({}));
    const id = 'slide_' + Date.now();
    const orderIndex = body.orderIndex !== undefined ? body.orderIndex : 0;
    const imageUrl = body.imageUrl || '';
    const textContent = body.textContent || '';
    const published = body.published !== undefined ? (body.published ? 1 : 0) : 1;

    if (env.DB) {
      await env.DB.prepare(
        'INSERT INTO slides (id, order_index, image_url, text_content, published) VALUES (?, ?, ?, ?, ?)'
      ).bind(id, orderIndex, imageUrl, textContent, published).run();
    }

    return jsonResponse({ success: true, slide: { id, orderIndex, imageUrl, textContent, published: !!published } }, 200, corsHeaders);
  }

  // 7. Admin Slides: Update Slide
  if (subpath.startsWith('admin/slides/') && method === 'PUT') {
    const session = await getSession(env, request, url);
    if (!session || session.role !== 'admin') {
      return jsonResponse({ error: 'Admin access required.' }, 403, corsHeaders);
    }

    const slideId = subpath.replace('admin/slides/', '');
    const body = await request.json().catch(() => ({}));

    if (env.DB) {
      await env.DB.prepare(
        'UPDATE slides SET image_url = ?, text_content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).bind(body.imageUrl, body.textContent, slideId).run();
    }

    return jsonResponse({ success: true }, 200, corsHeaders);
  }

  // 8. Admin Slides: Delete Slide
  if (subpath.startsWith('admin/slides/') && method === 'DELETE') {
    const session = await getSession(env, request, url);
    if (!session || session.role !== 'admin') {
      return jsonResponse({ error: 'Admin access required.' }, 403, corsHeaders);
    }

    const slideId = subpath.replace('admin/slides/', '');
    if (env.DB) {
      await env.DB.prepare('DELETE FROM slides WHERE id = ?').bind(slideId).run();
    }
    return jsonResponse({ success: true }, 200, corsHeaders);
  }

  // 9. Admin Slides: Reorder Slides
  if (subpath === 'admin/slides/reorder' && method === 'POST') {
    const session = await getSession(env, request, url);
    if (!session || session.role !== 'admin') {
      return jsonResponse({ error: 'Admin access required.' }, 403, corsHeaders);
    }

    const { slideIds } = await request.json().catch(() => ({ slideIds: [] }));
    if (Array.isArray(slideIds) && env.DB) {
      const statements = slideIds.map((id, index) =>
        env.DB.prepare('UPDATE slides SET order_index = ? WHERE id = ?').bind(index, id)
      );
      await env.DB.batch(statements);
    }
    return jsonResponse({ success: true }, 200, corsHeaders);
  }

  // 10. Admin Access Codes: List Codes
  if (subpath === 'admin/codes' && method === 'GET') {
    const session = await getSession(env, request, url);
    if (!session || session.role !== 'admin') {
      return jsonResponse({ error: 'Admin access required.' }, 403, corsHeaders);
    }

    if (env.DB) {
      const { results } = await env.DB.prepare(
        'SELECT id, code_display as code, created_at as createdAt, is_active as active FROM access_codes ORDER BY created_at DESC'
      ).all();
      return jsonResponse({ codes: (results || []).map(r => ({ ...r, active: !!r.active })) }, 200, corsHeaders);
    }
    return jsonResponse({ codes: [] }, 200, corsHeaders);
  }

  // 11. Admin Access Codes: Generate New Code
  if (subpath === 'admin/codes' && method === 'POST') {
    const session = await getSession(env, request, url);
    if (!session || session.role !== 'admin') {
      return jsonResponse({ error: 'Admin access required.' }, 403, corsHeaders);
    }

    const body = await request.json().catch(() => ({}));
    const codeString = (body.code || ('LOVE-' + Math.floor(1000 + Math.random() * 9000))).trim().toUpperCase();
    const codeHash = await sha256(codeString);
    const id = 'code_' + Date.now();

    if (env.DB) {
      await env.DB.prepare(
        'INSERT INTO access_codes (id, code_hash, code_display, is_active) VALUES (?, ?, ?, ?)'
      ).bind(id, codeHash, codeString, 1).run();
    }

    return jsonResponse({
      success: true,
      code: { id, code: codeString, createdAt: new Date().toISOString(), active: true }
    }, 200, corsHeaders);
  }

  // 12. Admin Access Codes: Revoke Code
  if (subpath.startsWith('admin/codes/') && subpath.endsWith('/revoke') && method === 'POST') {
    const session = await getSession(env, request, url);
    if (!session || session.role !== 'admin') {
      return jsonResponse({ error: 'Admin access required.' }, 403, corsHeaders);
    }

    const codeId = subpath.replace('admin/codes/', '').replace('/revoke', '');
    if (env.DB) {
      await env.DB.prepare('UPDATE access_codes SET is_active = 0 WHERE id = ?').bind(codeId).run();
    }
    return jsonResponse({ success: true }, 200, corsHeaders);
  }

  // 13. Photos: Upload to Cloudflare R2 (Admin Only)
  if (subpath === 'photos/upload' && method === 'POST') {
    const session = await getSession(env, request, url);
    if (!session || session.role !== 'admin') {
      return jsonResponse({ error: 'Admin access required.' }, 403, corsHeaders);
    }

    let fileBuffer;
    let contentType = 'image/jpeg';
    const reqContentType = request.headers.get('content-type') || '';

    if (reqContentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      if (!file || typeof file === 'string') {
        return jsonResponse({ error: 'No image file provided' }, 400, corsHeaders);
      }
      fileBuffer = await file.arrayBuffer();
      contentType = file.type || 'image/jpeg';
    } else {
      fileBuffer = await request.arrayBuffer();
      contentType = reqContentType || 'image/jpeg';
    }

    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const key = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    if (env.PHOTOS) {
      await env.PHOTOS.put(key, fileBuffer, {
        httpMetadata: { contentType }
      });
      return jsonResponse({ success: true, key, url: `/api/photos/${key}` }, 200, corsHeaders);
    }

    // Fallback if R2 binding is not available locally
    const base64 = bufferToBase64(fileBuffer);
    const dataUrl = `data:${contentType};base64,${base64}`;
    return jsonResponse({ success: true, key, url: dataUrl }, 200, corsHeaders);
  }

  // 14. Photos: Protected Media Stream from R2 (Viewer or Admin Only)
  if (subpath.startsWith('photos/') && method === 'GET') {
    const session = await getSession(env, request, url);
    if (!session) {
      return jsonResponse(
        { error: 'Unauthorized: Love Journey media is private and requires a valid session code.' },
        401,
        corsHeaders
      );
    }

    const key = subpath.replace('photos/', '');
    if (env.PHOTOS) {
      const object = await env.PHOTOS.get(key);
      if (!object) {
        return jsonResponse({ error: 'Photo not found' }, 404, corsHeaders);
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      headers.set('Cache-Control', 'private, max-age=1800');
      headers.set('Access-Control-Allow-Origin', '*');

      return new Response(object.body, { headers });
    }

    return jsonResponse({ error: 'R2 storage not configured' }, 404, corsHeaders);
  }

  // 404 for unknown API routes
  return jsonResponse({ error: 'API route not found' }, 404, corsHeaders);
}

/**
 * Extract token from Authorization header, Cookie, or query param
 */
function extractToken(request, url) {
  const authHeader = request.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(/session_token=([^;]+)/);
  if (match) {
    return match[1].trim();
  }

  const queryToken = url.searchParams.get('token');
  if (queryToken) {
    return queryToken.trim();
  }

  return null;
}

/**
 * Validate session against D1 Database (Enforces 30-min server expiration)
 */
async function getSession(env, request, url) {
  const token = extractToken(request, url);
  if (!token) return null;

  if (env.DB) {
    const tokenHash = await sha256(token);
    const stmt = env.DB.prepare(
      'SELECT * FROM sessions WHERE token_hash = ? AND expires_at > datetime("now")'
    );
    const session = await stmt.bind(tokenHash).first();
    return session || null;
  }
  return null;
}

/**
 * Create a session in D1 with server-side expiration timestamp
 */
async function createSession(db, role, durationSeconds) {
  const token = 'tok_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + durationSeconds * 1000).toISOString();
  const id = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

  if (db) {
    await db.prepare(
      'INSERT INTO sessions (id, token_hash, role, expires_at) VALUES (?, ?, ?, ?)'
    ).bind(id, tokenHash, role, expiresAt).run();
  }

  return { token, expiresAt, role };
}

/**
 * Helper to compute SHA-256 hash
 */
async function sha256(str) {
  const data = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Helper for JSON Responses
 */
function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

/**
 * Buffer to Base64 fallback helper
 */
function bufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
