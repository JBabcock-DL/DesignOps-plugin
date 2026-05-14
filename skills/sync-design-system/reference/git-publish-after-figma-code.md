# Sync — Git publish after Figma→code writes

> **Linked from:** [`../phases/06-axis-A-and-canvas.md`](../phases/06-axis-A-and-canvas.md) (6.F / 6.R), [`../phases/figma-only-path.md`](../phases/figma-only-path.md) (11.5b), [`../phases/07-10-axes-BC.md`](../phases/07-10-axes-BC.md) (8.F / 8.R F-items).

---

## When this runs

After **successful disk writes** where Figma was the source of truth for **code**:

| Location | Trigger |
|----------|---------|
| **6.F / 6.R (Axis A)** | At least one token value was written into the local token file from Figma (`M > 0` in 6.R, or any write in 6.F). |
| **11.5b** | User confirmed write; token file was updated from `plan.A.figmaVarsInMemory`. |
| **8.F / 8.R (Axis B)** | Drift markdown file was written for F-resolved component drift (8.F full axis; 8.R scoped F items). |

---

## Step A — Probe git (silent skip)

From the **consumer repo root** (directory containing the written files):

1. Run `git rev-parse --is-inside-work-tree` (or equivalent). If exit non-zero or output is not `true`:
   - Log: `Git publish: skipped (not a git repository).`
   - **Stop** — do **not** call **AskUserQuestion** for git publish.

2. If inside a git repo, continue to Step B.

---

## Step B — AskUserQuestion (one decision moment)

Call **`AskUserQuestion` once** with exactly these options (labels may shorten; meanings must match):

| Option | Meaning |
|--------|---------|
| **Skip git** | Leave changes **uncommitted** in the working tree only. |
| **Open pull request** | Create a new branch, `git add` **only** the paths this step wrote, commit, `git push -u origin HEAD`, then `gh pr create` with an appropriate title/body. |
| **Push to current branch** | `git add` **only** those paths, `git commit`, `git push` to the configured upstream (may push directly to `main` if that is the current branch — warn in the prompt body). |

**Prompt body (adapt paths + summary):**

> "Figma→code updates were written to: `<list of paths>`.
> How should these be published in git?
> - **Skip git** — I will not run git commands; you commit/PR yourself.
> - **Open pull request** — New branch + commit + push + GitHub PR (needs `gh` CLI authenticated and a remote named `origin`).
> - **Push to current branch** — Commit on your current branch and push (uses upstream; **directly updates the branch you have checked out**, including `main` if applicable)."

**One tool call per decision moment** — do not combine this with the 11.5b write-confirm prompt or the Step 5 axis bundle.

---

## Step C — Execute the chosen path

### Skip git

Log: `Git publish: skipped (user choice).` Done.

### Open pull request

**Preflight** (if any check fails, log and **do not** partially commit — leave working tree as after write):

- `command -v gh` (or host equivalent) — if missing: `Git publish: PR skipped (gh CLI not found).`
- `git remote get-url origin` — if missing: `Git publish: PR skipped (no origin remote).`

**Commands** (token / drift file only — adjust branch prefix per call site):

```bash
git checkout -b sync/figma-code-{YYYYMMDD-HHmm}
git add -- <path1> [<path2> ...]
git status   # verify only intended paths staged
git commit -m "chore(sync): sync from Figma"
git push -u origin HEAD
gh pr create --title "<title>" --body "<body>"
```

- **Axis B drift:** branch name `sync/design-drift-{YYYYMMDD-HHmm}`; title `Design drift — {YYYY-MM-DD HH:mm}`; body points at drift file (same spirit as previous hard-coded 8.F example).
- **Tokens:** branch `sync/figma-tokens-{YYYYMMDD-HHmm}`; title `chore(sync): tokens from Figma — {YYYY-MM-DD}`; short body listing token file path.

Record PR URL in the Step 11 report when applicable.

### Push to current branch

**Preflight:** `git remote get-url origin` (or `git rev-parse --abbrev-ref @{upstream}`) — if no upstream configured, log `Git publish: push skipped (no upstream for current branch).` and stop.

```bash
git add -- <path1> [<path2> ...]
git commit -m "chore(sync): sync from Figma"
git push
```

On non-zero exit from `git` / `gh`, log stderr, report `Git publish: failed (<reason>)`, and do **not** claim success. Leave repo state for the user to inspect.

---

## Notes

- **Stage only written paths** — never `git add -A` unless the skill is the sole editor and the phase explicitly allows it (default: **no**).
- **Sandboxes / CI:** If the agent cannot run `git`/`gh`, treat as preflight failure and log skip — same as missing `gh` for PR path.
- **Mixed R-mode (8.R):** When both F and C resolutions exist, write the **F** drift file and run the **git publish gate** for it **before** running `/create-component` for **C** items. Axis **A** F→code token writes use the **6.F / 6.R** gate separately in Step 6.
