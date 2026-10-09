export interface PushApiResult {
  ok: boolean;
  error?: string;
}

type PushFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

async function responseError(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({})) as { error?: string };
  return body.error || `${fallback} (HTTP ${response.status}).`;
}

export async function requestPushUnsubscribe(
  endpoint: string,
  fetcher: PushFetch = fetch,
  token?: string | null,
): Promise<PushApiResult> {
  try {
    const response = await fetcher("/api/push/unsubscribe", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({ endpoint }),
    });
    return response.ok
      ? { ok: true }
      : { ok: false, error: await responseError(response, "Could not disable push notifications") };
  } catch {
    return { ok: false, error: "Could not reach the notification service." };
  }
}

export async function requestTestPush(
  fetcher: PushFetch = fetch,
  token?: string | null,
): Promise<PushApiResult> {
  try {
    const response = await fetcher("/api/push/send-test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
    });
    return response.ok
      ? { ok: true }
      : { ok: false, error: await responseError(response, "Could not send a test notification") };
  } catch {
    return { ok: false, error: "Could not reach the notification service." };
  }
}
