import { Canvas } from "@react-three/fiber";
import { OrbitControls, Center, Instances, Instance, ContactShadows } from "@react-three/drei";

// Renders a brick model. studs=true -> LEGO look; monochrome -> grey "print" preview.
// highlightUnsupported -> tint not-directly-supported bricks red (stability cue).
function Bricks({ brickModel, studs = true, monochrome = false }) {
  const bricks = brickModel.bricks;
  const supportSet = new Set(bricks.map((b) => `${b.x},${b.y},${b.z}`));
  const colorOf = (b) => {
    if (monochrome) return "#cfd2d1";
    return b.hex;
  };
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

export default function BrickViewer({ brickModel, studs = true, monochrome = false, height = 380 }) {
  const span = brickModel ? Math.max(brickModel.grid[0], brickModel.grid[2]) : 12;
  return (
    <div style={{ height, borderRadius: 10, overflow: "hidden", background: "linear-gradient(#eef3f7,#dfe7ee)" }}>
      <Canvas shadows camera={{ position: [span * 1.4, span * 1.2, span * 1.6], fov: 40 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 18, 8]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
        <Center>{brickModel && <Bricks brickModel={brickModel} studs={studs} monochrome={monochrome} />}</Center>
        <ContactShadows position={[0, -0.01, 0]} opacity={0.35} scale={span * 4} blur={2} far={20} />
        <OrbitControls enablePan={false} autoRotate autoRotateSpeed={0.8} minDistance={4} maxDistance={span * 5} />
      </Canvas>
    </div>
  );
}
