import Expo, { ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";

const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN,
});

export const DAILY_CHANNEL_ID = "daily-favorites";

export type DigestRecipient = {
  userId: string;
  token: string;
  title: string;
  body: string;
  date: string;
  matchCount: number;
};

export type PushMessageOutcome = {
  token: string;
  ok: boolean;
};

export type DigestSendResult = {
  sent: number;
  failed: number;
  invalidTokens: string[];
  sentUserIds: string[];
  failedUserIds: string[];
};

type DigestPushMessage = ExpoPushMessage & {
  collapseId: string;
};

function ticketError(ticket: ExpoPushTicket): string | null {
  if (ticket.status !== "error") return null;
  return ticket.details?.error ?? ticket.message ?? "unknown";
}

export async function sendPushNotifications(
  messages: ExpoPushMessage[],
): Promise<{
  sent: number;
  failed: number;
  invalidTokens: string[];
  outcomes: PushMessageOutcome[];
}> {
  const outcomes: PushMessageOutcome[] = messages.map((message) => ({
    token: typeof message.to === "string" ? message.to : "",
    ok: false,
  }));
  const invalidTokens: string[] = [];
  const valid: ExpoPushMessage[] = [];
  const validIndexes: number[] = [];

  messages.forEach((message, index) => {
    if (typeof message.to === "string" && Expo.isExpoPushToken(message.to)) {
      valid.push(message);
      validIndexes.push(index);
    }
  });

  if (!valid.length) {
    return {
      sent: 0,
      failed: messages.length,
      invalidTokens,
      outcomes,
    };
  }

  const chunks = expo.chunkPushNotifications(valid);
  let sent = 0;
  let failed = messages.length - valid.length;
  let cursor = 0;

  for (const chunk of chunks) {
    const chunkIndexes = validIndexes.slice(cursor, cursor + chunk.length);
    cursor += chunk.length;
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, index) => {
        const messageIndex = chunkIndexes[index];
        if (ticket.status === "ok") {
          sent += 1;
          if (messageIndex !== undefined) outcomes[messageIndex].ok = true;
          return;
        }
        failed += 1;
        const error = ticketError(ticket);
        const token = chunk[index]?.to;
        if (error === "DeviceNotRegistered" && typeof token === "string") {
          invalidTokens.push(token);
        }
      });
    } catch {
      failed += chunk.length;
    }
  }

  return { sent, failed, invalidTokens, outcomes };
}

export async function sendDailyDigestNotifications(
  recipients: DigestRecipient[],
): Promise<DigestSendResult> {
  const collapseId = recipients[0]
    ? `daily-digest-${recipients[0].date}`
    : "daily-digest";

  const messages: DigestPushMessage[] = recipients.map((recipient) => ({
    to: recipient.token,
    sound: "default" as const,
    title: recipient.title,
    body: recipient.body,
    channelId: DAILY_CHANNEL_ID,
    collapseId,
    data: {
      type: "daily_digest",
      date: recipient.date,
      match_count: recipient.matchCount,
    },
  }));

  const pushResult = await sendPushNotifications(messages);
  const sentUserIds = new Set<string>();
  const failedUserIds = new Set<string>();

  recipients.forEach((recipient, index) => {
    if (pushResult.outcomes[index]?.ok) {
      sentUserIds.add(recipient.userId);
    } else {
      failedUserIds.add(recipient.userId);
    }
  });

  for (const userId of sentUserIds) {
    failedUserIds.delete(userId);
  }

  return {
    sent: pushResult.sent,
    failed: pushResult.failed,
    invalidTokens: pushResult.invalidTokens,
    sentUserIds: [...sentUserIds],
    failedUserIds: [...failedUserIds],
  };
}
