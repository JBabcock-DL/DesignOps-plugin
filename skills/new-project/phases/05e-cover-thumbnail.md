# Phase 05e — Thumbnail page cover

## Runtime order
Runs **after** Phase 05d.

## Goal
Draw a sleek, modern `Cover` frame on the `Thumbnail` page: a near-black canvas with two soft colored glows, a refined typographic title, and minimal supporting chrome. Do **not** call `figma.setFileThumbnailNodeAsync` (not supported in this MCP flow).

## Prerequisites
- Phases through 05d complete.

## Placeholders
Replace every literal `PROJECT_NAME` in the script with the **exact** project name string from Step 1 before sending to `use_figma`.

## Instructions
Load **figma-use** before `use_figma` if required. One `use_figma` with the script below and the Step 4 `fileKey`.

## Success criteria
`Cover` exists on `Thumbnail` with: dark background, two blurred color glows, eyebrow label, project title, hairline accent rule, meta line, small brand mark, and footer text.

## Design rationale
The previous cover used a saturated blue→green diagonal gradient with a giant 120px title, two frosted-glass pill chips, and a bottom-left DL mark — visually loud and dated. The new cover is inspired by contemporary docs covers (Linear, Vercel, Stripe):

- **Depth without noise:** a near-black canvas with two blurred colored ellipses, rather than a corner-to-corner gradient.
- **Strong type, quiet everything else:** one large display title does the work; everything else is muted gray at 13–22px.
- **Four-corner grid:** eyebrow top-left, brand mark top-right, version bottom-left, year bottom-right — gives the frame a calm, Swiss balance.
- **No chips, no lists.** The meta line (`Foundations · Components · Guidelines`) tells designers what's inside without competing visually.

## Step 5e — Draw Cover on Thumbnail

Call `use_figma` with the `fileKey` from Step 4. Navigate to the `Thumbnail` page and draw the `Cover` frame described below.

```javascript
// Navigate to the Thumbnail page
const thumbPage = figma.root.children.find(p => p.name === 'Thumbnail');
await figma.setCurrentPageAsync(thumbPage);

await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });

// hex -> { r, g, b } in 0..1 space
function hex(h) {
  const n = parseInt(h.replace('#', ''), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

// ── Cover frame: 1920×1080, near-black ─────────────────────────────
const coverFrame = figma.createFrame();
coverFrame.name = 'Cover';
coverFrame.resize(1920, 1080);
coverFrame.x = 0;
coverFrame.y = 0;
coverFrame.cornerRadius = 0;
coverFrame.fills = [{ type: 'SOLID', color: hex('#0A0A0C') }];
coverFrame.clipsContent = true;
thumbPage.appendChild(coverFrame);

// ── Glow 1: warm violet, upper-left (blurred ellipse) ──────────────
const glow1 = figma.createEllipse();
glow1.name = 'glow/violet';
glow1.resize(1400, 1000);
glow1.x = -400;
glow1.y = -300;
glow1.fills = [{ type: 'SOLID', color: hex('#5B3FA3'), opacity: 0.45 }];
glow1.strokes = [];
glow1.effects = [{ type: 'LAYER_BLUR', radius: 280, visible: true }];
coverFrame.appendChild(glow1);

// ── Glow 2: cool blue, lower-right (blurred ellipse) ───────────────
const glow2 = figma.createEllipse();
glow2.name = 'glow/blue';
glow2.resize(900, 700);
glow2.x = 1200;
glow2.y = 600;
glow2.fills = [{ type: 'SOLID', color: hex('#3D6CE8'), opacity: 0.2 }];
glow2.strokes = [];
glow2.effects = [{ type: 'LAYER_BLUR', radius: 240, visible: true }];
coverFrame.appendChild(glow2);

// ── Eyebrow: "DESIGN SYSTEM" top-left ──────────────────────────────
const eyebrow = figma.createText();
eyebrow.fontName = { family: 'Inter', style: 'Medium' };
eyebrow.fontSize = 14;
eyebrow.characters = 'DESIGN SYSTEM';
eyebrow.letterSpacing = { value: 2.4, unit: 'PIXELS' };
eyebrow.fills = [{ type: 'SOLID', color: hex('#8B8B92') }];
eyebrow.x = 120;
eyebrow.y = 96;
coverFrame.appendChild(eyebrow);

// ── Brand mark: 2×2 grid, top-right, muted ─────────────────────────
const brand = figma.createFrame();
brand.name = 'brand-mark';
brand.resize(16, 16);
brand.x = 1784;
brand.y = 96;
brand.fills = [];
brand.clipsContent = false;
coverFrame.appendChild(brand);

const sq = 7, gap = 2;
for (const [c, r] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
  const s = figma.createRectangle();
  s.resize(sq, sq);
  s.x = c * (sq + gap);
  s.y = r * (sq + gap);
  s.fills = [{ type: 'SOLID', color: hex('#4A4A52') }];
  s.cornerRadius = 1;
  brand.appendChild(s);
}

// ── Title: PROJECT_NAME, huge, vertically centered near y=500 ──────
const title = figma.createText();
title.fontName = { family: 'Inter', style: 'Bold' };
title.fontSize = 180;
title.characters = PROJECT_NAME;   // bound from Step 1 collected value
title.letterSpacing = { value: -4, unit: 'PIXELS' };
title.lineHeight = { value: 95, unit: 'PERCENT' };
title.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
title.resize(Math.min(1680, title.width), title.height);
title.x = 120;
title.y = Math.round(500 - title.height / 2);
coverFrame.appendChild(title);

// ── Hairline accent rule, 48×2, soft violet ────────────────────────
const rule = figma.createRectangle();
rule.name = 'accent-rule';
rule.resize(48, 2);
rule.cornerRadius = 1;
rule.fills = [{ type: 'SOLID', color: hex('#A594E8') }];
rule.x = 120;
rule.y = title.y + title.height + 36;
coverFrame.appendChild(rule);

// ── Meta line under rule ───────────────────────────────────────────
const meta = figma.createText();
meta.fontName = { family: 'Inter', style: 'Regular' };
meta.fontSize = 22;
meta.characters = 'Foundations  ·  Components  ·  Guidelines';
meta.fills = [{ type: 'SOLID', color: hex('#8B8B92') }];
meta.x = 120;
meta.y = rule.y + 22;
coverFrame.appendChild(meta);

// ── Footer: version bottom-left, year bottom-right ─────────────────
const footerY = 972;

const footerLeft = figma.createText();
footerLeft.fontName = { family: 'Inter', style: 'Medium' };
footerLeft.fontSize = 13;
footerLeft.characters = 'v1.0';
footerLeft.letterSpacing = { value: 0.5, unit: 'PIXELS' };
footerLeft.fills = [{ type: 'SOLID', color: hex('#5A5A62') }];
footerLeft.x = 120;
footerLeft.y = footerY;
coverFrame.appendChild(footerLeft);

const footerRight = figma.createText();
footerRight.fontName = { family: 'Inter', style: 'Medium' };
footerRight.fontSize = 13;
footerRight.characters = '© 2026';
footerRight.letterSpacing = { value: 0.5, unit: 'PIXELS' };
footerRight.fills = [{ type: 'SOLID', color: hex('#5A5A62') }];
footerRight.x = 1800 - footerRight.width;
footerRight.y = footerY;
coverFrame.appendChild(footerRight);
```

> **Note:** Replace `PROJECT_NAME` in the code above with the actual project name string collected in Step 1 before passing the code to `use_figma`.

