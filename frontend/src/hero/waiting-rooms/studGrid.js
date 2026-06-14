// The on-screen stud pitch + dot wash shared by every waiting-room treatment,
// so the three rooms read as one family (not three magic 22s). StageSquare's
// VoxelSweep draws grid LINES instead of dots, so it imports STUD_PITCH only.
export const STUD_PITCH = 22;

// radial stud-dot texture used by CardHand (card backs) + VisualizingCanvas
export const studDotBg = (opacity) => ({
  backgroundImage: "radial-gradient(circle, #ffffff 1.2px, transparent 1.4px)",
  backgroundSize: `${STUD_PITCH}px ${STUD_PITCH}px`,
  opacity,
});
