export interface MiniMission {
  id: string;
  title: string;
  description: string;
  rewardPollen: number;
  rewardXp: number;
}

const MISSION_POOL: MiniMission[] = [
  { id: "polish-house", title: "Casa brilhante", description: "Toque em todas as estações da casa.", rewardPollen: 8, rewardXp: 10 },
  { id: "morning-talk", title: "Bom dia", description: "Volte de manhã para um cafezinho com a Bia.", rewardPollen: 5, rewardXp: 5 },
  { id: "pollen-hunt", title: "Caçadora", description: "Colete 3 pólens em uma única visita.", rewardPollen: 6, rewardXp: 8 },
  { id: "dance-party", title: "Festa", description: "Veja a Bee dançar por pelo menos 10s.", rewardPollen: 4, rewardXp: 6 },
  { id: "rest-well", title: "Soninho", description: "Mande a Bee descansar na cama.", rewardPollen: 5, rewardXp: 5 },
];

export function pickRandomMission(): MiniMission {
  return MISSION_POOL[Math.floor(Math.random() * MISSION_POOL.length)];
}
