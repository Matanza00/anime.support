import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { classifyUrl, renderEmbed } from './embeds.js';

marked.setOptions({ gfm: true, breaks: false });

const ALLOWED = {
  allowedTags: [
    'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'blockquote', 'a', 'img', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'br', 'hr', 'code', 'details', 'summary',
  ],
  allowedAttributes: { a: ['href', 'title', 'rel', 'target'], img: ['src', 'alt', 'title', 'loading'] },
  allowedSchemes: ['https', 'http', 'mailto'],
  transformTags: {
    a: (tag, attribs) => {
      const external = /^https?:\/\//.test(attribs.href || '');
      return {
        tagName: 'a',
        attribs: external ? { ...attribs, rel: 'noopener nofollow', target: '_blank' } : attribs,
      };
    },
    img: (tag, attribs) => ({ tagName: 'img', attribs: { ...attribs, loading: 'lazy' } }),
  },
};

/**
 * Renders article markdown to safe HTML.
 *  - A YouTube / X / Instagram / TikTok / video / image URL alone on its own line becomes an embed.
 *  - Returns { before, after } split at the middle so an in-article ad fits between paragraphs,
 *    plus the third-party embed scripts the page needs.
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

  let html = sanitizeHtml(marked.parse(withTokens), ALLOWED);
  html = html.replace(/<p>EMBEDTOKEN(\d+)<\/p>/g, (_, i) => renderEmbed({ url: embeds[Number(i)] }, scripts));

  const parts = html.split('</p>');
  if (parts.length < 4) return { before: html, after: '', scripts };
  const mid = Math.floor(parts.length / 2);
  return {
    before: parts.slice(0, mid).join('</p>') + '</p>',
    after: parts.slice(mid).join('</p>'),
    scripts,
  };
}

export function plainText(md = '') {
  return md.replace(/[#*_>`\[\]()!-]/g, '').replace(/\s+/g, ' ').trim();
}
