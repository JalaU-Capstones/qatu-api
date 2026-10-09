# Git and Collaboration Guide

## 2.1 Branching Strategy (GitFlow)

Qatu Marketplace uses the GitFlow branching model.

### Main Branches

- **`main`**: Represents the production-ready code. It must always be stable. Only accepts merges from `release/*` or `hotfix/*`.
- **`develop`**: The integration branch for new features. All feature branches merge into this branch before preparing a release.

### Supporting Branches

- **`feature/*`**: Used for developing new features (e.g., one branch per user story or task). Branches off from `develop` and merges back into `develop`.
- **`release/*`**: Used to prepare for a new production release. Branches off from `develop` and merges into both `main` and `develop`.
- **`hotfix/*`**: Used for urgent fixes in production. Branches off from `main` and merges into both `main` and `develop`.

### Naming Conventions

- Feature: `feature/US-01-buyer-registration`
- Release: `release/v1.0.0`
- Hotfix: `hotfix/fix-login-error`

### Branch Protection Rules

- `main` and `develop` cannot be pushed directly.
- Merge requests require at least one approval and passing CI checks.

## 2.2 Commit Message Convention (Conventional Commits)

We follow the Conventional Commits specification: `<type>(<scope>): <description>`

### Commit Types

- `feat:` — A new feature
- `fix:` — A bug fix
- `docs:` — Documentation only changes
- `style:` — Changes that do not affect the meaning of the code (formatting)
- `refactor:` — A code change that neither fixes a bug nor adds a feature
- `perf:` — A code change that improves performance
- `test:` — Adding missing tests or correcting existing tests
- `build:` — Changes that affect the build system or dependencies
- `ci:` — Changes to CI configuration files and scripts
- `chore:` — Other changes that don't modify src or test files
- `revert:` — Reverts a previous commit

### Scope

Use a scope to specify the context of the change (e.g., `feat(auth): add social login`).

### Breaking Changes

Indicated by appending a `!` after the type/scope or adding `BREAKING CHANGE:` in the footer.

**Examples:**

- Good: `feat(cart): add ability to remove items`
- Bad: `added cart remove feature`

## 2.3 Merge Request Guidelines

- Every merge request must reference an issue (e.g., `Closes #12`).
- At least one approval is required before merging.
- All CI checks must pass (lint, tests, build).
- Direct commits to `main` or `develop` are forbidden.
- Use squash merge for feature branches to keep the commit history clean.
- Delete the feature branch after merging.

## 2.4 Code Review Checklist

- Code follows the Definition of Done (see Wiki).
- Tests are included and passing.
- Linting and formatting pass.
- API documentation is updated if endpoints changed.
- No secrets or credentials are committed.
- Wiki is updated if architectural decisions changed.

## 2.5 Remote Configuration

Our repositories are mirrored:

- `origin`: GitLab (Primary)
- `github`: GitHub (Mirror)

To push to both remotes simultaneously:

```bash
git push origin develop
git push github develop
```

Keeping both remotes in sync is essential for our CI/CD pipelines (GitLab CI primary, GitHub Actions mirror).

## 2.6 Common Git Commands

```bash
# Create and switch to a new branch
git checkout -b feature/US-02-cart

# Stage and commit
git add .
git commit -m "feat(cart): add add-to-cart endpoint"

# Push a branch for the first time
git push -u origin feature/US-02-cart

# Fetch latest changes
git fetch --all

# Rebase feature branch on develop
git pull --rebase origin develop
```
