// Posts a link to your Facebook Page through the Graph API.
// Needs a long-lived Page access token with pages_manage_posts permission (see README).
import { CONFIG } from './config.js';

export const facebookEnabled = () => Boolean(CONFIG.fb.pageId && CONFIG.fb.token);

/**
 * photo mode (default): posts the branded headline card as a photo, link in the caption.
 * link mode: a classic link-preview post (uses the article's og:image).
 */
export async function postToPage({ message, link, imageUrl }) {
  const photo = CONFIG.fb.postMode === 'photo' && imageUrl;
  const edge = photo ? 'photos' : 'feed';
  const url = `https://graph.facebook.com/${CONFIG.fb.graphVersion}/${CONFIG.fb.pageId}/${edge}`;
  const payload = photo
    ? { url: imageUrl, caption: `${message}\n\nRead more: ${link}`, access_token: CONFIG.fb.token }
    : { message, link, access_token: CONFIG.fb.token };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error?.message || `Facebook HTTP ${res.status}`);
  return data.post_id || data.id;
}
