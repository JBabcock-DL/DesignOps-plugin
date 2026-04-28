# Composer 2 probe + `qa:assembled-size` fixture

**`handoff.json`** — `{}` (fresh draw) for scripts that only need a file to exist.

## Parent transport proof (`.transport-proof.json`)

1. Emit synthetic MCP args (default 25 000 B `code`; total wrapper is larger):

   ```bash
   node scripts/probe-parent-transport.mjs --size 25000 --out probe-args-25k.json
   ```

   The command prints **`total-mcp-args`** (UTF-8 bytes of the full JSON). In the **parent** agent, `Read` `probe-args-25k.json` and run **`call_mcp` → `use_figma`** once for a real round-trip (use a real **`--file-key`** if Figma must succeed in-file).

2. After a **successful** tool call, record the proven size (use the **total** UTF-8 size you actually sent, or match the script’s printed line):

   ```bash
   node scripts/probe-parent-transport.mjs --record --size 25000 \
     --observed-bytes <N> --target "$(pwd)"
   ```

   Writes **`.transport-proof.json`** here. **`maxProvenSize`** is cited in **[`AGENTS.md`](../../../AGENTS.md)** anti-confabulation policy.

Committed **optional** illustrative proof must be regenerated in Composer — see **[`08-cursor-composer-mcp.md`](../../../skills/create-component/conventions/08-cursor-composer-mcp.md)** and **[`EXECUTOR.md`](../../../skills/create-component/EXECUTOR.md)**.

## Size report for all slugs

From DesignOps-plugin root (with **`handoff.json` = `{}`**, only **`cc-doc-scaffold-shell`** assembles; other slugs need realistic merged handoff — see merge script errors in JSON output):

```bash
npm run qa:assembled-size -- \
  --draw-dir scripts/test-fixtures/composer2-probe-draw \
  --layout control \
  --config-block scripts/test-fixtures/min-op-scaffold.config.mjs \
  --registry "{}" \
  --file-key headless-or-test
```

For **delegate engine byte sizes** without a full handoff:

```bash
npm run report:delegate-sizes
```

Produces JSON under **`.designops/qa-size-report/`** in the draw-dir (gitignored) with **`mcpWrapperBytes`** per successful slug.
