'use client';
// Entry upload. Prepares everything in the browser first: big images are shrunk to WebP, and a preview
// image is made for every entry (a frame of the video, or a render of the 3D model).
import { useCallback, useRef, useState } from 'react';
import Turnstile, { TURNSTILE_KEY } from './Turnstile';

const MB = 1024 * 1024;
const LIMIT = { image: 10 * MB, model: 25 * MB, video: 25 * MB };
const ACCEPT = { image: '.png,.jpg,.jpeg,.webp', model: '.glb', video: '.mp4,.webm' };
const kindOf = (f) => (/\.glb$/i.test(f.name) ? 'model' : /^video\//.test(f.type) || /\.(mp4|webm)$/i.test(f.name) ? 'video' : /^image\/(png|jpeg|webp)$/.test(f.type) ? 'image' : null);

const canvasBlob = (canvas, q = 0.86) => new Promise((r) => canvas.toBlob(r, 'image/webp', q));
async function drawTo(source, w, h, maxW) {
  const scale = Math.min(1, maxW / w);
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
  return c;
}
async function imageParts(file) {
  const bmp = await createImageBitmap(file);
  const thumb = await canvasBlob(await drawTo(bmp, bmp.width, bmp.height, 900), 0.82);
  // keep the original when it is already small; otherwise a high-quality 2560px WebP
  const main = file.size <= 6 * MB ? file : new File([await canvasBlob(await drawTo(bmp, bmp.width, bmp.height, 2560), 0.9)], 'artwork.webp', { type: 'image/webp' });
  return { main, thumb };
}
function videoThumb(file) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.src = URL.createObjectURL(file);
    v.onloadeddata = () => (v.currentTime = Math.min(1, (v.duration || 2) / 2));
    v.onseeked = async () => resolve(await canvasBlob(await drawTo(v, v.videoWidth, v.videoHeight, 900), 0.82));
    v.onerror = () => reject(new Error('This video could not be read. Use MP4 (H.264) or WebM.'));
  });
}
async function modelThumb(file, holder) {
  await import('@google/model-viewer');
  const mv = document.createElement('model-viewer');
  mv.setAttribute('src', URL.createObjectURL(file));
  mv.setAttribute('camera-controls', '');
  mv.setAttribute('loading', 'eager'); // load now, even before the box scrolls into view
  mv.setAttribute('reveal', 'auto');
  mv.setAttribute('shadow-intensity', '1');
  mv.setAttribute('exposure', '1');
  mv.style.width = '100%';
  mv.style.height = '320px';
  holder.replaceChildren(mv);
  await new Promise((resolve, reject) => {
    mv.addEventListener('load', resolve, { once: true });
    mv.addEventListener('error', () => reject(new Error('This GLB file could not be opened.')), { once: true });
    setTimeout(() => reject(new Error('The 3D model took too long to load.')), 30000);
  });
  await new Promise((r) => setTimeout(r, 400));
  return mv.toBlob({ mimeType: 'image/webp', qualityArgument: 0.85, idealAspect: true });
}

