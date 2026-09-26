#!/usr/bin/env bash
# Brings a self-hosted Backstage up to date with upstream, as a branch + pull
# request. Nothing lands on the default branch until a human merges it.
#
# Run by .github/workflows/update-from-upstream.yml, which always executes the
# copy of THIS FILE on upstream main - so a fix here reaches every deployment
# without anyone editing their workflow.
#
# The hard case is a "Deploy with Vercel" copy: a fresh repo whose first commit
# is a snapshot of some upstream commit, with no shared history, so `git merge`
# has no base and refuses. We find that snapshot's upstream commit and do a
# three-way merge against it: only what changed upstream since the copy comes
# in, and whatever the deployer changed is kept.
#
# Env: UPSTREAM, BRANCH, BASE_INPUT (manual override), DEFAULT_BRANCH, GH_TOKEN.
#      DRY_RUN=1 stops after computing the merge and prints it (tests use it).
set -euo pipefail

UPSTREAM=${UPSTREAM:-https://github.com/seifelesllamseif/backstage.git}
BRANCH=${BRANCH:-backstage-update}
summary() { echo "$*" >> "${GITHUB_STEP_SUMMARY:-/dev/stderr}"; }
version_of() {
  git show "$1:package.json" | sed -n 's/^ *"version": *"\([^"]*\)".*/\1/p' | head -n1
}

git fetch --quiet "$UPSTREAM" main
upstream=$(git rev-parse FETCH_HEAD)
version=$(version_of "$upstream")

if git merge-base --is-ancestor "$upstream" HEAD; then
  summary "Already up to date with Backstage $version."
  echo "status=up-to-date"
  exit 0
fi

# An update branch from an earlier run that already carries this version:
# leave it. Someone may be resolving it by hand, and re-pushing it every week
# would also re-notify every week.
if [ -z "${DRY_RUN:-}" ] && git fetch --quiet origin "$BRANCH" 2>/dev/null &&
  git merge-base --is-ancestor "$upstream" FETCH_HEAD; then
  summary "\`$BRANCH\` already has Backstage $version - merge its pull request."
  exit 0
fi

# ── Find the base: the upstream commit this repo started from ────────────────
root=$(git rev-list --max-parents=0 HEAD | tail -n1)
base=${BASE_INPUT:-}
[ -n "$base" ] || base=$(git merge-base HEAD "$upstream" || true)

if [ -z "$base" ]; then
  # Newest upstream commit that our first commit adds and changes nothing
  # relative to. Files merely MISSING from our first commit are allowed: some
  # ways of copying a repo re-add its files through .gitignore, which drops
  # anything tracked-but-ignored (this repo has 32 of those under docs/).
  for c in $(git rev-list "$upstream"); do
    if git diff --quiet --no-renames --diff-filter=AMT "$c" "$root"; then
      base=$c
      break
    fi
  done
fi

if [ -z "$base" ]; then
  # Not a snapshot at all (first commit edited before it was pushed?). The
  # workflow's `base` input is the escape hatch; DEPLOY.md gives the SHA.
  summary "Could not work out which Backstage commit this repo was created from."
  summary "Re-run the workflow with **base** set to that upstream commit (DEPLOY.md#updating)."
  exit 1
fi

# ── Put back files that were dropped when the repo was copied ────────────────
# Missing from our FIRST commit but present in base = never had them, as
# opposed to deleted them later. Merging without them would turn every
# upstream edit to one of those files into a modify/delete conflict against a
# file the deployer never saw. Merge from a scratch commit that has them.
ours=HEAD
index=$(mktemp)
GIT_INDEX_FILE=$index git read-tree HEAD
restored=0
while IFS= read -r -d '' path; do
  git cat-file -e "HEAD:$path" 2>/dev/null && continue
  git ls-tree "$base" -- "$path" | GIT_INDEX_FILE=$index git update-index --index-info
  restored=$((restored + 1))
done < <(git diff -z --name-only --no-renames --diff-filter=D "$base" "$root")
if [ "$restored" -gt 0 ]; then
  ours=$(git commit-tree "$(GIT_INDEX_FILE=$index git write-tree)" -p HEAD -m scratch)
fi
rm -f "$index"

# ── Merge ────────────────────────────────────────────────────────────────────
if ! tree=$(git merge-tree --write-tree --merge-base="$base" "$ours" "$upstream"); then
  # merge-tree exits 1 when it conflicts - that's the answer we're reading,
  # not an error, and under pipefail it would abort before reporting it.
  conflicts=$(git merge-tree --write-tree --name-only --no-messages \
    --merge-base="$base" "$ours" "$upstream" | tail -n +2 || true)
  summary "### Backstage $version needs a hand merge"
  summary "These files changed both here and upstream:"
  summary '```'
  summary "$conflicts"
  summary '```'
  summary "Locally: \`git fetch $UPSTREAM main && git merge FETCH_HEAD --allow-unrelated-histories\`, resolve those files, push."
  echo "status=conflict"
  echo "$conflicts"
  exit 1
fi

# Parents are the real HEAD and upstream - the scratch commit never enters
# history. After this, HEAD and upstream share history and later runs are
# plain merges.
commit=$(git commit-tree "$tree" -p HEAD -p "$upstream" \
  -m "Update Backstage to $version" \
  -m "Merged from $UPSTREAM at ${upstream:0:7} (base ${base:0:7}).")

if [ -n "${DRY_RUN:-}" ]; then
  echo "status=merged"
  echo "base=$base"
  echo "restored=$restored"
  echo "commit=$commit"
  exit 0
fi

# ── Publish as a pull request ────────────────────────────────────────────────
git push --force --quiet origin "$commit:refs/heads/$BRANCH"

title="Update Backstage to $version"
body="Brings in everything upstream changed since this deployment was last updated: [what changed](https://github.com/seifelesllamseif/backstage/compare/${base:0:12}...${upstream:0:12}).

- Vercel builds a preview of this branch. Previews don't run database migrations, so if this release adds tables the preview may show errors - expected, and your live database is untouched until you merge.
- Merging deploys to production; the build applies any new migrations first.
- Your own changes to this repo are kept. Files changed both here and upstream would have stopped the update instead - there were none."

if [ -n "$(gh pr list --head "$BRANCH" --state open --json number -q '.[0].number')" ]; then
  summary "Pull request for \`$BRANCH\` updated to Backstage $version."
elif url=$(gh pr create --head "$BRANCH" --base "$DEFAULT_BRANCH" --title "$title" --body "$body"); then
  summary "Opened $url"
else
  # New repos don't let Actions open pull requests until that is allowed
  # (Settings -> Actions -> General). An issue still notifies the owner.
  compare="https://github.com/$GITHUB_REPOSITORY/compare/$DEFAULT_BRANCH...$BRANCH?expand=1"
  gh issue create --title "$title" \
    --body "The update is ready on \`$BRANCH\`. [Open the pull request]($compare) to review and merge it.

$body"
  summary "Could not open a pull request (Actions may not be allowed to), so opened an issue linking to $compare"
fi
