import type { Map } from "../types";

interface MapCardProps {
  map: Map;
  onSelect: (map: Map) => void;
  disabled?: boolean;
}

export default function MapCard({ map, onSelect, disabled }: MapCardProps) {
  const surfaceColor =
    map.surface.toLowerCase() === "turf" ? "bg-green-700" : "bg-amber-800";

  return (
    <button
      onClick={() => onSelect(map)}
      disabled={disabled}
      className="p-2 lg:p-3 bg-gray-700 border-2 border-gray-600 rounded-lg hover:border-gray-500 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-600"
    >
      <div
        className={`${surfaceColor} rounded px-2 py-2 lg:py-3 mb-1.5 lg:mb-2 flex flex-col items-center justify-center`}
      >
        <span className="text-xs font-semibold text-gray-100">
          {map.surface}
        </span>
      </div>
      <p className="text-xs lg:text-sm font-bold text-gray-100 text-center mb-0.5 lg:mb-1">
        {map.track}
      </p>
      <p className="text-xs text-gray-300 text-center">
        {map.distance}m{map.variant ? ` (${map.variant})` : ""}
      </p>
      {map.conditions && (
        <p className="text-xs text-gray-400 text-center mt-1">
          {map.conditions.season} • {map.conditions.ground} •{" "}
          {map.conditions.weather}
        </p>
      )}
    </button>
  );
}
