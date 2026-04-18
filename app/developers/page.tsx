import ApiKeyManager from "@/components/developer/api-key-manager";
import Link from "next/link";

const SEARCH_EXAMPLE = `curl "https://your-domain/api/search?disease=measles%20and%20polio%20vaccines" \\
  -H "x-api-key: <YOUR_API_KEY>"`;

const EMBED_SNIPPET = `<iframe
  src="https://your-domain/embed"
  title="VaxInfo Search Widget"
  width="420"
  height="560"
  style="border:0;border-radius:14px;overflow:hidden"
></iframe>`;

export default function DeveloperDocsPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-12 md:px-8">
      <header className="mb-8">
        <p className="mb-2 inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">
          Developer Platform
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">VaxInfo API Documentation</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-600 md:text-base">
          Build vaccine search experiences with API keys, analytics tracking, and embeddable widgets.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Core Endpoints</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>
              <span className="font-semibold">GET /api/search</span> - intelligent disease search and recommendations
            </li>
            <li>
              <span className="font-semibold">GET /api/vaccines</span> - paginated disease and vaccine dataset
            </li>
            <li>
              <span className="font-semibold">GET /api/analytics</span> - search trends and demand analytics
            </li>
            <li>
              <span className="font-semibold">GET /api/dashboard/export</span> - CSV/PDF export
            </li>
            <li>
              <span className="font-semibold">GET /api/health</span> - health and DB status check
            </li>
            <li>
              <span className="font-semibold">GET/POST/PATCH/DELETE /api/developer/keys</span> - API key lifecycle
            </li>
          </ul>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Authentication</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>
              Use <span className="font-semibold">x-api-key</span> or <span className="font-semibold">Authorization: Bearer</span>.
            </li>
            <li>
              Create/list/rotate/revoke/delete keys via <span className="font-semibold">/api/developer/keys</span> (signed-in users).
            </li>
            <li>
              Usage metrics via <span className="font-semibold">/api/developer/usage</span>.
            </li>
            <li>
              Anonymous requests are supported with stricter rate limits.
            </li>
          </ul>
        </article>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-slate-950 p-5 text-slate-100">
        <h2 className="text-xl font-semibold">Search API Example</h2>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-black/40 p-4 text-xs leading-relaxed">{SEARCH_EXAMPLE}</pre>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Key Rotation Example</h2>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
{`curl -X PATCH "https://your-domain/api/developer/keys" \\
  -H "Content-Type: application/json" \\
  -b "next-auth.session-token=<YOUR_SESSION_TOKEN>" \\
  -d '{"keyId":"<KEY_ID>","action":"rotate"}'`}
        </pre>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Response Highlights</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li>Intent detection (`search`, `explanation`, `recommendation`, `analytics`).</li>
          <li>Multi-disease result arrays with severity and mandatory tags.</li>
          <li>Recommendation payloads for child schedule and travel contexts.</li>
          <li>Backward-compatible top match fields (`disease`, `vaccines`, `matchType`, `score`).</li>
        </ul>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Embeddable Widget</h2>
        <p className="mt-2 text-sm text-slate-700">
          Use the hosted widget page or embed it directly in third-party websites.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">{EMBED_SNIPPET}</pre>
        <Link
          href="/embed"
          className="mt-3 inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Open widget preview
        </Link>
      </section>

      <ApiKeyManager />
    </main>
  );
}
