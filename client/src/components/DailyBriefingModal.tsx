import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Thermometer, Droplets, Wind, Sparkles, Star, Zap } from "lucide-react";

interface WeatherData {
  temp: number;
  tempMin: number;
  tempMax: number;
  description: string;
  precipitationChance: number;
}

interface BriefingData {
  text: string;
  weather: WeatherData | null;
  city: string | null;
  date: string;
  dayOfWeek: string;
}

interface DailyBriefingModalProps {
  briefing: BriefingData;
  userName: string;
  onStart: () => void;
  onDismiss: () => void;
}

function HoneycombPattern() {
  return (
    <svg
      className="absolute inset-0 w-full h-full opacity-[0.06] pointer-events-none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="honeycomb" x="0" y="0" width="56" height="48" patternUnits="userSpaceOnUse">
          <polygon
            points="28,2 54,14 54,34 28,46 2,34 2,14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#honeycomb)" />
    </svg>
  );
}

function WeatherIcon({ code, precipChance }: { code: string; precipChance: number }) {
  if (precipChance >= 70 || code.includes("chuva") || code.includes("pancada") || code.includes("tempestade")) {
    return <span className="text-3xl">🌧️</span>;
  }
  if (precipChance >= 40 || code.includes("nublado") || code.includes("névoa")) {
    return <span className="text-3xl">⛅</span>;
  }
  if (code.includes("garoa")) return <span className="text-3xl">🌦️</span>;
  if (code.includes("neve")) return <span className="text-3xl">❄️</span>;
  return <span className="text-3xl">☀️</span>;
}

function getGreetingEmoji(text: string): string {
  const lower = text.toLowerCase();
  if (lower.startsWith("bom dia")) return "🌅";
  if (lower.startsWith("boa tarde")) return "☀️";
  if (lower.startsWith("boa noite")) return "🌙";
  return "🐝";
}

export default function DailyBriefingModal({
  briefing,
  userName,
  onStart,
  onDismiss,
}: DailyBriefingModalProps) {
  const [visible, setVisible] = useState(true);
  const [cityInput, setCityInput] = useState(briefing.city ?? "");
  const [showCityInput, setShowCityInput] = useState(!briefing.city && !briefing.weather);

  const greetingEmoji = getGreetingEmoji(briefing.text);

  function handleStart() {
    setVisible(false);
    setTimeout(onStart, 350);
  }

  function handleDismiss() {
    setVisible(false);
    setTimeout(onDismiss, 350);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleDismiss}
          />

          {/* Card */}
          <motion.div
            className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
            initial={{ y: "100%", opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: "100%", opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 28, stiffness: 320, mass: 0.9 }}
          >
            {/* Gradient background */}
            <div className="absolute inset-0 bg-gradient-to-b from-amber-400 via-amber-500 to-yellow-600" />
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-amber-300/30" />
            <HoneycombPattern />

            <div className="relative z-10">
              {/* Header */}
              <div className="flex items-start justify-between p-5 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-2xl bg-black/20 backdrop-blur-sm flex items-center justify-center">
                    <span className="text-lg">{greetingEmoji}</span>
                  </div>
                  <div>
                    <p className="text-amber-900/70 text-xs font-semibold uppercase tracking-wider">
                      Resumo do dia
                    </p>
                    <p className="text-amber-950 font-bold text-sm leading-tight capitalize">
                      {briefing.dayOfWeek}, {briefing.date}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleDismiss}
                  className="w-8 h-8 rounded-full bg-black/15 hover:bg-black/25 transition-colors flex items-center justify-center"
                >
                  <X size={14} className="text-amber-950" />
                </button>
              </div>

              {/* Weather strip */}
              {briefing.weather && (
                <motion.div
                  className="mx-4 mb-3 rounded-2xl bg-black/15 backdrop-blur-sm p-3 flex items-center gap-3"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.18 }}
                >
                  <WeatherIcon
                    code={briefing.weather.description}
                    precipChance={briefing.weather.precipitationChance}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-amber-950 font-bold text-base leading-none">
                      {briefing.weather.temp}°C
                    </p>
                    <p className="text-amber-900/80 text-xs mt-0.5 truncate">
                      {briefing.weather.description}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-amber-950/90 text-xs font-semibold">
                      {briefing.weather.tempMin}° – {briefing.weather.tempMax}°
                    </p>
                    {briefing.weather.precipitationChance > 20 && (
                      <div className="flex items-center justify-end gap-1 mt-0.5">
                        <Droplets size={10} className="text-blue-700" />
                        <p className="text-blue-800 text-xs font-medium">
                          {briefing.weather.precipitationChance}%
                        </p>
                      </div>
                    )}
                  </div>
                  {briefing.city && (
                    <div className="flex items-center gap-1 ml-1">
                      <MapPin size={10} className="text-amber-800/70 shrink-0" />
                      <span className="text-amber-900/70 text-xs truncate max-w-[70px]">
                        {briefing.city}
                      </span>
                    </div>
                  )}
                </motion.div>
              )}

              {/* AI message */}
              <motion.div
                className="mx-4 mb-4"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <div className="rounded-2xl bg-white/25 backdrop-blur-sm p-4 border border-white/30">
                  <div className="flex gap-2 items-start">
                    <div className="w-7 h-7 rounded-xl bg-black/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-sm">🐝</span>
                    </div>
                    <p className="text-amber-950 text-sm leading-relaxed font-medium flex-1">
                      {briefing.text}
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* City input (when no city/weather) */}
              {showCityInput && (
                <motion.div
                  className="mx-4 mb-3"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                >
                  <div className="rounded-xl bg-black/15 p-3 flex gap-2 items-center">
                    <MapPin size={14} className="text-amber-900 shrink-0" />
                    <input
                      type="text"
                      placeholder="Sua cidade para previsão do tempo..."
                      value={cityInput}
                      onChange={(e) => setCityInput(e.target.value)}
                      className="flex-1 bg-transparent text-amber-950 placeholder-amber-900/50 text-sm outline-none"
                    />
                  </div>
                </motion.div>
              )}

              {/* Stats chips */}
              <motion.div
                className="mx-4 mb-4 flex gap-2 flex-wrap"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
              >
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/15 backdrop-blur-sm">
                  <Sparkles size={11} className="text-amber-900" />
                  <span className="text-amber-950 text-xs font-semibold">Bee está com você</span>
                </div>
              </motion.div>

              {/* Action buttons */}
              <motion.div
                className="p-4 pt-0 flex flex-col gap-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <button
                  onClick={handleStart}
                  className="w-full py-3.5 rounded-2xl bg-amber-950 text-amber-100 font-bold text-sm tracking-wide hover:bg-black transition-colors active:scale-[0.98] transition-transform shadow-lg"
                >
                  Começar meu dia ✨
                </button>
                <button
                  onClick={handleDismiss}
                  className="w-full py-2.5 rounded-2xl bg-black/10 text-amber-950 font-medium text-sm hover:bg-black/20 transition-colors active:scale-[0.98] transition-transform"
                >
                  Fechar
                </button>
              </motion.div>

              {/* Safe area for mobile */}
              <div className="h-safe-area-inset-bottom sm:h-0" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
