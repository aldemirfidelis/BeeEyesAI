import { Group, Circle, Rect, RoundedRect, Path, Skia } from "@shopify/react-native-skia";
import { useDerivedValue, useSharedValue, withRepeat, withTiming, type SharedValue } from "react-native-reanimated";
import { useEffect, useMemo } from "react";
import type { BeeState } from "../engine/types";
import type { CatalogItem } from "../engine/catalog";

interface Props {
  pixelX: SharedValue<number>;
  pixelY: SharedValue<number>;
  facing: SharedValue<number>;
  tileSize: number;
  state: BeeState;
  hat?: CatalogItem | null;
  accessory?: CatalogItem | null;
  body?: CatalogItem | null;
}

export function BeeSprite({ pixelX, pixelY, facing, tileSize, state, hat, accessory, body }: Props) {
  const bodyR = tileSize * 0.34;
  const bodyColor = (body?.data.color as string | undefined) ?? "#fbcb45";
  const bodyHighlight = (body?.data.highlight as string | undefined) ?? "#fff4c2";
  const isRainbow = body?.data.rainbow === true;
  const idlePhase = useSharedValue(0);
  const wingPhase = useSharedValue(0);
  const walkPhase = useSharedValue(0);
  const dancePhase = useSharedValue(0);

  useEffect(() => {
    if (state === "celebrating" || state === "happy") {
      dancePhase.value = withRepeat(withTiming(1, { duration: 700 }), -1, false);
    } else {
      dancePhase.value = 0;
    }
  }, [state, dancePhase]);

  useEffect(() => {
    idlePhase.value = withRepeat(withTiming(1, { duration: 1400 }), -1, true);
    wingPhase.value = withRepeat(withTiming(1, { duration: state === "walking" ? 110 : 240 }), -1, true);
    walkPhase.value = withRepeat(withTiming(1, { duration: 280 }), -1, true);
  }, [idlePhase, state, walkPhase, wingPhase]);

  // Bobbing vertical: idle calmo, walk mais intenso, dance = jump alto
  const isDancing = state === "celebrating" || state === "happy";
  const bobAmp = isDancing ? tileSize * 0.16 : state === "walking" ? tileSize * 0.07 : tileSize * 0.035;
  const bobY = useDerivedValue(() => {
    if (isDancing) {
      // Pulinhos altos em ritmo
      return -Math.abs(Math.sin(dancePhase.value * Math.PI * 2)) * bobAmp;
    }
    return Math.sin(idlePhase.value * Math.PI * 2) * bobAmp;
  });

  // Wobble horizontal quando anda + lateral sway na dança
  const wobbleAmp = state === "walking" ? tileSize * 0.04 : isDancing ? tileSize * 0.06 : 0;
  const wobbleX = useDerivedValue(() => {
    if (isDancing) {
      return Math.sin(dancePhase.value * Math.PI * 4) * wobbleAmp;
    }
    return Math.sin(walkPhase.value * Math.PI * 2) * wobbleAmp;
  });

  const cx = useDerivedValue(() => pixelX.value + wobbleX.value);
  const cy = useDerivedValue(() => pixelY.value + bobY.value);

  // Sombra acompanha o bobbing: encolhe quando sobe
  const shadowScale = useDerivedValue(() => 1 - Math.abs(bobY.value) / (bodyR * 1.2));
  const shadowR = useDerivedValue(() => bodyR * 0.72 * shadowScale.value);
  const shadowY = useDerivedValue(() => pixelY.value + bodyR * 0.78);
  const shadowOpacity = useDerivedValue(() => 0.36 * (0.7 + shadowScale.value * 0.3));

  // Asas: pulsa de raio e opacidade
  const wingR = useDerivedValue(() => bodyR * 0.62 * (0.7 + Math.abs(Math.sin(wingPhase.value * Math.PI * 2)) * 0.6));
  const wingAlpha = useDerivedValue(() => 0.55 + Math.abs(Math.sin(wingPhase.value * Math.PI * 2)) * 0.25);
  const wingTopY = useDerivedValue(() => cy.value - bodyR * 0.65);
  const wingLeftX = useDerivedValue(() => cx.value - bodyR * 0.95);
  const wingRightX = useDerivedValue(() => cx.value + bodyR * 0.95);

  // Antenas: dois bolinhas com haste
  const antLY = useDerivedValue(() => cy.value - bodyR * 1.15 + Math.sin(idlePhase.value * Math.PI * 3) * 1.5);
  const antRY = useDerivedValue(() => cy.value - bodyR * 1.15 + Math.sin(idlePhase.value * Math.PI * 3 + 1) * 1.5);
  const antLX = useDerivedValue(() => cx.value - bodyR * 0.35);
  const antRX = useDerivedValue(() => cx.value + bodyR * 0.35);

  const antLBaseY = useDerivedValue(() => cy.value - bodyR * 0.85);
  const antRBaseY = useDerivedValue(() => cy.value - bodyR * 0.85);

  const stripeX = useDerivedValue(() => cx.value - bodyR * 0.78);
  const stripeW = bodyR * 1.56;
  const stripeH = bodyR * 0.18;
  const stripe1Y = useDerivedValue(() => cy.value - bodyR * 0.25);
  const stripe2Y = useDerivedValue(() => cy.value + bodyR * 0.05);
  const stripe3Y = useDerivedValue(() => cy.value + bodyR * 0.35);

  // Olhos
  const eyeOpenAlpha = state === "sleeping" ? 0 : 1;
  const eyeClosedAlpha = state === "sleeping" ? 1 : 0;
  const eyeLX = useDerivedValue(() => cx.value - bodyR * 0.32);
  const eyeRX = useDerivedValue(() => cx.value + bodyR * 0.32);
  const eyeY = useDerivedValue(() => cy.value - bodyR * 0.35);
  const eyeBrilhoLX = useDerivedValue(() => cx.value - bodyR * 0.28);
  const eyeBrilhoRX = useDerivedValue(() => cx.value + bodyR * 0.36);
  const eyeBrilhoY = useDerivedValue(() => cy.value - bodyR * 0.4);

  // Bochechas rosadas
  const cheekY = useDerivedValue(() => cy.value - bodyR * 0.05);
  const cheekLX = useDerivedValue(() => cx.value - bodyR * 0.45);
  const cheekRX = useDerivedValue(() => cx.value + bodyR * 0.45);

  // Boquinha
  const mouthY = useDerivedValue(() => cy.value + bodyR * 0.18);

  // Ferrao
  const stingerX = useDerivedValue(() => cx.value);
  const stingerY = useDerivedValue(() => cy.value + bodyR * 0.95);

  // Z (zzz) quando sleeping
  const zAlpha = state === "sleeping" ? 0.9 : 0;
  const zY = useDerivedValue(() => cy.value - bodyR * 1.3 + Math.sin(idlePhase.value * Math.PI * 2) * 3);
  const zX = useDerivedValue(() => cx.value + bodyR * 0.7);

  return (
    <Group>
      {/* Sombra no chao (escala com bobbing) */}
      <Group opacity={shadowOpacity}>
        <Circle cx={cx} cy={shadowY} r={shadowR} color="#1a0e02" />
      </Group>

      {/* Antenas (haste + bolinha) */}
      <Group>
        <Circle cx={antLBaseY ? antLX : antLX} cy={antLBaseY} r={bodyR * 0.05} color="#22150b" />
        <Circle cx={antRX} cy={antRBaseY} r={bodyR * 0.05} color="#22150b" />
        <Circle cx={antLX} cy={antLY} r={bodyR * 0.08} color="#22150b" />
        <Circle cx={antRX} cy={antRY} r={bodyR * 0.08} color="#22150b" />
      </Group>

      {/* Asas (atras do corpo, com transparencia animada) */}
      <Group opacity={wingAlpha}>
        <Circle cx={wingLeftX} cy={wingTopY} r={wingR} color="#e8f4ff" />
        <Circle cx={wingRightX} cy={wingTopY} r={wingR} color="#e8f4ff" />
      </Group>

      {/* Ferrao (atras do corpo, ponta inferior) */}
      <Circle cx={stingerX} cy={stingerY} r={bodyR * 0.12} color="#22150b" />

      {/* Corpo principal — rainbow ou cor unica */}
      {isRainbow ? (
        <Group>
          <Circle cx={cx} cy={cy} r={bodyR} color="#fb6f8c" />
          <Circle cx={cx} cy={cy} r={bodyR * 0.85} color="#fbcb45" />
          <Circle cx={cx} cy={cy} r={bodyR * 0.7} color="#7fc572" />
          <Circle cx={cx} cy={cy} r={bodyR * 0.55} color="#5b9bd5" />
          <Circle cx={cx} cy={cy} r={bodyR * 0.4} color="#b687d8" />
        </Group>
      ) : (
        <Circle cx={cx} cy={cy} r={bodyR} color={bodyColor} />
      )}

      {/* Highlight (brilho no canto superior esquerdo) */}
      <Group opacity={0.4}>
        <Circle cx={useDerivedValue(() => cx.value - bodyR * 0.35)} cy={useDerivedValue(() => cy.value - bodyR * 0.4)} r={bodyR * 0.22} color={bodyHighlight} />
      </Group>

      {/* Listras — escondidas no rainbow */}
      {!isRainbow && (
        <>
          <Rect x={stripeX} y={stripe1Y} width={stripeW} height={stripeH} color="#2a1a08" />
          <Rect x={stripeX} y={stripe2Y} width={stripeW} height={stripeH} color="#2a1a08" />
          <Rect x={stripeX} y={stripe3Y} width={stripeW} height={stripeH} color="#2a1a08" />
        </>
      )}

      {/* Bochechas rosadas */}
      <Group opacity={state === "happy" || state === "celebrating" ? 0.85 : 0.5}>
        <Circle cx={cheekLX} cy={cheekY} r={bodyR * 0.16} color="#f4838b" />
        <Circle cx={cheekRX} cy={cheekY} r={bodyR * 0.16} color="#f4838b" />
      </Group>

      {/* Olhos abertos — ocultos quando accessory cobre */}
      <Group opacity={accessoryCoversEyes(accessory) ? 0 : eyeOpenAlpha}>
        <Circle cx={eyeLX} cy={eyeY} r={bodyR * 0.12} color="#22150b" />
        <Circle cx={eyeRX} cy={eyeY} r={bodyR * 0.12} color="#22150b" />
        <Circle cx={eyeBrilhoLX} cy={eyeBrilhoY} r={bodyR * 0.05} color="#ffffff" />
        <Circle cx={eyeBrilhoRX} cy={eyeBrilhoY} r={bodyR * 0.05} color="#ffffff" />
      </Group>

      {/* Olhos fechados (sleeping) - tracinhos */}
      <Group opacity={eyeClosedAlpha}>
        <Rect x={useDerivedValue(() => eyeLX.value - bodyR * 0.12)} y={eyeY} width={bodyR * 0.24} height={bodyR * 0.04} color="#22150b" />
        <Rect x={useDerivedValue(() => eyeRX.value - bodyR * 0.12)} y={eyeY} width={bodyR * 0.24} height={bodyR * 0.04} color="#22150b" />
      </Group>

      {/* Boquinha */}
      <Group opacity={state === "happy" || state === "celebrating" ? 1 : 0.7}>
        <RoundedRect
          x={useDerivedValue(() => cx.value - bodyR * 0.16)}
          y={mouthY}
          width={bodyR * 0.32}
          height={bodyR * 0.14}
          r={bodyR * 0.08}
          color="#22150b"
        />
      </Group>

      {/* Zzz quando sleeping */}
      <Group opacity={zAlpha}>
        <Circle cx={zX} cy={zY} r={bodyR * 0.18} color="#dde4ee" />
      </Group>

      {/* Accessory (oculos, mascara, lacinho) — usa derived pra acompanhar a Bee */}
      <AccessoryLayer accessory={accessory} cx={cx} cy={cy} bodyR={bodyR} />

      {/* Hat por cima de tudo */}
      <HatLayer hat={hat} cx={cx} cy={cy} bodyR={bodyR} />
    </Group>
  );
}

