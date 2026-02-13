import axios from "axios";
import { ENV } from "./_core/env";

const BASE_URL = "https://api.the-odds-api.com/v4";

function apiKey() {
  return ENV.theOddsApiKey;
}

export interface OddsSport {
  key: string;
  group: string;
  title: string;
  description: string;
  active: boolean;
  has_outrights: boolean;
}

export interface OddsOutcome {
  name: string;
  price: number;
  point?: number;
}

export interface OddsMarket {
  key: string;
  last_update: string;
  outcomes: OddsOutcome[];
}

export interface OddsBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OddsMarket[];
}

export interface OddsEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsBookmaker[];
}

export interface ScoreEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores: { name: string; score: string }[] | null;
  last_update: string | null;
}

// Get all in-season sports (free, no credit cost)
export async function fetchSports(): Promise<OddsSport[]> {
  const { data } = await axios.get<OddsSport[]>(`${BASE_URL}/sports`, {
    params: { apiKey: apiKey() },
  });
  return data;
}

// Get odds for a sport
export async function fetchOdds(sportKey: string, markets = "h2h,spreads,totals", regions = "us,eu,uk"): Promise<OddsEvent[]> {
  const { data } = await axios.get<OddsEvent[]>(`${BASE_URL}/sports/${sportKey}/odds`, {
    params: {
      apiKey: apiKey(),
      regions,
      markets,
      oddsFormat: "decimal",
    },
  });
  return data;
}

// Get scores for a sport (for settlement)
export async function fetchScores(sportKey: string, daysFrom = 3): Promise<ScoreEvent[]> {
  const { data } = await axios.get<ScoreEvent[]>(`${BASE_URL}/sports/${sportKey}/scores`, {
    params: {
      apiKey: apiKey(),
      daysFrom,
    },
  });
  return data;
}

// Get events list for a sport (no odds, cheaper)
export async function fetchEvents(sportKey: string): Promise<Array<{
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
}>> {
  const { data } = await axios.get(`${BASE_URL}/sports/${sportKey}/events`, {
    params: { apiKey: apiKey() },
  });
  return data;
}
