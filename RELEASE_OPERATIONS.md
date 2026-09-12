# Release operations

AI Vision uses pull requests and the `quality-gate` check for every change. The repository owner may merge after the check passes; no second reviewer is required while the owner is the only collaborator. Keep the PR checklist complete and attach screenshots for interface changes.

The Pages workflow builds and tests `/docs` from the candidate `main` commit, uploads the exact artifact, deploys it to the `github-pages` environment, and verifies the public URL before IndexNow runs. The workflow rejects an outdated commit. The hourly health workflow checks the latest successful deployment with synthetic browser traffic and opens one owner-assigned GitHub issue for an active failure. Scheduled Actions can be delayed or disabled after 60 days without repository activity, so GitHub notifications are an operational aid rather than an independent uptime guarantee.

## Manual settings audit

Run **Actions → Production health → Run workflow** (or run `node scripts/check-github-settings.cjs --repo stiwarilbj/AI_Vision` locally after `gh auth login`). The read-only audit compares branch protection, Pages source/build type/HTTPS, and the `github-pages` deployment environment with `config/github-settings.json`. Apply drift manually in repository settings, then run the audit again. The audit never writes settings and no administrator token is stored in GitHub.

## Manual Gemini release check

Before a release, use a separate Gemini test project and disposable key. Enter it through extension Settings while recording is disabled, use fictional pages, verify capture, explanation, extraction, follow-up, and the Browser-task approval/Stop path, then remove the key. Never put the key in commits, screenshots, traces, Actions variables, or issue text.

## Rollback

For a `/docs` restoration, run **Actions → Prepare Pages rollback** on `main` with the full SHA of a previously successful `github-pages` deployment. Download the `rollback-preparation-<sha>` artifact, inspect `rollback.json`, and check whether the patch is empty. If it contains changes, apply it to a fresh branch from `main`, then open a normal pull request:

```sh
git switch -c rollback/docs-<short-sha> main
git apply docs-rollback.patch
git add docs
git commit -m "Prepare Pages rollback to <short-sha>"
git push -u origin rollback/docs-<short-sha>
gh pr create --title "Prepare Pages rollback to <short-sha>"
```

Let the usual `quality-gate`, Pages promotion, deployment verifier, and production smoke check run before merging. The preparation workflow only reads GitHub and writes an artifact; it never edits production. For a code-wide recovery, create a normal revert pull request for the last verified `main` commit instead. Do not force-push or edit production files directly. If a deployment is still propagating, wait for the bounded verifier before deciding whether a rollback is needed.
