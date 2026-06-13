// STL export of an AI-generated mesh (the raw TRELLIS scene). Binary STL is
// compact and universally accepted by slicers / CAD. Mirrors the import style
// of ldraw.js (download helper) and useDataUrlGLB.js (three/examples loaders).
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";

// Bake parent transforms into world space, then serialise every mesh in the
// subtree to a single binary STL ArrayBuffer.
export function meshSceneToStl(object3d) {
  object3d.updateMatrixWorld(true);
  return new STLExporter().parse(object3d, { binary: true });
}

export function downloadStl(filename, object3d) {
  const name = filename.toLowerCase().endsWith(".stl") ? filename : `${filename}.stl`;
  const buf = meshSceneToStl(object3d);
  const blob = new Blob([buf], { type: "model/stl" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
