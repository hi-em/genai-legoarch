// Build a printable STL (ASCII) from a brick model — REAL Exit-1 download.
import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export function brickModelToStl(bm, withStuds = true) {
  const geos = [];
  for (const b of bm.bricks) {
    const body = new THREE.BoxGeometry(0.96, 0.96, 0.96);
    body.translate(b.x, b.z, b.y);
    geos.push(body);
    if (withStuds) {
      const stud = new THREE.CylinderGeometry(0.28, 0.28, 0.2, 12);
      stud.translate(b.x, b.z + 0.55, b.y);
      geos.push(stud);
    }
  }
  if (!geos.length) return "solid empty\nendsolid empty\n";
  const merged = mergeGeometries(geos, false);
  const mesh = new THREE.Mesh(merged);
  return new STLExporter().parse(mesh, { binary: false });
}
