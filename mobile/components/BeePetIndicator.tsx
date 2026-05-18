import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useBeePetStore } from "@mobile/stores/beePetStore";
import { findItem } from "@mobile/features/casa-da-bee/engine/catalog";
import { BeePreview } from "@mobile/features/casa-da-bee/components/BeePreview";

const SIZE = 56;

function colorForState(state: string): string {
  switch (state) {
    case "working":
      return "#5b9bd5";
    case "walking":
      return "#9ccaff";
    case "happy":
    case "celebrating":
      return "#ec5c5c";
    case "sleeping":
      return "#7d6a1f";
    case "thinking":
      return "#b94a8a";
    default:
      return "#f5b400";
  }
}

export function BeePetIndicator() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const state = useBeePetStore((s) => s.state);
  const target = useBeePetStore((s) => s.target);
  const speech = useBeePetStore((s) => s.speech);
  const pendingPollen = useBeePetStore((s) => s.pendingPollen);
  const isWorking = useBeePetStore((s) => s.isWorking);
  const equippedHatId = useBeePetStore((s) => s.equippedHatId);
  const equippedAccessoryId = useBeePetStore((s) => s.equippedAccessoryId);
  const equippedBodyId = useBeePetStore((s) => s.equippedBodyId);

  const bob = useSharedValue(0);
  const pulse = useSharedValue(0);
  const ring = useSharedValue(0);

  useEffect(() => {
    bob.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
    pulse.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, [bob, pulse]);

  useEffect(() => {
    // Anim de "ring" quando começa a trabalhar
    if (isWorking) {
      ring.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) }), -1, false);
    } else {
      ring.value = 0;
    }
  }, [isWorking, ring]);

  // Esconder na propria tela da casa
  const hideOnCasa = pathname?.includes("casa-da-bee");

  const beeStyle = useAnimatedStyle(() => {
    const amp = isWorking ? 6 : 3;
    return {
      transform: [{ translateY: Math.sin(bob.value * Math.PI * 2) * amp }],
    };
  });

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.3 - pulse.value * 0.3,
    transform: [{ scale: 1 + pulse.value * 0.5 }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 1 - ring.value,
    transform: [{ scale: 1 + ring.value * 0.8 }],
  }));

  const speechStyle = useAnimatedStyle(() => {
    const visible = !!speech ? 1 : 0;
    return {
      opacity: withTiming(visible, { duration: 220 }),
      transform: [{ scale: withTiming(visible ? 1 : 0.85, { duration: 220 }) }],
    };
  });

  if (hideOnCasa) return null;

  const ringColor = colorForState(state);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push("/casa-da-bee");
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { bottom: insets.bottom + 88, right: 16 }]}
    >
      {speech && (
        <Animated.View style={[styles.bubble, speechStyle]}>
          <Text style={styles.bubbleText}>{speech}</Text>
          <View style={styles.bubbleTail} />
        </Animated.View>
      )}

      <Pressable onPress={handlePress} style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}>
        {/* Anel de pulso de fundo (trabalhando) */}
        {isWorking && (
          <Animated.View style={[styles.ring, { borderColor: ringColor }, ringStyle]} />
        )}
        {/* Pulso suave */}
        <Animated.View style={[styles.pulse, { backgroundColor: ringColor }, pulseStyle]} />

        {/* Bee mini-sprite com outfit equipado */}
        <View style={[styles.beeContainer, { borderColor: ringColor }]}>
          <Animated.View style={beeStyle}>
            <BeePreview
              size={SIZE - 6}
              hat={findItem(equippedHatId)}
              accessory={findItem(equippedAccessoryId)}
              body={findItem(equippedBodyId)}
            />
          </Animated.View>
        </View>

        {/* Badge de polens pendentes */}
        {pendingPollen > 0 && (
          <View style={styles.badge}>
            <Feather name="zap" size={9} color="#2a2014" />
            <Text style={styles.badgeText}>{pendingPollen > 99 ? "99+" : pendingPollen}</Text>
          </View>
        )}

        {/* Mini-icone do target da task */}
        {target && (
          <View style={styles.targetIcon}>
            <Feather name={iconForTarget(target)} size={10} color="#fff4c2" />
          </View>
        )}
      </Pressable>
    </View>
  );
}

function iconForTarget(target: string): keyof typeof Feather.glyphMap {
  if (target === "search") return "search";
  if (target === "train") return "activity";
  if (target === "calendar") return "calendar";
  if (target === "study") return "book-open";
  if (target === "sleep") return "moon";
  return "zap";
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    alignItems: "flex-end",
    gap: 6,
    zIndex: 30,
  },
  fab: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  fabPressed: { opacity: 0.85, transform: [{ scale: 0.94 }] },
  beeContainer: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: "rgba(255, 248, 214, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    shadowColor: "#231809",
    shadowOpacity: 0.32,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  beeEmoji: { fontSize: 26 },
  ring: {
    position: "absolute",
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 3,
  },
  pulse: {
    position: "absolute",
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minWidth: 22,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: "#ffd95b",
    borderWidth: 1.5,
    borderColor: "rgba(78, 52, 24, 0.8)",
    justifyContent: "center",
  },
  badgeText: {
    color: "#2a2014",
    fontSize: 10,
    fontWeight: "900",
  },
  targetIcon: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(46, 35, 18, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255, 248, 214, 0.95)",
  },
  bubble: {
    maxWidth: 220,
    backgroundColor: "rgba(255, 248, 214, 0.96)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "rgba(87, 61, 28, 0.75)",
    shadowColor: "#231809",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  bubbleText: {
    color: "#2c2114",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16,
  },
  bubbleTail: {
    position: "absolute",
    bottom: -8,
    right: 24,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "rgba(87, 61, 28, 0.75)",
  },
});
