import { toPng } from "html-to-image";

export function downloadDataUrl(filename, dataUrl) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

// Rasterize a DOM node to a PNG at 2x and download it.
export async function exportNodePng(node, filename) {
  const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true });
  downloadDataUrl(filename, dataUrl);
  return dataUrl;
}

export async function copyNodePng(node) {
  const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true });
  const blob = await (await fetch(dataUrl)).blob();
  await navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })]);
}
