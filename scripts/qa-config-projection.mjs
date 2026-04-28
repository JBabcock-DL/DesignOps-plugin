#!/usr/bin/env node
/**
 * Smoke tests for Tier 1 CONFIG projection (identity defaults + whitelist path).
 */

import assert from "node:assert";
import {
  applyConfigProjectionForSlug,
  configObjectToEmbeddedBlock,
} from "./config-projection.mjs";

const fixture = {
  layoutKey: "chip",
  componentName: "Button",
  shadcnSourceHash: "abc",
  extras: [1],
};

// Default map: identity (full CONFIG)
assert.deepStrictEqual(
  applyConfigProjectionForSlug("cc-variants", fixture),
  fixture,
  "defaults should preserve full CONFIG"
);

assert.ok(
  configObjectToEmbeddedBlock({ x: 1 }).includes('"x": 1'),
  "embedded block should stringify"
);

console.log("ok: qa-config-projection");
