// Lives inside a <Canvas> that was created with gl={{ preserveDrawingBuffer:true }}
// and hands the parent a function returning the current frame as a PNG data URL.
// preserveDrawingBuffer keeps the backbuffer readable after the frame (WebGL
// clears it otherwise), so toDataURL captures the live render rather than a
// blank — the right tool for WebGL, where html-to-image can't reach the GL pixels.
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

export default function CaptureBridge({ onReady }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    if (!onReady) return;
    onReady(() => {
      // render synchronously so the captured frame matches the current view
      // (robust even under frameloop="demand"), then read the persisted buffer.
      gl.render(scene, camera);
      return gl.domElement.toDataURL("image/png");
    });
    return () => onReady(null);
  }, [gl, scene, camera, onReady]);
  return null;
}
