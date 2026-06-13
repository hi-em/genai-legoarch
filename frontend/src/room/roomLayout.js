// Layout + movement constants for the collector's room — a walkable gallery
// where each saved set stands as a boxed product on its own plinth down two
// side walls, with the whiteboard on the back wall. 1 unit = 1 stud, same as
// the rest of the 3D (bricks3d.jsx).
import * as THREE from "three";
import { BOX } from "../lib/boxTexture.js";

export const EYE_Y = 1.7;          // standing eye height
export const WALL_H = 5.2;         // room height
export const PLAYER_R = 0.5;       // keeps the camera off the walls
export const PLINTH_H = 1.05;      // waist-high display plinth
export const BOX_DISPLAY_SCALE = 1.7;
export const OPEN_RANGE = 3.8;     // walk this close to a set to open it
export const MOVE_SPEED = 6.2;     // units / second

// Room grows with the collection so 20 sets never crowd the aisle.
export function roomDims(n) {
  const perSide = Math.max(1, Math.ceil(n / 2));
  const depth = Math.max(15, 9 + (perSide - 1) * 5);
  const width = 13;
  return { width, depth, wallH: WALL_H };
}

export function spawnPos(dims) {
  return [0, EYE_Y, dims.depth / 2 - 2.8];   // just inside the door, facing the room (-Z)
}

export function bounds(dims) {
  return {
    minX: -dims.width / 2 + PLAYER_R,
    maxX: dims.width / 2 - PLAYER_R,
    minZ: -dims.depth / 2 + PLAYER_R,
    maxZ: dims.depth / 2 - PLAYER_R,
  };
}

// Sets alternate down the left and right walls, marching front -> back; each
// box's printed front faces the aisle (centre). yaw rotates +Z toward the
// centre line.
export function pedestalSlots(n, dims) {
  const xL = -dims.width / 2 + 1.6;
  const xR = dims.width / 2 - 1.6;
  const zFront = dims.depth / 2 - 4;
  const zBack = -dims.depth / 2 + 4;
  const perSide = Math.max(1, Math.ceil(n / 2));
  const slots = [];
  for (let i = 0; i < n; i++) {
    const side = i % 2;             // 0 = left, 1 = right
    const idx = Math.floor(i / 2);  // step along that wall
    const t = perSide > 1 ? idx / (perSide - 1) : 0;
    const z = zFront + (zBack - zFront) * t;
    const x = side === 0 ? xL : xR;
    const yaw = side === 0 ? Math.PI / 2 : -Math.PI / 2;
    slots.push({ pos: [x, 0, z], yaw });
  }
  return slots;
}

// Circular keep-out around each plinth so you can't walk through a display.
export function noGoZones(slots) {
  return slots.map((s) => ({ x: s.pos[0], z: s.pos[2], r: 1.6 }));
}

// ---------------------------------------------------------------------------
// Staging: a freshly-forged set is packed on a central plinth (room centre),
// then slides to its wall slot. Camera poses are resolved here so CameraRig
// has a single source for where to look.

export const STAGING_PLINTH_POS = [0, 0, 0];   // room centre, clear of both side walls
export const STAGING_YAW = 0;                  // box front (+z) faces the staging camera

// A camera pose = { pos:[x,y,z], quat:[x,y,z,w] }. Built from a temp camera so
// the quaternion matches how a PerspectiveCamera would frame the target.
const _cam = new THREE.PerspectiveCamera();
export function makeLookPose(eye, target) {
  _cam.position.set(eye[0], eye[1], eye[2]);
  _cam.up.set(0, 1, 0);
  _cam.lookAt(target[0], target[1], target[2]);
  const q = _cam.quaternion;
  return { pos: [eye[0], eye[1], eye[2]], quat: [q.x, q.y, q.z, q.w] };
}

const boxCenterY = (scale) => PLINTH_H + (BOX.BH * scale) / 2;

// Stand in front of the central plinth, framing the packed box.
export function stagingCameraPose(/* dims */) {
  return makeLookPose([0, 2.9, 5.4], [0, boxCenterY(BOX_DISPLAY_SCALE), 0]);
}

// Stand on the aisle side of a wall slot, looking at its box.
export function wallFocusPose(slot) {
  const [x, , z] = slot.pos;
  const aisle = x < 0 ? 1 : -1;             // step toward room centre
  const eye = [x + aisle * 3.2, EYE_Y, z];
  return makeLookPose(eye, [x, boxCenterY(BOX_DISPLAY_SCALE), z]);
}

// The booklet comes to a fixed central lectern in front of the spawn, read from
// a consistent pose — independent of where the box is, so staging and wall sets
// share one clean reading setup.
export function bookPos(dims) {
  return [0, 1.85, dims.depth / 2 - 6.2];
}
export function bookReadingPose(dims) {
  const z = dims.depth / 2 - 4;
  return makeLookPose([0, 1.95, z], [0, 1.8, z - 2.2]);
}

// A clamped standing pose to release the camera back into free-walk.
export function standingPose(dims, near = true) {
  const z = near ? dims.depth / 2 - 2.8 : 0;
  return makeLookPose([0, EYE_Y, z], [0, EYE_Y, z - 1]);
}

// Keep-out for the central staging plinth (only meaningful if walking while staged).
export function stagingNoGo() {
  return { x: STAGING_PLINTH_POS[0], z: STAGING_PLINTH_POS[2], r: 1.8 };
}
