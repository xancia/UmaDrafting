interface FormatSelectionProps {
  onSelectFormat: (format: "5v5" | "3v3v3") => void;
}

export default function FormatSelection({
  onSelectFormat,
}: FormatSelectionProps) {
  return (
    <div className="h-screen bg-linear-to-br from-gray-950 to-gray-900 flex items-center justify-center px-6">
      <div className="bg-gray-800 rounded-xl shadow-2xl p-12 border-2 border-gray-700 max-w-2xl w-full">
        <h1 className="text-5xl font-bold text-center mb-4 text-gray-100">
          Uma Musume Drafting
        </h1>
        <p className="text-center text-gray-400 mb-12 text-lg">
          Select your draft format to begin
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => onSelectFormat("5v5")}
            className="group bg-gray-700 hover:bg-gray-600 border-2 border-gray-600 hover:border-blue-500 rounded-xl p-8 transition-all transform hover:scale-105 shadow-lg"
          >
            <div className="text-6xl font-bold text-blue-500 mb-4">5v5</div>
            <p className="text-gray-400 text-sm">
              2 Teams • Uma & Map Drafting
            </p>
          </button>

          <button
            onClick={() => onSelectFormat("3v3v3")}
            className="group bg-gray-700 hover:bg-gray-600 border-2 border-gray-600 hover:border-purple-500 rounded-xl p-8 transition-all transform hover:scale-105 shadow-lg relative"
          >
            <div className="text-6xl font-bold text-purple-500 mb-4">3v3v3</div>
            <p className="text-gray-400 text-sm">3 Teams • Uma & Card Draft</p>
            <div className="absolute top-4 right-4 bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">
              WIP
            </div>
          </button>
        </div>

        <div className="mt-8 text-center text-xs text-gray-500">
          Made by{" "}
          <a
            href="https://github.com/xancia"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-400 transition-colors"
          >
            Terumi (xancia)
          </a>{" "}
          and{" "}
          <a
            href="https://discord.gg/CWEgfQBRSK"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-400 transition-colors"
          >
            Umamusume Tournaments Discord
          </a>
        </div>
      </div>
    </div>
  );
}
