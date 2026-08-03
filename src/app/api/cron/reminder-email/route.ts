import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isJapaneseHoliday } from "@/lib/holidays";
import { isWeekdayJst, todayInJst } from "@/lib/jst-date";
import { sendReminderEmail } from "@/lib/mailer";

// Vercel Cron（vercel.jsonの"crons"）から平日19:30 JST(=10:30 UTC)に呼び出される想定。
// Vercelは環境変数CRON_SECRETが設定されていると、その値を Authorization: Bearer ヘッダーで
// 自動的に付与してくれるため、ここで一致確認して外部からの不正な呼び出しを弾く。
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = todayInJst();
  if (!isWeekdayJst(today) || isJapaneseHoliday(today)) {
    return NextResponse.json({ skipped: true, reason: "holiday_or_weekend" });
  }

  const employees = await prisma.employee.findMany({
    where: { isActive: true, reminderEmailEnabled: true },
    include: {
      allowedEmail: true,
      timeEntries: { where: { workDate: today }, select: { id: true } },
    },
  });

  const targets = employees.filter(
    (e) => e.allowedEmail?.email && e.timeEntries.length === 0,
  );

  const results = await Promise.allSettled(
    targets.map((e) => sendReminderEmail(e.allowedEmail!.email, e.name, today)),
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failures = results
    .map((r, i) => (r.status === "rejected" ? { employee: targets[i].name, error: String(r.reason) } : null))
    .filter((f): f is { employee: string; error: string } => f !== null);

  if (failures.length > 0) {
    console.error("喚起メールの送信に失敗しました", failures);
  }

  return NextResponse.json({
    checked: employees.length,
    targeted: targets.length,
    sent,
    failed: failures.length,
  });
}
