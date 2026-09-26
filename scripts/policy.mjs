import { parse } from 'parse5';

export const requiredHeaders = {
  'content-security-policy': "default-src 'none'; script-src 'none'; script-src-attr 'none'; style-src 'self'; style-src-attr 'none'; img-src 'self'; font-src 'self'; media-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-src 'none'; frame-ancestors 'none'; form-action 'none'; worker-src 'none'; manifest-src 'none'",
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'strict-transport-security': 'max-age=31536000',
};

// Cloudflare Pages redirects: exactly these permanent moves, so no route is silently lost or hijacked.
export const requiredRedirects = ['/founder/ /about/founder/ 301', '/founder /about/founder/ 301', '/about/ /about/company/ 301', '/about /about/company/ 301'];
export function readRedirects(text) {
  const lines = text.trim().split(/\r?\n/);
  if (JSON.stringify(lines) !== JSON.stringify(requiredRedirects)) throw new Error('Redirects do not match the reviewed policy');
  return lines.map(line => { const [from, to, status] = line.split(' '); return { from, to, status: Number(status) }; });
}

export function readHeaders(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.shift() !== '/*') throw new Error('Headers must cover all paths');
  const headers = {};
  for (const line of lines) {
    const match = /^\s+([\w-]+):\s*(.+)$/.exec(line);
    if (!match) throw new Error('Unexpected header rule');
    const key = match[1].toLowerCase();
    if (key in headers) throw new Error(`Duplicate header: ${key}`);
    headers[key] = match[2];
  }
  if (JSON.stringify(Object.entries(headers).sort()) !== JSON.stringify(Object.entries(requiredHeaders).sort())) {
    throw new Error('Security headers do not match the reviewed policy');
  }
  return headers;
}

// The founder portrait and the demo video's poster are the only permitted image content: exactly these files, with no metadata chunks.
export const allowedImages = { '/founder/max-brooks-480.webp': 'webp', '/founder/max-brooks-960.webp': 'webp', '/founder/max-brooks-480.png': 'png', '/demo/northcannon-demo-poster.webp': 'webp' };

// The product demonstration video and its captions are the only permitted media: exactly these files.
// They ship to production only once every demo video claim is founder-attested (see publication.mjs).
export const allowedMedia = { '/demo/northcannon-demo.mp4': 'mp4', '/demo/northcannon-demo.en.vtt': 'vtt' };
// The video's page copy and its transcript, one claim per spoken paragraph; the captions must speak exactly these.
export const demoTranscriptClaimIds = Array.from({ length: 14 }, (_, i) => `demo-transcript-${String(i + 1).padStart(2, '0')}`);
export const demoVideoClaimIds = ['demo-video-title', 'demo-video-lede', 'demo-video-label', 'demo-video-captions-label', 'demo-video-disclosure', 'demo-video-transcript-title', ...demoTranscriptClaimIds];
/** Output checks for the demo media: in production only with every demo video claim approved; captions must
 * speak exactly the transcript claims; video and captions ship together. `media` maps output names to bytes. */
export function demoMediaErrors(media, claims, { production }) {
  if (!media.size) return [];
  const errors = [];
  const byId = new Map(claims.map(c => [c.claim_id, c]));
  if (production && !demoVideoClaimIds.every(id => byId.get(id)?.approval_state === 'approved')) errors.push('Demo video media in production without attested claims');
  const vtt = media.get('demo/northcannon-demo.en.vtt');
  if (!vtt || !media.has('demo/northcannon-demo.mp4')) return [...errors, 'Demo video and captions must ship together'];
  errors.push(...disclosureErrors(vtt.toString('utf8'), 'demo/northcannon-demo.en.vtt'));
  if (captionText(vtt.toString('utf8')) !== demoTranscriptClaimIds.map(id => byId.get(id)?.statement).join(' ')) errors.push('Demo captions do not match the transcript claims');
  return errors;
}
export const MAX_MEDIA_BYTES = 25 * 1024 * 1024; // Cloudflare Pages' per-file limit
export function inspectMedia(buffer, kind, name) {
  if (buffer.length > MAX_MEDIA_BYTES) return [`${name}: larger than the 25 MiB per-file limit`];
  if (kind === 'mp4') {
    if (buffer.toString('latin1', 4, 8) !== 'ftyp') return [`${name}: not an MP4`];
    // Walk the box tree (never the media data): no user-data or metadata boxes (titles, comments, encoder tags).
    const containers = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'dinf', 'mvex', 'moof', 'traf']);
    const found = [];
    const walkBoxes = (start, end) => {
      for (let i = start; i + 8 <= end;) {
        let size = buffer.readUInt32BE(i);
        const type = buffer.toString('latin1', i + 4, i + 8);
        let header = 8;
        if (size === 1) { size = Number(buffer.readBigUInt64BE(i + 8)); header = 16; } else if (size === 0) size = end - i;
        if (size < header || i + size > end) { found.push('malformed'); return; }
        if (['udta', 'meta', 'ilst'].includes(type)) found.push(type);
        if (containers.has(type)) walkBoxes(i + header, i + size);
        i += size;
      }
    };
    walkBoxes(0, buffer.length);
    return found.length ? [`${name}: container metadata or malformed boxes (${found.join(', ')})`] : [];
  }
  const text = buffer.toString('utf8');
  return /^WEBVTT\n\n/.test(text) && !/<|NOTE|STYLE|REGION|::cue/.test(text) ? [] : [`${name}: captions must be plain WebVTT cues`];
}
/** The spoken words of a WebVTT file, in order, as one space-joined string. */
export function captionText(text) {
  return text.split(/\n\n+/).slice(1).map(cue => cue.split('\n').slice(1).join(' ')).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}
