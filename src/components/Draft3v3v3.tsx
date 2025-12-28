import { useState } from "react";
import type { DraftState3v3v3, Card } from "../types3v3v3";
import type { UmaMusume } from "../types";
import {
  getInitialDraftState3v3v3,
  getNextTeamAndPhase,
  getTurnOrder,
} from "../draftLogic3v3v3";
import TeamPanel3v3v3 from "./TeamPanel3v3v3";
import UmaCard from "./UmaCard";

interface Draft3v3v3Props {
  onBackToMenu: () => void;
}

export default function Draft3v3v3({ onBackToMenu }: Draft3v3v3Props) {
  const [draftState, setDraftState] = useState<DraftState3v3v3>(
    getInitialDraftState3v3v3()
  );
  const [history, setHistory] = useState<DraftState3v3v3[]>([
    getInitialDraftState3v3v3(),
  ]);
  const [team1Name, setTeam1Name] = useState<string>("Team 1");
  const [team2Name, setTeam2Name] = useState<string>("Team 2");
  const [team3Name, setTeam3Name] = useState<string>("Team 3");
  const [tempTeam1Name, setTempTeam1Name] = useState<string>("Team 1");
  const [tempTeam2Name, setTempTeam2Name] = useState<string>("Team 2");
  const [tempTeam3Name, setTempTeam3Name] = useState<string>("Team 3");
  const [cardRarityFilter, setCardRarityFilter] = useState<
    "SSR" | "SR" | "R" | null
  >(null);
  const [umaSearch, setUmaSearch] = useState<string>("");
  const [cardSearch, setCardSearch] = useState<string>("");
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [showMenuConfirm, setShowMenuConfirm] = useState<boolean>(false);

  const confirmTeamNames = () => {
    setTeam1Name(tempTeam1Name || "Team 1");
    setTeam2Name(tempTeam2Name || "Team 2");
    setTeam3Name(tempTeam3Name || "Team 3");
    setDraftState({ ...draftState, phase: "card-preban" });
  };

  const handleUndo = () => {
    if (history.length > 1) {
      const newHistory = history.slice(0, -1);
      setHistory(newHistory);
      setDraftState(newHistory[newHistory.length - 1]);
      setUmaSearch("");
      setCardSearch("");
    }
  };

  const handleReset = () => {
    setShowResetConfirm(true);
  };

  const confirmReset = () => {
    const initialState = getInitialDraftState3v3v3();
    setDraftState(initialState);
    setHistory([initialState]);
    setTeam1Name("Team 1");
    setTeam2Name("Team 2");
    setTeam3Name("Team 3");
    setTempTeam1Name("Team 1");
    setTempTeam2Name("Team 2");
    setTempTeam3Name("Team 3");
    setCardRarityFilter(null);
    setUmaSearch("");
    setShowResetConfirm(false);
  };

  const handleBackToMenuClick = () => {
    setShowMenuConfirm(true);
  };

  const confirmBackToMenu = () => {
    onBackToMenu();
  };

  const toggleCardPreBan = (card: Card) => {
    const isPreBanned = draftState.preBannedCards.some((c) => c.id === card.id);
    const newPreBannedCards = isPreBanned
      ? draftState.preBannedCards.filter((c) => c.id !== card.id)
      : [...draftState.preBannedCards, card];

    setDraftState({ ...draftState, preBannedCards: newPreBannedCards });
  };

  const startUmaDraft = () => {
    const newState: DraftState3v3v3 = { ...draftState, phase: "uma-ban" };
    setDraftState(newState);
    setHistory([...history, newState]);
  };

  const continueToCardPick = () => {
    const cardOrder = getTurnOrder(1, "card-pick");
    const newState: DraftState3v3v3 = {
      ...draftState,
      phase: "card-pick",
      currentTeam: cardOrder[0],
      round: 1,
      turnInRound: 0,
    };
    setDraftState(newState);
    setHistory([...history, newState]);
  };

  const continueToComplete = () => {
    const newState: DraftState3v3v3 = {
      ...draftState,
      phase: "complete",
    };
    setDraftState(newState);
    setHistory([...history, newState]);
  };

  const handleUmaSelect = (uma: UmaMusume) => {
    const { currentTeam, phase } = draftState;

    // Prevent selection if uma-pick is complete (all teams have 3 umas)
    if (
      phase === "uma-pick" &&
      draftState.team1.pickedUmas.length === 3 &&
      draftState.team2.pickedUmas.length === 3 &&
      draftState.team3.pickedUmas.length === 3
    ) {
      return;
    }

    if (phase === "uma-ban") {
      const newState = {
        ...draftState,
        [currentTeam]: {
          ...draftState[currentTeam],
          bannedUmas: [...draftState[currentTeam].bannedUmas, uma],
        },
        availableUmas: draftState.availableUmas.filter((u) => u.id !== uma.id),
      };

      const nextState = getNextTeamAndPhase(newState);
      newState.currentTeam = nextState.nextTeam;
      newState.phase = nextState.nextPhase;
      newState.round = nextState.nextRound;
      newState.turnInRound = nextState.nextTurnInRound;

      setDraftState(newState);
      setHistory([...history, newState]);
    } else if (phase === "uma-pick") {
      const newState = {
        ...draftState,
        [currentTeam]: {
          ...draftState[currentTeam],
          pickedUmas: [...draftState[currentTeam].pickedUmas, uma],
        },
        availableUmas: draftState.availableUmas.filter((u) => u.id !== uma.id),
      };

      const nextState = getNextTeamAndPhase(newState);
      // Don't auto-advance to card-pick phase, stay in uma-pick
      if (nextState.nextPhase === "card-pick") {
        newState.currentTeam = currentTeam;
        newState.phase = "uma-pick";
        newState.round = draftState.round;
        newState.turnInRound = draftState.turnInRound;
      } else {
        newState.currentTeam = nextState.nextTeam;
        newState.phase = nextState.nextPhase;
        newState.round = nextState.nextRound;
        newState.turnInRound = nextState.nextTurnInRound;
      }

      setDraftState(newState);
      setHistory([...history, newState]);
    }
  };

  const handleCardSelect = (card: Card) => {
    if (draftState.phase !== "card-pick") return;

    // Prevent selection if card-pick is complete (all teams have 5 cards)
    if (
      draftState.team1.pickedCards.length === 5 &&
      draftState.team2.pickedCards.length === 5 &&
      draftState.team3.pickedCards.length === 5
    ) {
      return;
    }

    const currentTeam = draftState.currentTeam;
    const newState = {
      ...draftState,
      [currentTeam]: {
        ...draftState[currentTeam],
        pickedCards: [...draftState[currentTeam].pickedCards, card],
      },
      pickedCards: [...draftState.pickedCards, card],
      availableCards: draftState.availableCards.filter((c) => c.id !== card.id),
    };

    const nextState = getNextTeamAndPhase(newState);
    // Don't auto-advance to complete phase, stay in card-pick
    if (nextState.nextPhase === "complete") {
      newState.currentTeam = currentTeam;
      newState.phase = "card-pick";
      newState.round = draftState.round;
      newState.turnInRound = draftState.turnInRound;
    } else {
      newState.currentTeam = nextState.nextTeam;
      newState.phase = nextState.nextPhase;
      newState.round = nextState.nextRound;
      newState.turnInRound = nextState.nextTurnInRound;
    }

    setDraftState(newState);
    setHistory([...history, newState]);
  };

  const getFilteredUmas = () => {
    if (!umaSearch.trim()) return draftState.availableUmas;
    return draftState.availableUmas.filter((uma) =>
      uma.name.toLowerCase().includes(umaSearch.toLowerCase())
    );
  };

  const getFilteredCards = () => {
    let cards = draftState.availableCards.filter(
      (card) => !draftState.preBannedCards.some((pb) => pb.id === card.id)
    );

    if (cardSearch) {
      cards = cards.filter((card) =>
        card.name.toLowerCase().includes(cardSearch.toLowerCase())
      );
    }

    if (cardRarityFilter) {
      cards = cards.filter((card) => card.rarity === cardRarityFilter);
    }

    return cards;
  };

  const getTeamName = (team: "team1" | "team2" | "team3") => {
    if (team === "team1") return team1Name;
    if (team === "team2") return team2Name;
    return team3Name;
  };

  // Team Names Phase
  if (draftState.phase === "team-names") {
    return (
      <div className="h-screen bg-linear-to-br from-gray-950 to-gray-900 flex items-center justify-center px-6">
        <div className="bg-gray-800 rounded-xl shadow-2xl p-8 border-2 border-gray-700 max-w-md w-full">
          <h2 className="text-2xl font-bold text-gray-100 mb-4">
            Enter Team Names
          </h2>
          <p className="text-gray-400 mb-6">
            Name the three teams for this 3v3v3 draft
          </p>
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-blue-400 mb-2">
                Team 1 Name
              </label>
              <input
                type="text"
                value={tempTeam1Name}
                onChange={(e) => setTempTeam1Name(e.target.value)}
                placeholder="Team 1"
                maxLength={30}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-red-400 mb-2">
                Team 2 Name
              </label>
              <input
                type="text"
                value={tempTeam2Name}
                onChange={(e) => setTempTeam2Name(e.target.value)}
                placeholder="Team 2"
                maxLength={30}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-green-400 mb-2">
                Team 3 Name
              </label>
              <input
                type="text"
                value={tempTeam3Name}
                onChange={(e) => setTempTeam3Name(e.target.value)}
                placeholder="Team 3"
                maxLength={30}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:border-green-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={onBackToMenu}
              className="bg-gray-700 hover:bg-gray-600 text-gray-100 font-semibold py-2 px-6 rounded-lg transition-colors border border-gray-600"
            >
              Back
            </button>
            <button
              onClick={confirmTeamNames}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-8 rounded-lg transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Card Pre-ban Phase
  if (draftState.phase === "card-preban") {
    return (
      <div className="h-screen bg-linear-to-br from-gray-950 to-gray-900 flex flex-col px-6 py-6">
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700 mb-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-100">
                Card Pre-ban Phase
              </h2>
              <p className="text-gray-400">
                Select cards to ban from the draft pool (
                {draftState.preBannedCards.length} banned)
              </p>
            </div>
            <button
              onClick={startUmaDraft}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-8 rounded-lg transition-colors"
            >
              Start Draft →
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
          <h3 className="text-xl font-bold text-gray-100 mb-4">
            Available Cards
          </h3>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search cards..."
              value={cardSearch}
              onChange={(e) => setCardSearch(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-15 gap-4">
            {draftState.availableCards
              .filter((card) =>
                card.name.toLowerCase().includes(cardSearch.toLowerCase())
              )
              .map((card) => {
                const isBanned = draftState.preBannedCards.some(
                  (c) => c.id === card.id
                );
                return (
                  <button
                    key={card.id}
                    onClick={() => toggleCardPreBan(card)}
                    className={`p-2 rounded-lg border-2 transition-all ${
                      isBanned
                        ? "bg-red-900 border-red-600 opacity-50"
                        : "bg-gray-700 border-gray-600 hover:border-gray-500"
                    }`}
                  >
                    <div className="aspect-square bg-gray-600 rounded mb-1 overflow-hidden relative p-2">
                      {card.imageUrl ? (
                        <img
                          src={card.imageUrl}
                          alt={card.name}
                          className="w-full h-full object-cover rounded"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-2xl text-gray-400">?</span>
                        </div>
                      )}
                      {card.type && (
                        <img
                          src={`./supoka/${card.type}-icon.png`}
                          alt={card.type}
                          className="absolute top-1 right-1 w-6 h-6 object-contain"
                        />
                      )}
                    </div>
                    <p className="text-xs font-semibold text-gray-100 text-center truncate">
                      {card.name}
                    </p>
                    {isBanned && (
                      <div className="mt-1 text-red-400 text-xs font-bold text-center">
                        BANNED
                      </div>
                    )}
                  </button>
                );
              })}
          </div>
        </div>
      </div>
    );
  }

  // Main Draft Phase (Uma Draft or Card Draft)
  const currentTeamColor =
    draftState.currentTeam === "team1"
      ? "text-blue-400"
      : draftState.currentTeam === "team2"
      ? "text-red-400"
      : "text-green-400";

  return (
    <div className="h-screen bg-linear-to-br from-gray-950 to-gray-900 flex flex-col px-6 py-4 gap-3">
      {/* Compact Header */}
      <div className="bg-gray-800 rounded-lg shadow-lg px-4 py-2 border border-gray-700 shrink-0">
        <div className="flex items-center">
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <span className="text-xl font-semibold text-gray-100">
              Round {draftState.round}
            </span>
            {draftState.phase !== "complete" && (
              <>
                <span className="text-xl text-gray-500">•</span>
                <span className="text-2xl font-bold text-gray-100">
                  {draftState.phase === "uma-ban" && "Uma Ban"}
                  {draftState.phase === "uma-pick" && "Uma Pick"}
                  {draftState.phase === "card-pick" && "Card Draft"}
                </span>
                <span className="text-xl text-gray-500">•</span>
                <span className={`text-lg font-semibold ${currentTeamColor}`}>
                  {getTeamName(draftState.currentTeam)}
                </span>
              </>
            )}
            {draftState.phase === "complete" && (
              <span className="text-2xl font-bold text-gray-100">
                Complete!
              </span>
            )}
          </div>
          <div className="flex-1 flex items-center justify-end gap-2">
            {/* Continue button for uma-pick complete */}
            {draftState.phase === "uma-pick" &&
              draftState.round === 3 &&
              draftState.team1.pickedUmas.length === 3 &&
              draftState.team2.pickedUmas.length === 3 &&
              draftState.team3.pickedUmas.length === 3 && (
                <button
                  onClick={continueToCardPick}
                  className="bg-slate-600 hover:bg-slate-700 text-white font-semibold py-1.5 px-4 rounded-lg transition-colors text-sm"
                >
                  Continue to Card Draft →
                </button>
              )}
            {/* Continue button for card-pick complete */}
            {draftState.phase === "card-pick" &&
              draftState.round === 5 &&
              draftState.team1.pickedCards.length === 5 &&
              draftState.team2.pickedCards.length === 5 &&
              draftState.team3.pickedCards.length === 5 && (
                <button
                  onClick={continueToComplete}
                  className="bg-slate-600 hover:bg-slate-700 text-white font-semibold py-1.5 px-4 rounded-lg transition-colors text-sm"
                >
                  View Results →
                </button>
              )}
            <button
              onClick={handleUndo}
              disabled={history.length <= 1}
              className="bg-gray-700 hover:bg-gray-600 text-gray-100 font-semibold py-1.5 px-4 rounded-lg transition-colors border border-gray-600 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Undo
            </button>
            <button
              onClick={handleReset}
              className="bg-gray-700 hover:bg-gray-600 text-gray-100 font-semibold py-1.5 px-4 rounded-lg transition-colors border border-gray-600 text-sm"
            >
              Reset
            </button>
            <button
              onClick={handleBackToMenuClick}
              className="bg-gray-700 hover:bg-gray-600 text-gray-100 font-semibold py-1.5 px-4 rounded-lg transition-colors border border-gray-600 text-sm"
            >
              Format Selection
            </button>
          </div>
        </div>
      </div>

      {/* Team Panels Row */}
      {(draftState.phase === "uma-ban" ||
        draftState.phase === "uma-pick" ||
        draftState.phase === "card-pick") && (
        <div className="grid grid-cols-3 gap-3 shrink-0">
          <TeamPanel3v3v3
            team="team1"
            teamName={team1Name}
            teamData={draftState.team1}
            isCurrentTurn={draftState.currentTeam === "team1"}
            phase={draftState.phase}
          />
          <TeamPanel3v3v3
            team="team2"
            teamName={team2Name}
            teamData={draftState.team2}
            isCurrentTurn={draftState.currentTeam === "team2"}
            phase={draftState.phase}
          />
          <TeamPanel3v3v3
            team="team3"
            teamName={team3Name}
            teamData={draftState.team3}
            isCurrentTurn={draftState.currentTeam === "team3"}
            phase={draftState.phase}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto hide-scrollbar bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
        {/* Uma Draft */}
        {(draftState.phase === "uma-ban" ||
          draftState.phase === "uma-pick") && (
          <>
            <h2 className="text-2xl font-bold mb-4 text-gray-100">
              {draftState.phase === "uma-pick" && "Available Umamusume"}
              {draftState.phase === "uma-ban" && "Available Umamusume"}
            </h2>
            <input
              type="text"
              placeholder="Search Umamusume..."
              value={umaSearch}
              onChange={(e) => setUmaSearch(e.target.value)}
              className="w-full mb-4 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:border-gray-500"
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-15 gap-4">
              {getFilteredUmas().map((uma) => (
                <UmaCard key={uma.id} uma={uma} onSelect={handleUmaSelect} />
              ))}
            </div>
          </>
        )}
        {/* Card Draft */}
        {draftState.phase === "card-pick" && (
          <>
            <h3 className="text-xl font-bold text-gray-100 mb-4">
              Available Cards
            </h3>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search cards..."
                value={cardSearch}
                onChange={(e) => setCardSearch(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-3 mb-6">
              <button
                onClick={() =>
                  setCardRarityFilter(cardRarityFilter === "SSR" ? null : "SSR")
                }
                className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                  cardRarityFilter === "SSR"
                    ? "bg-yellow-600 text-white"
                    : "bg-gray-700 text-gray-100 hover:bg-gray-600"
                } border border-gray-600`}
              >
                SSR
              </button>
              <button
                onClick={() =>
                  setCardRarityFilter(cardRarityFilter === "SR" ? null : "SR")
                }
                className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                  cardRarityFilter === "SR"
                    ? "bg-purple-600 text-white"
                    : "bg-gray-700 text-gray-100 hover:bg-gray-600"
                } border border-gray-600`}
              >
                SR
              </button>
              <button
                onClick={() =>
                  setCardRarityFilter(cardRarityFilter === "R" ? null : "R")
                }
                className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                  cardRarityFilter === "R"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-100 hover:bg-gray-600"
                } border border-gray-600`}
              >
                R
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-15 gap-4">
              {getFilteredCards().map((card) => (
                <button
                  key={card.id}
                  onClick={() => handleCardSelect(card)}
                  className="p-2 bg-gray-700 border-2 border-gray-600 rounded-lg hover:border-gray-500 hover:shadow-lg transition-all"
                >
                  <div className="aspect-square bg-gray-600 rounded mb-1 overflow-hidden relative p-2">
                    {card.imageUrl ? (
                      <img
                        src={card.imageUrl}
                        alt={card.name}
                        className="w-full h-full object-cover rounded"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-2xl text-gray-400">?</span>
                      </div>
                    )}
                    {card.type && (
                      <img
                        src={`./supoka/${card.type}-icon.png`}
                        alt={card.type}
                        className="absolute top-1 right-1 w-6 h-6 object-contain"
                      />
                    )}
                  </div>
                  <p className="text-xs font-semibold text-gray-100 text-center truncate">
                    {card.name}
                  </p>
                </button>
              ))}
            </div>
          </>
        )}
        {draftState.phase === "complete" && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-3xl font-bold text-gray-100 mb-2">
                Draft Complete!
              </h3>
              <p className="text-gray-400">All selections have been made.</p>
            </div>

            {/* Team Results - Uma Musume Only */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Team 1 */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h4 className="text-xl font-bold text-blue-400 mb-4 text-center border-b border-gray-600 pb-2">
                  {team1Name}
                </h4>

                <div className="grid grid-cols-3 gap-2">
                  {draftState.team1.pickedUmas.map((uma) => (
                    <div
                      key={uma.id}
                      className="aspect-square rounded border border-gray-600 overflow-hidden"
                    >
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
                  ))}
                </div>
              </div>

              {/* Team 2 */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h4 className="text-xl font-bold text-red-400 mb-4 text-center border-b border-gray-600 pb-2">
                  {team2Name}
                </h4>

                <div className="grid grid-cols-3 gap-2">
                  {draftState.team2.pickedUmas.map((uma) => (
                    <div
                      key={uma.id}
                      className="aspect-square rounded border border-gray-600 overflow-hidden"
                    >
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
                  ))}
                </div>
              </div>

              {/* Team 3 */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h4 className="text-xl font-bold text-green-400 mb-4 text-center border-b border-gray-600 pb-2">
                  {team3Name}
                </h4>

                <div className="grid grid-cols-3 gap-2">
                  {draftState.team3.pickedUmas.map((uma) => (
                    <div
                      key={uma.id}
                      className="aspect-square rounded border border-gray-600 overflow-hidden"
                    >
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
                  ))}
                </div>
              </div>
            </div>

            {/* Card Pool - All Cards Together */}
            <div className="bg-gray-700 rounded-lg p-6">
              <h4 className="text-2xl font-bold text-gray-100 mb-4 text-center border-b border-gray-600 pb-3">
                Card Pool
              </h4>
              <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-15 gap-2">
                {draftState.pickedCards.map((card) => (
                  <div
                    key={card.id}
                    className="aspect-square rounded border border-gray-600 overflow-hidden relative"
                  >
                    <img
                      src={card.imageUrl}
                      alt={card.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                      }}
                    />
                    {card.type && (
                      <img
                        src={`./supoka/${card.type}-icon.png`}
                        alt={card.type}
                        className="absolute top-0.5 right-0.5 w-4 h-4 object-contain"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}{" "}
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl shadow-2xl p-8 border-2 border-gray-700 max-w-md">
            <h2 className="text-2xl font-bold text-gray-100 mb-4">
              Reset Draft?
            </h2>
            <p className="text-gray-400 mb-6">
              Are you sure you want to reset the draft? All progress will be
              lost and you will return to the team name selection.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="bg-gray-700 hover:bg-gray-600 text-gray-100 font-semibold py-2 px-6 rounded-lg transition-colors border border-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={confirmReset}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
              >
                Reset Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back to Menu Confirmation Modal */}
      {showMenuConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl shadow-2xl p-8 border-2 border-gray-700 max-w-md">
            <h2 className="text-2xl font-bold text-gray-100 mb-4">
              Return to Menu?
            </h2>
            <p className="text-gray-400 mb-6">
              Are you sure you want to return to the format selection menu?
              Current draft progress will be lost.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowMenuConfirm(false)}
                className="bg-gray-700 hover:bg-gray-600 text-gray-100 font-semibold py-2 px-6 rounded-lg transition-colors border border-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={confirmBackToMenu}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
              >
                Return to Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