function accessoryCoversEyes(acc?: CatalogItem | null): boolean {
  if (!acc) return false;
  const v = acc.data.variant as string | undefined;
  return v === "sunglasses" || v === "reading" || v === "mask";
}

function AccessoryLayer({
  accessory,
  cx,
  cy,
  bodyR,
}: {
  accessory: CatalogItem | null | undefined;
  cx: SharedValue<number>;
  cy: SharedValue<number>;
  bodyR: number;
}) {
  if (!accessory) return null;
  const v = accessory.data.variant as string | undefined;
  if (!v || v === "none") return null;
  const color = (accessory.data.color as string | undefined) ?? "#2a1a08";

  if (v === "sunglasses" || v === "reading") {
    return (
      <Group>
        <RoundedRect
          x={useDerivedValue(() => cx.value - bodyR * 0.6)}
          y={useDerivedValue(() => cy.value - bodyR * 0.45)}
          width={bodyR * 0.4}
          height={bodyR * 0.3}
          r={bodyR * 0.12}
          color={color}
        />
        <RoundedRect
          x={useDerivedValue(() => cx.value + bodyR * 0.2)}
          y={useDerivedValue(() => cy.value - bodyR * 0.45)}
          width={bodyR * 0.4}
          height={bodyR * 0.3}
          r={bodyR * 0.12}
          color={color}
        />
        <Rect
          x={useDerivedValue(() => cx.value - bodyR * 0.2)}
          y={useDerivedValue(() => cy.value - bodyR * 0.35)}
          width={bodyR * 0.4}
          height={bodyR * 0.04}
          color={color}
        />
      </Group>
    );
  }

  if (v === "bow") {
    return (
      <Group>
        <Circle cx={useDerivedValue(() => cx.value - bodyR * 0.65)} cy={useDerivedValue(() => cy.value - bodyR * 0.75)} r={bodyR * 0.16} color={color} />
        <Circle cx={useDerivedValue(() => cx.value - bodyR * 0.85)} cy={useDerivedValue(() => cy.value - bodyR * 0.75)} r={bodyR * 0.12} color={color} />
      </Group>
    );
  }

  if (v === "headphone") {
    return (
      <Group>
        <Circle cx={useDerivedValue(() => cx.value - bodyR * 0.95)} cy={useDerivedValue(() => cy.value - bodyR * 0.3)} r={bodyR * 0.22} color={color} />
        <Circle cx={useDerivedValue(() => cx.value + bodyR * 0.95)} cy={useDerivedValue(() => cy.value - bodyR * 0.3)} r={bodyR * 0.22} color={color} />
      </Group>
    );
  }

  if (v === "monocle") {
    return (
      <Group>
        <Circle cx={useDerivedValue(() => cx.value + bodyR * 0.32)} cy={useDerivedValue(() => cy.value - bodyR * 0.35)} r={bodyR * 0.2} color="rgba(220, 200, 100, 0.5)" />
        <Circle
          cx={useDerivedValue(() => cx.value + bodyR * 0.32)}
          cy={useDerivedValue(() => cy.value - bodyR * 0.35)}
          r={bodyR * 0.2}
          color={color}
          style="stroke"
          strokeWidth={bodyR * 0.05}
        />
      </Group>
    );
  }

  if (v === "mask") {
    const accent = (accessory.data.accent as string | undefined) ?? color;
    return (
      <Group>
        <RoundedRect
          x={useDerivedValue(() => cx.value - bodyR * 0.7)}
          y={useDerivedValue(() => cy.value - bodyR * 0.5)}
          width={bodyR * 1.4}
          height={bodyR * 0.4}
          r={bodyR * 0.15}
          color={color}
        />
        <Circle cx={useDerivedValue(() => cx.value - bodyR * 0.32)} cy={useDerivedValue(() => cy.value - bodyR * 0.32)} r={bodyR * 0.12} color={accent} />
        <Circle cx={useDerivedValue(() => cx.value + bodyR * 0.32)} cy={useDerivedValue(() => cy.value - bodyR * 0.32)} r={bodyR * 0.12} color={accent} />
      </Group>
    );
  }

  return null;
}

