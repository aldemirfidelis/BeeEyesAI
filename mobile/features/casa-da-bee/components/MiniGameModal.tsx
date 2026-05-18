import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const GAME_DURATION_MS = 12_000;
const FLOWER_LIFE_MS = 1400;
const SPAWN_INTERVAL_MS = 600;
const POLLEN_PER_HIT = 2;

interface Flower {
  id: number;
  x: number;
  y: number;
  expiresAt: number;
  color: string;
  isGolden: boolean;
}

const COLORS = ["#f4838b", "#9ccaff", "#fbe27a", "#b687d8", "#7fc572"];

interface Props {
  visible: boolean;
  onClose: () => void;
  onFinish: (pollenEarned: number, hits: number, misses: number) => void;
}

export function MiniGameModal({ visible, onClose, onFinish }: Props) {
  const { width, height } = useWindowDimensions();
  const playArea = { width: width - 40, height: height * 0.55 };

  const [flowers, setFlowers] = useState<Flower[]>([]);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [pollen, setPollen] = useState(0);
  const [phase, setPhase] = useState<"intro" | "playing" | "done">("intro");

  const idRef = useRef(0);
  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);

  function startGame() {
    setHits(0);
    setMisses(0);
    setPollen(0);
    setFlowers([]);
    setPhase("playing");

    // Spawn flowers
    const spawnInterval = setInterval(() => {
      const isGolden = Math.random() < 0.12;
      const newFlower: Flower = {
        id: ++idRef.current,
        x: 20 + Math.random() * (playArea.width - 60),
        y: 20 + Math.random() * (playArea.height - 60),
        expiresAt: Date.now() + FLOWER_LIFE_MS,
        color: isGolden ? "#fbe27a" : COLORS[Math.floor(Math.random() * COLORS.length)],
        isGolden,
      };
      setFlowers((prev) => [...prev, newFlower]);
    }, SPAWN_INTERVAL_MS);

    // Limpa flowers expiradas (e conta como miss)
    const cleanInterval = setInterval(() => {
      const now = Date.now();
      setFlowers((prev) => {
        const expired = prev.filter((f) => f.expiresAt < now);
        if (expired.length > 0) setMisses((m) => m + expired.length);
        return prev.filter((f) => f.expiresAt >= now);
      });
    }, 200);

    intervalsRef.current = [spawnInterval, cleanInterval];

    // Fim de jogo
    setTimeout(() => {
      intervalsRef.current.forEach(clearInterval);
      intervalsRef.current = [];
      setFlowers([]);
      setPhase("done");
    }, GAME_DURATION_MS);
  }

  useEffect(() => {
    return () => {
      intervalsRef.current.forEach(clearInterval);
    };
  }, []);

  function handleHit(flower: Flower) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setFlowers((prev) => prev.filter((f) => f.id !== flower.id));
    setHits((h) => h + 1);
    const earn = flower.isGolden ? POLLEN_PER_HIT * 3 : POLLEN_PER_HIT;
    setPollen((p) => p + earn);
  }

  function finishAndClose() {
    onFinish(pollen, hits, misses);
    setPhase("intro");
    onClose();
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {phase === "intro" && (
            <>
              <View style={styles.headerIcon}>
                <Text style={styles.flowerEmoji}>🌼</Text>
              </View>
              <Text style={styles.title}>Caça-Pólen!</Text>
              <Text style={styles.body}>Toque rápido nas flores antes delas sumirem. 12 segundos. Douradas valem 3x.</Text>
              <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]} onPress={startGame}>
                <Feather name="play" size={16} color="#2a2014" />
                <Text style={styles.primaryBtnText}>Começar</Text>
              </Pressable>
              <Pressable onPress={onClose}>
                <Text style={styles.cancelText}>Voltar</Text>
              </Pressable>
            </>
          )}

          {phase === "playing" && (
            <>
              <View style={styles.playArea}>
                {flowers.map((f) => (
                  <FlowerButton key={f.id} flower={f} onPress={() => handleHit(f)} />
                ))}
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Feather name="target" size={14} color="#5b9bd5" />
                  <Text style={styles.statText}>{hits} acertos</Text>
                </View>
                <View style={styles.statBox}>
                  <Feather name="zap" size={14} color="#f5b400" />
                  <Text style={styles.statText}>{pollen} pólen</Text>
                </View>
                <View style={styles.statBox}>
                  <Feather name="x-circle" size={14} color="#ec5c5c" />
                  <Text style={styles.statText}>{misses}</Text>
                </View>
              </View>
            </>
          )}

          {phase === "done" && (
            <>
              <View style={styles.headerIcon}>
                <Text style={styles.flowerEmoji}>🎉</Text>
              </View>
              <Text style={styles.title}>Fim de jogo!</Text>
              <Text style={styles.bigPollen}>+{pollen}</Text>
              <Text style={styles.body}>{hits} acertos · {misses} flores perdidas</Text>
              <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]} onPress={finishAndClose}>
                <Feather name="check" size={16} color="#2a2014" />
                <Text style={styles.primaryBtnText}>Coletar</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function FlowerButton({ flower, onPress }: { flower: Flower; onPress: () => void }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.back(1.6)) });
    opacity.value = withTiming(1, { duration: 220 });
    const lifeLeft = flower.expiresAt - Date.now();
    if (lifeLeft > 300) {
      setTimeout(() => {
        opacity.value = withTiming(0, { duration: 300 });
        scale.value = withTiming(0.6, { duration: 300 });
      }, lifeLeft - 300);
    }
  }, [flower.expiresAt, opacity, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.flowerWrap, { left: flower.x, top: flower.y }, style]}>
      <Pressable onPress={onPress} style={[styles.flowerBtn, { backgroundColor: flower.color }]}>
        {flower.isGolden ? (
          <Feather name="star" size={26} color="#7a5230" />
        ) : (
          <View style={styles.flowerInner} />
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(8, 6, 2, 0.78)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff8d6",
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "rgba(87, 61, 28, 0.75)",
    padding: 20,
    alignItems: "center",
    gap: 10,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ffd95b",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(78, 52, 24, 0.72)",
  },
  flowerEmoji: { fontSize: 30 },
  title: { color: "#2c2114", fontSize: 22, fontWeight: "900", textAlign: "center" },
  body: { color: "#5e4520", fontSize: 13, fontWeight: "700", textAlign: "center", lineHeight: 18 },
  bigPollen: { color: "#f5b400", fontSize: 38, fontWeight: "900" },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#ffd95b",
    borderWidth: 2,
    borderColor: "rgba(78, 52, 24, 0.72)",
    marginTop: 4,
  },
  primaryBtnText: { color: "#2a2014", fontSize: 14, fontWeight: "900" },
  cancelText: { color: "#7a4f18", fontSize: 12, fontWeight: "800", marginTop: 4, textDecorationLine: "underline" },
  pressed: { transform: [{ translateY: 2 }] },
  playArea: {
    width: "100%",
    aspectRatio: 0.85,
    backgroundColor: "rgba(91, 124, 56, 0.18)",
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
  },
  flowerWrap: { position: "absolute" },
  flowerBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(78, 52, 24, 0.45)",
  },
  flowerInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#ffe27a",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    paddingTop: 8,
  },
  statBox: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { color: "#2a2014", fontSize: 12, fontWeight: "900" },
});
