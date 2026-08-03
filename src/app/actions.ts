"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BREAK_WINDOWS, getBreakWindowsWithinSpan, type BreakKey } from "@/lib/ninku";
import { sumHours, sumNinku, toReportEntry, type ReportEntry } from "@/lib/report";
import { geocodeAddress, type GeocodeResult } from "@/lib/geocode";
import {
  destroySession,
  getSession,
  requireAdminSession,
  requireEmployeeSession,
} from "@/lib/session";

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// "YYYY-MM-DD" をその日のローカル0時のDateに変換する
function startOfDateString(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// 打刻の作成・変更のたびにBigQueryを全件同期する。ユーザーの打刻操作をブロックしたくないので
// 完了を待たずに投げっぱなしにし、失敗してもログに残すだけで打刻自体は成功させる。
function triggerBigQuerySyncInBackground(): void {
  import("@/lib/bigquery")
    .then((m) => m.syncTimeEntriesToBigQuery())
    .catch((error) => {
      console.error("BigQueryへの自動同期に失敗しました", error);
    });
}

// 現場の追加・状態変更のたびにBigQueryのsitesテーブルも同様に自動同期する。
function triggerSiteBigQuerySyncInBackground(): void {
  import("@/lib/bigquery")
    .then((m) => m.syncSitesToBigQuery())
    .catch((error) => {
      console.error("BigQueryへの現場情報の自動同期に失敗しました", error);
    });
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function getCurrentEmployee() {
  const { employeeId } = await requireEmployeeSession();
  return prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
}

// 従業員に紐付いていない管理者専用アカウントでも表示名を出せるように、
// 従業員名が無ければメールアドレスにフォールバックする。
export async function getCurrentUserLabel(): Promise<string> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.employeeId) {
    const employee = await prisma.employee.findUnique({ where: { id: session.employeeId } });
    if (employee) return employee.name;
  }
  return session.email;
}

// 管理者画面（ホワイトリストの従業員選択など）専用。一覧に全員の名前が出るため管理者限定にする。
export async function getEmployees() {
  await requireAdminSession();
  return prisma.employee.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function getSites() {
  await requireEmployeeSession();
  return prisma.site.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function getSiteById(siteId: string) {
  await requireEmployeeSession();
  return prisma.site.findUnique({ where: { id: siteId } });
}

// 住所やビル名から緯度経度を検索する（現場登録時、現場にいなくても位置を設定できるように）。
// ログインしていれば従業員・管理者どちらでも使える。
export async function searchAddress(query: string): Promise<GeocodeResult[]> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (query.trim().length < 2) {
    return [];
  }
  return geocodeAddress(query.trim());
}

function normalizeSiteName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "");
}

// 2点間の距離をメートルで返す（ハーバーサイン公式）。
function distanceInMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export interface CreateSiteState {
  status: "idle" | "duplicate_warning" | "success" | "error";
  message: string;
  siteId?: string;
}

// 現場は「みんなで付け足していく」想定のため、ログインしていれば従業員・管理者どちらでも
// 新規登録できる（管理者限定にしない）。同名・近接の現場がある場合は一度警告し、
// 表記ゆれや重複登録に気づけるようにする。
export async function createSite(
  _prevState: CreateSiteState,
  formData: FormData,
): Promise<CreateSiteState> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const name = formData.get("name");
  const lat = formData.get("lat");
  const lng = formData.get("lng");
  const confirmDuplicate = formData.get("confirmDuplicate") != null;

  if (typeof name !== "string" || name.trim() === "") {
    return { status: "error", message: "現場名を入力してください" };
  }
  if (typeof lat !== "string" || typeof lng !== "string" || lat === "" || lng === "") {
    return {
      status: "error",
      message: "位置情報を設定してください（現在地を使うか、住所で検索してください）",
    };
  }
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
    return { status: "error", message: "位置情報が正しくありません" };
  }

  if (!confirmDuplicate) {
    const existingSites = await prisma.site.findMany({ where: { isActive: true } });
    const normalizedNew = normalizeSiteName(name);
    const nameMatch = existingSites.find((s) => normalizeSiteName(s.name) === normalizedNew);
    const nearbyMatch = existingSites.find(
      (s) => distanceInMeters(s.lat, s.lng, latNum, lngNum) < 100,
    );
    if (nameMatch || nearbyMatch) {
      const reasons = [
        nameMatch ? `「${nameMatch.name}」と同じ名前` : null,
        nearbyMatch && nearbyMatch.id !== nameMatch?.id ? `「${nearbyMatch.name}」から100m以内` : null,
      ]
        .filter(Boolean)
        .join("、");
      return {
        status: "duplicate_warning",
        message: `似た現場が既に登録されています（${reasons}）。それでも新しく登録しますか？`,
      };
    }
  }

  const site = await prisma.site.create({
    data: { name: name.trim(), lat: latNum, lng: lngNum },
  });

  revalidatePath("/sites");
  revalidatePath("/admin/sites");
  revalidatePath("/entries/manual");
  triggerSiteBigQuerySyncInBackground();

  return { status: "success", message: `「${site.name}」を登録しました。`, siteId: site.id };
}

