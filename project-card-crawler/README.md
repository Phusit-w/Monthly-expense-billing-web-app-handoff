# Project Card crawler

Crawls the `PS` network share (`\\192.168.99.1\PS`) and pushes one **Project
Card** per project folder found to `expense-billing-app`'s ingest API. Runs
by hand, from a machine that has access to the share — the app's server
doesn't (see `../docs/adr/0005-project-card-push-based-ingest.md`). See
`../app/(app)/project-card/CONTEXT.md` for the domain glossary and
`../../PROJECT-SEARCH-GRILL-2026-09-15.md` (repo root) for the full design
history.

## Setup

```powershell
cd "C:\Phusit\Claude Project\ICN Apps\expense-billing-app\project-card-crawler"
python -m pip install -r requirements.txt
```

## Run

```powershell
# Discover + summarize only, print the payload, push nothing:
python main.py --ps-root "\\192.168.99.1\PS" --dry-run

# Push for real:
python main.py --ps-root "\\192.168.99.1\PS" `
  --api-url https://psaidemo.icn21.local/api/project-card/ingest `
  --api-key <PROJECT_CARD_INGEST_KEY> `
  --insecure
```

`--api-key` is set on the production Windows service's own environment
(`nssm get ExpenseBillingApp AppEnvironmentExtra`), not in a `.env` file —
the running service never reads `.env` at all (see
docs/DEPLOY-WINDOWS.md). `--insecure` skips TLS certificate verification,
needed because `psaidemo.icn21.local` uses a self-signed cert (see its
reverse-proxy setup in docs/DEPLOY-WINDOWS.md) — omit it if that ever
changes to a real certificate.

Re-index is a manual step for v1 (not scheduled) — see the grill doc's
R4-Q1. Run it again whenever the share has new/changed projects worth
reflecting; each run re-pushes every project it finds (upsert by
`folderPath`), and never overwrites a budget a person has already verified
in the app (see `../lib/project-card.ts`).

## Known limitation: folder detection isn't perfect

`discovery.py` decides a folder is a project by looking for `_TOR`/
`Proposal*`/etc. subfolders inside it (or an explicit year folder for
NT/NBTC-style clients — see the module docstring). Run against the real
share on 2026-09-16, it found 205 projects and skipped 44 folders that
matched neither pattern. Spot-checking the skipped list found a mix of:

- genuinely non-project folders (shared "Proposal"/reference folders sitting
  directly under a client, e.g. `MEA\Proposal`, `KT\WW Information`) —
  correctly skipped
- real projects that just don't have the expected marker subfolders (e.g.
  `CMU\CMU001 COVID`, `BBTEC\BBT002 MA OFC Y66 PEA`) — missed
- at least two clients (`AOT`, `DOPA`) where the client folder itself seems
  to be a single, un-subdivided project rather than a container of several
  — a layout variant `discovery.py` doesn't handle at all

`main.py` prints every skipped folder to stderr specifically so these can
be reviewed by hand rather than silently dropped (matches Round 1 Q2's
"auto-detect + a confirm/edit pass" recommendation — the pass itself is a
manual `stderr` review for v1, not a UI). If a skipped folder turns out to
be a real project, there's no override list yet — add a case to
`discovery.py`'s heuristic (and a test in `test_discovery.py`) once a
pattern emerges, rather than hand-editing one-off exceptions.

## AI summarization is off by default

`ai_provider.py` mirrors `../soc-worker/ai_provider.py`'s fail-closed
pattern exactly: `build_provider()` always returns `DisabledProvider`,
which never sends document text anywhere and produces no summary. Every
card pushed today has blank `descriptionTh`/`descriptionEn`/`budgetAmount`
unless a person fills them in by hand in the app — `client`/`projectName`/
`folderPath`/`year` (when derivable from the folder structure) are still
populated, since those never depend on AI. Wiring up a real provider is a
separate, deliberate decision (see the SOC precedent for why this defaults
closed) — implement `ProjectCardAiProvider.summarize` and update
`build_provider()` when one is approved.

## Tests

```powershell
python -m unittest test_discovery test_extract_text test_crawler -v
```

All pure-logic (folder detection, text extraction, payload building) — no
live share or server needed. `discovery.py`'s heuristic has additionally
been spot-checked against the real share; see "Known limitation" above.
