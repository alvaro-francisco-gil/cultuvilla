"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { NavBar } from "@/components/NavBar";
import { EventForm } from "@/components/EventForm";
import { createEvent } from "@villa-events/shared/services/eventService";
import { Timestamp } from "firebase/firestore";

export default function NewEventPage() {
  const { user } = useAuth();
  const router = useRouter();

  const handleSubmit = async (data: {
    title: string;
    description: string;
    date: string;
    location: string;
    maxAttendees?: number;
  }) => {
    if (!user) return;
    await createEvent({
      ...data,
      date: Timestamp.fromDate(new Date(data.date)),
      createdBy: user.uid,
    });
    router.push("/admin");
  };

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-3xl font-bold">Crear Evento</h1>
        <EventForm onSubmit={handleSubmit} />
      </main>
    </>
  );
}
