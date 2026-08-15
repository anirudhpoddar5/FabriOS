<!-- CANONICAL SOURCE: ~/Projects/standards/BASELINE.md
Synced into every repo at .agents/standards/. Edit the canonical file, then run
`node ~/Projects/standards/sync.mjs --write`. Never edit a repo copy. -->

# Baseline — applies to every project

StitchLogic, Ethica, Vetro, Fabrios, PEXX website, PEXX Shopify.

Agent-agnostic: written for whichever assistant is reading it. Every rule here
is written down because it already cost something; dates mark when.

---

## 1. Definition of Done

Work is finished when it is finished, not when it is ready to be checked. The
owner is not a QA step. Nothing below is optional, and they run in order:

1. **The build passes.** Run it. Not "should compile".
2. **Verified in a real browser** (or the real runtime, for a script). Load the
   page, click the thing, see the result. Never report "this should work" —
   say what was checked and what was seen.
3. **Help / FAQ updated** if a user would notice the change. A new screen,
   route or workflow is not done until the in-app help describes it in plain
   language, matching the existing sections.
4. **A test added or updated from the user's point of view** — browser-driven,
   clicking through the flow as a person would. If the UI genuinely does not
   offer an action (no delete button, append-only by design), do not fabricate
   a test for it; write one line saying why.
5. **Guard harnesses green.** Where a project has them (StitchLogic:
   `npm run harness`), they run and pass. Each one guards a rule that already
   broke once.
6. **A plain-English summary written** for the owner — see §2.
7. **Only then deploy.**

If any step is skipped, say which and why, in the summary. A skipped step named
out loud is a decision; a skipped step left silent is a defect handed over.

---

## 2. Writing for the owner

He is **not a coder**. Every substantive message ends with a short plain-English
summary covering: what it means, what he must do, what it costs, what is
waiting on him.

- **Lead with the consequence, not the mechanism.** "Excel was showing ₹12.50
  as 13" beats "the numFmt was applied unconditionally".
- Say plainly what is blocked, what needs a decision, and what needs nothing.
- Never present a guess as a finding. State what was verified, and how.
- Flag anything that touches live customers or costs money **before** doing it.
- No jargon and no code in the summary section.

---

## 3. Secrets

- No credential ever enters a repository — not in code, not in test fixtures,
  not in saved browser/session state.
- Real `.env` files are gitignored; only `*.example` files are tracked.
- **Ignore directories, not individual filenames.** *2026-08-10: Playwright's
  saved login state, holding a live Supabase session token, sat committed for
  months. The gitignore rule directly above it listed three files by name and
  missed two others in the same directory.*
- A committed token stays valid until the password is changed. Rotating is the
  fix; deleting the file is not.

---

## 4. Deployment

- Deploys come from `main`. **Merging to `main` is shipping to real users.**
- Being committed is not being deployed. *2026-06-13: a performance fix sat on
  an unmerged branch while production ran the old code, and the problem was
  reported as unfixed.* Verify: `git merge-base --is-ancestor <sha> main`.
- Users need a hard refresh to pick up a new bundle.
- Run the package manager's install after editing `package.json`; a stale
  lockfile fails every build.
- Never deploy into a degraded backend — a new bug and an outage are
  indistinguishable while it is down.
- Do not commit or push unless asked. Leave work in the tree and report it.

---

## 5. Verifying work

- **A class name that does not exist fails silently and looks fine in review.**
  *2026-08-10: 64 numeric table columns used a `tabular` class that was never
  defined; figures rendered misaligned everywhere.* Confirm a class resolves in
  the built CSS before trusting it.
- Tailwind cannot see class names assembled at runtime. Tone/status maps must
  be static objects, not string concatenation.
- Non-trivial pure logic leaves one runnable check behind — the smallest thing
  that fails if the logic breaks. See StitchLogic's `scripts/*-harness.mjs`.
- Test failures fall into three recurring **non-bug** classes: network outage,
  expired session, latency flake. Establish which before chasing a defect.

---

## 6. Standards hygiene

- Canonical standards live in `~/Projects/standards/`. Each repo carries a
  committed copy at `.agents/standards/` because a cloud session clones one
  repo and can see nothing outside it.
- **Never edit a repo copy.** Edit the canonical file, then
  `node ~/Projects/standards/sync.mjs --write`.
- `node ~/Projects/standards/sync.mjs` checks and **exits non-zero on drift**.
  Run it before a deploy. *Three copies of the design language drifted once and
  had to be reconciled by hand (2026-08-09).*
- Each repo's `AGENTS.md` is its entry point; `CLAUDE.md` points at it. Product
  specifics belong in the repo, never here.

---

## 7. Review block

**Last reviewed: 2026-08-10 — re-check quarterly (next: 2026-11-10).**

At each review, check and date the answers:

- **(a) New free tools worth adopting.** What is now free or cheap that was not
  — hosting, test infrastructure, model access, monitoring, error tracking?
  Anything currently paid for that has a free equivalent good enough to switch?
- **(b) New prompting and model guidance.** Which models are current, what has
  changed in how to instruct them, and does anything in these files now
  contradict published guidance? Long instruction files measurably reduce how
  well instructions are followed — if a rule no longer changes behaviour, cut
  it. Aim to leave each review with fewer lines, not more.

Log the outcome as a dated line here so staleness stays visible.

- 2026-08-10 — Files created. Folded the former `ENGINEERING.md` into this file
  and `PRODUCT-TRIO.md`; switched from link-only to synced committed copies
  because cloud sessions cannot read outside their repo.
