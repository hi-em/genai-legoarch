// lEgoarCh wordmark — the capital E and C are set as accent tiles for
// Emilie & Charles. Custom mark (NOT the LEGO logo, which is trademark-protected).
export default function Brand() {
  return (
    <div className="bf-brand">
      <img src="/brick.svg" alt="" aria-hidden="true" />
      <span className="bf-word" aria-label="lEgoarCh">
        l<span className="ec ec-e">E</span>goar<span className="ec ec-c">C</span>h
      </span>
    </div>
  );
}
