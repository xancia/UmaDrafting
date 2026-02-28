import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  subscribeToLeaderboard,
  type LeaderboardEntry,
} from "../services/leaderboard";

function winRate(entry: LeaderboardEntry): string {
  const games = entry.wins + entry.losses;
  if (games === 0) {
    return "0.0%";
  }
  return `${((entry.wins / games) * 100).toFixed(1)}%`;
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToLeaderboard((nextEntries) => {
      setEntries(nextEntries);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <div className="flex-1 overflow-auto custom-scrollbar bg-gray-950 text-gray-100 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Leaderboard</h1>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 rounded-md bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            Back
          </button>
        </div>

        {loading ? (
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 text-gray-300">
            Loading leaderboard...
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 text-gray-300">
            No leaderboard entries yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-left bg-gray-900">
              <thead className="bg-gray-800 text-gray-200">
                <tr>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Player</th>
                  <th className="px-4 py-3">ELO</th>
                  <th className="px-4 py-3">W</th>
                  <th className="px-4 py-3">L</th>
                  <th className="px-4 py-3">Win%</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={entry.discordUserId} className="border-t border-gray-800">
                    <td className="px-4 py-3">{index + 1}</td>
                    <td className="px-4 py-3">{entry.displayName}</td>
                    <td className="px-4 py-3">
                      {Math.round(entry.rating)} ± {Math.round(2 * entry.rd)}
                    </td>
                    <td className="px-4 py-3">{entry.wins}</td>
                    <td className="px-4 py-3">{entry.losses}</td>
                    <td className="px-4 py-3">{winRate(entry)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-sm text-gray-400 mt-4">
          Want to set up match reporting in your Discord server? Contact{" "}
          <span className="text-indigo-400 font-medium">Terumi</span> on Discord.
        </p>
      </div>
    </div>
  );
}
