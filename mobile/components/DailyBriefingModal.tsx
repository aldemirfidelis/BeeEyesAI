import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  visible: boolean;
  briefing: BriefingData;
  userName: string;
  onStart: () => void;
  onDismiss: () => void;
}

function getWeatherEmoji(description: string, precipChance: number): string {
  if (precipChance >= 70 || description.includes("chuva") || description.includes("tempestade")) return "🌧️";
  if (precipChance >= 40 || description.includes("nublado")) return "⛅";
  if (description.includes("garoa")) return "🌦️";
  if (description.includes("neve")) return "❄️";
  return "☀️";
}

function getGreetingEmoji(text: string): string {
  const lower = text.toLowerCase();
  if (lower.startsWith("bom dia")) return "🌅";
  if (lower.startsWith("boa tarde")) return "☀️";
  if (lower.startsWith("boa noite")) return "🌙";
  return "🐝";
}

export default function DailyBriefingModal({
  visible,
  briefing,
  userName,
  onStart,
  onDismiss,
}: DailyBriefingModalProps) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 28,
          stiffness: 320,
          mass: 0.9,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 400, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const greetingEmoji = getGreetingEmoji(briefing.text);
  const dayLabel = briefing.dayOfWeek.charAt(0).toUpperCase() + briefing.dayOfWeek.slice(1);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
      </Animated.View>

      <View style={styles.container} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.card,
            { paddingBottom: insets.bottom + 8, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconBadge}>
                <Text style={styles.iconEmoji}>{greetingEmoji}</Text>
              </View>
              <View>
                <Text style={styles.label}>Resumo do dia</Text>
                <Text style={styles.dateText} numberOfLines={1}>
                  {dayLabel}, {briefing.date}
                </Text>
              </View>
            </View>
            <Pressable onPress={onDismiss} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Weather strip */}
          {briefing.weather && (
            <View style={styles.weatherStrip}>
              <Text style={styles.weatherEmoji}>
                {getWeatherEmoji(briefing.weather.description, briefing.weather.precipitationChance)}
              </Text>
              <View style={styles.weatherInfo}>
                <Text style={styles.weatherTemp}>{briefing.weather.temp}°C</Text>
                <Text style={styles.weatherDesc} numberOfLines={1}>
                  {briefing.weather.description}
                </Text>
              </View>
              <View style={styles.weatherRight}>
                <Text style={styles.weatherRange}>
                  {briefing.weather.tempMin}° – {briefing.weather.tempMax}°
                </Text>
                {briefing.weather.precipitationChance > 20 && (
                  <Text style={styles.precipText}>
                    💧 {briefing.weather.precipitationChance}%
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* AI message bubble */}
          <View style={styles.messageBubble}>
            <View style={styles.beeAvatar}>
              <Text style={styles.beeAvatarText}>🐝</Text>
            </View>
            <ScrollView style={styles.messageScroll} scrollEnabled={briefing.text.length > 200}>
              <Text style={styles.messageText}>{briefing.text}</Text>
            </ScrollView>
          </View>

          {/* Bee badge */}
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>✨ Bee está com você</Text>
            </View>
          </View>

          {/* Buttons */}
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={onStart}
          >
            <Text style={styles.primaryBtnText}>Começar meu dia ✨</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressedSecondary]}
            onPress={onDismiss}
          >
            <Text style={styles.secondaryBtnText}>Fechar</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const HONEY = "#F59E0B";
const HONEY_DARK = "#92400E";
const HONEY_BG = "#FCD34D";

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  container: {
    flex: 1,
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: HONEY_BG,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 16,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconEmoji: { fontSize: 18 },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: HONEY_DARK,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    opacity: 0.7,
  },
  dateText: {
    fontSize: 13,
    fontWeight: "700",
    color: HONEY_DARK,
    textTransform: "capitalize",
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { fontSize: 12, color: HONEY_DARK, fontWeight: "700" },
  weatherStrip: {
    backgroundColor: "rgba(0,0,0,0.12)",
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  weatherEmoji: { fontSize: 28 },
  weatherInfo: { flex: 1 },
  weatherTemp: { fontSize: 18, fontWeight: "800", color: HONEY_DARK },
  weatherDesc: { fontSize: 12, color: HONEY_DARK, opacity: 0.8, marginTop: 1 },
  weatherRight: { alignItems: "flex-end" },
  weatherRange: { fontSize: 12, fontWeight: "600", color: HONEY_DARK },
  precipText: { fontSize: 11, color: "#1D4ED8", fontWeight: "600", marginTop: 2 },
  messageBubble: {
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  beeAvatar: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  beeAvatarText: { fontSize: 14 },
  messageScroll: { flex: 1, maxHeight: 120 },
  messageText: {
    fontSize: 14,
    lineHeight: 21,
    color: HONEY_DARK,
    fontWeight: "500",
  },
  badgeRow: { flexDirection: "row" },
  badge: {
    backgroundColor: "rgba(0,0,0,0.12)",
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 11, color: HONEY_DARK, fontWeight: "600" },
  primaryBtn: {
    backgroundColor: HONEY_DARK,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 2,
  },
  primaryBtnText: {
    color: "#FEF3C7",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    backgroundColor: "rgba(0,0,0,0.1)",
    borderRadius: 18,
    paddingVertical: 11,
    alignItems: "center",
  },
  secondaryBtnText: {
    color: HONEY_DARK,
    fontSize: 14,
    fontWeight: "600",
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  pressedSecondary: { opacity: 0.7 },
});