// --- 管理者: 現場管理 ---

export async function setSiteActive(siteId: string, isActive: boolean): Promise<void> {
  await requireAdminSession();
  await prisma.site.update({ where: { id: siteId }, data: { isActive } });
  revalidatePath("/admin/sites");
  revalidatePath("/sites");
  triggerSiteBigQuerySyncInBackground();
}

// 現場ごとの全期間の人工合計。作業が終わって無効化した現場も「過去の現場」として
// 振り返れるように、稼働中・無効どちらも対象に含める。
export async function getSiteLifetimeSummaries() {
  await requireAdminSession();

  const sites = await prisma.site.findMany({ orderBy: { name: "asc" } });
  const entries = await prisma.timeEntry.findMany({
    where: { clockIn: { not: null }, clockOut: { not: null } },
  });

  return sites.map((site) => {
    const siteEntries = entries.filter((e) => e.siteId === site.id);
    const reportEntries = siteEntries.map((e) =>
      toReportEntry({
        id: e.id,
        employeeId: e.employeeId,
        employeeName: "",
        siteId: e.siteId,
        siteName: site.name,
        workDate: e.workDate,
        clockIn: e.clockIn!,
        clockOut: e.clockOut!,
        workedBreak1: e.workedBreak1,
        workedBreak2: e.workedBreak2,
        workedBreak3: e.workedBreak3,
      }),
    );
    const lastWorkDate = siteEntries.reduce<Date | null>(
      (latest, e) => (!latest || e.workDate > latest ? e.workDate : latest),
      null,
    );

    return {
      site,
      totalNinku: sumNinku(reportEntries),
      totalHours: sumHours(reportEntries),
      entryCount: reportEntries.length,
      lastWorkDate,
    };
  });
}

// 本日の全打刻（現場をまたいで複数件になりうる）。ログイン中の本人のものだけを返す。
export async function getTodayEntriesForSelf() {
  const { employeeId } = await requireEmployeeSession();
  return prisma.timeEntry.findMany({
    where: { employeeId, workDate: startOfToday() },
    include: { site: true },
    orderBy: { clockIn: "asc" },
  });
}

// フォームのaction属性に直接bindして渡すため、戻り値はvoidにする。
// employeeIdはクライアントから受け取らず、必ずセッションから解決する
// （他人になりすまして打刻できないようにするため）。
export async function clockIn(siteId: string): Promise<void> {
  const { employeeId } = await requireEmployeeSession();

  // 同時に2現場で稼働することはできないため、退勤していない打刻が残っていないか確認する。
  const openEntry = await prisma.timeEntry.findFirst({
    where: { employeeId, workDate: startOfToday(), clockOut: null },
  });
  if (openEntry) {
    throw new Error("すでに退勤していない打刻があります。先に退勤してください");
  }

  const now = new Date();
  await prisma.timeEntry.create({
    data: {
      employeeId,
      siteId,
      workDate: startOfToday(),
      clockIn: now,
      originalClockIn: now,
    },
  });
  revalidatePath("/clock");
}

// フォームのチェックボックスは休憩枠ごとに name="break1" 等で送られてくる（チェック時のみ値が付く）。
function checkedBreakKeysFromFormData(formData: FormData): Set<BreakKey> {
  return new Set<BreakKey>(
    BREAK_WINDOWS.map((w) => w.key).filter((key) => formData.get(key) != null),
  );
}

function workedBreakFields(checked: Set<BreakKey>) {
  return {
    workedBreak1: checked.has("break1"),
    workedBreak2: checked.has("break2"),
    workedBreak3: checked.has("break3"),
  };
}

