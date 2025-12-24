import type { Team3v3v3, TeamData3v3v3 } from "../types3v3v3";

interface TeamPanel3v3v3Props {
  team: Team3v3v3;
  teamName: string;
  teamData: TeamData3v3v3;
  isCurrentTurn: boolean;
}

export default function TeamPanel3v3v3({
  team,
  teamName,
  teamData,
  isCurrentTurn,
}: TeamPanel3v3v3Props) {
  const teamColor =
    team === "team1"
      ? "text-blue-500"
      : team === "team2"
      ? "text-red-500"
      : "text-green-500";

  const borderColor = isCurrentTurn
    ? team === "team1"
      ? "border-blue-500 shadow-blue-500/50"
      : team === "team2"
      ? "border-red-500 shadow-red-500/50"
      : "border-green-500 shadow-green-500/50"
    : "border-gray-700";

  return (
    <div
      className={`bg-gray-800 rounded-lg shadow-lg p-1.5 border-2 transition-all ${borderColor} ${
        isCurrentTurn ? "shadow-lg" : ""
      }`}
    >
      <div className="text-center mb-1 pb-1 border-b border-gray-700">
        <h3 className={`text-xs font-bold ${teamColor}`}>{teamName}</h3>
      </div>

      {/* Picked Umamusume Section */}
      <div className="mb-1">
        <h4 className="text-[10px] font-bold mb-1 text-gray-300 uppercase">
          Picked ({teamData.pickedUmas.length}/3)
        </h4>
        <div className="grid grid-cols-3 gap-1 max-w-125 mx-auto">
          {[...Array(3)].map((_, index) => {
            const uma = teamData.pickedUmas[index];
            return (
              <div
                key={index}
                className={`aspect-square rounded border overflow-hidden relative ${
                  uma
                    ? "border-gray-600 bg-gray-600"
                    : "bg-gray-900 border-gray-700"
                }`}
              >
                {uma ? (
                  <div className="relative w-full h-full">
                    <img
                      src={uma.imageUrl}
                      alt={uma.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                      }}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Banned Umamusume Section */}
      <div>
        <h4 className="text-[10px] font-bold mb-1 text-red-400 uppercase">
          Banned ({teamData.bannedUmas.length}/3)
        </h4>
        <div className="grid grid-cols-3 gap-1 max-w-125 mx-auto">
          {[...Array(3)].map((_, index) => {
            const uma = teamData.bannedUmas[index];
            return (
              <div
                key={index}
                className={`aspect-square rounded border overflow-hidden relative ${
                  uma
                    ? "border-gray-600 bg-gray-600"
                    : "bg-gray-900 border-gray-700"
                }`}
              >
                {uma ? (
                  <div className="relative w-full h-full">
                    <img
                      src={uma.imageUrl}
                      alt={uma.name}
                      className="w-full h-full object-cover grayscale opacity-30"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-red-500 text-xl font-bold">
                      ✕
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