export function inspectImage(buffer, kind, name) {
  const errors = [];
  if (kind === 'png') {
    if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return [`${name}: not a PNG`];
    for (let i = 8; i < buffer.length; i += 12 + buffer.readUInt32BE(i)) {
      const type = buffer.toString('latin1', i + 4, i + 8);
      if (!['IHDR', 'IDAT', 'IEND'].includes(type)) errors.push(`${name}: metadata chunk ${type}`);
    }
  } else {
    if (buffer.toString('latin1', 0, 4) !== 'RIFF' || buffer.toString('latin1', 8, 12) !== 'WEBP') return [`${name}: not a WebP`];
    for (let i = 12; i < buffer.length; i += 8 + buffer.readUInt32LE(i + 4) + (buffer.readUInt32LE(i + 4) % 2)) {
      const type = buffer.toString('latin1', i, i + 4);
      if (!['VP8 ', 'VP8L'].includes(type)) errors.push(`${name}: metadata chunk ${type.trim()}`);
    }
  }
  return errors;
}

export function inspectMarkup(text, name) {
  const errors = [];
  const references = [];
  const ids = new Set();
  const prohibited = new Set(['script', 'style', 'form', 'input', 'textarea', 'select', 'button', 'iframe', 'frame', 'frameset', 'object', 'embed', 'base', 'audio', 'foreignObject', 'foreignobject', 'animate', 'set', 'animatetransform', 'animatemotion', 'template']);
  const visit = (node, parent) => {
    const tag = node.tagName?.toLowerCase();
    if (prohibited.has(tag)) errors.push(`${name}: prohibited <${tag}>`);
    const attrs = Object.fromEntries((node.attrs ?? []).map(a => [a.name, a.value]));
    // <source> is allowed only inside <picture> for the reviewed WebP portrait files.
    const portraitSource = tag === 'source' && parent?.tagName?.toLowerCase() === 'picture' && attrs.type === 'image/webp'
      && Object.keys(attrs).every(key => ['type', 'srcset', 'sizes'].includes(key))
      && (attrs.srcset ?? '').split(',').map(entry => entry.trim().split(/\s+/)[0]).every(url => allowedImages[url] === 'webp');
    if (tag === 'source' && !portraitSource) errors.push(`${name}: prohibited <source>`);
    // <video> only for the reviewed demo file: user-started (controls, no autoplay/loop/muted), its poster, and
    // <track> children that are captions for it. No other media element or attribute.
    if (tag === 'video') {
      const allowed = ['src', 'poster', 'controls', 'preload', 'width', 'height', 'playsinline', 'class', 'id', 'aria-label', 'aria-describedby'];
      if (!Object.keys(attrs).every(key => allowed.includes(key)) || !('controls' in attrs) || allowedMedia[attrs.src] !== 'mp4'
        || (attrs.poster !== undefined && allowedImages[attrs.poster] !== 'webp') || !['none', 'metadata'].includes(attrs.preload)) errors.push(`${name}: prohibited <video>`);
    }
    if (tag === 'track') {
      if (parent?.tagName?.toLowerCase() !== 'video' || attrs.kind !== 'captions' || allowedMedia[attrs.src] !== 'vtt'
        || !Object.keys(attrs).every(key => ['kind', 'src', 'srclang', 'label', 'default'].includes(key))) errors.push(`${name}: prohibited <track>`);
    }
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'style' || /^on/i.test(key) || ['srcdoc', 'ping', 'imagesrcset'].includes(key) || (key === 'srcset' && !portraitSource)) {
        errors.push(`${name}: prohibited ${key} attribute`);
      }
      if (key === 'id') {
        if (ids.has(value)) errors.push(`${name}: duplicate ID ${value}`);
        ids.add(value);
      }
      if (['src', 'href', 'action', 'data', 'poster', 'background'].includes(key)) {
        // Only local references, same-document fragments, and approved mail links.
        if (/^mailto:(hello|contact|security)@northcannon\.io(?:\?|$)/.test(value) && tag === 'a') continue;
        if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value) || /[\\\u0000-\u0020]/.test(value)) {
          errors.push(`${name}: non-local or ambiguous reference`);
        } else references.push(value);
      }
    }
    if (tag === 'meta' && attrs['http-equiv']) errors.push(`${name}: http-equiv is prohibited`);
    if (tag === 'link' && !['stylesheet', 'icon', 'canonical'].includes(attrs.rel)) errors.push(`${name}: prohibited link relation`);
    for (const child of node.childNodes ?? []) visit(child, node);
  };
  visit(parse(text));
  return { errors, references, ids };
}

export function isSecretLikeFile(basename) {
  return !basename.endsWith('.example') && /(^\.en[v](?:\.|$)|(?:secret|credential)|\.(?:pem|key|p12|pfx)$)/i.test(basename);
}

export function disclosureErrors(text, name) {
  const patterns = [
    /(?:\/Users\/|\/private\/|\/home\/)/i,
    /(?:docs\/internal|repo[_]buildout|founder[_]planning|\.en[v]\b)/i,
    /github\.com[:/]northcannon\/northcannon(?:[\s/'"#?]|$)/i,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\b(?:ghp_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16})\b/,
  ];
  return patterns.some(pattern => pattern.test(text)) ? [`${name}: prohibited disclosure pattern`] : [];
}
