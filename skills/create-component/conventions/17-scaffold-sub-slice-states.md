# Scaffold sub-slice intermediate states (Plan A)

When the legacy single machine slug **`cc-doc-scaffold`** is replaced by **five** slugs (`cc-doc-scaffold-shell` … `cc-doc-scaffold-placeholders`, with **table chrome** and **table body** split), each `use_figma` must leave the file in a state that does not violate the doc pipeline invariants in [`04-doc-pipeline-contract.md`](./04-doc-pipeline-contract.md) and [`09-mcp-multi-step-doc-pipeline.md`](./09-mcp-multi-step-doc-pipeline.md) **1.1** for the **union** of completed slices so far.

| Slug (order) | Figma result after the slice | Notes |
|-------------|-----------------------------|--------|
| `cc-doc-scaffold-shell` | `_PageContent` on the page; `doc/component/<name>` root frame; **no** header, table, or dashed reserves yet | Ids for `pageContentId` + `docRootId` are valid for the next handoff. |
| `cc-doc-scaffold-header` | Header frame + title + summary under `docRoot` | No table; placeholder row count not required until table slices. |
| `cc-doc-scaffold-table-chrome` | **Properties** group, table frame, **header** row only (no body) | Figma return should include `propertiesTableId` for the table node so the body slice can `append` rows. |
| `cc-doc-scaffold-table-body` | **N** placeholder body rows (N = `CONFIG.properties.length`) | Requires prior merge with `doc.propertiesTableId`. Matches step1 table contract (with chrome) before `cc-variants`. |
| `cc-doc-scaffold-placeholders` | Three dashed reserve frames under `docRoot` (component-set, matrix, usage) | Same end state as the legacy **one-call** `create-component-engine-doc.step1` / single-merge scaffold before variants. |

**`cc-variants` runs only after the last row** (`cc-doc-scaffold-placeholders` merged). The global DAG in [`13-component-draw-orchestrator.md`](./13-component-draw-orchestrator.md) is unchanged: all scaffold sub-slugs complete before `cc-variants`.
