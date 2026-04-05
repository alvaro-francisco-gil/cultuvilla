"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { signInWithGoogle, signInWithEmail, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) router.push("/");
  }, [user, router]);

  if (user) return null;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmail(email, password, isSignUp);
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-center text-2xl font-bold">Villa Events</h1>
        <p className="text-center text-[var(--color-text-light)]">
          {isSignUp ? "Crear cuenta" : "Iniciar sesión"}
        </p>

        <button
          onClick={signInWithGoogle}
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 font-medium transition hover:bg-gray-50"
        >
          Continuar con Google
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--color-border)]" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-[var(--color-bg)] px-2 text-[var(--color-text-light)]">
              o
            </span>
          </div>
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-[var(--color-border)] px-4 py-3"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-[var(--color-border)] px-4 py-3"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-lg bg-[var(--color-primary)] px-4 py-3 font-medium text-white transition hover:bg-[var(--color-primary-dark)]"
          >
            {isSignUp ? "Crear cuenta" : "Entrar"}
          </button>
        </form>

        <p className="text-center text-sm text-[var(--color-text-light)]">
          {isSignUp ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?"}{" "}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-[var(--color-primary)] hover:underline"
          >
            {isSignUp ? "Iniciar sesión" : "Crear cuenta"}
          </button>
        </p>
      </div>
    </main>
  );
}
