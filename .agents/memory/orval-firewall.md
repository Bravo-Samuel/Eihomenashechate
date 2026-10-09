---
name: Replit package firewall
description: Constraint encountered when installing the imported workspace dependencies on Replit
---

The Replit package firewall may reject an older dependency tarball even when the package is otherwise valid. Prefer the current compatible release when it preserves the project API and runtime support, and document the reason beside the dependency change.

**Why:** A clean workspace install cannot succeed if the lockfile points at a blocked tarball; bypassing the firewall is not an acceptable recovery path.

**How to apply:** When dependency installation returns a package-firewall 403, identify the direct dependency, check its current compatible release, update the manifest and lockfile together, and keep generated source changes out of the setup diff unless regeneration is intentional. For a transitive dependency, first check whether its parent has a newer safe release; if the parent is already current, use a compatible patch override rather than bypassing the firewall.