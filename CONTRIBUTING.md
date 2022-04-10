# Contributing

Thank you for considering to contribute to `node-fetch` 💖

Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md).
By participating you agree to abide by its terms.

## Setup

Node.js 12.20 or higher is required. Install it from https://nodejs.org/en/. [GitHub's `gh` CLI](https://cli.github.com/) is recommended for the initial setup

1. Fork this repository and clone it to your local machine. Using `gh` you can do this

   ```
   gh repo fork node-fetch/node-fetch
   ```

2. After cloning and changing into the `node-fetch` directory, install dependencies and run the tests

   ```
   npm install
   npm test
   ```

## Issues before pull requests

Unless the change is trivial such as a type, please [open an issue first](https://github.com/node-fetch/node-fetch/issues/new) before starting a pull request for a bug fix or a new feature.

After you cloned your fork, create a new branch and implement the changes in them. To start a pull request, you can use the `gh` CLI

```
gh pr create
```

## Maintainers only

### Merging the Pull Request & releasing a new version

Releases are automated using [semantic-release](https://github.com/semantic-release/semantic-release).
The following commit message conventions determine which version is released:

1. `fix: ...` or `fix(scope name): ...` prefix in subject: bumps fix version, e.g. `1.2.3` → `1.2.4`
2. `feat: ...` or `feat(scope name): ...` prefix in subject: bumps feature version, e.g. `1.2.3` → `1.3.0`
3. `BREAKING CHANGE:` in body: bumps breaking version, e.g. `1.2.3` → `2.0.0`

Only one version number is bumped at a time, the highest version change trumps the others.
Besides, publishing a new version to npm, semantic-release also creates a git tag and release
on GitHub, generates changelogs from the commit messages and puts them into the release notes.

If the pull request looks good but does not follow the commit conventions, update the pull request title and use the <kbd>Squash & merge</kbd> button, at which point you can set a custom commit message.

### Beta/Next/Maintenance releases

`semantic-release` supports pre-releases and maintenance releases.

In order to release a maintenance version, open a pull request against a `[VERSION].x` branch, e.g. `2.x`. As long as the commit conventions documented above are followed, a maintenance version will be released. Breaking changes are not permitted.

In order to release a beta version, create or re-create the `beta` branch based on the latest `main` branch. Then create a pull request against the `beta` branch. When merged into the `beta` branch, a new `...-beta.X` release will be created. Once ready, create a pull request against `main` (or `next` if you prefer). This pull request be merged using `squash & merge`.

**Important**: do not rebase & force push to the `beta` branch while working on pre-releases. Do only use force push to reset the `beta` branch in order to sync it with the latest `main`.

To release a `next` version, create or re-create the `next` branch based on the latest `main` branch. Then create a pull request against the `next` branch. When merged into the `next` branch, a new version is created based on the commit conventions, but published using the `next` dist-tag to npm and marked as pre-release on GitHub.

**Important**: do not rebase & force push to the `next` branch while working on pre-releases. Do only use force push to reset the `next` branch in order to sync it with the latest `main`. Also, when merging `next` into `main`, **do not use squash & merge**! In this particular case, the traditional "Create a merge commit" merge button has to be used, otherwise semantic-release will not be able to match the commit history and won't be able to promote the existing releases in npm or GitHub. If the button is disabled, temporarily enable it in the repository settings. 

For any semantic-release questions, ping [@gr2m](https://github.com/gr2m).
