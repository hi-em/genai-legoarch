// First-person movement for the room: drei PointerLockControls owns the look
// (click to lock, Esc to release), a WASD rig owns the walk. The camera is
// clamped to the room AABB and pushed out of each plinth's keep-out circle, and
// R teleports back to the door — so you can never clip a wall or get lost.
import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import * as THREE from "three";
import { bounds, spawnPos, EYE_Y, MOVE_SPEED } from "./roomLayout.js";

export default function FpsControls({ dims, noGo, onLockChange }) {
  const camera = useThree((s) => s.camera);
  const keys = useRef({});
  const b = bounds(dims);
  const fwd = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const dir = useRef(new THREE.Vector3());

  useEffect(() => {
    const dn = (e) => {
      keys.current[e.code] = true;
      if (e.code === "KeyR") camera.position.set(...spawnPos(dims));
    };
    const up = (e) => { keys.current[e.code] = false; };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", dn);
      window.removeEventListener("keyup", up);
    };
  }, [camera, dims]);

  useFrame((_, delta) => {
    const k = keys.current;
    let mz = 0, mx = 0;
    if (k.KeyW || k.ArrowUp) mz += 1;
    if (k.KeyS || k.ArrowDown) mz -= 1;
    if (k.KeyD || k.ArrowRight) mx += 1;
    if (k.KeyA || k.ArrowLeft) mx -= 1;
    if (!mx && !mz) return;

    camera.getWorldDirection(fwd.current);
    fwd.current.y = 0;
    fwd.current.normalize();
    right.current.crossVectors(fwd.current, camera.up).normalize();
    dir.current.set(0, 0, 0)
      .addScaledVector(fwd.current, mz)
      .addScaledVector(right.current, mx);
    if (dir.current.lengthSq() === 0) return;
    dir.current.normalize();

    const step = MOVE_SPEED * Math.min(delta, 0.05);
    let nx = camera.position.x + dir.current.x * step;
    let nz = camera.position.z + dir.current.z * step;

    // room walls
    nx = Math.max(b.minX, Math.min(b.maxX, nx));
    nz = Math.max(b.minZ, Math.min(b.maxZ, nz));

    // plinth keep-out: push the camera radially out of any display it enters
    for (const z of noGo) {
      const ddx = nx - z.x, ddz = nz - z.z;
      const d = Math.hypot(ddx, ddz);
      if (d < z.r) {
        const f = z.r / (d || 0.0001);
        nx = z.x + ddx * f;
        nz = z.z + ddz * f;
      }
    }

    camera.position.x = nx;
    camera.position.z = nz;
    camera.position.y = EYE_Y;
  });

  return (
    <PointerLockControls
      onLock={() => onLockChange?.(true)}
      onUnlock={() => onLockChange?.(false)}
    />
  );
}
