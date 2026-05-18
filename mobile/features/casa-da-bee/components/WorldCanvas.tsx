import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Canvas, Group, Circle, BlurMask, Rect } from "@shopify/react-native-skia";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { runOnJS, useDerivedValue, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { type Position, type MapItem } from "../engine/types";
import type { BeeGameApi } from "../engine/state";
import { BeeSprite } from "./BeeSprite";
import { StationSprite } from "./StationSprite";
import { TileSprite } from "./TileSprite";
import { AmbientFX } from "./AmbientFX";
import { EffectsLayer } from "./EffectsLayer";
import { EmotionBubble } from "./EmotionBubble";
import { WindowDecorations } from "./WindowDecorations";
import { Wildlife } from "./Wildlife";
import type { Effect } from "../engine/effects";
import type { TimeOfDay } from "../engine/dayNight";
import type { CatalogItem } from "../engine/catalog";

interface Props {
  game: BeeGameApi;
  width: number;
  height: number;
  timeOfDay: TimeOfDay;
  passiveItems: MapItem[];
  effects: Effect[];
  onNpcTap?: (npcId: string) => void;
  equippedHat?: CatalogItem | null;
  equippedAccessory?: CatalogItem | null;
  equippedBody?: CatalogItem | null;
  equippedBed?: CatalogItem | null;
  equippedDesk?: CatalogItem | null;
  equippedRug?: CatalogItem | null;
  equippedWallpaper?: CatalogItem | null;
  equippedFloor?: CatalogItem | null;
  furnitureOverrides?: Record<string, Position>;
  onMoveFurniture?: (stationId: string, position: Position) => void;
}

export function WorldCanvas({
  game,
  width,
  height,
  timeOfDay,
  passiveItems,
  effects,
  onNpcTap,
  equippedHat,
  equippedAccessory,
  equippedBody,
  equippedBed,
  equippedDesk,
  equippedRug,
  equippedWallpaper,
  equippedFloor,
  furnitureOverrides,
  onMoveFurniture,
}: Props) {
  const { map } = game;
  const [editingStation, setEditingStation] = useState<string | null>(null);

  const stationsWithOverride = useMemo(() => {
    if (!furnitureOverrides) return map.stations;
    return map.stations.map((s) => ({
      ...s,
      position: furnitureOverrides[s.id] ?? s.position,
    }));
  }, [furnitureOverrides, map.stations]);

  const tileSize = useMemo(() => Math.min(width / map.width, height / map.height), [
    height,
    map.height,
    map.width,
    width,
  ]);

  const offsetX = useMemo(() => (width - tileSize * map.width) / 2, [map.width, tileSize, width]);
  const offsetY = useMemo(() => (height - tileSize * map.height) / 2, [height, map.height, tileSize]);

  const beePixelX = useDerivedValue(() => offsetX + game.pixelX.value * tileSize + tileSize / 2);
  const beePixelY = useDerivedValue(() => offsetY + game.pixelY.value * tileSize + tileSize / 2);

  // Tick global pra pulsacao de itens collectibles
  const pulseTick = useSharedValue(0);
  useEffect(() => {
    pulseTick.value = withRepeat(withTiming(1, { duration: 1100 }), -1, true);
  }, [pulseTick]);

  const handleTap = (target: Position) => {
    // Se ha movel selecionado, tap = move ele pro tile
    if (editingStation && onMoveFurniture) {
      onMoveFurniture(editingStation, target);
      setEditingStation(null);
      return;
    }
    const npc = map.npcs.find((n) => n.position.x === target.x && n.position.y === target.y);
    if (npc && onNpcTap) {
      onNpcTap(npc.id);
      return;
    }
    game.walkToTile(target);
  };

  const handleLongPress = (target: Position) => {
    // Long press num movel = entra em modo edicao
    const station = stationsWithOverride.find((s) => s.position.x === target.x && s.position.y === target.y);
    if (station) {
      setEditingStation(station.id);
    }
  };

  const tap = Gesture.Tap().onEnd((e) => {
    "worklet";
    const tx = Math.floor((e.x - offsetX) / tileSize);
    const ty = Math.floor((e.y - offsetY) / tileSize);
    if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return;
    runOnJS(handleTap)({ x: tx, y: ty });
  });

  const longPress = Gesture.LongPress()
    .minDuration(400)
    .onStart((e) => {
      "worklet";
      const tx = Math.floor((e.x - offsetX) / tileSize);
      const ty = Math.floor((e.y - offsetY) / tileSize);
      if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return;
      runOnJS(handleLongPress)({ x: tx, y: ty });
    });

  const composedGesture = Gesture.Exclusive(longPress, tap);

  return (
    <GestureDetector gesture={composedGesture}>
      <View style={[styles.container, { width, height }]}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Group>
            {/* Tiles */}
            {map.ground.flatMap((row, y) =>
              row.map((tile, x) => (
                <TileSprite
                  key={`tile-${x}-${y}`}
                  tile={tile}
                  px={offsetX + x * tileSize}
                  py={offsetY + y * tileSize}
                  tileSize={tileSize}
                  wallpaper={equippedWallpaper}
                  floor={equippedFloor}
                  rug={equippedRug}
                />
              )),
            )}

            {/* Janelas com céu animado */}
            <WindowDecorations
              tileSize={tileSize}
              offsetX={offsetX}
              offsetY={offsetY}
              mapWidth={map.width}
              timeOfDay={timeOfDay}
            />

            {/* Borboletas ambient */}
            <Wildlife width={width} height={height} />

            {/* Estacoes (usa stationsWithOverride se ha layout salvo) */}
            {stationsWithOverride.map((station) => (
              <Group key={station.id} opacity={editingStation === station.id ? 0.6 : 1}>
                <StationSprite
                  station={station}
                  tileSize={tileSize}
                  offsetX={offsetX}
                  offsetY={offsetY}
                  bedVariant={equippedBed}
                  deskVariant={equippedDesk}
                />
                {/* Borda destacada quando esta sendo movido */}
                {editingStation === station.id && (
                  <Rect
                    x={offsetX + station.position.x * tileSize}
                    y={offsetY + station.position.y * tileSize}
                    width={tileSize}
                    height={tileSize}
                    color="#fbe27a"
                    style="stroke"
                    strokeWidth={3}
                  />
                )}
              </Group>
            ))}

            {/* Itens originais do mapa */}
            {map.items.map((item) => (
              <CollectibleSprite
                key={item.id}
                item={item}
                tileSize={tileSize}
                offsetX={offsetX}
                offsetY={offsetY}
                pulseTick={pulseTick}
              />
            ))}

            {/* Itens passivos (spawnados em runtime) */}
            {passiveItems.map((item) => (
              <CollectibleSprite
                key={item.id}
                item={item}
                tileSize={tileSize}
                offsetX={offsetX}
                offsetY={offsetY}
                pulseTick={pulseTick}
              />
            ))}

            {/* NPCs */}
            {map.npcs.map((npc) => {
              const px = offsetX + npc.position.x * tileSize + tileSize / 2;
              const py = offsetY + npc.position.y * tileSize + tileSize / 2;
              return (
                <Group key={npc.id}>
                  <Circle cx={px} cy={py} r={tileSize * 0.32} color="#f4c45c" />
                  <Circle cx={px - tileSize * 0.1} cy={py - tileSize * 0.08} r={tileSize * 0.05} color="#22150b" />
                  <Circle cx={px + tileSize * 0.1} cy={py - tileSize * 0.08} r={tileSize * 0.05} color="#22150b" />
                </Group>
              );
            })}

            {/* Bee */}
            <BeeSprite
              pixelX={beePixelX}
              pixelY={beePixelY}
              facing={game.facing}
              tileSize={tileSize}
              state={game.state}
              hat={equippedHat}
              accessory={equippedAccessory}
              body={equippedBody}
            />

            {/* Efeitos visuais (particles + confetti) */}
            <EffectsLayer effects={effects} />

            {/* Ambient FX: vignette + particles de polen + tint hora do dia */}
            <AmbientFX width={width} height={height} timeOfDay={timeOfDay} />
          </Group>
        </Canvas>

        {/* Emoji da Bee (RN absolute sobre o Canvas) */}
        <EmotionBubble beePixelX={beePixelX} beePixelY={beePixelY} state={game.state} tileSize={tileSize} />
      </View>
    </GestureDetector>
  );
}

function CollectibleSprite({
  item,
  tileSize,
  offsetX,
  offsetY,
  pulseTick,
}: {
  item: MapItem;
  tileSize: number;
  offsetX: number;
  offsetY: number;
  pulseTick: ReturnType<typeof useSharedValue<number>>;
}) {
  const px = offsetX + item.position.x * tileSize + tileSize / 2;
  const py = offsetY + item.position.y * tileSize + tileSize / 2;
  const isStar = item.type === "star";
  const isHeart = item.type === "heart";
  const color = isStar ? "#fff06d" : isHeart ? "#ec5c5c" : "#fbd449";

  // bobbing vertical
  const cy = useDerivedValue(() => py + Math.sin(pulseTick.value * Math.PI * 2) * tileSize * (isStar ? 0.1 : 0.06));
  const r = useDerivedValue(() => tileSize * ((isStar ? 0.22 : 0.16) + pulseTick.value * (isStar ? 0.08 : 0.04)));
  const haloR = useDerivedValue(() => tileSize * ((isStar ? 0.5 : 0.3) + pulseTick.value * (isStar ? 0.18 : 0.08)));
  const haloAlpha = useDerivedValue(() => (isStar ? 0.45 : 0.25) + pulseTick.value * (isStar ? 0.3 : 0.15));

  return (
    <Group>
      {/* Halo brilhante atras */}
      <Group opacity={haloAlpha}>
        <Circle cx={px} cy={cy} r={haloR} color={color}>
          <BlurMask blur={isStar ? 10 : 6} style="solid" />
        </Circle>
      </Group>
      {/* Item principal */}
      <Circle cx={px} cy={cy} r={r} color={color} />
      {/* Star: raios extras pra ficar tipo estrela */}
      {isStar && (
        <Group opacity={0.8}>
          <Circle cx={useDerivedValue(() => px + tileSize * 0.18)} cy={useDerivedValue(() => cy.value)} r={tileSize * 0.06} color={color} />
          <Circle cx={useDerivedValue(() => px - tileSize * 0.18)} cy={useDerivedValue(() => cy.value)} r={tileSize * 0.06} color={color} />
          <Circle cx={useDerivedValue(() => px)} cy={useDerivedValue(() => cy.value - tileSize * 0.18)} r={tileSize * 0.06} color={color} />
          <Circle cx={useDerivedValue(() => px)} cy={useDerivedValue(() => cy.value + tileSize * 0.18)} r={tileSize * 0.06} color={color} />
        </Group>
      )}
      {/* Highlight central */}
      <Circle cx={useDerivedValue(() => px - tileSize * 0.04)} cy={useDerivedValue(() => cy.value - tileSize * 0.04)} r={tileSize * 0.05} color="#ffffff" />
    </Group>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#160f04", overflow: "hidden" },
});
