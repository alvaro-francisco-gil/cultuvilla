"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function NavBar() {
  const { user, loading } = useAuth();

  return (
    <nav className="border-b border-[var(--color-border)] bg-[var(--color-bg-card)]">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-xl font-bold">
          Villa Events
        </Link>
        <div className="flex items-center gap-4">
          {loading ? null : user ? (
            <>
              <Link
                href="/admin"
                className="text-sm text-[var(--color-text-light)] hover:text-[var(--color-text)]"
              >
                Admin
              </Link>
              <Link
                href="/profile"
                className="text-sm text-[var(--color-text-light)] hover:text-[var(--color-text)]"
              >
                Mi Perfil
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[var(--color-primary-dark)]"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
