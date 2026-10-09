import { readFile, access } from 'node:fs/promises';
import { parse } from 'parse5';
import { fileInventory } from './publication.mjs';
import { inspectClaimOutput } from '../src/governance/output.mjs';
import { loadGovernance } from '../src/governance/registry.mjs';
import { readRoutes, routeFile } from '../src/governance/routes.mjs';
import { migratedReviewPaths } from './redesign-policy.mjs';
import { publicOutputDisclosureErrors, isSecretLikeFile } from './policy.mjs';
const { claims } = loadGovernance();
const errors = [];
const files = await fileInventory('dist');
const forbidden = /trust infrastructure|after Gate 1 runs|will be published after the run|pending independent stress testing|Gate 1 will run|\b(?:GPT-\d|Claude|OpenAI|Anthropic|NVIDIA|H100|A100)\b/i;
let pages = 0;
for (const name of files) {
  if (isSecretLikeFile(name.split('/').at(-1))) { errors.push(`${name}: forbidden filename; not read`); continue; }
  if (/\.(mp4|webm|vtt|mp3|wav)$/i.test(name) || /demo-poster/.test(name)) errors.push(`${name}: withdrawn media`);
  if (name === 'og/northcannon-default.png') errors.push('Pending OG image in production');
  if (!name.endsWith('.html')) continue;
  pages++;
  const html = await readFile('dist/'+name,'utf8');
  errors.push(...inspectClaimOutput(html,claims),...publicOutputDisclosureErrors(html,name));
  const prose=[];
  const visit=node=>{
    if(node.nodeName==='#text') prose.push(node.value);
    for(const attr of node.attrs??[]) if(['alt','aria-label','aria-description','title','content'].includes(attr.name)) prose.push(attr.value);
    for(const child of node.childNodes??[]) visit(child);
  };
  visit(parse(html));
  if(forbidden.test(prose.join(' '))) errors.push(`${name}: forbidden public copy`);
}
const reviewRoutes=readRoutes().filter(r=>!migratedReviewPaths.has(r.path));
for(const route of reviewRoutes) await access('.review-dist/'+routeFile(route));
for(const route of readRoutes().filter(r=>!r.publish)) if(files.includes(routeFile(route))) errors.push(`${route.path}: unpublished production route`);
if(errors.length) throw new Error(errors.join('\n'));
console.log(`Production sweep PASS: ${pages} HTML routes; 0 pending statements; 0 forbidden phrases or implementation identities; 0 media files; pending OG absent; unpublished routes absent.`);
console.log(`Review inventory PASS: ${reviewRoutes.length} routes plus the isolated specimen.`);
console.log(reviewRoutes.map(r=>r.path).join('\n'));
