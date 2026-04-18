"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function SignInPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (mode === "register") {
        const registerResponse = await fetch("/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name,
            email,
            password
          })
        });

        if (!registerResponse.ok) {
          const payload = (await registerResponse.json().catch(() => ({ message: "Registration failed" }))) as {
            message?: string;
          };
          throw new Error(payload.message ?? "Registration failed");
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false
      });

      if (!result || result.error) {
        throw new Error("Invalid credentials");
      }

      router.push("/");
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="mb-2 inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700">
          VaxInfo Auth
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Access saved diseases, personalized dashboard preferences, and API key management.
        </p>

        <div className="mt-4 inline-flex rounded-lg border border-slate-200 p-1 text-xs">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`rounded-md px-3 py-1.5 font-medium ${
              mode === "signin" ? "bg-sky-600 text-white" : "text-slate-700"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`rounded-md px-3 py-1.5 font-medium ${
              mode === "register" ? "bg-sky-600 text-white" : "text-slate-700"
            }`}
          >
            Register
          </button>
        </div>

        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          {mode === "register" && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-700">Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-sky-300"
                placeholder="Your name"
              />
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-sky-300"
              placeholder="you@example.com"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-700">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-sky-300"
              placeholder="At least 8 characters"
              required
            />
          </label>

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="h-10 w-full rounded-lg bg-sky-600 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Please wait..." : mode === "signin" ? "Sign in" : "Register and sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
