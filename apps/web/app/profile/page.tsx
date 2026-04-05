"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { NavBar } from "@/components/NavBar";

export default function ProfilePage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) return null;

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-3xl font-bold">Mi Perfil</h1>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
          {user.photoURL && (
            <img
              src={user.photoURL}
              alt="Avatar"
              className="mb-4 h-16 w-16 rounded-full"
            />
          )}
          <p className="text-lg font-semibold">
            {user.displayName || "Sin nombre"}
          </p>
          <p className="text-[var(--color-text-light)]">{user.email}</p>
          <button
            onClick={async () => {
              await signOut();
              router.push("/");
            }}
            className="mt-6 rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 transition hover:bg-red-50"
          >
            Cerrar sesión
          </button>
        </div>
      </main>
    </>
  );
}
