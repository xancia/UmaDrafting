import type { Map } from "../types";

interface MapCardProps {
  map: Map;
  onSelect: (map: Map) => void;
  disabled?: boolean;
}

export default function MapCard({ map, onSelect, disabled }: MapCardProps) {
  return (
    <button
      onClick={() => onSelect(map)}
      disabled={disabled}
      className="p-3 bg-gray-700 border-2 border-gray-600 rounded-lg hover:border-gray-500 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-600"
    >
      <div className="bg-gray-600 rounded px-2 py-3 mb-2 flex flex-col items-center justify-center">
        <span className="text-xs font-semibold text-gray-200">
          {map.surface}
        </span>
      </div>
      <p className="text-sm font-bold text-gray-100 text-center mb-1">
        {map.track}
      </p>
      <p className="text-xs text-gray-300 text-center">
        {map.distance}m{map.variant ? ` (${map.variant})` : ""}
      </p>
    </button>
  );
}
