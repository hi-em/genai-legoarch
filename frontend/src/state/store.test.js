// Regression coverage for the shelf collection's write paths — specifically the
// Task 4 bug where re-tuning a saved set dropped an UNRELATED (oldest) set
// instead of updating the edited one in place.
//
// The store reads localStorage at import time, and vitest runs in node (no DOM),
// so we install an in-memory localStorage stub BEFORE importing via dynamic
// import (which, unlike a static import, is not hoisted above this stub).
import { describe, it, expect, beforeEach } from "vitest";

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)); },
  removeItem: (k) => { mem.delete(k); },
  clear: () => mem.clear(),
};

const { useCollection } = await import("./store.js");

const mk = (id, nBricks) => ({
  id, title: `set-${id}`, nBricks, brickModel: { grid: [1, 1, 1] }, created_at: `${id}`,
});

beforeEach(() => {
  mem.clear();
  useCollection.setState({ items: [] });
});

describe("useCollection.add", () => {
  it("prepends new sets (newest first)", () => {
    useCollection.getState().add(mk("a", 100));
    useCollection.getState().add(mk("b", 200));
    expect(useCollection.getState().items.map((i) => i.id)).toEqual(["b", "a"]);
  });
});

describe("useCollection.update — Task 4 re-tune replaces in place", () => {
  it("updates the edited set by id WITHOUT dropping any unrelated set", () => {
    useCollection.getState().add(mk("sagrada", 4242)); // oldest
    useCollection.getState().add(mk("muralla", 3000)); // newest, the one we edit

    const res = useCollection.getState().update("muralla", { nBricks: 8888, updated_at: "x" });
    const items = useCollection.getState().items;

    expect(res).toEqual({ updated: true, dropped: 0 });
    expect(items).toHaveLength(2);                       // no duplicate added
    expect(items.map((i) => i.id)).toEqual(["muralla", "sagrada"]); // order preserved
    expect(items.find((i) => i.id === "muralla").nBricks).toBe(8888); // edited in place
    expect(items.find((i) => i.id === "muralla").updated_at).toBe("x");
    expect(items.find((i) => i.id === "sagrada").nBricks).toBe(4242); // UNRELATED set untouched
  });

  it("editing the OLDEST set also leaves the others intact (same id, no churn)", () => {
    useCollection.getState().add(mk("old", 100));
    useCollection.getState().add(mk("mid", 200));
    useCollection.getState().add(mk("new", 300));

    useCollection.getState().update("old", { nBricks: 999 });
    const items = useCollection.getState().items;

    expect(items.map((i) => i.id)).toEqual(["new", "mid", "old"]);
    expect(items.find((i) => i.id === "old").nBricks).toBe(999);
    expect(items.find((i) => i.id === "new").nBricks).toBe(300);
  });

  it("no-ops for an id that isn't on the shelf", () => {
    useCollection.getState().add(mk("a", 100));
    const res = useCollection.getState().update("ghost", { nBricks: 1 });
    expect(res).toEqual({ updated: false, dropped: 0 });
    expect(useCollection.getState().items).toHaveLength(1);
    expect(useCollection.getState().items[0].nBricks).toBe(100);
  });
});
