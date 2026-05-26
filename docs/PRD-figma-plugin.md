# DesignOps Figma Plugin — Product Requirements Document

**Status:** Draft for planning breakdown
**Author:** Detroit Labs DesignOps
**Date:** 2026-05-26
**Target repo:** `DesignOps-figma-plugin` (new, not yet created)
**Supersedes:** Agent-driven workflow in `DesignOps-plugin` (this repo)

> This document is the canonical scope artifact for the DesignOps Figma plugin. Once `DesignOps-figma-plugin` is created, this file moves to its root as `PRD.md`. The current `DesignOps-plugin` repo enters managed sunset (see §17).

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Mission & Strategic Context](#2-mission--strategic-context)
3. [Goals & Non-Goals](#3-goals--non-goals)
4. [Personas & Actors](#4-personas--actors)
5. [Use Cases](#5-use-cases)
6. [Functional Requirements](#6-functional-requirements)
7. [Architecture](#7-architecture)
8. [Data Contracts](#8-data-contracts)
9. [Operations Protocol](#9-operations-protocol)
10. [I/O Subsystem](#10-io-subsystem)
11. [Non-Functional Requirements](#11-non-functional-requirements)
12. [Phasing & Milestones](#12-phasing--milestones)
13. [Distribution Strategy & Feature Gating](#13-distribution-strategy--feature-gating)
14. [Success Metrics](#14-success-metrics)
15. [Risks & Mitigations](#15-risks--mitigations)
16. [Open Questions](#16-open-questions)
17. [Sunset Plan for DesignOps-plugin Repo](#17-sunset-plan-for-designops-plugin-repo)
18. [Glossary](#18-glossary)

---

## 1. Executive Summary

DesignOps today is a set of Claude-driven skills that orchestrate Figma design system work via the MCP `use_figma` tool. The agent-driven approach delivers value but pays a heavy tax: a 50 kB MCP payload cap requires a multi-layer bundle-assembly + subagent transport apparatus, every variable push pays for LLM tokens, designers need Claude Code + MCP configured, and gotchas live as prompt-rules the model must remember.

This PRD specifies a replacement: a deterministic Figma plugin that runs inside the Figma sandbox, owns the bootstrap and context-bridge work natively (no LLM, no MCP transport), and is designed as a **deterministic context bridge between agents** — usable today with Claude (designer-mediated handoff), eventually with the Figma Agent if and when its surface allows, and gracefully deprecated as Figma ships native equivalents.

The plugin's center of gravity is bootstrap speed (design system setup measured in seconds, not minutes) and bidirectional context flow (Figma ↔ consumer repo) through versioned, agent-consumable JSON/Markdown documents.

---

## 2. Mission & Strategic Context

### 2.1 Mission Statement

> **The DesignOps plugin is a deterministic context bridge between agents.** Zero LLM tokens consumed internally; first-class file I/O in both directions; agents are optional upstream/downstream users that the plugin is designed *for* but does not depend *on*.

### 2.2 Why now

| Force | Implication |
|---|---|
| Figma Agent launched May 2026 (free-form design, translations, quick edits) | Pluggable LLM judgment slices can be deferred to Figma; we stop trying to own them |
| Figma Plugin API has full parity for variables, components, modes, bindings, Code Connect | Everything DesignOps does via MCP can be done natively |
| MCP transport layer is the largest source of complexity in the current repo | Removing it deletes whole skill files and convention shards |
| Figma's Variables REST API gates writes to Enterprise plans | Plugin path avoids the plan gate; plugin sandbox uses free Plugin API |

### 2.3 Strategic positioning vs. agents

The plugin assumes a future where free-form design judgment migrates to Figma Agent. Its job is the deterministic, repeatable scaffolding work that benefits from being code rather than prompt-driven:

- Pushing tokens into variables with correct modes and codeSyntax
- Building style-guide canvases that follow auto-layout invariants
- Scaffolding components with variant matrices and variable bindings
- Detecting drift across the design ↔ code boundary
- Capturing handoff context as portable documents

For everything else, the plugin produces context documents (Markdown + JSON) that designers carry to whichever agent makes sense — Claude today, Figma Agent later, none of them if Figma ships native versions.

---

## 3. Goals & Non-Goals

### 3.1 Goals

| # | Goal | Measurable when… |
|---|---|---|
| G1 | Bootstrap a full design system (5 collections, style-guide canvas, 400+ variables) in under 30 seconds | Phase 1 latency benchmark |
| G2 | Scaffold a single component with full variant matrix in under 5 seconds | Phase 2 benchmark |
| G3 | Bidirectional drift detection across Figma ↔ repo with 3-way merge semantics (push/pull/conflict) | Phase 3 tests |
| G4 | Import code components from a connected repo into Figma with deterministic spec extraction | Phase 4 per-framework |
| G5 | Zero LLM tokens consumed inside the plugin | Architecture audit |
| G6 | Agents (Claude / Figma Agent / CLI) can consume plugin outputs and produce plugin inputs without plugin changes | Schema versioning + adoption proof |
| G7 | Designer requires no CLI / Claude Code / MCP setup to use the plugin | Onboarding test with non-engineer designer |

### 3.2 Non-Goals

| # | Non-goal | Why |
|---|---|---|
| N1 | Free-form design generation from prompt | Figma Agent territory |
| N2 | Translation / localization workflows | Figma Agent territory |
| N3 | Accessibility audit beyond emitting raw frame metadata | Figma Agent territory; defer |
| N4 | In-plugin LLM calls of any kind | Violates mission; would add API key handling and cost |
| N5 | Direct writeback into application source code | Engineer territory; plugin emits specs, engineers update implementations |
| N6 | Multi-file batch operations in v1 | Requires Variables REST API (Enterprise) or remote orchestration; deferred |
| N7 | Replacing the engineer-side CLI (shadcn install, `figma connect publish`, ticket creation) | Keep code-side workflows in code-side tooling |
| N8 | Plugin-to-agent automatic invocation | Platform-gated; designer-mediated handoff is the constraint we accept |

---

## 4. Personas & Actors

| Actor | Role | Required? |
|---|---|---|
| **Designer** | Primary plugin user; drives all interactions | Yes |
| **Engineer** | Owns `tokens.json`, reviews PRs from plugin, updates component implementations | Yes (project-side) |
| **DesignOps Plugin** | Deterministic execution engine in Figma sandbox | Yes |
| **Claude (CLI / Cursor / chat)** | Optional pre/post-processing agent for context | Optional |
| **Figma Agent** | Optional on-canvas agent for free-form, translation, a11y | Optional |
| **CI (GitHub Actions)** | Validates contracts; runs `figma connect publish` | Yes for Code Connect publish |

The designer is the **only** human required in every workflow. Every other actor is opt-in.

---

## 5. Use Cases

### 5.1 UC-1: Greenfield design system bootstrap

**Actor:** Designer (Engineer prepared `tokens.json` upstream)
**Trigger:** New Figma file, no existing design system
**Outcome:** Full Figma file populated with 5 variable collections (Primitives, Theme, Typography, Layout, Effects), style-guide canvas pages (color, typography, layout, effects, token overview), audit report
**Latency target:** <30s end-to-end

### 5.2 UC-2: Add component (designer-led, registry pick)

**Actor:** Designer
**Trigger:** Designer needs a known component (e.g. shadcn Button)
**Outcome:** Component scaffolded on canvas with variant matrix and variable bindings; `.designops-registry.json` updated via GitHub PR
**Latency target:** <5s scaffold time

### 5.3 UC-3: Add component (agent-emitted spec)

**Actor:** Designer + Claude (or future Figma Agent)
**Trigger:** Designer needs a component without a known spec
**Outcome:** Claude produces `component-spec.v1.json`; designer pastes / loads from clipboard; plugin scaffolds same as UC-2
**Latency target:** <3 designer clicks past agent conversation

### 5.4 UC-4: Import component from connected repo

**Actor:** Designer (Engineer authored the component in code)
**Trigger:** Component exists in code, not in Figma
**Outcome:** Plugin parses source file (React/Vue/WC/SwiftUI/Compose), produces `component-spec.v1.json`, pre-scans dependencies, designer reviews preview, scaffolds with sub-component instance references where registry matches
**Latency target:** <10s parse + preview; <5s scaffold after accept

### 5.5 UC-5: Bidirectional drift sync

**Actor:** Designer
**Trigger:** Designer opens plugin and sees `Sync · 4↑ 2↓` badge, or runs detect manually
**Outcome:** 3-way comparison surfaces push candidates (Figma → Repo), pull candidates (Repo → Figma), and conflicts (both changed since last sync); designer resolves per-drift; push emits GitHub PR; pull applies locally to Figma
**Latency target:** <2s detect; resolution UX bounded by designer review pace

### 5.6 UC-6: Dev handoff capture

**Actor:** Designer → consumer (Claude / Jira / GitHub)
**Trigger:** Designer ready to hand off a frame to engineering
**Outcome:** Plugin captures frame screenshot, URL, components used (with Code Connect URLs if mapped), tokens referenced, auto-layout metadata; emits `handoff-context.v1.{json,md}`; designer routes via clipboard / GitHub PR / canvas Output page / pluginData
**Latency target:** <1s capture

### 5.7 UC-7: Code Connect mapping emission

**Actor:** Designer initiates; Engineer reviews; CI publishes
**Trigger:** Components on canvas without code mappings
**Outcome:** Plugin detects unmapped, generates per-framework stub files, opens GitHub PR to consumer repo; engineer fills implementation references; CI runs `figma connect publish` on merge
**Latency target:** <5s stub generation for ~10 components

---

## 6. Functional Requirements

### 6.1 Bootstrap engine (FR-BOOT)

| ID | Requirement |
|---|---|
| FR-BOOT-1 | Read tokens from any I/O source (§10) supporting W3C DTCG **or** legacy `.designops-registry.json` shape (hybrid auto-detect) |
| FR-BOOT-2 | Normalize input to canonical internal token model |
| FR-BOOT-3 | Create / update 5 variable collections: Primitives, Theme, Typography, Layout, Effects |
| FR-BOOT-4 | Support modes per collection (Light/Dark on Theme; type-scale modes on Typography per Detroit Labs Foundations) |
| FR-BOOT-5 | Set `codeSyntax` on every variable per platform (Web/Android/iOS) — no platform alias collections (per locked architecture memory) |
| FR-BOOT-6 | Optionally use Figma's Extended Variable Collections (Jan 2026) for theme inheritance — spike in Phase 0 |
| FR-BOOT-7 | Build style-guide canvas pages: color tables, typography specimen, layout grids, effects, token overview |
| FR-BOOT-8 | Run audit after each build; report issues inline (no silent failures) |
| FR-BOOT-9 | Emit ops audit log to chosen sink |

### 6.2 Component scaffold — forward path (FR-SCAF)

| ID | Requirement |
|---|---|
| FR-SCAF-1 | Accept `component-spec.v1.json` from any I/O source |
| FR-SCAF-2 | Create ComponentSet with variants derived from spec's variant matrix |
| FR-SCAF-3 | Apply variable bindings (fill, stroke, radius, padding, gap, text styles) per spec |
| FR-SCAF-4 | Generate component property definitions matching spec props (Boolean, Text, Variant, InstanceSwap) |
| FR-SCAF-5 | Create a usage frame with example instances |
| FR-SCAF-6 | Append to `.designops-registry.json` payload; offer registry export via any sink |
| FR-SCAF-7 | Encode auto-layout invariants (resize-then-sizing-mode order; counter-axis AUTO for matrix specimens; row counter-axis AUTO; no 1px master heights) as helper functions, not prompt rules |

### 6.3 Component import — reverse path (FR-IMP)

| ID | Requirement |
|---|---|
| FR-IMP-1 | Pull component source file from connected repo via GitHub OAuth |
| FR-IMP-2 | Detect framework from file extension + project manifest |
| FR-IMP-3 | Pre-scan dependencies; check registry for sub-components; surface dependency tree before any parse work |
| FR-IMP-4 | Per-framework parser produces `component-spec.v1.json`: variants from enum prop types, booleans from boolean props, layout hints from JSX/template structure |
| FR-IMP-5 | Resolve `className` / CSS variable references to Figma variables via token resolver (§6.9) |
| FR-IMP-6 | Read existing Code Connect mapping if present to improve prop-mapping fidelity |
| FR-IMP-7 | Always show preview; never silent-apply; designer edits in preview before scaffold (locked decision) |
| FR-IMP-8 | Reference existing Figma components for sub-components when registry match exists (locked decision) |
| FR-IMP-9 | Offer "Also emit Code Connect PR" after successful import for components without mappings |

### 6.4 Drift detection (FR-DRIFT)

| ID | Requirement |
|---|---|
| FR-DRIFT-1 | Maintain a "last synced" snapshot per key, stored in canvas pluginData on a hidden node in the DesignOps Output page |
| FR-DRIFT-2 | On detect: pull current repo state, compare against last-synced snapshot AND Figma current state — 3-way |
| FR-DRIFT-3 | Classify each drift as `push` (Figma moved), `pull` (Repo moved), or `conflict` (both moved, disagree) |
| FR-DRIFT-4 | Emit `drift-report.v1.{json,md}` to any chosen sink |
| FR-DRIFT-5 | On plugin open, run a lightweight comparison and show badge: `Sync · N↑ M↓` (and `·K⚠` if conflicts) |
| FR-DRIFT-6 | Cover both variables (tokens.json ↔ Figma local variables) and components (component-spec.json ↔ Figma ComponentSet) |

### 6.5 Resolution UI (FR-RES)

| ID | Requirement |
|---|---|
| FR-RES-1 | Sync tab shows three filter chips: All / Push (↑) / Pull (↓) / Conflicts (⚠) |
| FR-RES-2 | Per-drift actions: Push / Pull / Skip / (for conflicts) Custom value |
| FR-RES-3 | Bulk actions: "Push selected → PR" and "Pull selected → apply"; both disabled if any selected row is an unresolved conflict |
| FR-RES-4 | On successful Push or Pull, update snapshot per-key for touched values |
| FR-RES-5 | On Skip, no snapshot change — drift resurfaces next detect |

### 6.6 Handoff context (FR-HAND)

| ID | Requirement |
|---|---|
| FR-HAND-1 | Capture selection metadata: node IDs, frame URL with deep-link, screenshot PNG export |
| FR-HAND-2 | Enumerate components used; include Code Connect URLs when mapped |
| FR-HAND-3 | List tokens referenced |
| FR-HAND-4 | Include auto-layout metadata (direction, gap, padding, sizing modes) |
| FR-HAND-5 | Emit `handoff-context.v1.{json,md}` to any chosen sink; default to clipboard (most common use) |

### 6.7 Code Connect stub generation (FR-CC)

| ID | Requirement |
|---|---|
| FR-CC-1 | Detect components without Code Connect mappings |
| FR-CC-2 | Per-framework generator produces stub file (React `.figma.tsx`, Vue, WC, SwiftUI, Compose) including Figma node IDs + component prop metadata |
| FR-CC-3 | Open GitHub PR to consumer repo with all stubs in one branch |
| FR-CC-4 | Plugin does **not** publish; CI runs `figma connect publish` on merge |
| FR-CC-5 | Generators share a common `MappingTemplate` interface with the import-side `ImportTemplate` for parser/resolver reuse |

### 6.8 I/O subsystem (FR-IO)

See §10 for full spec. Summary:

| ID | Requirement |
|---|---|
| FR-IO-1 | Four input ports: paste, file picker, clipboard auto-detect on open, GitHub OAuth pull, frame pluginData |
| FR-IO-2 | Four output sinks: download file, copy to clipboard, write to DesignOps Output page text node, write to frame pluginData, open GitHub PR |
| FR-IO-3 | Every contract document serializes as both `.v1.json` AND `.v1.md` (GFM tables + headings); markdown derived from JSON to prevent drift |
| FR-IO-4 | Designer picks file path + format at export time via a unified export sheet |

### 6.9 Connected repo settings (FR-CONF)

| ID | Requirement |
|---|---|
| FR-CONF-1 | Single Settings panel: Connected Repo section with all configured paths visible |
| FR-CONF-2 | Auto-detect token resolver source from repo (Tailwind config → tokens.css → Style Dictionary config → Tokens Studio JSON) |
| FR-CONF-3 | Manual override available; both modes coexist (locked decision) |
| FR-CONF-4 | Per-project scoping in clientStorage, keyed by repo URL |
| FR-CONF-5 | Configurable paths: tokens source, registry path, components directory, reports output directory |

---

## 7. Architecture

### 7.1 Layered model

```
┌─────────────────────────────────────────────────────────┐
│ Shells (front-ends, swappable)                          │
│   • Plugin UI (designer click — primary)                │
│   • Future: Figma Make Skills consuming contracts       │
│   • Future: External CLI driving the core via REST      │
└─────────────────────────────────────────────────────────┘
                       │
                       ▼  JSON ops program (input)
┌─────────────────────────────────────────────────────────┐
│ Ops Protocol (the contract — versioned, stable)         │
│   ops-program.v1 → dispatcher → core function calls     │
└─────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ Deterministic Core (pure TS, no LLM, no network)        │
│   • Variables (push/pull, modes, codeSyntax)            │
│   • Canvas builders (style guide pages)                 │
│   • Component scaffold + variant matrix                 │
│   • Component import + dependency scanner               │
│   • Token resolver (Tailwind / CSS / SD / TS)           │
│   • Drift detector (3-way w/ snapshot)                  │
│   • Handoff context capture                             │
│   • Code Connect stub generators (5 frameworks)         │
└─────────────────────────────────────────────────────────┘
                       │
                       ▼
                  Figma Plugin API
```

### 7.2 I/O surrounding the core

```
                              ┌──────────────────────┐
   Sources ─► normalizer ────►│                      │──► formatter ─► Sinks
                              │                      │
   • paste                    │   Deterministic      │   • download (json/md)
   • file picker              │   Core               │   • clipboard
   • clipboard auto-detect    │                      │   • Output page text node
   • GitHub OAuth pull        │                      │   • frame pluginData
   • frame pluginData         │                      │   • GitHub PR
                              └──────────────────────┘
```

### 7.3 Repo layout (target — `DesignOps-figma-plugin`)

```
DesignOps-figma-plugin/
  src/
    core/                           # Deterministic engines (pure TS)
      variables/
      canvas/                       # color, typography, layout, effects, overview builders
      components/                   # scaffold engine
      import/                       # per-framework parsers
        templates/
          react.ts
          vue.ts
          webcomponents.ts
          swiftui.ts
          compose.ts
        shared/
          tokenResolver.ts
          propTypeMapper.ts
          layoutInferrer.ts
          dependencyScanner.ts
      drift/                        # detector + snapshot
      handoff/                      # context capture
      codeconnect/                  # stub generators (same per-framework structure)
      audit/
    ops/                            # ops protocol: parse → dispatch → execute
    io/
      sources/
        paste.ts
        file.ts
        clipboard.ts
        github.ts
        pluginData.ts
        adapters/                   # W3C DTCG + legacy normalizers
      sinks/
        download.ts
        clipboard.ts
        outputPage.ts
        pluginData.ts
        githubPR.ts
      formats/
        json.ts
        markdown.ts                 # GFM serializer for all contract types
    contracts/                      # v1 JSON schemas (also published as npm pkg)
      opsProgram.v1.ts
      tokens.v1.ts
      componentSpec.v1.ts
      driftReport.v1.ts
      handoffContext.v1.ts
      registry.v1.ts
    ui/                             # React shell
      tabs/
        Bootstrap.tsx
        Components.tsx
        Sync.tsx
        Handoff.tsx
        Settings.tsx
      components/
        ExportSheet.tsx
        DependencyTree.tsx
        ConflictResolver.tsx
    config/
      flags.community.ts
      flags.org.ts
  manifest.community.json
  manifest.org.json
  scripts/
    build-community.mjs
    build-org.mjs
  docs/
    contracts/                      # Public schema docs for agent consumers
    architecture.md
  packages/
    contracts/                      # @detroitlabs/designops-contracts (published)
  tests/
    fixtures/                       # canonical inputs per contract type
    unit/
    integration/
```

### 7.4 Cross-repo contract package

`@detroitlabs/designops-contracts` is published from the new repo and consumed by both:

- The plugin itself
- Any CLI / CI tooling that validates contract documents
- The current `DesignOps-plugin` repo's skills during sunset (so Claude-side consumers can validate inputs/outputs)

Single source of truth for schemas. Bumping a schema is a coordinated package version bump.

---

## 8. Data Contracts

Five document types. Each has a `v1` JSON schema and a derived GFM markdown rendering. Markdown is generated from JSON; never authored separately.

### 8.1 `ops-program.v1`

**Direction:** Input
**Purpose:** "Run these operations against the current Figma file"
**Consumers:** Plugin
**Producers:** Plugin UI (from forms), Claude, future Figma Skill, CLI

```jsonc
{
  "v": 1,
  "kind": "ops-program",
  "meta": { "generatedAt": "ISO-8601", "generatedBy": "claude|designer|cli|figma-agent" },
  "ops": [
    { "type": "push-tokens", "source": { "kind": "inline", "tokens": {...} } },
    { "type": "build-style-guide", "pages": ["color","typography","layout","effects","overview"] },
    { "type": "scaffold-component", "spec": { /* component-spec.v1 */ } },
    { "type": "import-component", "repoPath": "src/components/Button.tsx" },
    { "type": "detect-drift", "scope": ["variables","components"] },
    { "type": "apply-resolution", "decisions": [ { "id": "...", "action": "push|pull|skip" } ] },
    { "type": "emit-handoff", "selection": [ "nodeId..." ] },
    { "type": "emit-code-connect-pr", "components": [ "name..." ], "framework": "react|vue|wc|swiftui|compose" }
  ]
}
```

### 8.2 `tokens` (hybrid: W3C DTCG **or** legacy)

**Direction:** Input
**Purpose:** Source of truth for design tokens
**Detection rules:** `$value`/`$type` keys → W3C DTCG. Detroit Labs `.designops-registry.json` markers → legacy. Ambiguous → error with hint.
**Normalization:** Both formats convert to canonical internal token model before reaching core.

### 8.3 `component-spec.v1`

**Direction:** Input
**Purpose:** Declarative description of a component sufficient to scaffold it
**Consumers:** Plugin scaffold engine
**Producers:** Plugin UI, Claude, plugin importer (from code), hand-authored

```jsonc
{
  "v": 1,
  "kind": "component-spec",
  "name": "Button",
  "framework": "react",
  "variantMatrix": {
    "variant": ["primary", "secondary", "ghost"],
    "size": ["sm", "md", "lg"],
    "disabled": [false, true]
  },
  "props": [
    { "name": "loading", "type": "boolean", "default": false }
  ],
  "bindings": [
    { "selector": "root.fill", "variable": "Theme/Primary" },
    { "selector": "label.text", "variable": "Typography/Body/medium" }
  ],
  "layout": {
    "direction": "horizontal",
    "gap": "Layout/spacing/2",
    "padding": "Layout/spacing/3",
    "sizing": { "horizontal": "hug", "vertical": "hug" }
  },
  "subComponents": [
    { "name": "Icon", "registryRef": "Icon" }
  ],
  "confidence": {
    "layout": "high|medium|low",
    "bindings": "high|medium|low",
    "unresolved": ["bg-muted/40"]
  }
}
```

### 8.4 `drift-report.v1`

**Direction:** Output
**Purpose:** Bidirectional diff with push/pull/conflict classification
**Consumers:** Designer (in plugin UI), Claude, future Figma Agent, engineers (via PR)
**Producers:** Plugin drift detector

```jsonc
{
  "v": 1,
  "kind": "drift-report",
  "meta": { "generatedAt": "ISO-8601", "figmaFileKey": "...", "repoUrl": "..." },
  "summary": { "push": 4, "pull": 2, "conflict": 1, "synced": 410 },
  "drifts": [
    {
      "id": "primitives/color/blue-500",
      "kind": "variable",
      "direction": "push",
      "figma": "#2563EB",
      "repo": "#3B82F6",
      "lastSynced": "#3B82F6"
    },
    {
      "id": "components/Button",
      "kind": "component",
      "direction": "push",
      "figma": { "variantMatrix": { /* with new "loading" */ } },
      "repo": { "variantMatrix": { /* without */ } },
      "lastSynced": { /* matches repo */ }
    },
    {
      "id": "typography/body/size",
      "kind": "variable",
      "direction": "conflict",
      "figma": 16,
      "repo": 15,
      "lastSynced": 14
    }
  ]
}
```

Markdown rendering uses `## Push (4)`, `## Pull (2)`, `## Conflicts (1)` headings with `↑ ↓ ⚠` icons.

### 8.5 `handoff-context.v1`

**Direction:** Output
**Purpose:** Self-contained handoff packet for engineering
**Consumers:** Claude (ticket creation), engineers (Slack/Jira), future Figma Agent
**Producers:** Plugin handoff capture

```jsonc
{
  "v": 1,
  "kind": "handoff-context",
  "meta": { "capturedAt": "ISO-8601", "figmaFileKey": "...", "frameUrl": "..." },
  "frames": [
    {
      "nodeId": "12:34",
      "name": "Checkout",
      "deepLink": "https://figma.com/...?node-id=12:34",
      "screenshot": { "format": "png", "dataUrl": "data:image/png;base64,..." }
    }
  ],
  "components": [
    { "name": "Button", "instances": 4, "codeConnectUrl": "..." }
  ],
  "tokensUsed": ["Theme/Primary", "Layout/spacing/3"],
  "autoLayout": { "direction": "vertical", "gap": "Layout/spacing/4" }
}
```

### 8.6 `registry.v1` (the existing `.designops-registry.json`, formalized)

**Direction:** Both (read for context, write on scaffold/import/sync)
**Purpose:** Single source of truth for what components exist in both Figma and code
**Schema:** TBD in Phase 2; formalize existing repo shape

---

## 9. Operations Protocol

The ops protocol is the contract between any **shell** (UI, agent, CLI) and the deterministic core. A program is a versioned JSON object containing an array of typed operations. The dispatcher parses, validates against schema, then routes each op to the appropriate core function.

### 9.1 Why ops-JSON over direct function calls

| Property | Direct calls | Ops JSON |
|---|---|---|
| Replayable / auditable | No | Yes — drop a `.designops.ops.json` next to the file |
| Agent-friendly | Moderate — agents write code OK | Best fit — JSON emission is well-trained |
| Inter-runtime portable | No — TS functions can't cross sandbox | Yes — JSON crosses any boundary |
| Bridges "external agent can't invoke plugin" gap | No | Yes — agent writes to canvas pluginData, plugin reads on open |

### 9.2 Op type categories

| Category | Op types |
|---|---|
| Bootstrap | `push-tokens`, `build-style-guide` |
| Components | `scaffold-component`, `import-component` |
| Drift | `detect-drift`, `apply-resolution` |
| Handoff | `emit-handoff` |
| Code Connect | `emit-code-connect-pr` |

Each op has a typed payload (validated against `@detroitlabs/designops-contracts`) and a typed return result included in the audit log.

### 9.3 Execution semantics

- Ops execute sequentially unless explicitly marked parallel-safe
- Each op produces a result entry in the run's audit log
- A failed op halts the program; partial state is reported
- All writes are wrapped in a single `figma.commitUndo` boundary so designer can undo a whole run

---

## 10. I/O Subsystem

### 10.1 Sources (input)

| Source | Use case | Phase |
|---|---|---|
| Paste textarea | Designer copy-pastes JSON from anywhere | 1 |
| File picker / drag-drop | Local file from disk (.json or .md) | 1 |
| Clipboard auto-detect on open | Plugin sniffs clipboard for valid contract JSON, offers "Load?" banner | 1 |
| GitHub OAuth pull (read) | Plugin pulls tokens / spec / config from connected repo | 1 (Org) |
| Frame pluginData | Upstream agent dropped ops via MCP write-to-canvas | 3 |

### 10.2 Sinks (output)

| Sink | Use case | Phase |
|---|---|---|
| Download as `.json` / `.md` | Designer carries file manually | 1 |
| Copy to clipboard | Most common — paste to chat/ticket/agent | 1 |
| DesignOps Output page text node | Persistent labeled node; agent with file access can read via MCP | 3 |
| Frame pluginData | Compact machine-readable handoff for round-trips | 3 |
| GitHub PR (write via OAuth) | Engineer-reviewable, mergeable change to consumer repo | 3 (Org) |

### 10.3 Dual-format serialization

Every contract document is emitted as **both** `.v1.json` and `.v1.md`:

- **JSON** is for machines: CI validators, strict schema consumers, agent ingestion
- **Markdown** is for humans and agents in chat: GitHub PR rendering, Claude chat, Figma canvas Output page

Markdown is generated from the JSON in `src/io/formats/markdown.ts`. The two can never diverge because there's only one source. GFM tables + headings, no exotic syntax.

### 10.4 Unified export sheet

Single component used across all flows:

```
┌─ Export drift-report ──────────────────────┐
│  Format:  [● JSON]  [● Markdown]  (both)   │
│                                             │
│  Destinations:                              │
│   ☑ Download file(s)                        │
│   ☐ Copy markdown to clipboard              │
│   ☐ Write to DesignOps Output page          │
│   ☐ Write to frame pluginData               │
│   ☑ Open GitHub PR                          │
│      Path: docs/designops/drift-{date}.md   │
│                                             │
│  [Cancel]                          [Export] │
└─────────────────────────────────────────────┘
```

---

## 11. Non-Functional Requirements

### 11.1 Performance

| Operation | Target | Baseline (current MCP path) |
|---|---|---|
| Full bootstrap (5 collections + style guide) | <30s | 5–15 min |
| Component scaffold (one component) | <5s | 3–8 min |
| Drift detection | <2s | 2–5 min |
| Handoff capture | <1s | 1–3 min |
| Code Connect stub PR (10 components) | <5s + GitHub roundtrip | 10+ min (multi-agent-turn) |

### 11.2 Determinism

- No LLM calls inside plugin
- No randomness in canvas placement (deterministic layout algorithms)
- Same input → same output across runs

### 11.3 Security

- No API keys or secrets in plugin bundle
- GitHub OAuth via standard flow; tokens stored in clientStorage scoped per repo URL (acknowledged: clientStorage is inspectable; OAuth tokens are revocable and limited-scope)
- No third-party network calls beyond GitHub API and Figma Plugin API
- `manifest.networkAccess.allowedDomains`: GitHub only

### 11.4 Determinism failure modes

When something can't be done deterministically (e.g. component import layout inference is uncertain), the plugin:

1. Flags the uncertainty in the preview
2. Requires explicit designer confirmation before proceeding
3. Records the decision in the audit log

Never silent-applies a guess.

### 11.5 Compatibility

- Figma Plugin API current as of 2026-05-26
- Targets Extended Variable Collections (Jan 2026) if Phase 0 spike validates
- Node 20+ for build tooling
- TypeScript strict mode

### 11.6 Internationalization

Plugin UI text in English only for v1. Designer-facing copy stored centrally to allow future localization.

---

## 12. Phasing & Milestones

### Phase 0 — Spike (1–2 days)

**Goal:** Validate platform assumptions before committing
- Single-screen plugin pushes one collection from pasted `tokens.json`
- Validate Extended Variable Collections semantics vs. current 5-collection design
- Measure bootstrap latency vs. MCP baseline
- **Exit criteria:** Latency target G1 looks achievable; no platform blockers

### Phase 1 — Bootstrap core + I/O foundation

**Goal:** Headline value — fast bootstrap from any input
- Full 5-collection push with modes + codeSyntax
- Style-guide canvas builders (color, typography, layout, effects, overview)
- Auto-layout / resize helpers encoding gotchas as code
- I/O sources: paste, file picker, clipboard auto-detect, GitHub OAuth pull (Org build)
- Audit reporting
- **Exit criteria:** G1 met; design system bootstrap demoed end-to-end

### Phase 2 — Component scaffold (forward path)

**Goal:** Add components from spec / registry
- ComponentSet creation with variant matrix
- Variable bindings applied
- Component property definitions
- Usage frame generation
- Registry update output via any sink
- **Exit criteria:** G2 met; UC-2 and UC-3 pass

### Phase 3 — Context export + drift sync

**Goal:** Bidirectional context flow; the agent-bridge story becomes real
- Drift detector (variables + components)
- 3-way snapshot mechanism (canvas pluginData)
- Push / Pull / Conflict resolution UI
- Handoff context capture
- All 4 output sinks wired up
- Markdown rendering for all contract types
- **Exit criteria:** G3 met; UC-5 and UC-6 pass; conflicts resolve correctly

### Phase 4 — Code Connect + Component import

Sub-phased to ship per-framework:

#### 4a — React

- `MappingTemplate` interface
- `ImportTemplate` interface (shared parser infra)
- React Code Connect stub generator
- React `importFromCode` (TS AST → component-spec)
- Token resolver: Tailwind v3/v4 + CSS vars
- Dependency scanner

#### 4b — Vue + Web Components

- Vue SFC parser
- Custom Elements Manifest parser
- Shared web token resolver

#### 4c — SwiftUI + Compose

- Swift parser
- Kotlin parser
- Native asset catalog resolver (different token model)

**Exit criteria:** G4 met per framework; UC-4 and UC-7 pass

### Phase 5 — Sunset of current repo

Parallel with Phase 4. See §17.

---

## 13. Distribution Strategy & Feature Gating

### 13.1 Two build targets, one codebase

| Capability | Community | Org |
|---|---|---|
| Bootstrap (tokens push, style guide canvas) | ✅ | ✅ |
| Component scaffold (forward path) | ✅ | ✅ |
| Drift detection (local snapshot only) | ✅ | ✅ |
| Handoff capture | ✅ | ✅ |
| Paste / file / clipboard / pluginData I/O | ✅ | ✅ |
| Download / clipboard / Output page sinks | ✅ | ✅ |
| GitHub OAuth (read tokens, write PR) | ❌ | ✅ |
| Component import from repo | ❌ (no OAuth) | ✅ |
| Code Connect PR emission | ❌ | ✅ |
| Multi-file batch via Variables REST | ❌ | ✅ (future) |
| Pre-configured token templates | ❌ | ✅ |

### 13.2 Mechanism

Single TS codebase. Build-time constants injected via `src/config/flags.{community,org}.ts`. Two manifests: `manifest.community.json` and `manifest.org.json`. UI affordances gated at the component level. Same code paths, gated visibility.

### 13.3 Distribution channels

- **Community build:** Figma Community plugin listing, public, free, zero-config
- **Org build:** Private installation via Detroit Labs Figma org; configured for client engagements

---

## 14. Success Metrics

| Metric | Target | Measurement |
|---|---|---|
| Bootstrap latency p50 | <30s | Telemetry from Phase 1 demo runs |
| Component scaffold latency p50 | <5s | Same |
| Drift detection latency p50 | <2s | Same |
| LLM tokens consumed inside plugin | 0 | Architecture audit |
| Designer onboarding time to first successful bootstrap | <10 min | User test with non-engineer designer |
| Time to scaffold a 10-component design system | <5 min | Internal benchmark on Detroit Labs Foundations sample |
| Client adoption | TBD (3 engagements within 6 months of GA) | Engagement tracking |
| Reduction in current-repo MCP session token cost | >90% on bootstrap workflows | Compare before/after on equivalent task |

---

## 15. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Figma platform API churn during build | Rework | Medium | Decouple ops protocol from Plugin API specifics; absorb breaking changes in one adapter layer |
| Extended Variable Collections semantics don't match Detroit Labs 5-collection model | Phase 0 redesign | Low–Medium | Phase 0 spike is explicitly scoped to validate this |
| Component import inference quality poor for complex JSX | Designer rejects feature | Medium | "Always preview, never silent-apply" policy; confidence flags; designer review gate |
| Code Connect framework cardinality (5 frameworks) too expensive | Phase 4 slips | Medium | Sub-phased per framework; each ships independently; React-first |
| Plugin parsing performance for large repo files | Slow imports | Low | clientStorage cache keyed by file SHA; sub-second budget; backend escape hatch deferred to v2 |
| Designer adoption stalls — too unfamiliar | Low usage | Medium | Figma Community distribution; ~10-min onboarding flow; mirror designer's existing mental model (push/pull/conflict) |
| Snapshot pluginData lost (file forked, plugin uninstalled, etc.) | False drift on reconnect | Low | Plugin handles missing snapshot by treating all repo state as "last synced" (no-op pull); designer reviews on first run after recovery |
| GitHub OAuth scope creep / privacy concerns | Org install friction | Low | Read-only by default; write scoped to designated repo paths; revocable |
| Figma Agent ships features that overlap with plugin (translation, a11y) | Plugin becomes confusing | Low | Already in §3 non-goals; plugin doesn't compete on these |
| Figma Agent ships native sync / handoff | Plugin's Sync/Handoff tabs obsolete | Medium-long-term | Designed for graceful deprecation: contracts versioned, tabs cleanly removable, core capabilities survive |

---

## 16. Open Questions

| # | Question | Resolution path |
|---|---|---|
| OQ-1 | Does Figma Plugin API support a programmatic auto-launch from a deep link or file annotation? | Test in Phase 0; if yes, revisit clipboard auto-detect priority |
| OQ-2 | Will Figma Agent eventually expose plugin invocation from Skills? | Track in Figma developer relations; trigger v2 architecture review if shipped |
| OQ-3 | Should v1 support Tokens Studio JSON as an input format alongside W3C DTCG and legacy? | Phase 1 user research; adapter is cheap to add later |
| OQ-4 | What's the right cadence for ContractsPackage version bumps? | Resolve during Phase 1 — establish semver discipline on first publish |
| OQ-5 | Should the Org build offer a backend proxy for teams that don't want GitHub OAuth on the designer's seat? | Defer to v1.x based on client feedback |
| OQ-6 | Multi-file design system support (foundations split across 3+ files) — Plugin API limit means per-file runs only | Document as known limitation; revisit with Variables REST in v2 if Enterprise customers ask |
| OQ-7 | How are conflicts surfaced when designer doesn't open the plugin for weeks (snapshot stale)? | UX research in Phase 3 — likely "since last sync (N days ago)" framing |

---

## 17. Sunset Plan for DesignOps-plugin Repo

The current repo enters managed sunset starting at plugin Phase 3 GA. The repo doesn't die — it shrinks to a focused **agent-side companion** to the plugin.

### 17.1 Skill-by-skill disposition

| Skill | Action at Plugin GA |
|---|---|
| `new-project` | Replaced. Skill becomes 1-line redirect: "Install the plugin." |
| `create-design-system` | Replaced. Same redirect. |
| `create-component` | Forward path replaced by plugin. shadcn-install side stays as CLI / Claude skill until that moves to a dedicated CLI. |
| `sync-design-system` | Becomes a thin Claude skill consuming `drift-report.v1.md`. Plugin detects; Claude orchestrates `AskUserQuestion` for conflicts. |
| `dev-handoff` | Becomes thin Claude skill consuming `handoff-context.v1.md` to create the ticket via `gh` / Jira. |
| `code-connect` | Replaced by plugin's PR-emission flow + CI publish. |
| `accessibility-check` | Deprecated; pointer to Figma Agent. |
| `new-language` | Deprecated; pointer to Figma Agent. |
| `canvas-bundle-runner` | Hard-deleted (no 50k cap inside plugin). |

### 17.2 Hard-delete list

- `scripts/assemble-component-use-figma-code.mjs`
- `scripts/check-payload.mjs`
- `scripts/check-use-figma-args.mjs`
- `scripts/probe-parent-transport.mjs`
- `scripts/sync-cache.sh` + `~/.claude/plugins/...` cache mirror
- `skills/canvas-bundle-runner/`
- `AGENTS.md` MCP anti-spiral section (most of it)
- `canvas-templates/bundles/*.min.mcp.js` (lifted into plugin as TS modules)
- `memory.md` MCP / payload sections

### 17.3 Sunset PR

A single dedicated PR after Plugin Phase 3 ships:

- Removes the items in §17.2
- Rewrites surviving skills as plugin-output consumers
- Updates `CLAUDE.md` / `memory.md` to point at the plugin
- Marks deprecated skills with redirect

---

## 18. Glossary

| Term | Definition |
|---|---|
| **Bootstrap** | Initial design system setup: variables push + style-guide canvas |
| **Common ancestor** | The "last synced" snapshot stored in canvas pluginData; baseline for 3-way drift detection |
| **Conflict** | Drift where both Figma and Repo moved since last sync and now disagree |
| **Contract document** | One of the 5 versioned JSON documents the plugin produces or consumes |
| **Deterministic** | Same input → same output; no LLM, no randomness; all behavior reproducible |
| **DesignOps Output page** | Hidden-or-named Figma page where plugin writes labeled text-node outputs and snapshot pluginData |
| **Forward path** | Component scaffold direction: spec → Figma component |
| **Org build** | Private Detroit Labs Figma org build with GitHub OAuth + Code Connect + import features gated on |
| **Pull** | Drift resolution direction: Repo → Figma (apply locally) |
| **Push** | Drift resolution direction: Figma → Repo (open PR) |
| **Reverse path** | Component import direction: code source → component-spec → Figma component |
| **Snapshot** | Per-key record of last-synced values stored in canvas pluginData |
| **Token resolver** | Subsystem that maps CSS class names / CSS variables to Figma variables via project config (Tailwind, etc.) |
| **W3C DTCG** | W3C Design Tokens Community Group standard JSON format for tokens |

---

*End of PRD. Next step: planning breakdown into stories/epics in the new `DesignOps-figma-plugin` repo.*
