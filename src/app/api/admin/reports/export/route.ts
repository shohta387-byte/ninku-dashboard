import { NextRequest, NextResponse } from "next/server";
import { getReportEntries } from "@/app/actions";
import { summarizeByEmployee, summarizeBySite } from "@/lib/report";
import { toCsv } from "@/lib/csv";
import { getSession } from "@/lib/session";
import { toJstInputValue, toJstParts } from "@/lib/jst-date";

function formatDate(date: Date): string {
  return toJstInputValue(date);
}

function formatTime(date: Date): string {
  const { hour, minute } = toJstParts(date);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
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
  const typeParam = params.get("type");
  const type = typeParam === "employee" || typeParam === "site" ? typeParam : "detail";

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

  if (type === "site") {
    const summaries = summarizeBySite(entries);
    const csv = toCsv(
      ["現場", "合計人工", "合計稼働時間(h)", "打刻件数"],
      summaries.map((s) => [s.siteName, s.totalNinku, s.totalHours, s.entryCount]),
    );
    return csvResponse(csv, `現場別人工_${from}_${to}.csv`);
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
