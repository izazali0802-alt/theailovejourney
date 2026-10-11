/**
 * Cloudflare Pages Functions adapter
 * Delegates directly to the unified Worker router
 */
import worker from '../../src/worker.js';

export async function onRequest(context) {
  const { request, env, waitUntil } = context;
  return worker.fetch(request, env, { waitUntil });
}
