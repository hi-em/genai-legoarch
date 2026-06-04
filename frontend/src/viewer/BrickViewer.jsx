import { Canvas } from "@react-three/fiber";
import { OrbitControls, Center, Instances, Instance, ContactShadows } from "@react-three/drei";

// A green studded baseplate the model sits on — makes it read as a set on a
// table. Muted/desaturated green so it stays premium, not "toy bin".
function Baseplate({ nx, ny, margin = 2 }) {
  const x0 = -margin, x1 = nx - 1 + margin;
  const y0 = -margin, y1 = ny - 1 + margin;
  const w = x1 - x0 + 1, d = y1 - y0 + 1;
  const cx = (x0 + x1) / 2, cz = (y0 + y1) / 2;
  const topY = -0.5;          // bricks (z=0) bottom is ~-0.48, so they rest on top
  const thick = 0.5;

  const studs = [];
  for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) studs.push([i, j]);

  return (
    <group>
      {/* darker plate edge / skirt */}
      <mesh position={[cx, topY - thick - 0.12, cz]} receiveShadow>
        <boxGeometry args={[w + 0.25, 0.3, d + 0.25]} />
        <meshStandardMaterial color="#4e6743" roughness={0.85} />
      </mesh>
      {/* plate top */}
      <mesh position={[cx, topY - thick / 2, cz]} receiveShadow castShadow>
        <boxGeometry args={[w, thick, d]} />
        <meshStandardMaterial color="#6f8a5f" roughness={0.78} />
      </mesh>
      {/* studs */}
      <Instances limit={studs.length}>
        <cylinderGeometry args={[0.28, 0.28, 0.2, 14]} />
        <meshStandardMaterial color="#7c9669" roughness={0.65} />
        {studs.map(([i, j], k) => (
          <Instance key={k} position={[i, topY + 0.08, j]} />
        ))}
      </Instances>
    </group>
  );
}

function Bricks({ brickModel, studs = true, monochrome = false }) {
  const bricks = brickModel.bricks;
  const colorOf = (b) => (monochrome ? "#cfd2d1" : b.hex);
  return (
    <group>
      <Instances limit={Math.max(1, bricks.length)} castShadow receiveShadow>
        <boxGeometry args={[0.96, 0.96, 0.96]} />
        <meshStandardMaterial roughness={0.55} metalness={0.0} />
        {bricks.map((b, i) => (
          <Instance key={i} position={[b.x, b.z, b.y]} color={colorOf(b)} />
        ))}
      </Instances>
      {studs && (
        <Instances limit={Math.max(1, bricks.length)} castShadow>
          <cylinderGeometry args={[0.28, 0.28, 0.2, 14]} />
          <meshStandardMaterial roughness={0.5} />
          {bricks.map((b, i) => (
            <Instance key={i} position={[b.x, b.z + 0.55, b.y]} color={colorOf(b)} />
          ))}
        </Instances>
      )}
    </group>
  );
}

export default function BrickViewer({ brickModel, studs = true, monochrome = false, stand = true, height = 380 }) {
  const span = brickModel ? Math.max(brickModel.grid[0], brickModel.grid[2]) : 12;
  const showStand = stand && brickModel;
  return (
    <div style={{ height, borderRadius: 12, overflow: "hidden", background: "linear-gradient(#eef3f7,#d7dee5)" }}>
      <Canvas shadows camera={{ position: [span * 1.5, span * 1.25, span * 1.7], fov: 40 }}>
        <ambientLight intensity={0.65} />
        <directionalLight position={[12, 20, 9]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-8, 6, -6]} intensity={0.35} />
        <Center>
          {brickModel && <Bricks brickModel={brickModel} studs={studs} monochrome={monochrome} />}
          {showStand && <Baseplate nx={brickModel.grid[0]} ny={brickModel.grid[1]} />}
        </Center>
        <ContactShadows position={[0, -0.75, 0]} opacity={0.4} scale={span * 4} blur={2.2} far={20} />
        <OrbitControls enablePan={false} autoRotate autoRotateSpeed={0.8} minDistance={4} maxDistance={span * 5} />
      </Canvas>
    </div>
  );
}
