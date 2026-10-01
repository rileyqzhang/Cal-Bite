import type { MenuOutput } from "@berkeley-dining/shared";
import { findFavoriteMatches } from "@/lib/favorites/match";
import { buildDailyDigestCopy, type NotificationMode } from "@/lib/push/copy";
import { sendDailyDigestNotifications, type DigestRecipient } from "@/lib/push/expo";
import { scrapeAvailableMenusFromToday } from "@/lib/scraper/fetch";
import {
  downloadMenuJson,
  getSupabaseAdmin,
  uploadMenuJson,
} from "@/lib/supabase/server";
import {
  isCampusNotifyCatchUpWindow,
  isCampusNotifyWindow,
  todayInTimeZone,
} from "@/lib/time/campus";

// Shared by the Vercel cron routes and scripts/cron.ts (GitHub Actions).

export type JobResult = { ok: boolean } & Record<string, unknown>;

const MODES = new Set<NotificationMode>(["favorites_only", "always"]);

export async function runDailyScrape(): Promise<JobResult> {
  const results: Record<string, unknown> = {
    scraped_dates: [] as string[],
  };

  try {
    const menus = await scrapeAvailableMenusFromToday({ includeNutrition: true });
    for (const menu of menus) {
      await uploadMenuJson(menu.date, menu);
      (results.scraped_dates as string[]).push(menu.date);
    }

    return { ok: true, ...results };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Cron job failed",
      ...results,
    };
  }
}

export type NotifyOptions = {
  /** Skip the 7:30 AM Pacific window check (manual tests). */
  force?: boolean;
  /**
   * Accept any tick from 7:25 to 9:59 AM Pacific instead of only 7:25–7:40.
   * For schedulers that can fire late (GitHub Actions); notification_sends
   * keeps it to one digest per user per day. Ticks run one at a time, so a
   * row still 'claimed' on a later tick is from a run that died right around
   * the send; treat it as delivered rather than risk a duplicate (--force
   * still retries it). 'failed' rows are retried as before.
   */
  catchUp?: boolean;
};

