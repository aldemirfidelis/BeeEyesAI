import { Router } from "express";
import { asyncHandler } from "../api/async-handler";
import { sendOk } from "../api/response";
import { requireAuth } from "../middleware/requireAuth";
import { storage } from "../storage";
import { generateDailyBriefing } from "../ai";

interface GeoResult {
  results?: Array<{ latitude: number; longitude: number; name: string }>;
}

interface WeatherResult {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    precipitation_probability?: number;
    weather_code?: number;
  };
  daily?: {
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
  };
}

function weatherCodeToDescription(code: number): string {
  if (code === 0) return "Céu limpo e ensolarado";
  if (code <= 3) return "Parcialmente nublado";
  if (code <= 48) return "Tempo nublado com névoa";
  if (code <= 55) return "Garoa leve";
  if (code <= 65) return "Chuva";
  if (code <= 75) return "Neve";
  if (code <= 82) return "Pancadas de chuva";
  if (code <= 99) return "Tempestade";
  return "Tempo variável";
}

async function fetchWeatherForCity(city: string): Promise<{
  temp: number;
  tempMin: number;
  tempMax: number;
  description: string;
  precipitationChance: number;
} | null> {
  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=pt&format=json`,
      { signal: AbortSignal.timeout(5000) }
    );
    const geoData = await geoRes.json() as GeoResult;
    const location = geoData.results?.[0];
    if (!location) return null;

    return fetchWeatherForCoords(location.latitude, location.longitude);
  } catch {
    return null;
  }
}

async function fetchWeatherForCoords(lat: number, lon: number): Promise<{
  temp: number;
  tempMin: number;
  tempMax: number;
  description: string;
  precipitationChance: number;
} | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation_probability,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json() as WeatherResult;

    const temp = Math.round(data.current?.temperature_2m ?? 0);
    const tempMax = Math.round(data.daily?.temperature_2m_max?.[0] ?? temp);
    const tempMin = Math.round(data.daily?.temperature_2m_min?.[0] ?? temp);
    const precipChance = data.daily?.precipitation_probability_max?.[0] ?? data.current?.precipitation_probability ?? 0;
    const code = data.current?.weather_code ?? 0;

    return {
      temp,
      tempMin,
      tempMax,
      description: weatherCodeToDescription(code),
      precipitationChance: Math.round(precipChance),
    };
  } catch {
    return null;
  }
}

function getTodayDateStr(): string {
  return new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }).split("/").reverse().join("-");
}

function getDayOfWeek(): string {
  const days = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  const idx = new Date().toLocaleDateString("en-US", { timeZone: "America/Sao_Paulo", weekday: "long" });
  const map: Record<string, string> = {
    Sunday: "domingo", Monday: "segunda-feira", Tuesday: "terça-feira",
    Wednesday: "quarta-feira", Thursday: "quinta-feira", Friday: "sexta-feira", Saturday: "sábado",
  };
  return map[idx] ?? days[new Date().getDay()];
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function createDailyBriefingRouter() {
  const router = Router();

  router.get("/api/daily-briefing", requireAuth, asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const user = await storage.getUser(userId);
    if (!user) return sendOk(res, { shouldShow: false });

    const today = getTodayDateStr();
    if (user.lastDailyBriefingDate === today) {
      return sendOk(res, { shouldShow: false });
    }

    const lat = req.query.lat ? parseFloat(req.query.lat as string) : null;
    const lon = req.query.lon ? parseFloat(req.query.lon as string) : null;
    const queryCity = typeof req.query.city === "string" && req.query.city.trim()
      ? req.query.city.trim()
      : null;

    let weather = null;
    let resolvedCity = queryCity ?? user.city ?? null;

    if (lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon)) {
      weather = await fetchWeatherForCoords(lat, lon);
    } else if (resolvedCity) {
      weather = await fetchWeatherForCity(resolvedCity);
    }

    const personality = await storage.getPersonality(userId);
    const interests = personality?.interests
      ? (JSON.parse(personality.interests) as string[]).slice(0, 6)
      : [];
    const facts = personality?.traits
      ? (JSON.parse(personality.traits) as string[]).slice(0, 5)
      : [];

    const briefingText = await generateDailyBriefing({
      userName: user.displayName || user.username,
      gender: user.gender,
      city: resolvedCity,
      dateStr: getFormattedDate(),
      dayOfWeek: getDayOfWeek(),
      weather,
      interests,
      streak: user.currentStreak,
      level: user.level,
      facts,
    });

    return sendOk(res, {
      shouldShow: true,
      briefing: {
        text: briefingText,
        weather,
        city: resolvedCity,
        date: getFormattedDate(),
        dayOfWeek: getDayOfWeek(),
      },
    });
  }));

  router.post("/api/daily-briefing/dismiss", requireAuth, asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const today = getTodayDateStr();
    await storage.updateLastDailyBriefingDate(userId, today);
    return sendOk(res, { dismissed: true });
  }));

  router.patch("/api/daily-briefing/city", requireAuth, asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const { city } = req.body as { city?: string };
    if (typeof city !== "string") {
      return sendOk(res, { updated: false });
    }
    await storage.updateUserPreferences(userId, { city: city.trim() || null });
    return sendOk(res, { updated: true });
  }));

  return router;
}
