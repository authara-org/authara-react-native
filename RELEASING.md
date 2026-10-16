# Releasing

Release Please owns package versions, tags, and GitHub releases. Core-driven
generated changes must come from an exact released Authara Core tag and commit.

## Repository prerequisites

- Make the repository public before publishing so npm provenance can reference
  the source repository.
- Add `AUTHARA_SDK_RELEASE_TOKEN` with access to Authara Core and this
  repository.
- Enable auto-merge and require the `pr-title` and `test` checks on `main` after
  the initial branch exists.
- Keep the repository variable `NPM_TRUSTED_PUBLISHING_READY` unset until the
  npm bootstrap below is complete. This prevents the first release pull request
  from auto-merging before npm can authenticate its publish.
- Keep `.codegen/manifest.json` at `unreleased` until the first Core release
  dispatch records an immutable Core tag and commit.

## Bootstrap npm once

The npm package must exist before npm can authorize a Trusted Publisher. Never
bootstrap it from an uncommitted tree or while Core provenance is `unreleased`.

1. Wait until the SDK's `main` branch records immutable Core provenance. Release
   Please may prepare its first release pull request, but the readiness variable
   keeps it from auto-merging.
2. From that exact clean `main` commit, run the tests and build, then bootstrap
   version `0.0.0` with a maintainer's npm authentication and 2FA. A staged
   publish (`npm stage publish --access public`, followed by human approval) is
   preferred when available.
3. Configure npm Trusted Publishing for:
   - GitHub organization: `authara-org`
   - Repository: `authara-react-native`
   - Workflow filename: `publish.yaml`
   - Environment: none
   - Allowed action: `npm publish`
4. Require 2FA and disallow traditional publishing tokens for the package.
5. Set the GitHub repository variable `NPM_TRUSTED_PUBLISHING_READY` to `true`
   and rerun the release workflow. The prepared release pull request can now
   auto-merge, and future releases publish through GitHub OIDC with provenance.

The Trusted Publisher must complete its first successful publish within npm's
validation window. Configure it immediately before the next SDK release.