export async function runDailyNotify(
  options: NotifyOptions = {},
): Promise<JobResult> {
  const inWindow = options.catchUp
    ? isCampusNotifyCatchUpWindow()
    : isCampusNotifyWindow();
  if (!options.force && !inWindow) {
    return {
      ok: true,
      skipped: "outside_730_pt_window",
    };
  }

  const today = todayInTimeZone();
  const results = {
    date: today,
    sent: 0,
    failed: 0,
    skipped: 0,
    invalid_tokens: 0,
    retried: 0,
  };

  try {
    const todayMenu = (await downloadMenuJson(today)) as MenuOutput | null;
    if (!todayMenu) {
      return {
        ok: true,
        ...results,
        skipped_reason: "no_menu",
      };
    }

    const supabase = getSupabaseAdmin();
    const { data: tokens, error: tokenError } = await supabase
      .from("push_tokens")
      .select("user_id, expo_push_token");

    if (tokenError) throw new Error(tokenError.message);

    const userIds = [...new Set((tokens ?? []).map((row) => row.user_id))];
    if (!userIds.length) {
      return { ok: true, ...results };
    }

    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, notifications_enabled, notification_mode")
      .in("id", userIds)
      .eq("notifications_enabled", true);

    if (profileError) throw new Error(profileError.message);

    const profileByUser = new Map(
      (profiles ?? []).map((profile) => [profile.id, profile]),
    );
    const eligibleIds = [...profileByUser.keys()];
    if (!eligibleIds.length) {
      results.skipped += (tokens ?? []).length;
      return { ok: true, ...results };
    }

    const { data: favorites, error: favError } = await supabase
      .from("favorite_foods")
      .select("user_id, display_name, food_name")
      .in("user_id", eligibleIds);

    if (favError) throw new Error(favError.message);

    const favoritesByUser = new Map<string, string[]>();
    for (const fav of favorites ?? []) {
      const list = favoritesByUser.get(fav.user_id) ?? [];
      list.push(fav.display_name || fav.food_name);
      favoritesByUser.set(fav.user_id, list);
    }

    const { data: existingSends, error: sentError } = await supabase
      .from("notification_sends")
      .select("user_id, status")
      .eq("send_date", today)
      .eq("kind", "daily_digest")
      .in("user_id", eligibleIds);

    if (sentError) throw new Error(sentError.message);

    const retryClaimed = !options.catchUp || options.force;
    const sentUsers = new Set<string>();
    const retryUsers = new Set<string>();
    for (const row of existingSends ?? []) {
      if (row.status === "sent" || (row.status === "claimed" && !retryClaimed)) {
        sentUsers.add(row.user_id);
      } else {
        retryUsers.add(row.user_id);
      }
    }

    const recipients: DigestRecipient[] = [];
    const claimedUserIds: string[] = [];

    for (const row of tokens ?? []) {
      const profile = profileByUser.get(row.user_id);
      if (!profile) {
        results.skipped += 1;
        continue;
      }
      if (sentUsers.has(row.user_id)) {
        results.skipped += 1;
        continue;
      }

      const mode: NotificationMode = MODES.has(profile.notification_mode)
        ? profile.notification_mode
        : "favorites_only";
      const matches = findFavoriteMatches(
        todayMenu,
        favoritesByUser.get(row.user_id) ?? [],
      );
      const copy = buildDailyDigestCopy(matches, mode);
      if (!copy) {
        results.skipped += 1;
        continue;
      }

      recipients.push({
        userId: row.user_id,
        token: row.expo_push_token,
        title: copy.title,
        body: copy.body,
        date: today,
        matchCount: copy.matchCount,
      });
      if (retryUsers.has(row.user_id)) {
        results.retried += 1;
        continue;
      }
      if (!claimedUserIds.includes(row.user_id)) {
        claimedUserIds.push(row.user_id);
      }
    }

    if (claimedUserIds.length) {
      const { error: claimError } = await supabase.from("notification_sends").insert(
        claimedUserIds.map((userId) => ({
          user_id: userId,
          send_date: today,
          kind: "daily_digest",
          status: "claimed",
        })),
      );
      if (claimError) {
        if (claimError.code === "23505") {
          const retryOnly = recipients.filter((recipient) =>
            retryUsers.has(recipient.userId),
          );
          if (!retryOnly.length) {
            return {
              ok: true,
              ...results,
              skipped: results.skipped + recipients.length,
              skipped_reason: "already_sent",
            };
          }
          recipients.splice(0, recipients.length, ...retryOnly);
        } else {
          throw new Error(claimError.message);
        }
      }
    }

    const pushResult = await sendDailyDigestNotifications(recipients);
    results.sent = pushResult.sent;
    results.failed = pushResult.failed;

    if (pushResult.sentUserIds.length) {
      const { error: sentUpdateError } = await supabase
        .from("notification_sends")
        .update({ status: "sent" })
        .eq("send_date", today)
        .eq("kind", "daily_digest")
        .in("user_id", pushResult.sentUserIds);
      if (sentUpdateError) throw new Error(sentUpdateError.message);
    }

    if (pushResult.failedUserIds.length) {
      const { error: failedUpdateError } = await supabase
        .from("notification_sends")
        .update({ status: "failed" })
        .eq("send_date", today)
        .eq("kind", "daily_digest")
        .in("user_id", pushResult.failedUserIds);
      if (failedUpdateError) throw new Error(failedUpdateError.message);
    }

    if (pushResult.invalidTokens.length) {
      const { error: deleteError } = await supabase
        .from("push_tokens")
        .delete()
        .in("expo_push_token", pushResult.invalidTokens);
      if (!deleteError) {
        results.invalid_tokens = pushResult.invalidTokens.length;
      }
    }

    return { ok: true, ...results };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Notify cron failed",
      ...results,
    };
  }
}