function HatLayer({
  hat,
  cx,
  cy,
  bodyR,
}: {
  hat: CatalogItem | null | undefined;
  cx: SharedValue<number>;
  cy: SharedValue<number>;
  bodyR: number;
}) {
  const crownPath = useMemo(() => {
    // path estatico pre-calculado relativo a 0,0 - posicionado via Group transform
    const p = Skia.Path.Make();
    p.moveTo(-bodyR * 0.65, -bodyR * 1.45);
    p.lineTo(-bodyR * 0.4, -bodyR * 1.85);
    p.lineTo(-bodyR * 0.15, -bodyR * 1.5);
    p.lineTo(0, -bodyR * 1.95);
    p.lineTo(bodyR * 0.15, -bodyR * 1.5);
    p.lineTo(bodyR * 0.4, -bodyR * 1.85);
    p.lineTo(bodyR * 0.65, -bodyR * 1.45);
    p.close();
    return p;
  }, [bodyR]);

  if (!hat) return null;
  const v = hat.data.variant as string | undefined;
  if (!v || v === "none") return null;
  const color = (hat.data.color as string | undefined) ?? "#2a1a08";
  const accent = (hat.data.accent as string | undefined) ?? color;

  const offsetX = useDerivedValue(() => cx.value);
  const offsetY = useDerivedValue(() => cy.value);
  const transform = useDerivedValue(() => [{ translateX: offsetX.value }, { translateY: offsetY.value }]);

  if (v === "crown") {
    return (
      <Group transform={transform}>
        <Path path={crownPath} color={color} />
        <Circle cx={0} cy={-bodyR * 1.6} r={bodyR * 0.1} color={accent} />
      </Group>
    );
  }

  if (v === "cap") {
    return (
      <Group transform={transform}>
        <RoundedRect x={-bodyR * 0.75} y={-bodyR * 1.45} width={bodyR * 1.5} height={bodyR * 0.5} r={bodyR * 0.3} color={color} />
        <RoundedRect x={-bodyR * 0.2} y={-bodyR * 1.0} width={bodyR * 1.1} height={bodyR * 0.18} r={bodyR * 0.08} color={color} />
      </Group>
    );
  }

  if (v === "top") {
    return (
      <Group transform={transform}>
        <Rect x={-bodyR * 0.85} y={-bodyR * 1.0} width={bodyR * 1.7} height={bodyR * 0.12} color={color} />
        <Rect x={-bodyR * 0.55} y={-bodyR * 1.85} width={bodyR * 1.1} height={bodyR * 0.85} color={color} />
        <Rect x={-bodyR * 0.55} y={-bodyR * 1.4} width={bodyR * 1.1} height={bodyR * 0.12} color={accent} />
      </Group>
    );
  }

  if (v === "chef") {
    return (
      <Group transform={transform}>
        <Rect x={-bodyR * 0.55} y={-bodyR * 1.2} width={bodyR * 1.1} height={bodyR * 0.3} color={color} />
        <Circle cx={0} cy={-bodyR * 1.45} r={bodyR * 0.7} color={color} />
        <Circle cx={-bodyR * 0.35} cy={-bodyR * 1.5} r={bodyR * 0.35} color={color} />
        <Circle cx={bodyR * 0.35} cy={-bodyR * 1.5} r={bodyR * 0.35} color={color} />
      </Group>
    );
  }

  if (v === "bandana") {
    const bandanaPath = Skia.Path.Make();
    bandanaPath.moveTo(-bodyR * 0.7, -bodyR * 1.05);
    bandanaPath.lineTo(bodyR * 0.7, -bodyR * 1.05);
    bandanaPath.lineTo(bodyR * 0.8, -bodyR * 0.7);
    bandanaPath.lineTo(-bodyR * 0.8, -bodyR * 0.7);
    bandanaPath.close();
    return (
      <Group transform={transform}>
        <Path path={bandanaPath} color={color} />
      </Group>
    );
  }

  if (v === "flower") {
    return (
      <Group transform={transform}>
        <Circle cx={-bodyR * 0.5} cy={-bodyR * 1.15} r={bodyR * 0.18} color={color} />
        <Circle cx={-bodyR * 0.3} cy={-bodyR * 1.35} r={bodyR * 0.18} color={color} />
        <Circle cx={-bodyR * 0.65} cy={-bodyR * 1.35} r={bodyR * 0.18} color={color} />
        <Circle cx={-bodyR * 0.5} cy={-bodyR * 1.55} r={bodyR * 0.18} color={color} />
        <Circle cx={-bodyR * 0.5} cy={-bodyR * 1.35} r={bodyR * 0.12} color={accent} />
      </Group>
    );
  }

  if (v === "halo") {
    return (
      <Group transform={transform}>
        <Circle cx={0} cy={-bodyR * 1.2} r={bodyR * 0.6} color={color} style="stroke" strokeWidth={bodyR * 0.13} />
      </Group>
    );
  }

  return null;
}
