import Expo, { ExpoPushMessage } from "expo-server-sdk";

const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN,
});

export type PushRecipient = {
  userId: string;
  token: string;
};

export async function sendPushNotifications(
  messages: ExpoPushMessage[],
): Promise<{ sent: number; failed: number }> {
  const valid = messages.filter((m) => Expo.isExpoPushToken(m.to as string));
  if (!valid.length) return { sent: 0, failed: messages.length };

  const chunks = expo.chunkPushNotifications(valid);
  let sent = 0;
  let failed = 0;

  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      for (const ticket of tickets) {
        if (ticket.status === "ok") sent += 1;
        else failed += 1;
      }
    } catch {
      failed += chunk.length;
    }
  }

  return { sent, failed };
}

export async function sendDailyDigestNotifications(
  recipients: Array<{ userId: string; token: string; body: string }>,
): Promise<{ sent: number; failed: number }> {
  const messages: ExpoPushMessage[] = recipients
    .filter((r) => r.body)
    .map((r) => ({
      to: r.token,
      sound: "default" as const,
      title: "Berkeley Dining",
      body: r.body,
      data: { type: "daily_digest" },
    }));

  return sendPushNotifications(messages);
}
