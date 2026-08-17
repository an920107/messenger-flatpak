---
name: git-release-tag
description: >-
  Standard operating procedure and specification for creating, annotating, GPG-signing,
  and releasing Git tags and Flatpak releases. Use this skill whenever the user asks to create,
  update, overwrite, or push a release tag, version bump, or release notes.
---

# Git Release Tag & Annotation Standard

This skill defines the strict standard operating procedure (SOP) for creating release tags, writing high-quality annotations, GPG-signing tags, and publishing releases across the repository.

---

## 1. Tag Annotation Format Specification

Every release tag MUST be an **annotated tag** (using `-a` or `-s`) with a structured, multi-line release note following this exact template:

```text
Release v<MAJOR>.<MINOR>.<PATCH>: <High-level summary of the release>

Key Features & Improvements:
- <Feature/Fix Category 1>: <Concise description of the change and user benefit>
- <Feature/Fix Category 2>: <Concise description of the change and user benefit>
- <Feature/Fix Category 3>: <Concise description of the change and user benefit>
```

### Formatting Rules
1. **Subject Line**: Must begin with `Release v<X.Y.Z>: ` followed by a clear, one-line summary.
2. **Blank Line**: Must have a blank line between the subject line and the body.
3. **Section Header**: Use `Key Features & Improvements:` (or `Key Features:` for major/initial releases).
4. **Bullet Points**:
   - Each bullet point must start with a capitalized category title and colon: `- <Category>: <Details>`.
   - Explain **what** changed and **why** it matters to the end user.
   - Avoid vague descriptions like `fix bugs` or `update code`.

---

## 2. Release Preparation Checklist

Before creating the tag, ensure all release metadata files are synchronized:

1. **Version Files**:
   - `Cargo.toml`: Update `version = "<X.Y.Z>"`
   - `Cargo.lock`: Update lockfile via `cargo check` or `cargo build`
2. **AppStream Metadata**:
   - `resources/com.squidspirit.Messenger.metainfo.xml`: Add the new `<release>` block at the top of `<releases>` with the current date (`YYYY-MM-DD`):
     ```xml
     <release version="<X.Y.Z>" date="YYYY-MM-DD">
       <description>
         <p><Summary of improvements and features></p>
       </description>
     </release>
     ```
3. **Build Validation**:
   - Run `./build.sh` (or local build script) to verify compilation, GPG signing, AppStream validation, and Flatpak bundle packaging cleanly succeed.

---

## 3. GPG Signing Procedure

All release tags MUST be cryptographically signed with GPG (`-s` flag).

### GPG Key ID
* Default Project Key: `FAD3540C51402C39642F344669703881A4876C1A` (`Squid <squid@squidspirit.com>`)

### Prevent GPG TTY Freeze
Always warm up the GPG agent in the session before running git commands to prevent interactive passphrase prompts from hanging:
```bash
echo "test" | gpg -u FAD3540C51402C39642F344669703881A4876C1A --clearsign > /dev/null
```

---

## 4. Execution Workflow

### A. New Release Creation
```bash
# 1. Commit metadata updates
git add Cargo.toml Cargo.lock resources/*.metainfo.xml
git commit -m "chore(release): bump version to <X.Y.Z>"

# 2. Warm GPG and create signed annotated tag
echo "test" | gpg -u FAD3540C51402C39642F344669703881A4876C1A --clearsign > /dev/null
git tag -s v<X.Y.Z> -m "Release v<X.Y.Z>: <Summary>

Key Features & Improvements:
- <Category 1>: <Details>
- <Category 2>: <Details>"

# 3. Push commit and tag to remote
git push origin main
git push origin v<X.Y.Z>
```

### B. Overwriting / Updating an Existing Tag
If the user requests squashing or overwriting an existing version tag:
```bash
# 1. Delete local tag
git tag -d v<X.Y.Z>

# 2. Re-create signed tag with complete annotation
echo "test" | gpg -u FAD3540C51402C39642F344669703881A4876C1A --clearsign > /dev/null
git tag -s v<X.Y.Z> -m "Release v<X.Y.Z>: <Summary>

Key Features & Improvements:
- <Category 1>: <Details>
- <Category 2>: <Details>"

# 3. Force push the tag to remote
git push origin v<X.Y.Z> --force
```

---

## 5. Verification

Verify the tag annotation format and signature before concluding:
```bash
# Verify annotation text
git tag -l -n99 v<X.Y.Z>

# Verify GPG signature
git tag -v v<X.Y.Z>
```
