export interface TrackConditions {
  season: "Spring" | "Summer" | "Fall" | "Winter";
  ground: "Firm" | "Wet";
  weather: "Sunny" | "Cloudy" | "Heavy" | "Soft";
}

export function generateTrackConditions(): TrackConditions {
  const seasons: TrackConditions["season"][] = [
    "Spring",
    "Summer",
    "Fall",
    "Winter",
  ];
  const grounds: TrackConditions["ground"][] = ["Firm", "Wet"];
  const weathers: TrackConditions["weather"][] = [
    "Sunny",
    "Cloudy",
    "Heavy",
    "Soft",
  ];

  return {
    season: seasons[Math.floor(Math.random() * seasons.length)],
    ground: grounds[Math.floor(Math.random() * grounds.length)],
    weather: weathers[Math.floor(Math.random() * weathers.length)],
  };
}

export function formatTrackConditions(conditions: TrackConditions): string {
  return `${conditions.season} • ${conditions.ground} • ${conditions.weather}`;
}