export async function clockOut(entryId: string, formData: FormData): Promise<void> {
  const { employeeId } = await requireEmployeeSession();
  const existing = await prisma.timeEntry.findUniqueOrThrow({ where: { id: entryId } });
  if (existing.employeeId !== employeeId) {
    throw new Error("この打刻を操作する権限がありません");
  }
  if (!existing.clockIn) {
    throw new Error("出勤していません");
  }

  const now = new Date();
  // 休憩チェックは、実際の勤務時間（clockIn〜now）に含まれる休憩枠しか有効にしない
  // （クライアント側の制御を回避してリクエストされた場合の保険）。
  const validKeys = new Set(getBreakWindowsWithinSpan(existing.workDate, existing.clockIn, now).map((w) => w.key));
  const checked = checkedBreakKeysFromFormData(formData);
  const effectiveChecked = new Set([...checked].filter((k) => validKeys.has(k)));
  const dailyReport = formData.get("dailyReport");

  await prisma.timeEntry.update({
    where: { id: entryId },
    data: {
      clockOut: now,
      originalClockOut: now,
      ...workedBreakFields(effectiveChecked),
      dailyReport: typeof dailyReport === "string" && dailyReport.trim() !== "" ? dailyReport.trim() : null,
    },
  });
  revalidatePath("/clock");
  triggerBigQuerySyncInBackground();
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// リアルタイムで打刻できなかった分を後から手動で追加する。
export async function createManualTimeEntry(formData: FormData) {
  const { employeeId } = await requireEmployeeSession();

  const siteId = formData.get("siteId");
  const dateStr = formData.get("date");
  const clockInTime = formData.get("clockInTime");
  const clockOutTime = formData.get("clockOutTime");
  const note = formData.get("note");

  if (typeof siteId !== "string" || siteId === "") {
    throw new Error("現場を選択してください");
  }
  if (typeof dateStr !== "string" || dateStr === "") {
    throw new Error("日付を選択してください");
  }
  if (typeof clockInTime !== "string" || typeof clockOutTime !== "string") {
    throw new Error("時刻を選択してください");
  }

  const workDate = startOfDateString(dateStr);
  if (workDate.getTime() > startOfToday().getTime()) {
    throw new Error("未来の日付は追加できません");
  }

  const newClockIn = new Date(workDate);
  const [inH, inM] = clockInTime.split(":").map(Number);
  newClockIn.setHours(inH, inM, 0, 0);

  const newClockOut = new Date(workDate);
  const [outH, outM] = clockOutTime.split(":").map(Number);
  newClockOut.setHours(outH, outM, 0, 0);

  if (newClockOut <= newClockIn) {
    throw new Error("退勤時刻は出勤時刻より後にしてください");
  }

  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) {
    throw new Error("現場が見つかりません");
  }

  // 同じ日の既存の打刻と時間帯が重なっていないか確認する（同時に2現場では働けないため）。
  const sameDayEntries = await prisma.timeEntry.findMany({
    where: { employeeId, workDate },
  });
  const overlapping = sameDayEntries.some((e) => {
    if (!e.clockIn) return false;
    const existingEnd = e.clockOut ?? new Date(8640000000000000); // 退勤していない場合は無期限とみなす
    return rangesOverlap(newClockIn, newClockOut, e.clockIn, existingEnd);
  });
  if (overlapping) {
    throw new Error("同じ日の他の打刻と時間帯が重なっています");
  }

  const validKeys = new Set(
    getBreakWindowsWithinSpan(workDate, newClockIn, newClockOut).map((w) => w.key),
  );
  const checked = checkedBreakKeysFromFormData(formData);
  const effectiveChecked = new Set([...checked].filter((k) => validKeys.has(k)));
  const dailyReport = formData.get("dailyReport");

  const session = await getSession();

  await prisma.timeEntry.create({
    data: {
      employeeId,
      siteId,
      workDate,
      clockIn: newClockIn,
      clockOut: newClockOut,
      isManuallyAdjusted: true,
      adjustedAt: new Date(),
      adjustmentNote: typeof note === "string" && note.length > 0 ? note : "手動追加",
      adjustedByName: session?.email,
      dailyReport: typeof dailyReport === "string" && dailyReport.trim() !== "" ? dailyReport.trim() : null,
      ...workedBreakFields(effectiveChecked),
    },
  });

  revalidatePath("/clock");
  triggerBigQuerySyncInBackground();
  redirect(`/clock?siteId=${siteId}`);
}

