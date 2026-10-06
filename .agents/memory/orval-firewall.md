---
name: Replit package firewall
description: Constraint encountered when installing the imported workspace dependencies on Replit
---

The Replit package firewall may reject an older direct dependency tarball even when the package is otherwise valid. Prefer the current compatible release when it preserves the project API and runtime support, and document the reason beside the dependency change.

**Why:** A clean workspace install cannot succeed if the lockfile points at a blocked tarball; bypassing the firewall is not an acceptable recovery path.

**How to apply:** When dependency installation returns a package-firewall 403, identify the direct dependency, check its current compatible release, update the manifest and lockfile together, and keep generated source changes out of the setup diff unless regeneration is intentional.

For blocked transitive dependencies, check the parent package's latest release first. If the parent is already current and allows a safe patch release, prefer a narrow override over replacing the parent or bypassing the firewall.

**Why:** The latest parent may still have a lockfile resolving an older blocked dependency; changing the whole framework adds unnecessary import risk.

**How to apply:** Refresh only the blocked dependency resolution and verify installation plus the affected app build.