"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { NavBar } from "@/components/NavBar";
import { EventForm } from "@/components/EventForm";
import { getEvent, updateEvent } from "@villa-events/shared/services/eventService";
import type { Event } from "@villa-events/shared/models/event";
import { Timestamp } from "firebase/firestore";

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getEvent(id)
      .then(setEvent)
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (data: {
    title: string;
    description: string;
    date: string;
    location: string;
    maxAttendees?: number;
  }) => {
    if (!user || !id) return;
    await updateEvent(id, {
      ...data,
      date: Timestamp.fromDate(new Date(data.date)),
    });
    router.push("/admin");
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
        <h1 className="mb-6 text-3xl font-bold">Editar Evento</h1>
        <EventForm onSubmit={handleSubmit} initialData={event} />
      </main>
    </>
  );
}
