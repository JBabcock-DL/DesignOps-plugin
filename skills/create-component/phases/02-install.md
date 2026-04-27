# Phase 02 — Install, harden, extract CONFIG

**Maps to:** [`EXECUTOR.md`](../EXECUTOR.md) steps **4, 4.3, 4.4, 4.7**; [`SKILL.md`](../SKILL.md) **§4.5** (Mode A / B CONFIG per component).

**Authority:** EXECUTOR for install / peer / rewrite / 4.7; SKILL **§4.5** for extraction and Mode branch.

**You are here when:** setup is complete; you install each component, fix peer deps, rewrite icon imports if applicable, run token-path preflight, and build **verbatim** `const CONFIG = { … }` (or `configBlock`) for each component in the run.

**Exit when:** each component has a final `configBlock` string ready for Figma; token paths confirmed or user acknowledged per [`conventions/07-token-paths.md`](../conventions/07-token-paths.md) (Step **4.7**; if `get_variable_defs` is empty, use **§7.3.1** — one full enumeration, no random `nodeId` loop).

**Next:** [`03-figma-prep.md`](./03-figma-prep.md)