export async function adjustTimeEntry(
  entryId: string,
  newClockIn: Date,
  newClockOut: Date,
  note?: string,
  dailyReport?: string,
) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  if (newClockOut <= newClockIn) {
    throw new Error("退勤時刻は出勤時刻より後にしてください");
  }

  const existing = await prisma.timeEntry.findUniqueOrThrow({ where: { id: entryId } });
  // 本人の打刻、または管理者のみ補正できる。
  if (existing.employeeId !== session.employeeId && !session.isAdmin) {
    throw new Error("この打刻を修正する権限がありません");
  }

  const entry = await prisma.timeEntry.update({
    where: { id: entryId },
    data: {
      clockIn: newClockIn,
      clockOut: newClockOut,
      isManuallyAdjusted: true,
      adjustedAt: new Date(),
      adjustmentNote: note,
      adjustedByName: session.email,
      dailyReport: dailyReport ?? null,
      // 初回の補正時のみ、補正前の元の打刻を退避する（監査用）
      ...(existing.isManuallyAdjusted
        ? {}
        : { originalClockIn: existing.clockIn, originalClockOut: existing.clockOut }),
    },
  });

  revalidatePath("/clock");
  revalidatePath(`/entries/${entryId}/edit`);
  triggerBigQuerySyncInBackground();
  return entry;
}

// "HH:MM" 形式の文字列を、対象日の時刻を持つDateに変換する
function combineDateAndTime(baseDate: Date, hhmm: string): Date {
  const [hours, minutes] = hhmm.split(":").map(Number);
  const result = new Date(baseDate);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

// /entries/[id]/edit のフォーム(action属性)から直接呼び出すためのラッパー。
// フォームは時刻文字列(HH:MM)しか渡せないため、ここでDateに組み立ててadjustTimeEntryに委譲する。
export async function adjustTimeEntryForm(entryId: string, formData: FormData) {
  const clockInTime = formData.get("clockInTime");
  const clockOutTime = formData.get("clockOutTime");
  const note = formData.get("note");
  const dailyReport = formData.get("dailyReport");

  if (typeof clockInTime !== "string" || typeof clockOutTime !== "string") {
    throw new Error("時刻を選択してください");
  }

  const existing = await prisma.timeEntry.findUniqueOrThrow({ where: { id: entryId } });
  const newClockIn = combineDateAndTime(existing.workDate, clockInTime);
  const newClockOut = combineDateAndTime(existing.workDate, clockOutTime);

  await adjustTimeEntry(
    entryId,
    newClockIn,
    newClockOut,
    typeof note === "string" && note.length > 0 ? note : undefined,
    typeof dailyReport === "string" && dailyReport.trim() !== "" ? dailyReport.trim() : undefined,
  );

  redirect(`/clock?siteId=${existing.siteId}`);
}

// 管理者画面の打刻詳細ページ用。日報や補正履歴まで含めた全情報を返す。
export async function getEntryDetail(entryId: string) {
  await requireAdminSession();

  const entry = await prisma.timeEntry.findUnique({
    where: { id: entryId },
    include: { employee: true, site: true },
  });
  if (!entry) return null;

  const ninku =
    entry.clockIn && entry.clockOut
      ? toReportEntry({
          id: entry.id,
          employeeId: entry.employeeId,
          employeeName: entry.employee.name,
          siteId: entry.siteId,
          siteName: entry.site.name,
          workDate: entry.workDate,
          clockIn: entry.clockIn,
          clockOut: entry.clockOut,
          workedBreak1: entry.workedBreak1,
          workedBreak2: entry.workedBreak2,
          workedBreak3: entry.workedBreak3,
        }).ninku
      : null;

  return { entry, ninku };
}

export async function getTimeEntryById(entryId: string) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const entry = await prisma.timeEntry.findUnique({ where: { id: entryId } });
  if (entry && entry.employeeId !== session.employeeId && !session.isAdmin) {
    throw new Error("この打刻を閲覧する権限がありません");
  }
  return entry;
}

// --- 管理者: 従業員の打刻を代理入力 ---

export interface CreateEntryForEmployeeState {
  status: "idle" | "success" | "error";
  message: string;
}

