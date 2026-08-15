# Skill routing

Canonical file: `~/Projects/standards/SKILL-ROUTING.md`. Repo copies under
`.agents/standards/` are written by `sync.mjs` — edit the canonical file, never
a copy.

## The rule

**Before starting a task in the left column, invoke the skill in the right
column.** Announce it ("Using `cro` to review this page"), then follow it.

This file exists because skill matching is a judgment call, and the judgment
was measurably bad: across ~400 sessions between 22 Jul and 15 Aug 2026, the
marketing skills were invoked one or two times each. `ads` was invoked **zero**
times while Meta campaigns were running. The skills that got used were the ones
a hook forced. This file is the forcing function for the rest.

"I already know how to do this" is not a reason to skip. That is the exact
thought that produced the zero.

## Products this covers

| Product | What it is | Stack |
|---|---|---|
| **StitchLogic / Trakr** | `~/Downloads/trakr` | Vite + React + TS + Tailwind + Supabase + Playwright |
| **Ethica** | `~/Projects/ethica` | same |
| **Vetro** | `~/Projects/vetro` | same |
| **Fabrios** | `~/Downloads/fabrios-main` | same, plus a Cloudflare Worker |
| **PEXX website + Shopify** | `~/Downloads/pexx-website` | Shopify theme, static site, Cloudflare Worker |

StitchLogic, Ethica and Vetro share **one Supabase project**. See
`PRODUCT-TRIO.md` and `BASELINE.md` — those rules outrank anything here.

## Software work — all five repos

| Task | Skill |
|---|---|
| Any new feature, component, or behaviour change | `superpowers:brainstorming` → then `superpowers:writing-plans` |
| Executing a written plan | `superpowers:executing-plans` or `superpowers:subagent-driven-development` |
| A bug, or anything behaving unexpectedly | `superpowers:systematic-debugging` |
| Writing tests / test-first work | `superpowers:test-driven-development` |
| New screen, or UI that looks templated | `frontend-design` |
| Any chart, graph, dashboard, KPI tile | `dataviz` — read **before** the first line of chart code |
| Before merging | `/code-review`, then `/security-review` |
| Full QA sweep of an app | `qa-audit` |
| Page is slow / Core Web Vitals | `web-perf` |
| Isolating work from the current branch | `superpowers:using-git-worktrees` |
| Finishing a branch — merge, PR, cleanup | `superpowers:finishing-a-development-branch` |
| Anything touching a Cloudflare Worker | `cloudflare` + `workers-best-practices` + `wrangler` |
| Anything calling the Claude API | `claude-api` — never answer model/pricing questions from memory |
| Verifying work is actually done | `superpowers:verification-before-completion` |

## PEXX — commerce and marketing

| Task | Skill |
|---|---|
| New or updated product listing (Shopify / Amazon / FirstCry) | `pexx-listing-generator` |
| Ad strategy, budget, targeting, when to kill an ad | `ads` |
| Writing or scaling ad copy and creative variants | `ad-creative` |
| A page isn't converting | `cro` |
| Website / landing / PDP copy | `copywriting` |
| Tightening copy that already exists | `copy-editing` |
| Email flows — welcome, abandoned cart, win-back | `emails` |
| WhatsApp / SMS sequences | `sms` |
| Popups and modals | `popups` |
| Pricing, discounts, free-shipping thresholds | `pricing` |
| Bundles, guarantees, gifting offers | `offers` |
| SEO problems, traffic drops, rankings | `seo-audit` |
| Structured data / rich results | `schema` |
| Being cited by ChatGPT, Perplexity, AI Overviews | `ai-seo` |
| Instagram, LinkedIn, Reels, carousels | `social` |
| A product or collection launch | `launch` |
| Retention, cancellations, failed payments | `churn-prevention` |
| Tracking, GA4, PostHog, event verification | `analytics` |
| Testing two versions of anything | `ab-testing` |
| Positioning / ICP context before other marketing work | `product-marketing` |
| A quarter or year of marketing planned end to end | `marketing-plan` |
| Stuck, need options | `marketing-ideas` |
| Want several expert opinions before committing spend | `marketing-council` |

## Output and admin

| Task | Skill |
|---|---|
| A document or report someone else will read | `artifact-design` |
| Diagrams inside that document | `artifact-diagramming` |
| Spreadsheets | `anthropic-skills:xlsx` |
| Word docs / PDFs | `anthropic-skills:docx`, `anthropic-skills:pdf` |
| Slides | `anthropic-skills:pptx` |
| Something recurring on a schedule | `/schedule` (cloud cron) or `/loop` (this session) |
| Too many permission prompts | `/fewer-permission-prompts` |
| Changing hooks, permissions, settings.json | `update-config` |

## Always on, never invoked

`ponytail` loads from a SessionStart hook every session. It is the reason to
stop at the first solution that works. It does not need calling and will not
appear in any skill count.

## Deployment — verified 15 Aug 2026

| Product | Deploys to | Skill |
|---|---|---|
| StitchLogic / Trakr | **Vercel** (`vercel.json` + linked `.vercel` project `trakr`) | `vercel:deploy`, `vercel:vercel-cli` |
| Ethica | **Vercel** (`vercel.json`, SPA rewrites) | same |
| Vetro | **Vercel** (`vercel.json` + linked `.vercel` project `vetro`) | same |
| Fabrios | **Cloudflare Pages** (`npx wrangler pages deploy`) | `cloudflare`, `wrangler` |
| PEXX website | **GitHub Pages** | — |
| PEXX WhatsApp worker | **Cloudflare Workers** | `cloudflare`, `wrangler` |

So `vercel:deploy`, `vercel:deployments-cicd`, `vercel:env-vars`,
`vercel:vercel-cli`, `vercel:status` and `vercel:verification` **are** in scope.

## Deliberately not used

- **The Next.js half of `vercel:*`** — `nextjs`, `next-forge`, `next-upgrade`,
  `next-cache-components`, `turbopack`, `routing-middleware`. Every app here is
  **Vite + React**, not Next.js. Vercel hosts Vite fine; deploying there does
  not make the Next.js skills relevant.
- **Community skill mega-marketplaces** — unvetted third-party instructions are
  a prompt-injection surface, and more skills makes routing worse, not better.
  Add a skill only when a real task had no home in the table above.

## When this file is wrong

If a task keeps happening and has no row, add a row. If a row names a skill
that no longer exists, delete the row. A routing table nobody trusts is worse
than none, because it gets skipped silently.
