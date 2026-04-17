# Phase 05e — Thumbnail page cover

## Runtime order
Runs **after** Phase 05d.

## Goal
Draw the `Cover` frame on the `Thumbnail` page (gradient, title, chips). Do **not** call `figma.setFileThumbnailNodeAsync` (not supported in this MCP flow).

## Prerequisites
- Phases through 05d complete.

## Placeholders
Replace every literal `PROJECT_NAME` in the script with the **exact** project name string from Step 1 before sending to `use_figma`.

## Instructions
Load **figma-use** before `use_figma` if required. One `use_figma` with the script below and the Step 4 `fileKey`.

## Success criteria
`Cover` exists on `Thumbnail` with gradient, project title, and chips.

## Step 5e — Draw Cover on Thumbnail

Call `use_figma` with the `fileKey` from Step 4. Navigate to the `Thumbnail` page and draw a `Cover` frame with a diagonal blue-to-green gradient, project title, and chips.

```javascript
// Navigate to the Thumbnail page
const thumbPage = figma.root.children.find(p => p.name === 'Thumbnail');
await figma.setCurrentPageAsync(thumbPage);

await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });

// ── Cover frame: 1920×1080, diagonal gradient ────────────────────
const coverFrame = figma.createFrame();
coverFrame.name   = 'Cover';
coverFrame.resize(1920, 1080);
coverFrame.x      = 0;
coverFrame.y      = 0;
coverFrame.cornerRadius = 0;

// GRADIENT_LINEAR: top-left (#3B82F6) → bottom-right (#22C55E)
coverFrame.fills = [{
  type: 'GRADIENT_LINEAR',
  gradientTransform: [[0.707, -0.707, 0.147], [0.707, 0.707, -0.147]],
  gradientStops: [
    { position: 0.0, color: { r: 0.231, g: 0.510, b: 0.965, a: 1 } },  // #3B82F6
    { position: 1.0, color: { r: 0.133, g: 0.773, b: 0.369, a: 1 } },  // #22C55E
  ],
}];
thumbPage.appendChild(coverFrame);

// ── DL icon: 2×2 grid of four 18×18 white rectangles, x=60, y=1002 ──
const icon = figma.createFrame();
icon.name   = 'dl-icon';
icon.resize(38, 38);  // 2×18 + 2px gap
icon.x      = 60;
icon.y      = 1002;
icon.fills  = [];
coverFrame.appendChild(icon);

const squareSize = 18, gap = 2;
[[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([col, row]) => {
  const sq = figma.createRectangle();
  sq.resize(squareSize, squareSize);
  sq.x      = col * (squareSize + gap);
  sq.y      = row * (squareSize + gap);
  sq.fills  = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  sq.cornerRadius = 2;
  icon.appendChild(sq);
});

// ── Project name title: 120px bold white, x=100, y=420 ───────────
const titleText = figma.createText();
titleText.fontName   = { family: 'Inter', style: 'Bold' };
titleText.fontSize   = 120;
titleText.characters = PROJECT_NAME;   // bound from Step 1 collected value
titleText.fills      = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
titleText.resize(1400, titleText.height);
titleText.x = 100;
titleText.y = 420;
coverFrame.appendChild(titleText);

// ── Two frosted-glass pill chips at y=600, x=100, gap=16 ─────────
const chipLabels = ['Design Tokens', 'Component Library'];
let chipX = 100;

for (const label of chipLabels) {
  const chip = figma.createFrame();
  chip.name         = `chip/${label}`;
  chip.cornerRadius = 999;
  chip.fills        = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.15 }];
  chip.strokes      = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.4 }];
  chip.strokeWeight  = 1;
  chip.paddingLeft   = 24;
  chip.paddingRight  = 24;
  chip.paddingTop    = 12;
  chip.paddingBottom = 12;

  const chipText = figma.createText();
  chipText.fontName   = { family: 'Inter', style: 'Medium' };
  chipText.fontSize   = 16;
  chipText.characters = label;
  chipText.fills      = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  chip.appendChild(chipText);

  // Size the chip frame to wrap the text
  chip.resize(chipText.width + 48, 48);
  chip.x = chipX;
  chip.y = 600;
  coverFrame.appendChild(chip);

  chipX += chip.width + 16;
}
```

> **Note:** Replace `PROJECT_NAME` in the code above with the actual project name string collected in Step 1 before passing the code to `use_figma`.

