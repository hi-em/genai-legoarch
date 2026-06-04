import Generate from "../screens/Generate.jsx";
import Viewer3D from "../screens/Viewer3D.jsx";
import BrickStudio from "../screens/BrickStudio.jsx";
import Shelf from "../screens/Shelf.jsx";
import Playground from "../screens/Playground.jsx";

// Maps a zone id to its screen, passing the `active` flag (live 3D vs poster).
export default function ZoneBody({ id, active }) {
  switch (id) {
    case "generate": return <Generate active={active} />;
    case "viewer": return <Viewer3D active={active} />;
    case "studio": return <BrickStudio active={active} />;
    case "shelf": return <Shelf active={active} />;
    case "playground": return <Playground active={active} />;
    default: return null;
  }
}
