import type { UmaMusume } from "../types";

interface UmaCardProps {
  uma: UmaMusume;
  onSelect: (uma: UmaMusume) => void;
  disabled?: boolean;
  isSelected?: boolean;
}

export default function UmaCard({
  uma,
  onSelect,
  disabled,
  isSelected,
}: UmaCardProps) {
  return (
    <button
      onClick={() => onSelect(uma)}
      disabled={disabled}
      className={`p-1.5 lg:p-2 bg-gray-700 border-2 rounded-lg hover:border-gray-500 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-600 ${
        isSelected
          ? "border-yellow-400 ring-2 ring-yellow-400/50"
          : "border-gray-600"
      }`}
    >
      <div className="aspect-square bg-gray-600 rounded mb-0.5 lg:mb-1 flex items-center justify-center overflow-hidden">
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
      <p className="text-xs font-semibold text-gray-100 text-center whitespace-pre-line leading-tight break-words">
        {uma.name}
      </p>
    </button>
  );
}
