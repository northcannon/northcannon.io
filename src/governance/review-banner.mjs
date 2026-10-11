// The draft banner marks every page of a review build as pending. Enforced for `--review` and `wp4`
// outputs, which carry pending copy; production output must never carry it (checked in validate.mjs).
import { draftBanner } from './routes.mjs';

/** Every HTML document in a review output must carry the draft banner. `files` maps output names to text. */
export function reviewBannerErrors(files, { required }) {
  if (!required) return [];
  return [...files]
    .filter(([name, text]) => name.endsWith('.html') && !text.includes(draftBanner))
    .map(([name]) => `${name}: missing review banner`);
}
