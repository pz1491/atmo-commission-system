import { MetaApiError } from "./types";

// Bump via env when Meta deprecates the current version — nothing else in
// the codebase should hardcode a version string.
export const META_GRAPH_API_VERSION =
  process.env.META_GRAPH_API_VERSION ?? "v23.0";

const GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

const MAX_RETRIES = 4;
const BASE_DELAY_MS = 500;

// Meta error codes that mean "you're being throttled, back off and retry":
// 4 = application request limit, 17 = user request limit, 32 = page limit,
// 613 = custom rate limit (ads insights).
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);
// 190 = invalid/expired OAuth token.
const TOKEN_ERROR_CODES = new Set([190]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface GraphErrorBody {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    type?: string;
  };
}

export interface MetaRequestOptions {
  method?: "GET" | "POST" | "DELETE";
  params?: Record<string, string | number | boolean | undefined>;
  body?: Record<string, unknown>;
}

/**
 * Thin, retrying wrapper around the Graph API. Every mutating call and every
 * insight read in this codebase should go through this function so retry,
 * rate-limit, and token-refresh behavior stays in one place.
 */
export async function metaFetch<T>(
  path: string,
  accessToken: string,
  options: MetaRequestOptions = {},
): Promise<T> {
  const { method = "GET", params = {}, body } = options;

  const url = new URL(`${GRAPH_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  if (method === "GET") {
    url.searchParams.set("access_token", accessToken);
  }

  let attempt = 0;
  let lastError: MetaApiError | null = null;

  while (attempt <= MAX_RETRIES) {
    try {
      const init: RequestInit = { method };
      if (method !== "GET") {
        init.headers = { "Content-Type": "application/json" };
        init.body = JSON.stringify({ ...body, access_token: accessToken });
      }

      const res = await fetch(url.toString(), init);
      const json = (await res.json().catch(() => ({}))) as GraphErrorBody & T;

      if (!res.ok || (json as GraphErrorBody).error) {
        const err = (json as GraphErrorBody).error;
        const code = err?.code;
        const isRateLimit = code !== undefined && RATE_LIMIT_CODES.has(code);
        const isTokenError = code !== undefined && TOKEN_ERROR_CODES.has(code);

        const apiError = new MetaApiError(
          err?.message ?? `Meta API request failed with status ${res.status}`,
          code,
          err?.error_subcode,
          res.status,
          isRateLimit,
          isTokenError,
        );

        if (isTokenError) {
          // Never worth retrying — surface immediately so the caller can
          // mark the connection EXPIRED and prompt reconnection.
          throw apiError;
        }

        if (isRateLimit && attempt < MAX_RETRIES) {
          lastError = apiError;
          const delay = BASE_DELAY_MS * 2 ** attempt;
          await sleep(delay);
          attempt += 1;
          continue;
        }

        throw apiError;
      }

      return json as T;
    } catch (err) {
      if (err instanceof MetaApiError) throw err;
      // Network-level failure (timeout, DNS, etc.) — retry with backoff.
      lastError = new MetaApiError(
        err instanceof Error ? err.message : "Unknown network error",
      );
      if (attempt >= MAX_RETRIES) throw lastError;
      await sleep(BASE_DELAY_MS * 2 ** attempt);
      attempt += 1;
    }
  }

  throw lastError ?? new MetaApiError("Meta API request failed after retries");
}

export async function metaFetchAllPages<T>(
  path: string,
  accessToken: string,
  params: Record<string, string | number | boolean | undefined> = {},
  maxPages = 20,
): Promise<T[]> {
  const results: T[] = [];
  let nextUrl: string | null = null;
  let page = 0;

  let data = await metaFetch<{ data: T[]; paging?: { next?: string } }>(
    path,
    accessToken,
    { params },
  );
  results.push(...data.data);
  nextUrl = data.paging?.next ?? null;
  page += 1;

  while (nextUrl && page < maxPages) {
    const res = await fetch(nextUrl);
    data = (await res.json()) as { data: T[]; paging?: { next?: string } };
    results.push(...data.data);
    nextUrl = data.paging?.next ?? null;
    page += 1;
  }

  return results;
}
