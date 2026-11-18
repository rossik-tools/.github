# Shared Access check (canonical)

`access.server.ts` is the one Cloudflare Access verification every rossik-tools Worker and Pages
Function uses. Each module keeps a **verbatim copy** (no build step may depend on another repo at
deploy time), and its CI fails when the copy differs from this file.

| Module | Copy | Test copy |
|---|---|---|
| tickets, it-inventory, pricing | `src/lib/access.server.ts` | `src/lib/access.server.test.ts` |
| route-planner, pdf-tools, learn | `server/access.ts` | none (vitest repos) |
| timekeeping | `src/access.ts` | none |

Edge functions (Supabase) have their own canonical file, `edge/access-auth.ts`, below.

## Changing it

1. Change it here, in a PR to this repo.
2. In the same round, copy the file into every module listed above (one PR per repo). Until a
   module has the new copy, its CI fails and nothing deploys there. The live app keeps running.
3. Never edit a module's copy. Module-specific notes go next to the import.

## The CI step each module runs

In the job that gates the deploy, after checkout. `FILE` is the module's copy (and the test copy
where there is one):

```yaml
      - name: Access check matches the canonical copy (B-11)
        run: |
          for pair in "src/lib/access.server.ts:access.server.ts" "src/lib/access.server.test.ts:access.server.test.ts"; do
            file=${pair%%:*}; canon=${pair##*:}
            want=$(curl -fsSL "https://raw.githubusercontent.com/rossik-tools/.github/main/shared/access/$canon" | tr -d '\r' | sha256sum)
            have=$(tr -d '\r' < "$file" | sha256sum)
            if [ "$want" != "$have" ]; then
              echo "::error file=$file::differs from rossik-tools/.github shared/access/$canon. Copy the canonical file; never edit the module copy."
              exit 1
            fi
          done
```

Line endings are ignored (Windows checkouts). If GitHub is unreachable the step fails, which is
the safe direction.

## Edge functions: `edge/access-auth.ts`

Same rules, Deno runtime. Each copy lives at `<functions dir>/_shared/access-auth.ts`; whatever a
module needs on top (audience from env or config, audit, rate limits) goes in a separate file
next to it.

| Module | Copy | Module-side file | CI check |
|---|---|---|---|
| portal | `infra/supabase/functions/_shared/access-auth.ts` | `_shared/platform.ts` | warning |
| leads | `supabase/functions/_shared/access-auth.ts` | `_shared/leads-aud.ts` | warning |
| presentations | `supabase/functions/_shared/access-auth.ts` | none | warning |
| rts-fleet-monitor | `supabase/functions/_shared/access-auth.ts` | none | none (RTS CI is not changed) |
| mag | `supabase/functions/_shared/access-auth.ts` | to follow after its first PR | to follow |

**Why the check only warns here:** no CI deploys these functions; they are deployed by hand. A
failing check would block the module's website deploy and still not stop a function deploy, so
it reports the drift instead.

**Changing it:** change it here, copy it into every module above in the same round, then redeploy
every function that imports it (a copy in git does nothing until the function is redeployed).

The warning step, in any job that runs on pushes and pull requests:

```yaml
      - name: Edge Access check matches the canonical copy (B-11, warning only)
        run: |
          file=supabase/functions/_shared/access-auth.ts
          want=$(curl -fsSL "https://raw.githubusercontent.com/rossik-tools/.github/main/shared/access/edge/access-auth.ts" | tr -d '\r' | sha256sum) || { echo "::warning::could not fetch the canonical edge Access check"; exit 0; }
          have=$(tr -d '\r' < "$file" | sha256sum)
          if [ "$want" != "$have" ]; then
            echo "::warning file=$file::differs from rossik-tools/.github shared/access/edge/access-auth.ts. Copy the canonical file and redeploy the functions; never edit the module copy."
          fi
```
