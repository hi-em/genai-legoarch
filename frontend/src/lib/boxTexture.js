// The retail-box front panel, painted by us on a canvas — shared by the
// BoxArt trophy (1280px) and the Shelf Wall dioramas (512px). One painter,
// one set of box proportions, so the box always reads the same everywhere.
import * as THREE from "three";
import { drawWordmark, drawLogoMark } from "../components/brand/brand.js";

// box proportions (LEGO Architecture-ish landscape box, world units)
export const BOX = { BW: 3.6, BH: 2.6, BD: 0.78, LID_T: 0.14 };

// ---------------------------------------------------------------------------
// Front-panel art: everything drawn by us on a canvas -> always correct.
export function drawFrontPanel(ctx, W, H, img, setCopy, pieces) {
  // matte black + subtle blueprint motif
  ctx.fillStyle = "#0b0b0e";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(64, 180, 190, 0.10)";
  ctx.lineWidth = 1;
  const grid = W / 18;
  for (let x = 0; x <= W; x += grid) {
    ctx.beginPath(); ctx.moveTo(x, H * 0.1); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = H * 0.1; y <= H; y += grid) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // hero art — the user's render with its white studio background keyed to
  // transparent (same ~238 threshold the backend's exposure matcher treats
  // as background), so the model floats on the black box, LEGO
  // Architecture style — not a pasted photo rectangle
  if (img) {
    const off = document.createElement("canvas");
    off.width = img.width;
    off.height = img.height;
    const octx = off.getContext("2d");
    octx.drawImage(img, 0, 0);
    try {
      const data = octx.getImageData(0, 0, off.width, off.height);
      const px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        const lo = Math.min(px[i], px[i + 1], px[i + 2]);
        if (lo > 238) px[i + 3] = 0;                       // pure studio white
        else if (lo > 218) px[i + 3] = Math.round(255 * (238 - lo) / 20); // soft edge
      }
      octx.putImageData(data, 0, 0);
    } catch {
      /* tainted canvas — draw unkeyed rather than fail */
    }
    const zone = { x: W * 0.1, y: H * 0.1, w: W * 0.8, h: H * 0.6 };
    const s = Math.min(zone.w / img.width, zone.h / img.height);
    const dw = img.width * s, dh = img.height * s;
    const dx = zone.x + (zone.w - dw) / 2, dy = zone.y + (zone.h - dh) / 2;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 12;
    ctx.drawImage(off, dx, dy, dw, dh);
    ctx.restore();
  }

  // brand lockup, top-left — the "Plate Stack" mark + wordmark, drawn straight
  // on the matte-black box like the app header floats on the felt. Colored
  // letters read on black (the old red chip hid the red 'a'); the mark is the
  // current logo, so the box now carries it for real.
  const m = W * 0.045;
  const markH = H * 0.075;
  drawLogoMark(ctx, m, m, markH);
  ctx.textBaseline = "middle";
  const wmPx = markH * 0.6;
  drawWordmark(ctx, m + markH + W * 0.012, m + markH / 2 + 1, wmPx, "#ffffff");

  // badges, top-right
  ctx.font = `800 ${H * 0.026}px 'DM Sans', system-ui, sans-serif`;
  ctx.textAlign = "right";
  const badge = (text, x) => {
    const w = ctx.measureText(text).width + H * 0.03;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.roundRect(x - w, m, w, H * 0.05, 5);
    ctx.fill();
    ctx.fillStyle = "#16181c";
    ctx.fillText(text, x - H * 0.015, m + H * 0.027);
    return x - w - H * 0.015;
  };
  let bx = W - m;
  if (pieces) bx = badge(`${pieces.toLocaleString()} pcs`, bx);
  badge("18+", bx);

  // name band, bottom — the words, OUR words
  const bandY = H * 0.76;
  const grad = ctx.createLinearGradient(0, bandY - H * 0.06, 0, H);
  grad.addColorStop(0, "rgba(5,5,7,0)");
  grad.addColorStop(0.35, "rgba(5,5,7,0.96)");
  grad.addColorStop(1, "rgba(5,5,7,1)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, bandY - H * 0.06, W, H - bandY + H * 0.06);

  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `700 ${H * 0.024}px 'DM Sans', system-ui, sans-serif`;
  ctx.fillText((setCopy?.series || "lEgoarCh · Architecture").toUpperCase(), m, bandY + H * 0.02);

  ctx.fillStyle = "#ffffff";
  let nameSize = H * 0.052;
  ctx.font = `900 ${nameSize}px 'DM Sans', system-ui, sans-serif`;
  const name = setCopy?.set_name || "Untitled set";
  while (ctx.measureText(name).width > W * 0.72 && nameSize > H * 0.03) {
    nameSize *= 0.94;
    ctx.font = `900 ${nameSize}px 'DM Sans', system-ui, sans-serif`;
  }
  ctx.fillText(name, m, bandY + H * 0.085);

  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `700 ${H * 0.042}px ui-monospace, monospace`;
  ctx.fillText(setCopy?.set_number || "", W - m, bandY + H * 0.085);
}

// ---------------------------------------------------------------------------
// Same painter, but resolves a PNG data URL instead of a CanvasTexture — for
// showing the box-front as flat cover art in a 2D <img> (the set-detail view,
// where the BUILD is the 3D hero and the box is just its packaging). Always
// resolves; a broken/absent image falls back to the typography-only panel.
export function buildFrontDataUrl({ imageUrl, setCopy, pieces, width = 720 }) {
  return new Promise((resolve) => {
    const W = width;
    const H = Math.round((width * BOX.BH) / BOX.BW);
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    const finish = (img) => {
      drawFrontPanel(ctx, W, H, img, setCopy, pieces);
      resolve(canvas.toDataURL("image/png"));
    };
    if (imageUrl) {
      const img = new Image();
      img.onload = () => finish(img);
      img.onerror = () => finish(null);
      img.src = imageUrl;
    } else finish(null);
  });
}

// ---------------------------------------------------------------------------
// Promise builder: paints the panel at `width` px (height follows the box
// aspect) and resolves a ready-to-map CanvasTexture. Always resolves — a
// broken/absent image falls back to the typography-only panel.
export function buildFrontTexture({ imageUrl, setCopy, pieces, width = 1280 }) {
  return new Promise((resolve) => {
    const W = width;
    const H = Math.round((width * BOX.BH) / BOX.BW);
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    const finish = (img) => {
      drawFrontPanel(ctx, W, H, img, setCopy, pieces);
      const t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      resolve(t);
    };
    if (imageUrl) {
      const img = new Image();
      img.onload = () => finish(img);
      img.onerror = () => finish(null);
      img.src = imageUrl;
    } else finish(null);
  });
}
