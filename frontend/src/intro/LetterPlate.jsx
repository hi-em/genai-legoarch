// One stamped tile of the launch intro: the training photo flips (rotateY)
// into a printed LEGO letter plate, then flies to its slot in the wordmark
// lockup. A ~120px plate can't land on a ~30px char advance, so the plate
// chrome (background + shadow) sheds mid-flight, leaving just the glyph —
// already recolored to its final wordmark color — to crossfade into the real
// <Wordmark/> at the hold beat.
import { motion } from "framer-motion";
import { BRAND_HEX } from "../components/brand/brand.js";

const GLYPH_RATIO = 0.62; // glyph font-size / tile edge

const hexToRgba0 = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, 0)`;
};

export default function LetterPlate({
  ch,
  colorKey, // null | "yellow" | "red" | "blue"
  tilePx,
  beat, // "idle" | "cascade" | "stamp" | "lockup" | "hold"
  flight, // { dx, dy, scale, delay } px-relative to the tile's grid slot, or null pre-measurement
  fast, // skip path: clamp springs to short tweens
  flipDelay = 0,
  photoSrc,
  onFlipDone,
}) {
  const flipped = beat === "stamp" || beat === "lockup" || beat === "hold";
  const flying = (beat === "lockup" || beat === "hold") && !!flight;
  const vanish = beat === "hold"; // crossfades into the real Wordmark

  const plateBg = colorKey ? BRAND_HEX[colorKey] : "#ffffff";
  const plateBgOut = colorKey ? hexToRgba0(BRAND_HEX[colorKey]) : "rgba(255,255,255,0)";
  const glyphStamp = colorKey ? "#ffffff" : "#20262b"; // ink on white plates
  const glyphFinal = colorKey ? BRAND_HEX[colorKey] : "#e9ebe6"; // = Wordmark on-dark

  return (
    <motion.div
      className="absolute inset-0"
      initial={false}
      animate={{
        x: flying ? flight.dx : 0,
        y: flying ? flight.dy : 0,
        scale: flying ? flight.scale : 1,
        opacity: vanish ? 0 : 1,
      }}
      transition={
        fast
          ? { duration: 0.35, ease: [0.3, 0, 0, 1], opacity: { duration: 0.3, delay: 0.35 } }
          : {
              type: "spring",
              stiffness: 260,
              damping: 28,
              delay: flying ? flight?.delay ?? 0 : 0,
              opacity: { duration: 0.3, delay: 0.4 },
            }
      }
    >
      <div className="h-full w-full [perspective:600px]">
        <motion.div
          className="relative h-full w-full [transform-style:preserve-3d]"
          initial={false}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={
            fast
              ? { duration: 0.2 }
              : { duration: 0.45, ease: [0.3, 0, 0, 1], delay: beat === "stamp" ? flipDelay : 0 }
          }
          onAnimationComplete={() => flipped && onFlipDone?.()}
        >
          {/* front: the training photo (what the tile looked like all along) */}
          <img
            src={photoSrc}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full max-w-none rounded object-cover shadow-pop [backface-visibility:hidden]"
          />
          {/* back: the printed letter plate */}
          <motion.div
            className="absolute inset-0 grid place-items-center rounded [backface-visibility:hidden] [transform:rotateY(180deg)]"
            initial={false}
            animate={{
              backgroundColor: flying || vanish ? plateBgOut : plateBg,
              boxShadow:
                flying || vanish ? "0 0 0 0 rgba(20,30,25,0)" : "0 8px 30px rgba(20,30,25,.20)",
            }}
            transition={{ duration: 0.35 }}
          >
            <motion.span
              className="font-display font-extrabold leading-none"
              style={{ fontSize: tilePx * GLYPH_RATIO }}
              initial={false}
              animate={{ color: flying || vanish ? glyphFinal : glyphStamp }}
              transition={{ duration: 0.35 }}
            >
              {ch}
            </motion.span>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
