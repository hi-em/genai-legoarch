// Real LDraw part geometry for the brick renderers (Sprint 1C).
//
// Each curated part ships as a self-contained packed .dat in /parts (built by
// scripts/build_parts.mjs from the official LDraw library, CC-BY). We load a
// part ONCE with three's LDrawLoader, merge its meshes into a single
// BufferGeometry normalised to grid units — 1 unit = 1 stud, origin at the
// BOTTOM-CENTRE of the canonical w×d footprint, +Y up — and instance it
// thousands of times. Parts that fail to load resolve to null and the
// renderer falls back to the legacy box+studs look, so geometry can never
// break the app.
import * as THREE from "three";
import { LDrawLoader } from "three/examples/jsm/loaders/LDrawLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useEffect, useMemo, useState } from "react";
import catalog from "../lib/catalog.gen.json";

const LDU_PER_STUD = 20;
const PART_META = Object.fromEntries((catalog?.parts || []).map((p) => [p.id, p]));
const SLOPE_FAMILIES = new Set(["slope45", "slope33", "cheese", "curved", "inverted"]);

let _loader = null;
let _materialsReady = null;

function loader() {
  if (!_loader) {
    _loader = new LDrawLoader();
    _loader.smoothNormals = true;
    _materialsReady = _loader
      .preloadMaterials("/parts/LDConfig.ldr")
      .catch(() => null); // missing LDConfig -> loads still work with defaults
  }
  return _loader;
}

const _cache = new Map(); // part id -> Promise<BufferGeometry|null>
const _done = new Map();  // part id -> BufferGeometry | null (resolved only)
if (import.meta.env?.DEV && typeof window !== "undefined") {
  window.__bfPartGeos = _done;
  window.__bfLoadPart = (id) => loadPartGeometry(id);
}

function buildGeometry(group, id) {
  group.updateMatrixWorld(true);
  const geos = [];
  group.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    let g = child.geometry.clone();
    g.applyMatrix4(child.matrixWorld);
    // strip per-vertex colour/material bookkeeping — colour rides per instance
    g.deleteAttribute("color");
    if (g.index) g = g.toNonIndexed();
    geos.push(g);
  });
  if (!geos.length) return null;
  const merged = mergeGeometries(geos, false);
  if (!merged) return null;
  // LDU -> studs, LDraw -Y-up -> three +Y-up
  merged.scale(1 / LDU_PER_STUD, 1 / LDU_PER_STUD, 1 / LDU_PER_STUD);
  merged.rotateX(Math.PI);
  // origin: bottom-centre of the footprint
  merged.computeBoundingBox();
  const bb = merged.boundingBox;
  merged.translate(
    -(bb.min.x + bb.max.x) / 2,
    -bb.min.y,
    -(bb.min.z + bb.max.z) / 2
  );
  canonicalize(merged, PART_META[id]);
  merged.computeBoundingSphere();
  return merged;
}

/**
 * Rotate the loaded geometry into the ENGINE's canonical orientation:
 * footprint w studs along X, d studs along Z, and (for slope families)
 * downhill toward +X. LDraw authors model parts in whatever orientation was
 * convenient (2x4 bricks are X-long, slope 3037 falls toward +Z...), so we
 * measure and correct once at load; the renderer then applies a plain
 * `-rot` Y rotation per instance.
 */
function canonicalize(geo, meta) {
  if (!meta) return;
  geo.computeBoundingBox();
  const ex = geo.boundingBox.max.x - geo.boundingBox.min.x;
  const ez = geo.boundingBox.max.z - geo.boundingBox.min.z;
  if (meta.w !== meta.d && Math.round(ex) === meta.d && Math.round(ez) === meta.w) {
    geo.rotateY(Math.PI / 2); // extents swapped vs catalog -> quarter turn
  }
  if (SLOPE_FAMILIES.has(meta.family)) {
    // high (full-height, studded) side = centroid of the top vertices;
    // downhill is the opposite. Normalise downhill to +X.
    geo.computeBoundingBox();
    const top = geo.boundingBox.max.y * 0.85;
    const pos = geo.attributes.position;
    let hx = 0, hz = 0, n = 0;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > top) {
        hx += pos.getX(i);
        hz += pos.getZ(i);
        n++;
      }
    }
    if (n > 0) {
      hx /= n;
      hz /= n;
      let angle = 0;
      if (Math.abs(hx) >= Math.abs(hz)) {
        angle = hx > 0.05 ? Math.PI : 0;              // high at +X -> flip
      } else {
        angle = hz > 0.05 ? -Math.PI / 2 : Math.PI / 2; // high at ±Z -> quarter
      }
      if (angle !== 0) geo.rotateY(angle);
    }
  }
}

export function loadPartGeometry(id) {
  if (_cache.has(id)) return _cache.get(id);
  const p = new Promise((resolve) => {
    const l = loader();
    (_materialsReady || Promise.resolve()).then(() => {
      l.load(
        `/parts/${id}.dat`,
        (group) => {
          let geo = null;
          try {
            geo = buildGeometry(group, id);
          } catch {
            geo = null;
          }
          _done.set(id, geo);
          resolve(geo);
        },
        undefined,
        () => {
          _done.set(id, null);
          resolve(null);
        }
      );
    });
  });
  _cache.set(id, p);
  return p;
}

/** Sync lookup — geometry if this part already finished loading, else undefined. */
export function partGeometryOf(id) {
  return _done.get(id);
}

/**
 * React hook: kick off loads for a set of part ids; returns
 * { ready, geos } where ready flips true once EVERY id resolved (geometry or
 * null). Gating on `ready` avoids a mixed real-parts/boxes frame.
 */
export function usePartGeometries(ids) {
  const key = useMemo(() => [...new Set(ids)].sort().join(","), [ids]);
  const [ready, setReady] = useState(() =>
    key === "" ? true : key.split(",").every((id) => _done.has(id))
  );
  useEffect(() => {
    if (key === "") return;
    const list = key.split(",");
    if (list.every((id) => _done.has(id))) {
      setReady(true);
      return;
    }
    let alive = true;
    setReady(false);
    Promise.all(list.map(loadPartGeometry)).then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [key]);
  return {
    ready,
    geos: _done,
  };
}
