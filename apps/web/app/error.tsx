'use client';

import { useEffect } from 'react';
import { reportError } from '@/lib/errorReporter';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { source: 'next-error-page', extra: { digest: error.digest } });
  }, [error]);

  return (
    <div className="px-4 py-12 text-center">
      <h1 className="text-xl font-semibold text-gray-900 mb-2">Algo ha ido mal</h1>
      <p className="text-sm text-gray-600 mb-6">
        Se ha producido un error inesperado. Puedes reintentar o recargar la página.
      </p>
      <button
        type="button"
        onClick={reset}
        className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition"
      >
        Reintentar
      </button>
    </div>
  );
}
