import { useCallback, useEffect, useRef } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useBeePetStore } from "@mobile/stores/beePetStore";
import { BeeHouseHandle } from "./BeeHouseHandle";
import CasaDaBeeNativeScreen from "@mobile/features/casa-da-bee/CasaDaBeeNativeScreen";

const HANDLE_SIZE = 56;
const HANDLE_OFFSET_RIGHT = 8;
const DRAG_THRESHOLD_RATIO = 0.4; // arrastar 40% da tela = abre

/**
 * Drawer da Casa da Bee — gaveta deslizante que entra da direita
 * sobrepondo a tela atual (ex: chat). Funciona em mobile e web.
 *
 * Como abre:
 *   - Toque no botão handle (casinha bonita no canto direito)
 *   - Arrasta o handle pra esquerda
 *
 * Como fecha:
 *   - Toque no chevron-right no header da casa
 *   - Arrasta da borda esquerda da casa pra direita
 */
interface Props {
  /** Conteudo da tela "de tras" (ex: chat). Renderizado abaixo da gaveta. */
  children: React.ReactNode;
  /** Posicao vertical do botao handle (default: meio da tela) */
  handleTopRatio?: number;
}

export function BeeHouseDrawer({ children, handleTopRatio = 0.42 }: Props) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pendingPollen = useBeePetStore((s) => s.pendingPollen);
  const hasNotification = pendingPollen > 0;

  // translateX: posição da gaveta (-screenWidth = escondida, 0 = aberta)
  const translateX = useSharedValue(-screenWidth);
  // Estado lógico (pra atualizar children quando aberto/fechado)
  const isOpenRef = useRef(false);

  // Mantém shared value sincronizado com mudança de tela
  useEffect(() => {
    if (!isOpenRef.current) {
      translateX.value = -screenWidth;
    }
  }, [screenWidth, translateX]);

  const open = useCallback(() => {
    isOpenRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    translateX.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
  }, [translateX]);

  const close = useCallback(() => {
    isOpenRef.current = false;
    Haptics.selectionAsync().catch(() => {});
    translateX.value = withTiming(-screenWidth, { duration: 280, easing: Easing.out(Easing.cubic) });
  }, [translateX, screenWidth]);

  // ============================================================
  // Pan no HANDLE (fechado → arrasta pra esquerda → abre)
  // ============================================================
  const handlePan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((e) => {
      "worklet";
      // Drag pra esquerda diminui translateX (de -screenWidth pra 0)
      const next = Math.min(0, -screenWidth + Math.max(0, -e.translationX));
      translateX.value = next;
    })
    .onEnd((e) => {
      "worklet";
      const dragDistance = -e.translationX;
      const threshold = screenWidth * DRAG_THRESHOLD_RATIO;
      if (dragDistance > threshold || e.velocityX < -700) {
        runOnJS(open)();
      } else {
        translateX.value = withTiming(-screenWidth, { duration: 200 });
      }
    });

  const handleTap = Gesture.Tap().onEnd(() => {
    "worklet";
    runOnJS(open)();
  });

  const handleGesture = Gesture.Exclusive(handlePan, handleTap);

  // ============================================================
  // Pan na BORDA ESQUERDA do drawer aberto (arrasta pra direita → fecha)
  // ============================================================
  const closePan = Gesture.Pan()
    .activeOffsetX([10, -10])
    .onUpdate((e) => {
      "worklet";
      const next = Math.min(0, Math.max(-screenWidth, e.translationX));
      translateX.value = next;
    })
    .onEnd((e) => {
      "worklet";
      const threshold = screenWidth * DRAG_THRESHOLD_RATIO;
      if (e.translationX > threshold || e.velocityX > 700) {
        runOnJS(close)();
      } else {
        translateX.value = withTiming(0, { duration: 200 });
      }
    });

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => {
    const progress = (translateX.value + screenWidth) / screenWidth;
    return {
      opacity: progress * 0.4,
      pointerEvents: progress > 0.05 ? "auto" : "none",
    };
  });

  const handleStyle = useAnimatedStyle(() => {
    const progress = (translateX.value + screenWidth) / screenWidth;
    // some quando drawer abre
    return {
      opacity: 1 - progress,
      transform: [{ translateX: progress * 60 }],
    };
  });

  return (
    <View style={styles.root}>
      {/* Conteudo de tras (chat) */}
      <View style={styles.background}>{children}</View>

      {/* Backdrop escurecido quando aberto */}
      <Animated.View pointerEvents="auto" style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      {/* Handle direita - botao casinha com Bee */}
      <Animated.View
        style={[
          styles.handleWrap,
          {
            top: screenHeight * handleTopRatio,
            right: HANDLE_OFFSET_RIGHT,
            paddingTop: insets.top,
          },
          handleStyle,
        ]}
        pointerEvents="box-none"
      >
        <GestureDetector gesture={handleGesture}>
          <View style={styles.handleButton}>
            <BeeHouseHandle size={HANDLE_SIZE - 4} pulse={hasNotification} />
            {hasNotification && (
              <View style={styles.handleBadge}>
                <View style={styles.handleBadgeDot} />
              </View>
            )}
          </View>
        </GestureDetector>
      </Animated.View>

      {/* Drawer (Casa da Bee) sobreposto */}
      <GestureDetector gesture={closePan}>
        <Animated.View style={[styles.drawer, { width: screenWidth }, drawerStyle]}>
          <CasaDaBeeNativeScreen onClose={close} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    zIndex: 5,
  },
  handleWrap: {
    position: "absolute",
    zIndex: 10,
    alignItems: "flex-end",
  },
  handleButton: {
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: HANDLE_SIZE / 2,
    backgroundColor: "rgba(255, 248, 214, 0.96)",
    borderWidth: 2,
    borderColor: "rgba(87, 61, 28, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#231809",
    shadowOpacity: 0.32,
    shadowRadius: 12,
    shadowOffset: { width: -2, height: 4 },
    elevation: 6,
  },
  handleBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#ec5c5c",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff8d6",
  },
  handleBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#fff8d6",
  },
  drawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    backgroundColor: "#160f04",
    zIndex: 20,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: -8, height: 0 },
    elevation: 16,
  },
});
