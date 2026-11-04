import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { classifyUrl, renderEmbed } from './embeds.js';
import { slugify } from './site.js';

marked.setOptions({ gfm: true, breaks: false });

const ALLOWED = {
  allowedTags: [
    'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'blockquote', 'a', 'img', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'br', 'hr', 'code', 'details', 'summary',
  ],
  allowedAttributes: { a: ['href', 'title', 'rel', 'target'], img: ['src', 'alt', 'title', 'loading'], h2: ['id'], h3: ['id'] },
  allowedSchemes: ['https', 'http', 'mailto'],
  transformTags: {
    a: (tag, attribs) => {
      const external = /^https?:\/\//.test(attribs.href || '');
      return { tagName: 'a', attribs: external ? { ...attribs, rel: 'noopener nofollow', target: '_blank' } : attribs };
    },
    img: (tag, attribs) => ({ tagName: 'img', attribs: { ...attribs, loading: 'lazy' } }),
  },
};

/**
 * Article markdown → safe HTML.
 *  - A YouTube / X / Instagram / TikTok / video / image URL alone on a line becomes an embed.
 *  - ## headings get ids (for the table of contents).
 *  - Split in the middle so an in-article ad fits between paragraphs.
 */
export function renderArticle(md = '', scripts = new Set()) {
  const embeds = [];
  const withTokens = String(md)
    .split(/\r?\n/)
    .map((line) => {
      const url = line.trim().replace(/^<|>$/g, '');
      if (/^https?:\/\/\S+$/.test(url) && classifyUrl(url)) {
        embeds.push(url);
        return `\n\nEMBEDTOKEN${embeds.length - 1}\n\n`;
      }
      return line;
    })
    .join('\n');

  const toc = [];
  let html = sanitizeHtml(marked.parse(withTokens), ALLOWED);
  html = html.replace(/<h2>(.*?)<\/h2>/g, (_, inner) => {
    const text = inner.replace(/<[^>]+>/g, '');
    const id = slugify(text) || `section-${toc.length + 1}`;
    toc.push({ id, text });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  html = html.replace(/<p>EMBEDTOKEN(\d+)<\/p>/g, (_, i) => renderEmbed({ url: embeds[Number(i)] }, scripts));

  const parts = html.split('</p>');
  if (parts.length < 4) return { before: html, after: '', toc, scripts };
  const mid = Math.floor(parts.length / 2);
  return { before: parts.slice(0, mid).join('</p>') + '</p>', after: parts.slice(mid).join('</p>'), toc, scripts };
}
