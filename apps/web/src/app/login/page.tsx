"use client";

import { useState } from "react";
import { Api } from "../../lib/api";
import { setToken } from "../../lib/storage";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("demo@kanban.dev");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onLogin() {
    setError(null);
    setBusy(true);
    try {
      const data = await Api.login({ email, password });
      setToken(data.token);
      location.href = "/";
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="logo">K</div>
        <h1>Welcome back</h1>
        <p className="sub">Sign in to your realtime workspace</p>
        {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onLogin();
          }}
        >
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            required
          />
          <button className="primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="foot">
          No account? <Link href="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}