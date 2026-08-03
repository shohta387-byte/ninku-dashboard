import nodemailer from "nodemailer";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} が設定されていません。喚起メールを送るには.env(またはVercelの環境変数)を確認してください。`);
  }
  return value;
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: requireEnv("REMINDER_GMAIL_USER"),
        pass: requireEnv("REMINDER_GMAIL_APP_PASSWORD"),
      },
    });
  }
  return transporter;
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "long" });
}

function buildReminderText(employeeName: string, date: Date): string {
  const appUrl = process.env.APP_URL?.replace(/\/$/, "") || "";
  const dateLabel = formatDateLabel(date);

  return `${employeeName} 様

お疲れ様です。人工管理システムです。

本日（${dateLabel}）分の出勤打刻がまだ確認できていません。
現場での作業前でしたら、お手数ですが下記から打刻をお願いいたします。

${appUrl || "（システムのURLはお手元のブックマーク、または管理者にご確認ください）"}

すでに退勤していて打刻だけし忘れてしまった場合は、ログイン後の
ホーム画面にある「打刻を後から手動で追加する」から後からでも記録できます。

本日は現場に入っていない、お休みだったなど対応が不要な場合は、
このメールは破棄していただいて問題ありません。

------------------------------------------------
本メールは、平日19:30時点で当日の打刻が確認できない方に自動送信しています。
心当たりがない場合や、届く必要がない場合は管理者までご連絡ください。
人工管理システム
------------------------------------------------`;
}

export async function sendReminderEmail(to: string, employeeName: string, date: Date): Promise<void> {
  const from = requireEnv("REMINDER_GMAIL_USER");
  await getTransporter().sendMail({
    from: `"人工管理システム" <${from}>`,
    to,
    subject: "本日の打刻、お済みでしょうか？",
    text: buildReminderText(employeeName, date),
  });
}