export default function SubmitForm({ contest, onDone }) {
  const [file, setFile] = useState(null);
  const [kind, setKind] = useState(null);
  const [preview, setPreview] = useState('');
  const [parts, setParts] = useState(null);
  const [fields, setFields] = useState({ title: '', description: '', tools: '', original: false, no_ai: false, rules: false, fan_art: false });
  const [busy, setBusy] = useState('');
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState('');
  const [token, setToken] = useState('');
  const modelBox = useRef(null);
  const onToken = useCallback((t) => setToken(t), []);
  const set = (k, v) => setFields((f) => ({ ...f, [k]: v }));
  const allowed = contest.kinds || ['image'];

  async function pick(f) {
    setErr('');
    setParts(null);
    setPreview('');
    if (!f) return;
    const k = kindOf(f);
    if (!k || !allowed.includes(k)) return setErr(`This contest accepts: ${allowed.map((a) => ({ image: 'PNG/JPG/WebP images', model: 'GLB 3D models', video: 'MP4/WebM video' })[a]).join(', ')}.`);
    if (f.size > LIMIT[k] && k !== 'image') return setErr(`That file is ${(f.size / MB).toFixed(1)} MB. The limit is ${LIMIT[k] / MB} MB.`);
    setFile(f);
    setKind(k);
    setBusy('Preparing preview…');
    try {
      let p;
      if (k === 'image') p = await imageParts(f);
      else if (k === 'video') p = { main: f, thumb: await videoThumb(f) };
      else p = { main: f, thumb: await modelThumb(f, modelBox.current) };
      if (p.main.size > LIMIT[k]) throw new Error(`Still too large after compressing (${(p.main.size / MB).toFixed(1)} MB). Please export a smaller file.`);
      setParts(p);
      setPreview(URL.createObjectURL(p.thumb));
      if (!fields.title) set('title', f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 80));
    } catch (x) {
      setErr(x.message);
      setFile(null);
    }
    setBusy('');
  }

  function submit(e) {
    e.preventDefault();
    setErr('');
    if (!parts) return setErr('Please choose your file first.');
    if (TURNSTILE_KEY && !token) return setErr('Please complete the "I am human" check.');
    const fd = new FormData();
    fd.set('contest', contest.slug);
    for (const k of ['title', 'description', 'tools']) fd.set(k, fields[k]);
    for (const k of ['original', 'no_ai', 'rules', 'fan_art']) if (fields[k]) fd.set(k, 'yes');
    fd.set('file', parts.main, parts.main.name || file.name);
    fd.set('thumb', new File([parts.thumb], 'thumb.webp', { type: 'image/webp' }));
    if (token) fd.set('turnstile', token);
    // XHR (not fetch) so we can show upload progress for big 3D files
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/entries');
    xhr.upload.onprogress = (ev) => ev.lengthComputable && setProgress(Math.round((ev.loaded / ev.total) * 100));
    xhr.onload = () => {
      setBusy('');
      let data = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) onDone?.(data);
      else setErr(data.error || `Upload failed (${xhr.status}).`);
    };
    xhr.onerror = () => {
      setBusy('');
      setErr('Upload failed. Check your connection and try again.');
    };
    setBusy('Uploading…');
    setProgress(0);
    xhr.send(fd);
  }

  return (
    <form className="form submit-form" onSubmit={submit}>
      <label className="drop">
        <input type="file" accept={allowed.map((a) => ACCEPT[a]).join(',')} onChange={(e) => pick(e.target.files?.[0])} />
        <span>
          <strong>{file ? file.name : 'Choose your file'}</strong>
          <small>{allowed.map((a) => ({ image: 'PNG, JPG or WebP (big images are compressed for you)', model: 'GLB 3D model up to 25 MB', video: 'MP4 or WebM up to 25 MB' })[a]).join(' · ')}</small>
        </span>
      </label>
      <div ref={modelBox} className="model-prep" style={kind === 'model' && busy ? undefined : { position: 'absolute', left: '-9999px', width: 640 }} />
      {preview && (
        <figure className="submit-preview">
          <img src={preview} alt="Preview of your entry" />
          <figcaption>Preview used on the contest page{parts ? ` · upload size ${(parts.main.size / MB).toFixed(1)} MB` : ''}</figcaption>
        </figure>
      )}
      <label>Title<input value={fields.title} maxLength={80} onChange={(e) => set('title', e.target.value)} required /></label>
      <label>About your piece<textarea rows={4} maxLength={2000} value={fields.description} onChange={(e) => set('description', e.target.value)} placeholder="The idea, the character, how you made it" /></label>
      <label>Tools used<input value={fields.tools} maxLength={120} onChange={(e) => set('tools', e.target.value)} placeholder="e.g. Clip Studio Paint, Blender, Substance Painter" /></label>
      <fieldset className="checks">
        <label><input type="checkbox" checked={fields.original} onChange={(e) => set('original', e.target.checked)} /> This is my own original work, made by me{contest.allowFanArt ? '' : ', with original characters and settings (no fan art)'}.</label>
        <label><input type="checkbox" checked={fields.no_ai} onChange={(e) => set('no_ai', e.target.checked)} /> I did not use generative AI to create it, and I can share work-in-progress files if asked.</label>
        {contest.allowFanArt && <label><input type="checkbox" checked={fields.fan_art} onChange={(e) => set('fan_art', e.target.checked)} /> This is fan art of an existing series.</label>}
        <label><input type="checkbox" checked={fields.rules} onChange={(e) => set('rules', e.target.checked)} /> I accept the <a href="/contests/rules/" target="_blank" rel="noopener">official contest rules</a>.</label>
      </fieldset>
      <Turnstile onToken={onToken} />
      {err && <p className="form-error" role="alert">{err}</p>}
      {busy && (
        <p className="form-ok" role="status">
          {busy}
          {busy === 'Uploading…' && ` ${progress}%`}
        </p>
      )}
      <div><button className="btn" disabled={Boolean(busy) || !parts || !fields.original || !fields.no_ai || !fields.rules}>Send my entry</button></div>
      <p className="meta">Every entry is checked by a moderator before it appears (usually within a day). One entry per person per contest; you can withdraw and replace it while submissions are open.</p>
    </form>
  );
}
