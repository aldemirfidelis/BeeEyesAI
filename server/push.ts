import { storage } from "./storage";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  channelId?: string;
  sound?: "default" | null;
}

async function sendRawPush(messages: PushMessage[]): Promise<void> {
  if (messages.length === 0) return;
  try {
    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(6000),
    });
  } catch {
    // non-blocking — push failures must never break the main flow
  }
}

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
  channelId = "bee-social",
): Promise<void> {
  const user = await storage.getUser(userId);
  const token = user?.expoPushToken;
  if (!token) return;
  await sendRawPush([{ to: token, title, body, data, channelId, sound: "default" }]);
}

export async function sendPushToCommunityMembers(
  communityId: string,
  excludeUserId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  const tokens = await storage.getCommunityMemberPushTokens(communityId, excludeUserId);
  if (tokens.length === 0) return;
  const messages: PushMessage[] = tokens.map((to) => ({
    to,
    title,
    body,
    data,
    channelId: "bee-social",
    sound: "default",
  }));
  await sendRawPush(messages);
}
