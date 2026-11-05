// Uploaded files (artwork, 3D models, videos). Uses Cloudflare R2 when the bucket is bound (10 GB free),
// otherwise Workers KV (1 GB free, 25 MB per file). Bindings are added by database/setup.mjs at deploy.

export const storageReady = (env) => Boolean(env.UPLOADS || env.UPLOADS_KV);

export async function putFile(env, key, data, contentType) {
  if (env.UPLOADS) return env.UPLOADS.put(key, data, { httpMetadata: { contentType } });
  if (env.UPLOADS_KV) return env.UPLOADS_KV.put(key, data, { metadata: { contentType } });
  throw new Error('No upload storage configured');
}

export async function getFile(env, key, request) {
  if (env.UPLOADS) {
    // Range requests let videos seek (Safari needs them to play at all)
    const range = request?.headers.get('Range') ? request.headers : undefined;
    const obj = await env.UPLOADS.get(key, range ? { range } : undefined);
    if (!obj) return null;
    const out = { body: obj.body, contentType: obj.httpMetadata?.contentType || 'application/octet-stream', size: obj.size };
    if (range && obj.range) {
      const start = obj.range.offset ?? 0;
      const len = obj.range.length ?? obj.size - start;
      out.range = { start, end: start + len - 1, length: len };
    }
    return out;
  }
  if (env.UPLOADS_KV) {
    const { value, metadata } = await env.UPLOADS_KV.getWithMetadata(key, { type: 'stream' });
    return value ? { body: value, contentType: metadata?.contentType || 'application/octet-stream' } : null;
  }
  return null;
}

export async function deleteFile(env, key) {
  if (env.UPLOADS) return env.UPLOADS.delete(key);
  if (env.UPLOADS_KV) return env.UPLOADS_KV.delete(key);
}

/** Checks the first bytes, so a renamed file can't pretend to be an image. */
export function sniff(bytes) {
  const b = new Uint8Array(bytes.slice(0, 16));
  const ascii = (i, n) => String.fromCharCode(...b.slice(i, i + n));
  if (b[0] === 0x89 && ascii(1, 3) === 'PNG') return { type: 'image/png', ext: 'png', kind: 'image' };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { type: 'image/jpeg', ext: 'jpg', kind: 'image' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return { type: 'image/webp', ext: 'webp', kind: 'image' };
  if (ascii(0, 4) === 'glTF') return { type: 'model/gltf-binary', ext: 'glb', kind: 'model' };
  if (ascii(4, 4) === 'ftyp') return { type: 'video/mp4', ext: 'mp4', kind: 'video' };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { type: 'video/webm', ext: 'webm', kind: 'video' };
  return null;
}
