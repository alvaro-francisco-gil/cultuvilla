'use client';

interface FeedFilterBarProps {
  nearbyOn: boolean;
  nearbyAvailable: boolean;
  onToggleNearby: () => void;
}

export function FeedFilterBar({ nearbyOn, nearbyAvailable, onToggleNearby }: FeedFilterBarProps) {
  if (!nearbyAvailable) return null;
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
      <button
        type="button"
        onClick={onToggleNearby}
        className={`text-xs px-3 py-1.5 rounded-full font-medium transition ${
          nearbyOn ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
        }`}
      >
        Cerca de mí
      </button>
    </div>
  );
}
