# Rossik Tools - Organization Working Rules

> Applies to EVERY repo in github.com/rossik-tools. Changes to this document only via PR approved by Filip.
> Status: 2026-08-20, Version 1.1

## 0. Guiding principle

We work like a professional IT company: structured, traceable, clean.
**We never copy blindly. We build step by step and understand what we build.**
Existing systems (intranet, Lovable tools) are references and sources of ideas - not copy templates.

## Language policy

**Everything inside this organization is written in English**: code, comments, commits, PRs,
issues, READMEs, docs, migrations. No exceptions. Conversations outside GitHub may happen in
any language; the moment something lands in a repo, it is English.

## 1. WHERE - Structure

| Rule | Concrete |
|---|---|
| One module = one repo = one subdomain | orgchart -> orgchart.rossiktools.com, fleet -> fleet.rossiktools.com |
| Repo names | English, lowercase, short: `portal`, `orgchart`, `fleet-monitor` |
| Mandatory files per repo | `README.md` (what it is, how to deploy), `AGENTS.md` (rules for AI sessions), `docs/` for decisions |
| Database | Supabase. Each module touches ONLY its own table prefix. Foreign prefixes are off-limits - even read access only by agreement |
| Secrets | NEVER in code, commits, or chats. Vault (rossik-core) or function secrets. No exceptions |
| Hosting | Cloudflare (Pages/Workers). Deploys only from `main`, never from local working copies |

## 2. HOW - Workflow

1. **`main` is sacred.** Always working, always the state that is live. Direct pushes are technically blocked.
2. **Everyone works on their own branch** (`filip`, `bogdan`, ...). Experiments belong there and are welcome.
3. **Code reaches main only via pull request** with at least 1 approval. You do not approve your own PRs.
4. **Small PRs.** One PR = one topic. 200 changed lines are reviewable; 2,000 are not.
5. **DB migrations** travel as files inside the PR. They are applied to the database only AFTER the merge, by the module owner. Repo and database must always match.
6. **Commits in English**, format `type(scope): what` - e.g. `feat(leave): telegram webhook`, `fix(orgchart): mobile layout`.
7. **AI work (Claude Code, Lovable) follows the same rules.** The repo's AGENTS.md is binding for every AI session.

## 3. WHAT - Definition of Done

A task is done when ALL of this holds - otherwise it is "in progress":

- [ ] Built and verified locally (build passes, core function tested)
- [ ] Security standard met (see section 5)
- [ ] Migrations exist as files in the repo, not only in the database
- [ ] README/docs updated if behavior or structure changed
- [ ] PR created, reviewed, merged
- [ ] Deployed from main and verified live (not just "should work")

## 4. WHEN - Approvals

| Action | Requires |
|---|---|
| Working on your own branch | nothing - full speed |
| Merge to main | PR + 1 approval (technically enforced) |
| Deploy / publish / DNS change | Filip's GO |
| New domain, new service, new cost | Filip's GO |
| Permission changes (GitHub, Supabase, Cloudflare, Access) | Filip's GO |
| Deleting data or infrastructure | Filip's GO, explicitly |

## 5. Security - minimum standard for every PR touching the database

- RLS on every new table, tenant separation where applicable
- `REVOKE ALL ... FROM anon, PUBLIC` on new tables AND functions (the PUBLIC trap!)
- Role checks NULL-safe (`COALESCE(..., false)`, `IS DISTINCT FROM`)
- Permissions configurable instead of hardcoded, where sensible
- No production data in repos, tests, or chats (GDPR)
- Publicly reachable endpoints (webhooks) need their own auth mechanism, justified in the PR

## 6. WHO - Roles

| Person | Role |
|---|---|
| Filip | Owner. Approvals, merges, permissions, infrastructure |
| Bogdan | Developer. Write access on assigned repos, works on branch `bogdan` |
| Module owner | named per repo (in its README). Responsible for quality and DB state of the module |

Access is granted per repo, never wholesale. New members start with read access.

## 7. Recording decisions

Significant architecture decisions (Why federation? Why Cloudflare?) are recorded as a short note
in the affected repo's `docs/`: what was decided, why, and what the alternative was.
Three sentences are enough. A year from now, nobody remembers otherwise.
