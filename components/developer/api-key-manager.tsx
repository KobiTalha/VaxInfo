"use client";

import {
    ClipboardCheck,
    Copy,
    KeyRound,
    RefreshCw,
    ShieldBan,
    ShieldCheck,
    Trash2
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type ApiKeyRecord = {
  id: string;
  name: string;
  prefix: string;
  isActive: boolean;
  rateLimitPerMinute: number;
  createdAt: string;
  lastUsedAt: string | null;
};

type ApiKeysResponse = {
  apiKeys?: ApiKeyRecord[];
  message?: string;
};

type CreateKeyResponse = {
  apiKey?: ApiKeyRecord;
  rawKey?: string;
  message?: string;
};

type UpdateKeyResponse = {
  apiKey?: ApiKeyRecord;
  rawKey?: string;
  message?: string;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return date.toLocaleString();
}

export default function ApiKeyManager() {
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workingKeyId, setWorkingKeyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [newKeyName, setNewKeyName] = useState("Website Integration Key");
  const [rateLimitPerMinute, setRateLimitPerMinute] = useState("60");
  const [latestRawKey, setLatestRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadApiKeys = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/developer/keys", {
        cache: "no-store"
      });

      const payload = (await response.json().catch(() => ({ message: "Failed to load API keys." }))) as ApiKeysResponse;

      if (response.status === 401) {
        setAuthRequired(true);
        setApiKeys([]);
        return;
      }

      if (!response.ok) {
        throw new Error(payload.message ?? "Failed to load API keys.");
      }

      setAuthRequired(false);
      setApiKeys(payload.apiKeys ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load API keys.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadApiKeys();
  }, []);

  const handleCreateKey = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/developer/keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: newKeyName,
          rateLimitPerMinute: Number(rateLimitPerMinute)
        })
      });

      const payload = (await response.json().catch(() => ({ message: "Failed to create API key." }))) as CreateKeyResponse;

      if (!response.ok || !payload.apiKey || !payload.rawKey) {
        throw new Error(payload.message ?? "Failed to create API key.");
      }

      setApiKeys((current) => [payload.apiKey as ApiKeyRecord, ...current]);
      setLatestRawKey(payload.rawKey);
      setCopied(false);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create API key.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const runAction = async (
    keyId: string,
    action: "rotate" | "revoke" | "activate"
  ) => {
    setWorkingKeyId(keyId);
    setError(null);

    try {
      const response = await fetch("/api/developer/keys", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ keyId, action })
      });

      const payload = (await response.json().catch(() => ({ message: "Failed to update API key." }))) as UpdateKeyResponse;

      if (!response.ok || !payload.apiKey) {
        throw new Error(payload.message ?? "Failed to update API key.");
      }

      setApiKeys((current) =>
        current.map((entry) => (entry.id === keyId ? (payload.apiKey as ApiKeyRecord) : entry))
      );

      if (action === "rotate" && payload.rawKey) {
        setLatestRawKey(payload.rawKey);
        setCopied(false);
      }
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update API key.");
    } finally {
      setWorkingKeyId(null);
    }
  };

  const deleteKey = async (keyId: string) => {
    setWorkingKeyId(keyId);
    setError(null);

    try {
      const response = await fetch(`/api/developer/keys?keyId=${encodeURIComponent(keyId)}`, {
        method: "DELETE"
      });

      const payload = (await response
        .json()
        .catch(() => ({ message: "Failed to delete API key." }))) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "Failed to delete API key.");
      }

      setApiKeys((current) => current.filter((entry) => entry.id !== keyId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete API key.");
    } finally {
      setWorkingKeyId(null);
    }
  };

  const copyRawKey = async () => {
    if (!latestRawKey) {
      return;
    }

    await navigator.clipboard.writeText(latestRawKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  if (isLoading) {
    return (
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-600">Loading API key manager...</p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">API Key Lifecycle Manager</h2>
          <p className="mt-1 text-sm text-slate-600">
            Create, rotate, revoke, reactivate, and delete per-user API keys.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void loadApiKeys();
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {authRequired ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Sign in to manage API keys.
          <div className="mt-3">
            <Link
              href="/auth/signin"
              className="inline-flex items-center rounded-lg border border-amber-300 bg-white px-3 py-2 font-medium text-amber-800 transition hover:bg-amber-100"
            >
              Go to sign-in
            </Link>
          </div>
        </div>
      ) : (
        <>
          <form onSubmit={handleCreateKey} className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="text-sm text-slate-700">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                Key name
              </span>
              <input
                value={newKeyName}
                onChange={(event) => setNewKeyName(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-sky-300"
                required
              />
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                Rate limit / minute
              </span>
              <input
                type="number"
                min={10}
                max={600}
                value={rateLimitPerMinute}
                onChange={(event) => setRateLimitPerMinute(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-sky-300"
                required
              />
            </label>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <KeyRound className="h-4 w-4" />
                {isSubmitting ? "Creating..." : "Create key"}
              </button>
            </div>
          </form>

          {latestRawKey && (
            <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-sky-700">
                New key value (shown once)
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="rounded-md bg-white px-2 py-1 text-xs text-slate-800">{latestRawKey}</code>
                <button
                  type="button"
                  onClick={() => {
                    void copyRawKey();
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-white px-2 py-1 text-xs font-medium text-sky-700 transition hover:bg-sky-100"
                >
                  {copied ? <ClipboardCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}

          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

          <div className="mt-4 space-y-3">
            {apiKeys.length === 0 && (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                No API keys created yet.
              </p>
            )}

            {apiKeys.map((apiKey) => {
              const isWorking = workingKeyId === apiKey.id;
              return (
                <article
                  key={apiKey.id}
                  className="rounded-xl border border-slate-200 bg-white p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{apiKey.name}</p>
                      <p className="mt-1 text-xs text-slate-600">Prefix: {apiKey.prefix}</p>
                      <p className="text-xs text-slate-600">
                        Rate limit: {apiKey.rateLimitPerMinute}/minute
                      </p>
                      <p className="text-xs text-slate-500">Created: {formatDate(apiKey.createdAt)}</p>
                      <p className="text-xs text-slate-500">Last used: {formatDate(apiKey.lastUsedAt)}</p>
                    </div>

                    <span
                      className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${
                        apiKey.isActive
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-rose-200 bg-rose-50 text-rose-700"
                      }`}
                    >
                      {apiKey.isActive ? "Active" : "Revoked"}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void runAction(apiKey.id, "rotate");
                      }}
                      disabled={isWorking}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Rotate
                    </button>

                    {apiKey.isActive ? (
                      <button
                        type="button"
                        onClick={() => {
                          void runAction(apiKey.id, "revoke");
                        }}
                        disabled={isWorking}
                        className="inline-flex items-center gap-1 rounded-md border border-amber-300 px-2.5 py-1.5 text-xs font-medium text-amber-800 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <ShieldBan className="h-3.5 w-3.5" />
                        Revoke
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          void runAction(apiKey.id, "activate");
                        }}
                        disabled={isWorking}
                        className="inline-flex items-center gap-1 rounded-md border border-emerald-300 px-2.5 py-1.5 text-xs font-medium text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Activate
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        void deleteKey(apiKey.id);
                      }}
                      disabled={isWorking}
                      className="inline-flex items-center gap-1 rounded-md border border-rose-300 px-2.5 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
