# Phase 05f — TOC URL hyperlinks

## Runtime order
Runs **last** among Figma write phases: **after** 05e so `Cover` exists for the Thumbnail row.

## Goal
Set URL hyperlinks on TOC page-name text only (`toc-link/{pageName}` rows).

## Prerequisites
- Phases 05b ( `_Header` targets) and 05e (`Cover` on Thumbnail) complete.

## Placeholders
Replace every literal `FILE_KEY` in the script with the **exact** file key string from Step 4 (same value as in the Figma URL).

## Instructions
Load **figma-use** before `use_figma` if required. One `use_figma` with the script below and the Step 4 `fileKey`.

## Success criteria
Each TOC row links to the correct node in this file; Thumbnail row targets `Cover`.

## Step 5c-links — Wire TOC URL hyperlinks

Call `use_figma` with the `fileKey` from Step 4 **after** Steps 5b and 5e so every destination page has a `_Header` (or the component master on `Documentation components`) and the `Thumbnail` page has a `Cover` frame. This step **only** sets **URL hyperlinks** on the page-name text inside each `toc-link/{pageName}` row — designers use **Cmd+click (Mac)** or **Ctrl+click (Windows)** on the linked text in the canvas to jump to the target frame in this file. **Do not** add prototype `reactions`; presentation mode is not the primary workflow here.

Replace `FILE_KEY` in the snippet below with the same literal `fileKey` string from Step 4 before invoking `use_figma`.

**Caveats:** Hyperlinks are on the **page-name text** only (not the arrow or the whole row). If a page is renamed after scaffolding, links no longer match — re-run `/new-project` to rebuild.

```javascript
const tocPage = figma.root.children.find(p => p.name === '📝 Table of Contents');
await figma.setCurrentPageAsync(tocPage);

const linkRows = tocPage.findAll(n => n.name.startsWith('toc-link/'));

for (const linkRow of linkRows) {
  const pageName = linkRow.name.replace('toc-link/', '');
  const targetPage = figma.root.children.find(p => p.name === pageName);
  if (!targetPage) continue;

  const targetNode =
    pageName === 'Thumbnail'
      ? targetPage.findOne(n => n.name === 'Cover') || targetPage.children[0]
      : targetPage.children.find(n => n.name === '_Header') || targetPage.children[0];
  if (!targetNode) continue;

  const textNode = linkRow.findOne(
    n => n.type === 'TEXT' && n.characters !== '→'
  );
  if (!textNode) continue;

  const nodeId = targetNode.id.replace(':', '-');
  textNode.hyperlink = {
    type: 'URL',
    value: `https://www.figma.com/design/FILE_KEY?node-id=${nodeId}`,
  };
}
```

> **Note:** Replace `FILE_KEY` in the URL with the actual file key from Step 4 before passing the code to `use_figma`.

