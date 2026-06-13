// The box at the centre of attention — driven by useRoomStage. It either:
//   • stages a freshly-forged set on the central plinth (PackingScene "pack"),
//     then SLIDES the sealed box across the room to its wall slot, or
//   • opens an already-shelved set at its wall slot (PackingScene "open").
// One component so the pack/open/slide choreography lives in a single place;
// Room hides the ordinary PedestalSet box (not its plinth) for whichever slot
// is active, so the texture and plinth read continuously across the hand-off.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { normalizeAdapted } from "../lib/brickModel.js";
import { BOX } from "../lib/boxTexture.js";
import { useShelfBoxTexture } from "../shelf/useShelfBoxTexture.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import {
  PackingScene, useFrontTexture, usePackingRain, T_END, O_END,
} from "../transition/PackingScene.jsx";
import { useRoomStage } from "./useRoomStage.js";
import { PLINTH_H, BOX_DISPLAY_SCALE, STAGING_PLINTH_POS, STAGING_YAW } from "./roomLayout.js";

const S = BOX_DISPLAY_SCALE;
const FLOOR_ABS = 1.45;                                  // PackingScene FLOOR_Y magnitude
const PACK_GROUP_Y = PLINTH_H + FLOOR_ABS * S;           // lands the carton floor on the plinth top
const CLOSED_Y = PLINTH_H + (BOX.BH * S) / 2 + 0.06;     // matches PedestalSet's box centre

const KRAFT = new THREE.MeshStandardMaterial({ color: "#b08a5e", roughness: 0.95 });
const BLACK = new THREE.MeshStandardMaterial({ color: "#101013", roughness: 0.6 });
const PLINTH = new THREE.MeshStandardMaterial({ color: "#1b1713", roughness: 0.9 });

// A plain sealed retail box (used during the slide), art on its +z face.
function ClosedBoxMeshes({ tex }) {
  const art = useMemo(
    () => new THREE.MeshStandardMaterial({ map: tex, color: tex ? "#ffffff" : "#101013", roughness: 0.5 }),
    [tex]
  );
  useEffect(() => () => art.dispose(), [art]);
  return (
    <group scale={S}>
      <mesh material={[KRAFT, KRAFT, BLACK, BLACK, art, BLACK]} castShadow receiveShadow>
        <boxGeometry args={[BOX.BW, BOX.BH, BOX.BD]} />
      </mesh>
      <mesh material={BLACK} position={[0, BOX.BH / 2 - BOX.LID_T / 2 + 0.01, 0]} castShadow>
        <boxGeometry args={[BOX.BW + 0.05, BOX.LID_T, BOX.BD + 0.05]} />
      </mesh>
    </group>
  );
}

export default function FocusStage({ slots }) {
  const reduced = useReducedMotion();
  const mode = useRoomStage((s) => s.mode);
  const staged = useRoomStage((s) => s.staged);
  const focus = useRoomStage((s) => s.focus);
  const slideTo = useRoomStage((s) => s.slideTo);
  const packingDone = useRoomStage((s) => s.packingDone);
  const openingDone = useRoomStage((s) => s.openingDone);
  const shelvingDone = useRoomStage((s) => s.shelvingDone);
  const setSlideT = useRoomStage((s) => s.setSlideT);

  const origin = staged ? "staging" : focus?.origin;
  const item = staged ? staged.item : focus?.item;
  const slot = origin === "wall" && focus ? slots[focus.slotIdx] : null;

  const bm = useMemo(() => (item ? normalizeAdapted(item.brickModel) : null), [item]);
  const pieces = bm?.stability?.nBricks;
  const frontTex = useFrontTexture(item?.renderThumb || null, item?.setCopy || null, pieces);
  const { rain, geosReady } = usePackingRain(bm);
  const shelfTex = useShelfBoxTexture(item || { id: "_none" });

  // slide bookkeeping (kept in a ref; mirrored to the store for CameraRig)
  const slideRef = useRef();
  const tRef = useRef(0);
  useEffect(() => { if (mode === "shelving") tRef.current = 0; }, [mode]);

  // wall-clock failsafes — a frozen rAF must never strand a leg
  useEffect(() => { if (mode === "packing") { const id = setTimeout(packingDone, T_END * 1000 + 1500); return () => clearTimeout(id); } }, [mode, packingDone]);
  useEffect(() => { if (mode === "opening") { const id = setTimeout(openingDone, O_END * 1000 + 1500); return () => clearTimeout(id); } }, [mode, openingDone]);
  useEffect(() => { if (mode === "shelving") { const id = setTimeout(shelvingDone, 1700); return () => clearTimeout(id); } }, [mode, shelvingDone]);

  useFrame((_, dtRaw) => {
    if (mode !== "shelving" || !slideRef.current || !slideTo) return;
    const dt = Math.min(dtRaw, 0.05);
    tRef.current = Math.min(1, tRef.current + (reduced ? 1 : dt / 1.2));
    setSlideT(tRef.current);
    const t = tRef.current, e = t * t * (3 - 2 * t);
    slideRef.current.position.set(
      THREE.MathUtils.lerp(STAGING_PLINTH_POS[0], slideTo.to[0], e),
      CLOSED_Y,
      THREE.MathUtils.lerp(STAGING_PLINTH_POS[2], slideTo.to[2], e)
    );
    slideRef.current.rotation.y = THREE.MathUtils.lerp(STAGING_YAW, slideTo.yaw, e);
    if (t >= 1) shelvingDone();
  });

  if (!item || !bm) return null;
  const ready = geosReady || rain.length === 0;

  // ---- staging path ----
  if (origin === "staging") {
    return (
      <group>
        <mesh position={[STAGING_PLINTH_POS[0], PLINTH_H / 2, STAGING_PLINTH_POS[2]]} material={PLINTH} castShadow receiveShadow>
          <boxGeometry args={[2.4, PLINTH_H, 2.0]} />
        </mesh>
        {mode === "shelving" ? (
          <group ref={slideRef} position={[STAGING_PLINTH_POS[0], CLOSED_Y, STAGING_PLINTH_POS[2]]} rotation={[0, STAGING_YAW, 0]}>
            <ClosedBoxMeshes tex={shelfTex} />
          </group>
        ) : (
          <group position={[STAGING_PLINTH_POS[0], PACK_GROUP_Y, STAGING_PLINTH_POS[2]]} scale={S}>
            {ready && (
              <PackingScene frontTex={frontTex} rain={rain} reduced={reduced} replayKey={`stage-${item.id}`} direction="pack" showFloor={false} onDone={packingDone} />
            )}
          </group>
        )}
      </group>
    );
  }

  // ---- wall-open path ----
  if (!slot) return null;
  const [sx, , sz] = slot.pos;
  if (mode === "focusing") {
    return (
      <group position={[sx, CLOSED_Y, sz]} rotation={[0, slot.yaw, 0]}>
        <ClosedBoxMeshes tex={shelfTex} />
      </group>
    );
  }
  return (
    <group position={[sx, PACK_GROUP_Y, sz]} rotation={[0, slot.yaw, 0]} scale={S}>
      {ready && (
        <PackingScene frontTex={frontTex} rain={rain} reduced={reduced} replayKey={`open-${item.id}`} direction="open" showFloor={false} onDone={openingDone} />
      )}
    </group>
  );
}
