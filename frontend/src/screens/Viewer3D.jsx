// M1: TRELLIS 3D model in a three.js viewer. EXIT 1 = download STL → 3D print.
// TODO: @react-three/fiber <Canvas> with the GLB/STL; "Download STL" button;
//       "Continue → Brick Studio" button to start the legolizer (Exit 2).
export default function Viewer3D() {
  return (
    <section className="bf-card">
      <h2 className="bf-h">3D model · Print it (Exit 1)</h2>
      <p className="bf-muted">
        Your render becomes a 3D model (TRELLIS). Stop here to <b>download the STL and 3D-print</b> a smooth souvenir,
        or continue to <b>Brick Studio</b> to turn it into real, buildable bricks.
      </p>
      <div style={{ height: 360, display: "grid", placeItems: "center", background: "#eef0ef", borderRadius: 8 }}>
        <span className="bf-muted">[ three.js viewer — M1 ]</span>
      </div>
      <div style={{ marginTop: "1rem", display: "flex", gap: ".5rem" }}>
        <button className="bf-stud-btn">⬇ Download STL</button>
        <button className="bf-stud-btn">Continue → Brick Studio</button>
      </div>
    </section>
  );
}
