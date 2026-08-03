import { NextRequest, NextResponse } from "next/server";
import { getReportEntries } from "@/app/actions";
import { summarizeByEmployee } from "@/lib/report";
import { toCsv } from "@/lib/csv";
import { getSession } from "@/lib/session";

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function csvResponse(csv: string, filename: string): NextResponse {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}

export async function GET(request: NextRequest) {
  // getReportEntries内のrequireAdminSessionはredirect()を使うが、Route Handlerでは
  // ページ遷移と同じようには扱われないため、ここで先に明示チェックして403を返す。
  const session = await getSession();
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const siteIdParam = params.get("siteId");
  const siteId = siteIdParam && siteIdParam !== "" ? siteIdParam : undefined;
  const from = params.get("from");
  const to = params.get("to");
  const type = params.get("type") === "employee" ? "employee" : "detail";

  if (!from || !to) {
    return NextResponse.json({ error: "from, to を指定してください" }, { status: 400 });
  }

  const entries = await getReportEntries({ siteId, from, to });

  if (type === "employee") {
    const summaries = summarizeByEmployee(entries);
    const csv = toCsv(
      ["従業員", "合計人工", "合計稼働時間(h)", "打刻件数"],
      summaries.map((s) => [s.employeeName, s.totalNinku, s.totalHours, s.entryCount]),
    );
    return csvResponse(csv, `従業員別人工_${from}_${to}.csv`);
  }

  const csv = toCsv(
    ["日付", "従業員", "現場", "出勤", "退勤", "稼働時間(h)", "人工"],
    entries.map((e) => [
      formatDate(e.workDate),
      e.employeeName,
      e.siteName,
      formatTime(e.clockIn),
      formatTime(e.clockOut),
      e.ninku.workedHours,
      e.ninku.totalNinku,
    ]),
  );
  return csvResponse(csv, `打刻詳細_${from}_${to}.csv`);
}
