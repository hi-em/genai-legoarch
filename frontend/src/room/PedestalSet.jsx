// One saved set in the room: a boxed product slowly turning on a lit plinth.
// Reuses the refcounted box-front texture and the same carton look as the old
// shelf. Walk within OPEN_RANGE and it lifts, glows, and offers to open.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { BOX } from "../lib/boxTexture.js";
import { useShelfBoxTexture } from "../shelf/useShelfBoxTexture.js";
import { PLINTH_H, BOX_DISPLAY_SCALE } from "./roomLayout.js";

// shared carton materials (module singletons — 20 boxes, 2 materials)
const KRAFT = new THREE.MeshStandardMaterial({ color: "#b08a5e", roughness: 0.95 });
const BLACK = new THREE.MeshStandardMaterial({ color: "#101013", roughness: 0.6 });
const PLINTH = new THREE.MeshStandardMaterial({ color: "#1b1713", roughness: 0.9 });

export default function PedestalSet({ item, slot, idx, aimed, reduced, hideBox, onOpen }) {
  const tex = useShelfBoxTexture(item);
  const boxRef = useRef();
  const art = useMemo(
    () => new THREE.MeshStandardMaterial({ map: tex, color: tex ? "#ffffff" : "#101013", roughness: 0.5 }),
    [tex]
  );
  useEffect(() => () => art.dispose(), [art]);

  const [x, , z] = slot.pos;
  const boxScale = BOX_DISPLAY_SCALE;
  const baseY = PLINTH_H + (BOX.BH * boxScale) / 2 + 0.06;

  const liftRef = useRef(0);
  useFrame((_, delta) => {
    const g = boxRef.current;
    if (!g) return;
    if (!reduced) g.rotation.y += delta * 0.3;        // slow turntable
    // ease the hover/aim lift
    const target = aimed ? 1 : 0;
    liftRef.current += (target - liftRef.current) * Math.min(1, delta * 6);
    g.position.y = baseY + liftRef.current * 0.18;
  });

  return (
    <group position={[x, 0, z]}>
      {/* plinth */}
      <mesh position={[0, PLINTH_H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, PLINTH_H, 2.0]} />
        <primitive object={PLINTH} attach="material" />
      </mesh>

      {/* the turning boxed set (hidden while this slot's box is being staged/opened
          by FocusStage — the plinth stays so the set reads continuously) */}
      {!hideBox && (
        <group
          ref={boxRef}
          position={[0, baseY, 0]}
          rotation={[0, slot.yaw, 0]}
          scale={boxScale}
          onClick={(e) => { e.stopPropagation(); onOpen(item, idx); }}
          onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
          onPointerOut={() => { document.body.style.cursor = ""; }}
        >
          {/* boxGeometry faces: [+x, -x, +y, -y, +z(front art), -z] */}
          <mesh material={[KRAFT, KRAFT, BLACK, BLACK, art, BLACK]} castShadow receiveShadow>
            <boxGeometry args={[BOX.BW, BOX.BH, BOX.BD]} />
          </mesh>
          <mesh material={BLACK} position={[0, BOX.BH / 2 - BOX.LID_T / 2 + 0.01, 0]} castShadow>
            <boxGeometry args={[BOX.BW + 0.05, BOX.LID_T, BOX.BD + 0.05]} />
          </mesh>
        </group>
      )}

      {/* a warm spot picks out the set you're standing at */}
      {aimed && !hideBox && <pointLight position={[0, PLINTH_H + 3, 1.4]} intensity={0.7} distance={6} color="#ffe9c2" />}

      {aimed && !hideBox && (
        <Html position={[0, PLINTH_H + BOX.BH * boxScale + 0.7, 0]} center distanceFactor={9} zIndexRange={[20, 0]}>
          <button
            onClick={() => onOpen(item, idx)}
            className="whitespace-nowrap rounded-full bg-ink/90 px-3 py-1 text-xs font-semibold text-white shadow-pop"
          >
            Press E to open · {item.title || "set"}
          </button>
        </Html>
      )}
    </group>
  );
}
