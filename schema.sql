-- Database Schema for The AI Love Journey (Cloudflare D1)

-- 1. Slides Table
CREATE TABLE IF NOT EXISTS slides (
  id TEXT PRIMARY KEY,
  order_index INTEGER NOT NULL DEFAULT 0,
  image_url TEXT NOT NULL,
  text_content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  published INTEGER DEFAULT 1
);

-- 2. Access Codes Table
CREATE TABLE IF NOT EXISTS access_codes (
  id TEXT PRIMARY KEY,
  code_hash TEXT UNIQUE NOT NULL,
  code_display TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  is_active INTEGER DEFAULT 1
);

-- 3. Active Sessions Table (Enforces 30-min server expiration)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL
);

-- Seed Default Access Code: LOVE-4829
INSERT OR REPLACE INTO access_codes (id, code_hash, code_display, created_at, is_active)
VALUES (
  'default-code-1',
  '054c77c08def8402c1ac37c1b15449c66dd15b1ec7197883aa5d8f05aedaf05d', -- SHA-256 hash of LOVE-4829
  'LOVE-4829',
  CURRENT_TIMESTAMP,
  1
);

-- Seed Initial Demo Story Slides matching user requirements
INSERT OR IGNORE INTO slides (id, order_index, image_url, text_content, published)
VALUES 
(
  'slide-demo-1',
  0,
  'https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=1000&auto=format&fit=crop',
  'Sometimes I wonder how two people can meet at exactly the right moment. Somehow, our story found its way to us.',
  1
),
(
  'slide-demo-2',
  1,
  'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?q=80&w=1000&auto=format&fit=crop',
  'And then there were all those little moments that started becoming something much bigger.',
  1
),
(
  'slide-demo-3',
  2,
  'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=1000&auto=format&fit=crop',
  'Every step of this journey with you feels like home. Here is to our story, bounded only by forever.',
  1
);
