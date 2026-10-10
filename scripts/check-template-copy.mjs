import { parse } from '@astrojs/compiler';
import { readdir, readFile } from 'node:fs/promises';
import { legacyLabels } from '../src/governance/routes.mjs';
// Parse templates, not frontmatter or expressions. Copy supplied by expressions is checked in rendered output.
export async function templateCopyErrors(source, name) {
  const { ast } = await parse(source);
  const errors = [];
  const visit = (node, expression = false) => {
    if (node.type === 'frontmatter' || node.type === 'comment') return;
    const inExpression = expression || node.type === 'expression';
    if (node.type === 'text' && !inExpression) {
      const text = node.value.replace(/\s+/g, ' ').trim();
      if (/[\p{L}\p{N}]/u.test(text) && !legacyLabels.has(text)) errors.push(`${name}: template text: ${text}`);
    }
    for (const child of node.children ?? []) visit(child, inExpression);
  };
  visit(ast);
  return errors;
}
export async function checkTemplateCopy() {
  const errors = [];
  for (const name of await readdir('src/components', { recursive: true })) if (name.endsWith('.astro')) errors.push(...await templateCopyErrors(await readFile(`src/components/${name}`, 'utf8'), name));
  if (errors.length) throw new Error(errors.join('\n'));
}
