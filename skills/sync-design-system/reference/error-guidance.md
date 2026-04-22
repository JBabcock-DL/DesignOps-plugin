# Sync — Error guidance

> **Linked from:** phase files and [`figma-only-path.md`](../phases/figma-only-path.md).

---

## Error Guidance

### File not found

> "The token file at `<path>` could not be found. Please check the path in `plugin/.claude/settings.local.json` or provide the correct file path."

If the path is still wrong after reporting the error, call **AskUserQuestion** to collect a corrected path before continuing.

### Malformed token file

> "The token file at `<path>` could not be parsed. It may contain a syntax error or an unsupported format.
>
> Supported formats: `tokens.json` (W3C DTCG), `tailwind.config.js`, CSS custom properties (`.css` / `.scss`).
>
> Please fix the file and run `/sync-design-system` again, or provide an alternative token file path."

Then call **AskUserQuestion** asking whether to paste a new token file path or stop the skill.

### API write permission error (403 / insufficient permissions)

> "The Figma API returned a permission error when trying to write variables. This usually means one of:
>
> - Your Figma account is not on an Organization tier plan (required for REST Variables API write access).
> - The Figma MCP connector needs to be re-authenticated in Claude Code settings.
> - You do not have edit access to the Figma file (`<file-key>`).
>
> Please verify your plan tier and connector auth, then retry."

### API read error (4xx / 5xx on GET variables)

> "Could not read variables from Figma file `<file-key>`. HTTP `<status>`: `<message>`.
>
> Check that the file key is correct and that your Figma MCP connector is authenticated. If the error persists, try re-authenticating the connector in Claude Code settings."

### Axis B extractor failure

If `extract-cva.mjs` exits non-zero for a component (custom composition, no cva, Radix-only file, etc.), record the component as `unresolvable` in the Axis B diff:

> `Axis B: {component} — source is not cva-based, cannot extract variant structure. Included in the diff as informational only; direction prompts will not target this component.`

That **`unresolvable` label applies to this Axis B diff only** (code-vs-Figma variant structure comparison). It does **not** mean `/create-component` cannot run: the same extractor outcome routes that skill to **Mode B**, and Step 6 may still draw a valid ComponentSet from curated `shadcn-props` + the synthetic template. See [`../../create-component/SKILL.md`](../../create-component/SKILL.md) §4.5.0.

### Axis C Connect API failure

**Partial failure — per-node tool flakes on some mappings.** If `get_code_connect_map` succeeds for some local mappings and fails for others (timeouts, transient errors, throws), mark only the failing ones as `publishedState: 'indeterminate'` per Step 2C. They're omitted from the 3C diff. Successful lookups still participate normally. This is the graceful degradation path — **never** blanket-mark everything as `unpublished` because a subset failed.

**Total failure — per-node tool unavailable for the session.** If `mcp__claude_ai_Figma__get_code_connect_map` is not callable at all (MCP not installed, handshake failure, etc.), fall back to the CLI bulk listing:

```bash
npx figma connect list --published --token=<PAT>
```

If the CLI returns a **non-empty** listing, build the per-mapping `publishedState` from its rows. If the CLI returns an **empty** listing, treat every local mapping as `indeterminate` (an empty bulk response from a live endpoint usually means degraded service, not genuinely-nothing-is-published).

**All paths down — MCP per-node AND CLI both fail.** Fall back to a `local-only` Axis C — diff buckets `missing` / `stale` / `unpublished` all become unavailable (they require the published side), and only `orphaned` is reported (source file deleted). Emit:

> `Axis C: published-state read unavailable (MCP + CLI both failed); diff limited to orphaned mappings (source files deleted).`

The user can still push in the C-wins direction (delegates to `/code-connect`, which has its own auth path and will idempotently no-op for already-published mappings — same guarantee that surfaces the *"Component is already mapped to code"* response); F-wins on an axis without published-state read is disabled for this run.
