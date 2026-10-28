#!/usr/bin/env bash
# Builds a throwaway git-flow repo in the current directory: ./origin.git (bare remote) and ./app.
# Mirrors the RS app repos: master/develop/production, release/version-X.Y.Z, version-X.Y.Z tags,
# commit.gpgsign=true with a key the agent cannot use.
set -eu
export GIT_AUTHOR_NAME=Fixture GIT_AUTHOR_EMAIL=fixture@example.com GIT_COMMITTER_NAME=Fixture GIT_COMMITTER_EMAIL=fixture@example.com
git init -q --bare -b master origin.git
git init -q -b master app && cd app
git config commit.gpgsign false
git remote add origin ../origin.git
c() { mkdir -p "$(dirname "$1")"; echo "$2" >> "$1"; git add "$1"; git commit -qm "$3"; }
c README.md "# app" "Initial commit"
git flow init -d >/dev/null 2>&1
for v in 0.3.0 0.3.1; do
  git switch -q develop; c CHANGELOG.md "$v" "Version $v: changes"
  git flow release start -F version-$v >/dev/null 2>&1 || git flow release start version-$v >/dev/null
  GIT_MERGE_AUTOEDIT=no git flow release finish -m "version-$v" version-$v >/dev/null
done
git branch production master
git switch -q develop
c src/app.js "export const app = 1;" "Add app entry point"
git push -q origin master develop production --tags
git flow feature start login-form >/dev/null
c src/login.js "export function login() {}" "Add login form skeleton"
c src/login.js "export function validate() {}" "Validate login form inputs"
git push -q -u origin feature/login-form
git switch -q develop
c src/config.js "export const API_URL = 'http://localhost:9999';" "Point API at local debug server"
git push -q origin develop
git switch -q feature/login-form
echo "// TODO polish" >> src/login.js   # uncommitted change, to see if the agent notices
git config commit.gpgsign true
git config user.signingkey DEADBEEFDEADBEEF
