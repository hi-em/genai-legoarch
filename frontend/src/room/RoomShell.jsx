// The room itself: a warm walnut-and-felt gallery box (floor, four walls,
// ceiling) lit like a small museum. Sized from roomDims so it always wraps the
// pedestals. Walls/floor cast no geometry cost beyond six planes.
import { WALL_H } from "./roomLayout.js";

const WALL = "#2b2620";     // warm dark wall, sits with the --table felt
const FLOOR = "#211c17";    // dark walnut floor
const CEIL = "#17140f";
const TRIM = "#3b3128";     // walnut trim / baseboard

export default function RoomShell({ dims }) {
  const { width: W, depth: D } = dims;
  const hw = W / 2, hd = D / 2;
  return (
    <group>
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color={FLOOR} roughness={0.95} />
      </mesh>
      {/* ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_H, 0]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color={CEIL} roughness={1} />
      </mesh>
      {/* back wall (-Z) — the whiteboard hangs here */}
      <mesh position={[0, WALL_H / 2, -hd]} receiveShadow>
        <planeGeometry args={[W, WALL_H]} />
        <meshStandardMaterial color={WALL} roughness={0.95} />
      </mesh>
      {/* front wall (+Z) */}
      <mesh rotation={[0, Math.PI, 0]} position={[0, WALL_H / 2, hd]}>
        <planeGeometry args={[W, WALL_H]} />
        <meshStandardMaterial color={WALL} roughness={0.95} />
      </mesh>
      {/* left wall (-X) */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[-hw, WALL_H / 2, 0]} receiveShadow>
        <planeGeometry args={[D, WALL_H]} />
        <meshStandardMaterial color={WALL} roughness={0.95} />
      </mesh>
      {/* right wall (+X) */}
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[hw, WALL_H / 2, 0]} receiveShadow>
        <planeGeometry args={[D, WALL_H]} />
        <meshStandardMaterial color={WALL} roughness={0.95} />
      </mesh>
      {/* baseboard runs along both side walls */}
      <mesh position={[-hw + 0.05, 0.2, 0]}>
        <boxGeometry args={[0.1, 0.4, D]} />
        <meshStandardMaterial color={TRIM} roughness={0.8} />
      </mesh>
      <mesh position={[hw - 0.05, 0.2, 0]}>
        <boxGeometry args={[0.1, 0.4, D]} />
        <meshStandardMaterial color={TRIM} roughness={0.8} />
      </mesh>

      {/* lighting: soft ambient + a warm ceiling key + a fill toward the back */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[2, WALL_H + 2, hd]}
        intensity={1.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-W}
        shadow-camera-right={W}
        shadow-camera-top={D}
        shadow-camera-bottom={-D}
        shadow-camera-near={1}
        shadow-camera-far={D + WALL_H + 6}
        shadow-bias={-0.0004}
      />
      <pointLight position={[0, WALL_H - 0.6, -hd + 2]} intensity={0.4} distance={D} />
    </group>
  );
}
