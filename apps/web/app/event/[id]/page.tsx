"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getEvent } from "@villa-events/shared/services/eventService";
import {
  getEventRegistrations,
  registerToEvent,
  unregisterFromEvent,
} from "@villa-events/shared/services/registrationService";
import type { Event } from "@villa-events/shared/models/event";
import type { EventRegistration } from "@villa-events/shared/models/event";
import { useAuth } from "@/lib/auth-context";
import { NavBar } from "@/components/NavBar";

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [loading, setLoading] = useState(true);

  const isRegistered = registrations.some((r) => r.userId === user?.uid);

  useEffect(() => {
    if (!id) return;
    Promise.all([getEvent(id), getEventRegistrations(id)])
      .then(([ev, regs]) => {
        setEvent(ev);
        setRegistrations(regs);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleRegister = async () => {
    if (!user || !id) return;
    await registerToEvent({
      eventId: id,
      userId: user.uid,
      userName: user.displayName || user.email || "Anónimo",
    });
    setRegistrations(await getEventRegistrations(id));
  };

  const handleUnregister = async () => {
    if (!user || !id) return;
    await unregisterFromEvent(id, user.uid);
    setRegistrations(await getEventRegistrations(id));
  };

  if (loading) {
    return (
      <>
        <NavBar />
        <main className="mx-auto max-w-2xl px-4 py-8">
          <p className="text-[var(--color-text-light)]">Cargando...</p>
        </main>
      </>
    );
  }

  if (!event) {
    return (
      <>
        <NavBar />
        <main className="mx-auto max-w-2xl px-4 py-8">
          <p>Evento no encontrado.</p>
        </main>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-3xl font-bold">{event.title}</h1>
        <p className="mt-2 text-[var(--color-text-light)]">
          {event.date?.toDate().toLocaleDateString("es-ES", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        <p className="mt-1 text-[var(--color-text-light)]">{event.location}</p>
        <p className="mt-4">{event.description}</p>

        <div className="mt-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <h2 className="font-semibold">
            Apuntados ({registrations.length}
            {event.maxAttendees ? ` / ${event.maxAttendees}` : ""})
          </h2>
          {user ? (
            <button
              onClick={isRegistered ? handleUnregister : handleRegister}
              className={`mt-3 rounded-lg px-4 py-2 font-medium text-white transition ${
                isRegistered
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)]"
              }`}
            >
              {isRegistered ? "Cancelar inscripción" : "Apuntarse"}
            </button>
          ) : (
            <p className="mt-3 text-sm text-[var(--color-text-light)]">
              Inicia sesión para apuntarte.
            </p>
          )}
          <ul className="mt-3 space-y-1">
            {registrations.map((r) => (
              <li key={r.id} className="text-sm">
                {r.userName}
              </li>
            ))}
          </ul>
        </div>
      </main>
    </>
  );
}