// 従業員が自分で打刻できなかった場合に、管理者が代わりに出勤・退勤時刻を入力する。
// createManualTimeEntry(従業員本人用)とほぼ同じ検証だが、任意の従業員を指定できる点と
// 管理者権限が必要な点が異なる。
export async function createEntryForEmployee(
  _prevState: CreateEntryForEmployeeState,
  formData: FormData,
): Promise<CreateEntryForEmployeeState> {
  const session = await requireAdminSession();

  const employeeId = formData.get("employeeId");
  const siteId = formData.get("siteId");
  const dateStr = formData.get("date");
  const clockInTime = formData.get("clockInTime");
  const clockOutTime = formData.get("clockOutTime");
  const note = formData.get("note");
  const dailyReport = formData.get("dailyReport");

  if (typeof employeeId !== "string" || employeeId === "") {
    return { status: "error", message: "従業員を選択してください" };
  }
  if (typeof siteId !== "string" || siteId === "") {
    return { status: "error", message: "現場を選択してください" };
  }
  if (typeof dateStr !== "string" || dateStr === "") {
    return { status: "error", message: "日付を選択してください" };
  }
  if (typeof clockInTime !== "string" || typeof clockOutTime !== "string") {
    return { status: "error", message: "時刻を選択してください" };
  }

  const workDate = startOfDateString(dateStr);
  if (workDate.getTime() > startOfToday().getTime()) {
    return { status: "error", message: "未来の日付は追加できません" };
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) {
    return { status: "error", message: "従業員が見つかりません" };
  }
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) {
    return { status: "error", message: "現場が見つかりません" };
  }

  const newClockIn = combineDateAndTime(workDate, clockInTime);
  const newClockOut = combineDateAndTime(workDate, clockOutTime);
  if (newClockOut <= newClockIn) {
    return { status: "error", message: "退勤時刻は出勤時刻より後にしてください" };
  }

  const sameDayEntries = await prisma.timeEntry.findMany({ where: { employeeId, workDate } });
  const overlapping = sameDayEntries.some((e) => {
    if (!e.clockIn) return false;
    const existingEnd = e.clockOut ?? new Date(8640000000000000); // 退勤していない場合は無期限とみなす
    return rangesOverlap(newClockIn, newClockOut, e.clockIn, existingEnd);
  });
  if (overlapping) {
    return { status: "error", message: "同じ日の他の打刻と時間帯が重なっています" };
  }

  const validKeys = new Set(
    getBreakWindowsWithinSpan(workDate, newClockIn, newClockOut).map((w) => w.key),
  );
  const checked = checkedBreakKeysFromFormData(formData);
  const effectiveChecked = new Set([...checked].filter((k) => validKeys.has(k)));

  await prisma.timeEntry.create({
    data: {
      employeeId,
      siteId,
      workDate,
      clockIn: newClockIn,
      clockOut: newClockOut,
      originalClockIn: newClockIn,
      originalClockOut: newClockOut,
      isManuallyAdjusted: true,
      adjustedAt: new Date(),
      adjustmentNote: typeof note === "string" && note.trim() !== "" ? note.trim() : "管理者が代理で入力",
      adjustedByName: session.email,
      dailyReport: typeof dailyReport === "string" && dailyReport.trim() !== "" ? dailyReport.trim() : null,
      ...workedBreakFields(effectiveChecked),
    },
  });

  revalidatePath("/admin/reports");
  revalidatePath("/admin/entries/new");
  triggerBigQuerySyncInBackground();

  return {
    status: "success",
    message: `${employee.name} さんの打刻（${dateStr} ${clockInTime}〜${clockOutTime}、${site.name}）を追加しました。`,
  };
}

// --- 管理者: ホワイトリスト管理 ---

