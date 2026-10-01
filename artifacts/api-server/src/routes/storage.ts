import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { ObjectPermission, canAccessObject } from "../lib/objectAcl";
import { requireAuth } from "../lib/requireAuth";
import { safeGetAuth } from "../lib/authorization";
import {
  createUploadUrl,
  isSupabaseStorageConfigured,
  StorageNotConfiguredError,
} from "../lib/supabaseStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

function replitObjectStorageAvailable(): boolean {
  return Boolean(
    process.env.PRIVATE_OBJECT_DIR?.trim() &&
      process.env.PUBLIC_OBJECT_SEARCH_PATHS?.trim(),
  );
}

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * Prefers Supabase Storage when configured; otherwise falls back to Replit
 * Object Storage. Returns 503 when neither backend is available.
 * Auth remains required — uploads are an account feature.
 */
router.post("/storage/uploads/request-url", requireAuth, async (req: Request, res: Response) => {
  const { name, size, contentType } = req.body ?? {};
  if (typeof name !== "string" || typeof size !== "number" || typeof contentType !== "string") {
    res.status(400).json({ error: "Missing or invalid required fields: name, size, contentType" });
    return;
  }

  try {
    if (isSupabaseStorageConfigured()) {
      const result = await createUploadUrl({
        contentType,
        fileName: name,
        pathPrefix: "uploads",
      });
      res.json({
        uploadURL: result.uploadURL,
        objectPath: result.objectPath,
        publicUrl: result.publicUrl,
        metadata: { name, size, contentType },
        backend: "supabase",
      });
      return;
    }

    if (!replitObjectStorageAvailable()) {
      res.status(503).json({
        error:
          "Object storage is not configured. Set SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL (or VITE_SUPABASE_URL), or configure Replit PRIVATE_OBJECT_DIR / PUBLIC_OBJECT_SEARCH_PATHS.",
      });
      return;
    }

    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    res.json({
      uploadURL,
      objectPath,
      metadata: { name, size, contentType },
      backend: "replit",
    });
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      res.status(503).json({ error: error.message });
      return;
    }
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
router.get("/storage/objects/*path", requireAuth, async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    // ── Ownership enforcement ────────────────────────────────────────────────
    const { userId } = safeGetAuth(req);
    const allowed = await canAccessObject({
      userId: userId ?? undefined,
      objectFile,
      requestedPermission: ObjectPermission.READ,
    });
    if (!allowed) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    // ────────────────────────────────────────────────────────────────────────

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
