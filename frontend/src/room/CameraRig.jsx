// The ONLY thing that moves the camera when the room isn't in free-walk.
// FpsControls (PointerLockControls) is unmounted in every other mode, so there
// is exactly one writer of camera.position/quaternion at any instant. Eases to
// the pose resolved from the room state machine; reduced motion snaps; a
// wall-clock failsafe guarantees the focusing leg "arrives" even if rAF freezes.
import { useEffect, useMemo, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import { useRoomStage } from "./useRoomStage.js";
import { BOX } from "../lib/boxTexture.js";
import {
  PLINTH_H, BOX_DISPLAY_SCALE, STAGING_PLINTH_POS,
  stagingCameraPose, wallFocusPose, bookReadingPose, makeLookPose,
} from "./roomLayout.js";

const BOX_CY = PLINTH_H + (BOX.BH * BOX_DISPLAY_SCALE) / 2;

function resolvePose(mode, focus, panel, slots, dims) {
  const wall = focus?.origin === "wall" && slots[focus.slotIdx];
  if (mode === "packing" || mode === "staged-idle") return stagingCameraPose();
  if (mode === "focusing" || mode === "opening") return wall ? wallFocusPose(slots[focus.slotIdx]) : stagingCameraPose();
  if (mode === "inspecting") {
    if (panel === "booklet") return bookReadingPose(dims);
    return wall ? wallFocusPose(slots[focus.slotIdx]) : stagingCameraPose();
  }
  return null;
}

export default function CameraRig({ slots, dims }) {
  const camera = useThree((s) => s.camera);
  const reduced = useReducedMotion();
  const mode = useRoomStage((s) => s.mode);
  const focus = useRoomStage((s) => s.focus);
  const panel = useRoomStage((s) => s.panel);
  const arrivedAtWall = useRoomStage((s) => s.arrivedAtWall);

  const target = useMemo(() => resolvePose(mode, focus, panel, slots, dims), [mode, focus, panel, slots, dims]);
  const arrived = useRef(false);
  const _v = useRef(new THREE.Vector3());
  const _q = useRef(new THREE.Quaternion());

  useEffect(() => { arrived.current = false; }, [mode, focus?.slotIdx, panel]);

  // failsafe: a frozen rAF must not strand the focus leg before "open"
  useEffect(() => {
    if (mode !== "focusing") return;
    const id = setTimeout(() => { if (!arrived.current) { arrived.current = true; arrivedAtWall(); } }, 1300);
    return () => clearTimeout(id);
  }, [mode, focus?.slotIdx, arrivedAtWall]);

  useFrame((_, dtRaw) => {
    if (mode === "free-walk") return;
    const dt = Math.min(dtRaw, 0.05);

    // shelving: hold the staging position, just track the sliding box with the look
    if (mode === "shelving") {
      const slide = useRoomStage.getState().slide;
      const to = useRoomStage.getState().slideTo?.to;
      if (slide && to) {
        const t = THREE.MathUtils.clamp(slide.t, 0, 1);
        const e = t * t * (3 - 2 * t);
        _v.current.set(
          THREE.MathUtils.lerp(STAGING_PLINTH_POS[0], to[0], e),
          BOX_CY,
          THREE.MathUtils.lerp(STAGING_PLINTH_POS[2], to[2], e)
        );
        const pose = makeLookPose([0, 2.9, 5.4], [_v.current.x, _v.current.y, _v.current.z]);
        camera.position.set(pose.pos[0], pose.pos[1], pose.pos[2]);
        _q.current.set(pose.quat[0], pose.quat[1], pose.quat[2], pose.quat[3]);
        camera.quaternion.slerp(_q.current, reduced ? 1 : Math.min(1, dt * 9));
      }
      return;
    }

    if (!target) return;
    const a = reduced ? 1 : 1 - Math.pow(1 - Math.min(1, dt * 2.6), 3);
    _v.current.set(target.pos[0], target.pos[1], target.pos[2]);
    camera.position.lerp(_v.current, a);
    _q.current.set(target.quat[0], target.quat[1], target.quat[2], target.quat[3]);
    camera.quaternion.slerp(_q.current, a);
    if (!arrived.current && (reduced || camera.position.distanceTo(_v.current) < 0.08)) {
      arrived.current = true;
      if (mode === "focusing") arrivedAtWall();
    }
  });

  return null;
}
