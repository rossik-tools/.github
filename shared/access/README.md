# Shared Access check (canonical)

`access.server.ts` is the one Cloudflare Access verification every rossik-tools Worker and Pages
Function uses. Each module keeps a **verbatim copy** (no build step may depend on another repo at
deploy time), and its CI fails when the copy differs from this file.

| Module | Copy | Test copy |
|---|---|---|
| tickets, it-inventory, pricing | `src/lib/access.server.ts` | `src/lib/access.server.test.ts` |
| route-planner, pdf-tools, learn | `server/access.ts` | none (vitest repos) |
| timekeeping | `src/access.ts` | none |

Edge functions (Supabase, `_shared/access-auth.ts`) are a different runtime and follow as step 2 of
audit item B-11.

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
