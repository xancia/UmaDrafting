import { useState } from "react";
import FormatSelection from "./components/FormatSelection";
import Draft5v5 from "./components/Draft5v5";
import Draft3v3v3 from "./components/Draft3v3v3";
import UnifiedTopBar from "./components/UnifiedTopBar";

type DraftFormat = "5v5" | "3v3v3" | null;

interface MultiplayerConfig {
  roomCode: string;
  playerName: string;
  isHost: boolean;
  isSpectator: boolean;
}

function App() {
  const [selectedFormat, setSelectedFormat] = useState<DraftFormat>(null);
  const [multiplayerConfig, setMultiplayerConfig] = useState<MultiplayerConfig | undefined>(undefined);

  const handleSelectFormat = (
    format: "5v5" | "3v3v3",
    config?: MultiplayerConfig
  ) => {
    setSelectedFormat(format);
    setMultiplayerConfig(config);
  };

  const handleBackToMenu = () => {
    setSelectedFormat(null);
    setMultiplayerConfig(undefined);
  };

  if (selectedFormat === "5v5") {
    return (
      <Draft5v5
        onBackToMenu={handleBackToMenu}
        multiplayerConfig={multiplayerConfig}
      />
    );
  }

  if (selectedFormat === "3v3v3") {
    return (
      <Draft3v3v3
        onBackToMenu={handleBackToMenu}
        multiplayerConfig={multiplayerConfig}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <UnifiedTopBar currentApp="drafter" />
      <FormatSelection onSelectFormat={handleSelectFormat} />
    </div>
  );
}

export default App;
