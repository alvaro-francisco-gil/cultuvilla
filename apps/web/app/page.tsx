"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getEvents } from "@villa-events/shared/services/eventService";
import type { Event } from "@villa-events/shared/models/event";
import { useAuth } from "@/lib/auth-context";
import { NavBar } from "@/components/NavBar";

export default function HomePage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEvents()
      .then(setEvents)
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-6 text-3xl font-bold">Próximos Eventos</h1>
        {loading ? (
          <p className="text-[var(--color-text-light)]">Cargando eventos...</p>
        ) : events.length === 0 ? (
          <p className="text-[var(--color-text-light)]">
            No hay eventos programados.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/event/${event.id}`}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-sm transition hover:shadow-md"
              >
                <h2 className="text-xl font-semibold">{event.title}</h2>
                <p className="mt-1 text-sm text-[var(--color-text-light)]">
                  {event.date?.toDate().toLocaleDateString("es-ES", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <p className="mt-1 text-sm text-[var(--color-text-light)]">
                  {event.location}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
