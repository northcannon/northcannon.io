/** Test instrumentation only; inspect paint on body, descendants and pseudos. */
export async function paintedBoxes(page) {
  return page.locator('body, body *').evaluateAll(elements => {
    const failures = [];
    const forced = matchMedia('(forced-colors: active)').matches;
    const probe = document.createElement('span');
    probe.style.color = 'CanvasText';
    document.body.append(probe);
    const canvasText = getComputedStyle(probe).color;
    probe.remove();
    const transparent = color => color === 'transparent' || /(?:rgba\([^)]*,\s*0\)|\/\s*0\))$/.test(color);
    const width = document.documentElement.scrollWidth;
    const height = document.documentElement.scrollHeight;
    for (const el of elements) {
      const label = `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}`;
      // Only the full-bleed decorative lattice may carry a gradient or mask.
      const lattice = el.matches('body > .graphene, body > .graphene > img');
      if (lattice && !forced) {
        const rect = el.getBoundingClientRect();
        if (Math.abs(rect.left + scrollX) > 1 || Math.abs(rect.top + scrollY) > 1 || Math.abs(rect.width - width) > 1 || Math.abs(rect.height - height) > 1) failures.push(`${label}: bounded lattice`);
      }
      // The existing local trust mark and decorative lattice are the only images.
      if (el.matches('img, svg') && !(el.matches('.wordmark > img[src="/northcannon-mark.svg"]') || el.matches('body > .graphene > img[src="/graphene-lattice.svg"]'))) failures.push(`${label}: unapproved image`);
      for (const pseudo of [null, '::before', '::after']) {
        const s = getComputedStyle(el, pseudo);
        // Non-generated pseudos and hidden elements do not paint visible boxes.
        if (pseudo && ['none', 'normal'].includes(s.content)) continue;
        if (s.display === 'none' || s.visibility === 'hidden' || !el.checkVisibility()) continue;
        const fail = property => failures.push(`${label}${pseudo ?? ''}: ${property}`);
        // Existing primary button fill, panel surface, neutral status-label surface.
        const component = !pseudo && el.matches('.action-link--primary, .panel, .status-label');
        // The native open mobile menu owns its own translucent surface in flow.
        const menu = !pseudo && el.matches('.mobile-navigation[open] > .navigation');
        const surface = component || menu || (!pseudo && lattice);
        if (!surface && !transparent(s.backgroundColor)) fail('background-color');
        // Components never gain gradient/mask permission from their surface exception.
        if (!(lattice && !pseudo) && s.backgroundImage !== 'none') fail('background-image');
        for (const property of ['box-shadow', 'backdrop-filter', 'filter', 'border-image-source']) {
          if (s.getPropertyValue(property) !== 'none' && s.getPropertyValue(property) !== '') fail(property);
        }
        if (!(lattice && !pseudo) && s.maskImage !== 'none') fail('mask-image');
        if (s.mixBlendMode !== 'normal') fail('mix-blend-mode');
        // Exact secondary border exception: all four sides 1px solid violet;
        // text color only while :active; CanvasText only under forced colors.
        // No other property or pseudo-element is exempted by this entry.
        const secondaryBorder = !pseudo && el.matches('.action-link--secondary') && ['Top', 'Right', 'Bottom', 'Left'].every(side =>
          s[`border${side}Width`] === '1px' && s[`border${side}Style`] === 'solid' &&
          (forced ? s[`border${side}Color`] === canvasText : s[`border${side}Color`] === (el.matches(':active') ? 'rgb(247, 244, 255)' : 'rgb(156, 107, 244)')));
        for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
          // Preserve only the header bottom and footer top rule lines.
          const rule = !pseudo && ((el.matches('.site-header') && side === 'Bottom') || (el.matches('.site-footer') && side === 'Top'));
          if (!component && !menu && !secondaryBorder && !rule && parseFloat(s[`border${side}Width`]) > 0 && !['none', 'hidden'].includes(s[`border${side}Style`]) && !transparent(s[`border${side}Color`])) fail(`border-${side.toLowerCase()}`);
        }
        const visibleOutline = !['none', 'hidden'].includes(s.outlineStyle) && parseFloat(s.outlineWidth) > 0 && !transparent(s.outlineColor);
        const focusOutline = !pseudo && el.matches(':focus-visible') && s.outlineStyle === 'solid' && s.outlineWidth === '3px' && s.outlineOffset === '5px' && (forced || s.outlineColor === 'rgb(156, 107, 244)');
        if (visibleOutline && !focusOutline) fail('outline');
      }
    }
    return failures;
  });
}