export async function getAllowedEmails() {
  await requireAdminSession();
  return prisma.allowedEmail.findMany({
    include: { employee: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function addAllowedEmail(formData: FormData) {
  await requireAdminSession();

  const email = formData.get("email");
  const employeeId = formData.get("employeeId");
  const newEmployeeName = formData.get("newEmployeeName");
  const isAdmin = formData.get("isAdmin") != null;

  if (typeof email !== "string" || email.trim() === "") {
    throw new Error("メールアドレスを入力してください");
  }

  const hasExistingSelection = typeof employeeId === "string" && employeeId !== "";
  const hasNewName = typeof newEmployeeName === "string" && newEmployeeName.trim() !== "";
  if (hasExistingSelection && hasNewName) {
    throw new Error("既存の従業員を選ぶか、新しい従業員名を入力するか、どちらか一方にしてください");
  }

  await prisma.$transaction(async (tx) => {
    let resolvedEmployeeId: string | null = hasExistingSelection ? (employeeId as string) : null;

    if (hasNewName) {
      const created = await tx.employee.create({
        data: { name: (newEmployeeName as string).trim() },
      });
      resolvedEmployeeId = created.id;
    }

    await tx.allowedEmail.create({
      data: {
        email: email.trim().toLowerCase(),
        isAdmin,
        employeeId: resolvedEmployeeId,
      },
    });
  });

  revalidatePath("/admin/whitelist");
}

// 既存のホワイトリスト登録の「従業員への紐付け」「管理者権限」を変更する。
// メールアドレス自体は変更不可（変更したい場合は削除して登録し直す）。
export async function updateAllowedEmail(id: string, formData: FormData) {
  await requireAdminSession();

  const employeeId = formData.get("employeeId");
  const newEmployeeName = formData.get("newEmployeeName");
  const isAdmin = formData.get("isAdmin") != null;

  const hasExistingSelection = typeof employeeId === "string" && employeeId !== "";
  const hasNewName = typeof newEmployeeName === "string" && newEmployeeName.trim() !== "";
  if (hasExistingSelection && hasNewName) {
    throw new Error("既存の従業員を選ぶか、新しい従業員名を入力するか、どちらか一方にしてください");
  }

  await prisma.$transaction(async (tx) => {
    let resolvedEmployeeId: string | null = hasExistingSelection ? (employeeId as string) : null;

    if (hasNewName) {
      const created = await tx.employee.create({
        data: { name: (newEmployeeName as string).trim() },
      });
      resolvedEmployeeId = created.id;
    }

    await tx.allowedEmail.update({
      where: { id },
      data: {
        isAdmin,
        employeeId: resolvedEmployeeId,
      },
    });
  });

  revalidatePath("/admin/whitelist");
}

export async function removeAllowedEmail(id: string): Promise<void> {
  await requireAdminSession();
  await prisma.allowedEmail.delete({ where: { id } });
  revalidatePath("/admin/whitelist");
}

// --- 管理者: レポート ---

// レポート画面の現場フィルタ用。過去のレポートも見られるよう非アクティブな現場も含める
// （getSitesは打刻用でisActiveのみを返すため、管理者はこちらを使う）。
export async function getSitesForAdmin() {
  await requireAdminSession();
  return prisma.site.findMany({ orderBy: { name: "asc" } });
}

export interface ReportFilters {
  siteId?: string;
  from: string; // "YYYY-MM-DD"
  to: string; // "YYYY-MM-DD"
}

export async function getReportEntries(filters: ReportFilters): Promise<ReportEntry[]> {
  await requireAdminSession();

  const entries = await prisma.timeEntry.findMany({
    where: {
      clockIn: { not: null },
      clockOut: { not: null },
      workDate: { gte: startOfDateString(filters.from), lte: startOfDateString(filters.to) },
      ...(filters.siteId ? { siteId: filters.siteId } : {}),
    },
    include: { employee: true, site: true },
    orderBy: [{ workDate: "asc" }, { clockIn: "asc" }],
  });

  return entries
    .filter((e) => e.clockIn && e.clockOut)
    .map((e) =>
      toReportEntry({
        id: e.id,
        employeeId: e.employeeId,
        employeeName: e.employee.name,
        siteId: e.siteId,
        siteName: e.site.name,
        workDate: e.workDate,
        clockIn: e.clockIn!,
        clockOut: e.clockOut!,
        workedBreak1: e.workedBreak1,
        workedBreak2: e.workedBreak2,
        workedBreak3: e.workedBreak3,
        dailyReport: e.dailyReport,
      }),
    );
}

// その現場（未指定なら全現場）で最初に打刻された日を返す。「全期間」表示の開始日に使う。
export async function getEarliestWorkDate(siteId?: string): Promise<Date | null> {
  await requireAdminSession();

  const earliest = await prisma.timeEntry.findFirst({
    where: {
      clockIn: { not: null },
      clockOut: { not: null },
      ...(siteId ? { siteId } : {}),
    },
    orderBy: { workDate: "asc" },
    select: { workDate: true },
  });

  return earliest?.workDate ?? null;
}

// --- 管理者: BigQuery連携 ---

export interface SyncBigQueryState {
  status: "idle" | "success" | "error";
  message: string;
}

export async function syncToBigQueryAction(
  _prevState: SyncBigQueryState,
  _formData: FormData,
): Promise<SyncBigQueryState> {
  await requireAdminSession();
  try {
    const { syncAllToBigQuery } = await import("@/lib/bigquery");
    const { timeEntries, sites } = await syncAllToBigQuery();
    return {
      status: "success",
      message: `打刻 ${timeEntries.rowCount}件（${timeEntries.datasetId}.${timeEntries.tableId}）、現場 ${sites.rowCount}件（${sites.datasetId}.${sites.tableId}）を同期しました。`,
    };
  } catch (error) {
    console.error("BigQuery sync failed", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "同期に失敗しました。",
    };
  }
}
