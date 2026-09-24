import { parse } from 'parse5';

export const requiredHeaders = {
  'content-security-policy': "default-src 'none'; script-src 'none'; script-src-attr 'none'; style-src 'self'; style-src-attr 'none'; img-src 'self'; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-src 'none'; frame-ancestors 'none'; form-action 'none'; worker-src 'none'; manifest-src 'none'",
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

// The founder portrait is the only permitted image content: exactly these files, with no metadata chunks.
export const allowedImages = { '/founder/max-brooks-480.webp': 'webp', '/founder/max-brooks-960.webp': 'webp', '/founder/max-brooks-480.png': 'png' };
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
  const prohibited = new Set(['script', 'style', 'form', 'input', 'textarea', 'select', 'button', 'iframe', 'frame', 'frameset', 'object', 'embed', 'base', 'audio', 'video', 'track', 'foreignObject', 'foreignobject', 'animate', 'set', 'animatetransform', 'animatemotion', 'template']);
  const visit = (node, parent) => {
    const tag = node.tagName?.toLowerCase();
    if (prohibited.has(tag)) errors.push(`${name}: prohibited <${tag}>`);
    const attrs = Object.fromEntries((node.attrs ?? []).map(a => [a.name, a.value]));
    // <source> is allowed only inside <picture> for the reviewed WebP portrait files.
    const portraitSource = tag === 'source' && parent?.tagName?.toLowerCase() === 'picture' && attrs.type === 'image/webp'
      && Object.keys(attrs).every(key => ['type', 'srcset', 'sizes'].includes(key))
      && (attrs.srcset ?? '').split(',').map(entry => entry.trim().split(/\s+/)[0]).every(url => allowedImages[url] === 'webp');
    if (tag === 'source' && !portraitSource) errors.push(`${name}: prohibited <source>`);
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
