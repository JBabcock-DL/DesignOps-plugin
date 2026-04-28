// Clear current page except _Header (matches draw-engine §6.0 single-pass).
for (const node of [...figma.currentPage.children]) {
  if (node.name !== '_Header') node.remove();
}
