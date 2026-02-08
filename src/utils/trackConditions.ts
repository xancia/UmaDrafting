export interface TrackConditions {
  season: "Spring" | "Summer" | "Fall" | "Winter";
  ground: "Firm" | "Good" | "Soft" | "Heavy";
  weather: "Sunny" | "Cloudy" | "Rainy" | "Snowy";
}

export function generateTrackConditions(): TrackConditions {
  const seasons: TrackConditions["season"][] = [
    "Spring",
    "Summer",
    "Fall",
    "Winter",
  ];
  const weathers: TrackConditions["weather"][] = [
    "Sunny",
    "Cloudy",
    "Rainy",
    "Snowy",
  ];

  const season = seasons[Math.floor(Math.random() * seasons.length)];

  // Snowy weather only possible in Winter
  const availableWeathers =
    season === "Winter" ? weathers : weathers.filter((w) => w !== "Snowy");
  const weather =
    availableWeathers[Math.floor(Math.random() * availableWeathers.length)];

  // Ground condition depends on weather
  let ground: TrackConditions["ground"];
  if (weather === "Sunny" || weather === "Cloudy") {
    ground = Math.random() < 0.5 ? "Firm" : "Good";
  } else if (weather === "Rainy") {
    ground = Math.random() < 0.5 ? "Soft" : "Heavy";
  } else {
    // Snowy
    ground = Math.random() < 0.5 ? "Good" : "Soft";
  }

  return {
    season,
    ground,
    weather,
  };
}

export function formatTrackConditions(conditions: TrackConditions): string {
  return `${conditions.season} • ${conditions.ground} • ${conditions.weather}`;
}
