interface AttendeeBadgeProps {
  isVecino: boolean;
}

export function AttendeeBadge({ isVecino }: AttendeeBadgeProps) {
  return isVecino ? (
    <span className="text-[10px] uppercase tracking-wide bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
      Vecino
    </span>
  ) : (
    <span className="text-[10px] uppercase tracking-wide bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
      Visitante
    </span>
  );
}
