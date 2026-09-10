"use client";

import { useState } from "react";
import { Api } from "../../lib/api";
import { setToken } from "../../lib/storage";
import Link from "next/link";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onRegister() {
    setError(null);
    setBusy(true);
    try {
      const data = await Api.register({ email, name, password });
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
        <h1>Create account</h1>
        <p className="sub">Join your team&apos;s realtime workspace</p>
        {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onRegister();
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required minLength={2} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 8 characters)"
            type="password"
            required
            minLength={8}
          />
          <button className="primary" disabled={busy}>
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>
        <p className="foot">
          Already have one? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}