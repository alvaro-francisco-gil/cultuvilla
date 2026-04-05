"use client";

import { useState } from "react";
import type { Event } from "@villa-events/shared/models/event";

interface EventFormProps {
  onSubmit: (data: {
    title: string;
    description: string;
    date: string;
    location: string;
    maxAttendees?: number;
  }) => Promise<void>;
  initialData?: Event;
}

export function EventForm({ onSubmit, initialData }: EventFormProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(
    initialData?.description || ""
  );
  const [date, setDate] = useState(
    initialData?.date
      ? initialData.date.toDate().toISOString().slice(0, 16)
      : ""
  );
  const [location, setLocation] = useState(initialData?.location || "");
  const [maxAttendees, setMaxAttendees] = useState<string>(
    initialData?.maxAttendees?.toString() || ""
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        title,
        description,
        date,
        location,
        maxAttendees: maxAttendees ? parseInt(maxAttendees, 10) : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Título</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full rounded-lg border border-[var(--color-border)] px-4 py-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Descripción</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={4}
          className="w-full rounded-lg border border-[var(--color-border)] px-4 py-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">
          Fecha y hora
        </label>
        <input
          type="datetime-local"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="w-full rounded-lg border border-[var(--color-border)] px-4 py-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Lugar</label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          required
          className="w-full rounded-lg border border-[var(--color-border)] px-4 py-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">
          Aforo máximo (opcional)
        </label>
        <input
          type="number"
          value={maxAttendees}
          onChange={(e) => setMaxAttendees(e.target.value)}
          min="1"
          className="w-full rounded-lg border border-[var(--color-border)] px-4 py-2"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-[var(--color-primary)] px-6 py-2 font-medium text-white transition hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
      >
        {submitting ? "Guardando..." : "Guardar"}
      </button>
    </form>
  );
}
