export interface ScoreSnapshot {
  focusScore: number;
  consistencyScore: number;
  disciplineScore: number;
  scoreTone: "Risco" | "Ritmo" | "Progresso";
  summary: string;
  insight: string;
}

export interface IntelligentNotification {
  id: string;
  type: "streak_risk" | "discipline_push" | "celebration" | "comeback";
  title: string;
  body: string;
  tone: "danger" | "warning" | "positive";
}

export interface NotificationCenterItem {
  id: string;
  category: "alert" | "activity" | "social";
  source: "intelligent" | "proactive" | "visit" | "connection" | "community" | "direct_message";
  title: string;
  body: string;
  tone: "danger" | "warning" | "positive" | "neutral";
  createdAt: string;
  read: boolean;
  fromUserId?: string;
  fromName?: string;
}
