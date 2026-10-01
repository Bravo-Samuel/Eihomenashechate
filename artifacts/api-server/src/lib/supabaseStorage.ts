import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export class StorageNotConfiguredError extends Error {
  constructor(message = "Supabase Storage is not configured") {
    super(message);
    this.name = "StorageNotConfiguredError";
  }
}

type SupabaseStorageConfig = {
  url: string;
  serviceRoleKey: string;
  bucket: string;
};

function readConfig(): SupabaseStorageConfig | null {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.VITE_SUPABASE_URL?.trim() ||
    "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "uploads";
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey, bucket };
}

let cachedClient: SupabaseClient | null | undefined;

function getServiceClient(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient;
  const config = readConfig();
  if (!config) {
    cachedClient = null;
    return null;
  }
  cachedClient = createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cachedClient;
}

export function isSupabaseStorageConfigured(): boolean {
  return readConfig() !== null;
}

export function getSupabaseStorageBucket(): string {
  return readConfig()?.bucket ?? "uploads";
}

export type CreateUploadUrlInput = {
  contentType?: string;
  pathPrefix?: string;
  fileName?: string;
};

export type CreateUploadUrlResult = {
  uploadURL: string;
  objectPath: string;
  publicUrl: string;
  token?: string;
};

/**
 * Create a signed upload URL in the configured Supabase Storage bucket.
 * Uses the service-role key on the server only — never expose it to the browser.
 */
export async function createUploadUrl(
  input: CreateUploadUrlInput = {},
): Promise<CreateUploadUrlResult> {
  const config = readConfig();
  const client = getServiceClient();
  if (!config || !client) {
    throw new StorageNotConfiguredError(
      "Supabase Storage is not configured. Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  const prefix = (input.pathPrefix ?? "uploads").replace(/^\/+|\/+$/g, "");
  const safeName = (input.fileName ?? randomUUID()).replace(/[^\w.\-]+/g, "_");
  const objectPath = `${prefix}/${randomUUID()}-${safeName}`;

  const { data, error } = await client.storage
    .from(config.bucket)
    .createSignedUploadUrl(objectPath);

  if (error || !data) {
    throw new Error(
      error?.message ?? "Failed to create Supabase signed upload URL",
    );
  }

  const publicUrl = getPublicUrl(objectPath);
  return {
    uploadURL: data.signedUrl,
    objectPath: `/objects/${config.bucket}/${objectPath}`,
    publicUrl,
    token: data.token,
  };
}

export function getPublicUrl(path: string): string {
  const config = readConfig();
  const client = getServiceClient();
  if (!config || !client) {
    throw new StorageNotConfiguredError();
  }
  const normalized = path
    .replace(/^\/objects\/[^/]+\//, "")
    .replace(/^\//, "");
  const { data } = client.storage.from(config.bucket).getPublicUrl(normalized);
  return data.publicUrl;
}
