// Decides how the collection is shown and degrades gracefully:
//   no WebGL / room crash / context loss  -> plain accessible list (-> SetDetail)
//   coarse pointer (touch)                -> orbit-around-room (no pointer lock)
//   otherwise                             -> full first-person walk
// In the 3D paths a set is opened IN the room (useRoomStage.focusWallSet),
// never via SetDetail — so onOpenSet is only the list fallback's handler.
import { useMemo, useState } from "react";
import ErrorBoundary from "../components/ErrorBoundary.jsx";
import { hasWebGL, coarsePointer } from "../lib/webgl.js";
import Room from "./Room.jsx";
import CollectionList from "./CollectionList.jsx";

export default function RoomGate({ items, onOpenSet, onRemove }) {
  const [forceList, setForceList] = useState(false);
  const webgl = useMemo(hasWebGL, []);
  const coarse = useMemo(coarsePointer, []);

  if (!webgl || forceList) {
    return (
      <div className="h-full overflow-y-auto pb-4">
        <CollectionList items={items} onSelect={onOpenSet} onRemove={onRemove} />
      </div>
    );
  }

  return (
    <ErrorBoundary silent onError={() => setForceList(true)}>
      <Room mode={coarse ? "orbit" : "fps"} items={items} onUseList={() => setForceList(true)} />
    </ErrorBoundary>
  );
}
