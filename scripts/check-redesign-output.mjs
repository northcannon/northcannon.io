import { readFile, access } from 'node:fs/promises';
import { parse } from 'parse5';
import { fileInventory } from './publication.mjs';
import { inspectClaimOutput } from '../src/governance/output.mjs';
import { loadGovernance } from '../src/governance/registry.mjs';
import { readRoutes, routeFile } from '../src/governance/routes.mjs';
import { migratedReviewPaths, forbiddenCopyErrors, conceptOutputErrors } from './redesign-policy.mjs';
import { pathToFileURL } from 'node:url';
import { publicOutputDisclosureErrors, isSecretLikeFile } from './policy.mjs';
// The production half checks one built output directory; the review half needs `.review-dist` and is skipped without it.
export async function checkRedesignOutput(root = 'dist', { review = true } = {}) {
const { claims } = loadGovernance();
const errors = [];
const files = await fileInventory(root);
let pages = 0;
for (const name of files) {
  if (isSecretLikeFile(name.split('/').at(-1))) { errors.push(`${name}: forbidden filename; not read`); continue; }
  if (/\.(mp4|webm|vtt|mp3|wav)$/i.test(name) || /demo-poster/.test(name)) errors.push(`${name}: withdrawn media`);
  if (name === 'og/northcannon-default.png') errors.push('Pending OG image in production');
  if (/\.(?:html|css|json|svg|txt|xml)$/.test(name)) errors.push(...conceptOutputErrors(await readFile(root+'/'+name,'utf8'),name));
  if (!name.endsWith('.html')) continue;
  pages++;
  const html = await readFile(root+'/'+name,'utf8');
  errors.push(...inspectClaimOutput(html,claims),...publicOutputDisclosureErrors(html,name));
  const prose=[];
  const visit=node=>{
    if(node.nodeName==='#text') prose.push(node.value);
    for(const attr of node.attrs??[]) if(['alt','aria-label','aria-description','title','content'].includes(attr.name)) prose.push(attr.value);
    for(const child of node.childNodes??[]) visit(child);
  };
  visit(parse(html));
  errors.push(...forbiddenCopyErrors(prose.join(' '),name));
}
const reviewRoutes=readRoutes().filter(r=>!migratedReviewPaths.has(r.path));
const reviewPresent=review&&await access('.review-dist/index.html').then(()=>true,()=>false);
if(reviewPresent) for(const route of reviewRoutes) await access('.review-dist/'+routeFile(route));
for(const route of readRoutes().filter(r=>!r.publish)) if(files.includes(routeFile(route))) errors.push(`${route.path}: unpublished production route`);
if(errors.length) throw new Error(errors.join('\n'));
return { pages, reviewRoutes: reviewPresent ? reviewRoutes : [] };
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
const { pages, reviewRoutes } = await checkRedesignOutput();
console.log(`Production sweep PASS: ${pages} HTML routes; 0 pending statements; 0 forbidden phrases or implementation identities; 0 media files; pending OG absent; unpublished routes absent.`);
console.log(`Review inventory PASS: ${reviewRoutes.length} routes plus the isolated specimen.`);
console.log(reviewRoutes.map(r=>r.path).join('\n'));
}
