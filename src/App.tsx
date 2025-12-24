import { useState } from "react";
import FormatSelection from "./components/FormatSelection";
import Draft5v5 from "./components/Draft5v5";
import Draft3v3v3 from "./components/Draft3v3v3";

type DraftFormat = "5v5" | "3v3v3" | null;

function App() {
  const [selectedFormat, setSelectedFormat] = useState<DraftFormat>(null);

  const handleSelectFormat = (format: "5v5" | "3v3v3") => {
    setSelectedFormat(format);
  };

  const handleBackToMenu = () => {
    setSelectedFormat(null);
  };

  if (selectedFormat === "5v5") {
    return <Draft5v5 onBackToMenu={handleBackToMenu} />;
  }

  if (selectedFormat === "3v3v3") {
    return <Draft3v3v3 onBackToMenu={handleBackToMenu} />;
  }

  return <FormatSelection onSelectFormat={handleSelectFormat} />;
}

export default App;
