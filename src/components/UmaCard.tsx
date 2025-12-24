import type { UmaMusume } from "../types";

interface UmaCardProps {
  uma: UmaMusume;
  onSelect: (uma: UmaMusume) => void;
  disabled?: boolean;
}

export default function UmaCard({ uma, onSelect, disabled }: UmaCardProps) {
  return (
    <button
      onClick={() => onSelect(uma)}
      disabled={disabled}
      className="p-4 bg-gray-700 border-2 border-gray-600 rounded-lg hover:border-gray-500 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-600"
    >
      <div className="aspect-square bg-gray-600 rounded mb-2 flex items-center justify-center overflow-hidden">
        {uma.imageUrl ? (
          <img
            src={uma.imageUrl}
            alt={uma.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-xl text-gray-400">?</span>
        )}
      </div>
      <p className="text-sm font-semibold text-gray-100 text-center">
        {uma.name}
      </p>
    </button>
  );
}
