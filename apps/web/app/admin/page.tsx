"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getEvents, deleteEvent } from "@villa-events/shared/services/eventService";
import type { Event } from "@villa-events/shared/models/event";
import { useAuth } from "@/lib/auth-context";
import { NavBar } from "@/components/NavBar";

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    getEvents()
      .then(setEvents)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este evento?")) return;
    await deleteEvent(id);
    setEvents(events.filter((e) => e.id !== id));
  };

  if (authLoading || !user) return null;

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Administrar Eventos</h1>
          <Link
            href="/admin/event/new"
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 font-medium text-white transition hover:bg-[var(--color-primary-dark)]"
          >
            Crear evento
          </Link>
        </div>

        {loading ? (
          <p className="text-[var(--color-text-light)]">Cargando...</p>
        ) : events.length === 0 ? (
          <p className="text-[var(--color-text-light)]">No hay eventos.</p>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4"
              >
                <div>
                  <h2 className="font-semibold">{event.title}</h2>
                  <p className="text-sm text-[var(--color-text-light)]">
                    {event.date?.toDate().toLocaleDateString("es-ES")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/admin/event/${event.id}/edit`}
                    className="rounded-lg border border-[var(--color-border)] px-3 py-1 text-sm transition hover:bg-gray-50"
                  >
                    Editar
                  </Link>
                  <button
                    onClick={() => handleDelete(event.id!)}
                    className="rounded-lg border border-red-200 px-3 py-1 text-sm text-red-600 transition hover:bg-red-50"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
