// Supabase Storage helpers. Files go to the public "media" bucket created by schema.sql.
import { db } from './db.js';

export const BUCKET = 'media';

export async function uploadBuffer(buffer, path, contentType) {
  const { error } = await db().storage.from(BUCKET).upload(path, buffer, { contentType, upsert: true, cacheControl: '31536000' });
  if (error) throw new Error(`Storage upload failed (${error.message}). Did you run schema.sql, which creates the "media" bucket?`);
  return db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
