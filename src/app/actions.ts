"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BREAK_WINDOWS, getBreakWindowsWithinSpan, type BreakKey } from "@/lib/ninku";
import { sumHours, sumNinku, toReportEntry, type ReportEntry } from "@/lib/report";
import { geocodeAddress, type GeocodeResult } from "@/lib/geocode";
import {
  createSession,
  destroySession,
  getSession,
  requireAdminSession,
  requireEmployeeSession,
} from "@/lib/session";
import {
  currentBillingPeriod,
  jstMidnightFromInputValue,
  jstDateTimeFromHHMM,
  toJstParts,
  todayInJst,
} from "@/lib/jst-date";

function startOfToday(): Date {
  return todayInJst();
}

// "YYYY-MM-DD" を日本時間のその日0時0分の絶対時刻に変換する
function startOfDateString(dateStr: string): Date {
  return jstMidnightFromInputValue(dateStr);
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

// 従業員に紐付いていない管理者専用アカウントが、自分自身も打刻できるようにする。
// 新しい従業員をその場で作り、自分のホワイトリスト登録に紐付けた上で、
// （次回ログインを待たず）今のセッションCookieも更新する。
export async function linkSelfAsEmployee(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.employeeId) {
    redirect("/");
  }

  const name = formData.get("name");
  if (typeof name !== "string" || name.trim() === "") {
    throw new Error("名前を入力してください");
  }

  const allowed = await prisma.allowedEmail.findUnique({ where: { email: session.email } });
  if (!allowed) {
    redirect("/login");
  }

  const employeeId =
    allowed.employeeId ??
    (
      await prisma.$transaction(async (tx) => {
        const created = await tx.employee.create({ data: { name: name.trim() } });
        await tx.allowedEmail.update({ where: { id: allowed.id }, data: { employeeId: created.id } });
        return created;
      })
    ).id;

  // employeeIdが変わったので、署名済みセッションCookieも作り直して即座に反映する。
  await createSession({ email: session.email, employeeId, isAdmin: session.isAdmin });

  revalidatePath("/admin/whitelist");
  redirect("/");
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

  // 位置情報は任意。入力されている場合のみ数値として検証する。
  const hasLocation = typeof lat === "string" && typeof lng === "string" && lat !== "" && lng !== "";
  let latNum: number | null = null;
  let lngNum: number | null = null;
  if (hasLocation) {
    latNum = Number(lat);
    lngNum = Number(lng);
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      return { status: "error", message: "位置情報が正しくありません" };
    }
  }

  if (!confirmDuplicate) {
    const existingSites = await prisma.site.findMany({ where: { isActive: true } });
    const normalizedNew = normalizeSiteName(name);
    const nameMatch = existingSites.find((s) => normalizeSiteName(s.name) === normalizedNew);
    const nearbyMatch =
      latNum !== null && lngNum !== null
        ? existingSites.find(
            (s) => s.lat !== null && s.lng !== null && distanceInMeters(s.lat, s.lng, latNum!, lngNum!) < 100,
          )
        : undefined;
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

// 退勤打刻が抜けたままの打刻（出勤はしたが退勤していない）。ホーム画面で目立たせて
// 修正を促すために使う。
// - 「本日分」は今まさに稼働中の可能性があるため対象外にする（誤って警告を出さないため）。
// - 今の締め期間より前のものは従業員が自分で直せないため対象外にする。
// （出勤したその日のうちに気づかず日をまたいでも、次の出勤時のチェックは「本日分」しか
// 見ていないため、古い抜け漏れが残り続けることがある）。
export async function getOpenEntriesForSelf() {
  const { employeeId } = await requireEmployeeSession();
  const { from } = currentBillingPeriod();
  return prisma.timeEntry.findMany({
    where: { employeeId, clockIn: { not: null }, clockOut: null, workDate: { gte: from, lt: startOfToday() } },
    include: { site: true },
    orderBy: { clockIn: "asc" },
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

// 今の締め期間(21日〜翌月20日)の全打刻。ログイン中の本人のものだけを返す
// （打刻一覧画面で、退勤し忘れなどを自分で直せるようにするため）。
export async function getMyEntriesForCurrentPeriod() {
  const { employeeId } = await requireEmployeeSession();
  const { from, to } = currentBillingPeriod();
  return prisma.timeEntry.findMany({
    where: { employeeId, workDate: { gte: from, lte: to } },
    include: { site: true },
    orderBy: [{ workDate: "desc" }, { clockIn: "desc" }],
  });
}

export interface DeleteEntryState {
  status: "idle" | "error";
  message: string;
}

// 従業員は自分の打刻を、今の締め期間(21日〜翌月20日)内に限り削除できる
// （それより前は集計・給与計算が締まっている想定のため変更させない）。管理者は期間の制限なく削除できる。
export async function deleteTimeEntry(
  entryId: string,
  _prevState: DeleteEntryState,
  _formData: FormData,
): Promise<DeleteEntryState> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const existing = await prisma.timeEntry.findUnique({ where: { id: entryId } });
  if (!existing) {
    return { status: "error", message: "打刻が見つかりません" };
  }

  if (existing.employeeId !== session.employeeId && !session.isAdmin) {
    return { status: "error", message: "この打刻を削除する権限がありません" };
  }

  if (!session.isAdmin) {
    const { from, to } = currentBillingPeriod();
    if (existing.workDate < from || existing.workDate > to) {
      return { status: "error", message: "今の締め期間（21日〜20日）より前の打刻は削除できません" };
    }
  }

  await prisma.timeEntry.delete({ where: { id: entryId } });
  revalidatePath("/entries");
  revalidatePath("/clock");
  triggerBigQuerySyncInBackground();
  return { status: "idle", message: "" };
}

export interface ClockInState {
  status: "idle" | "error";
  message: string;
}

// employeeIdはクライアントから受け取らず、必ずセッションから解決する
// （他人になりすまして打刻できないようにするため）。
export async function clockIn(
  siteId: string,
  _prevState: ClockInState,
  _formData: FormData,
): Promise<ClockInState> {
  const { employeeId } = await requireEmployeeSession();

  // 同時に2現場で稼働することはできないため、退勤していない打刻が残っていないか確認する。
  const openEntry = await prisma.timeEntry.findFirst({
    where: { employeeId, workDate: startOfToday(), clockOut: null },
  });
  if (openEntry) {
    return { status: "error", message: "すでに退勤していない打刻があります。先に退勤してください" };
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
  return { status: "idle", message: "" };
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

export interface ClockOutState {
  status: "idle" | "error";
  message: string;
}

export async function clockOut(
  entryId: string,
  _prevState: ClockOutState,
  formData: FormData,
): Promise<ClockOutState> {
  const { employeeId } = await requireEmployeeSession();
  const existing = await prisma.timeEntry.findUniqueOrThrow({ where: { id: entryId } });
  if (existing.employeeId !== employeeId) {
    return { status: "error", message: "この打刻を操作する権限がありません" };
  }
  if (!existing.clockIn) {
    return { status: "error", message: "出勤していません" };
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
  return { status: "idle", message: "" };
}

export interface MoveToNextSiteState {
  status: "idle" | "error";
  message: string;
}

// 現在稼働中の現場を退勤すると同時に、選んだ次の現場の出勤を同じ時刻で作成する。
// 従来の「退勤→現場選択→出勤」という2アクションを1操作にまとめ、片方だけ押し忘れて
// 次の現場の打刻が丸ごと抜ける事故を防ぐ。移動時間は「次の現場での稼働時間」とみなす
// 仕様のため、退勤・出勤には必ず同じ時刻(now)を使う。
export async function moveToNextSite(
  entryId: string,
  _prevState: MoveToNextSiteState,
  formData: FormData,
): Promise<MoveToNextSiteState> {
  const { employeeId } = await requireEmployeeSession();

  const nextSiteId = formData.get("nextSiteId");
  if (typeof nextSiteId !== "string" || nextSiteId === "") {
    return { status: "error", message: "次の現場を選択してください" };
  }

  const existing = await prisma.timeEntry.findUniqueOrThrow({ where: { id: entryId } });
  if (existing.employeeId !== employeeId) {
    return { status: "error", message: "この打刻を操作する権限がありません" };
  }
  if (!existing.clockIn || existing.clockOut) {
    return { status: "error", message: "退勤していない打刻が見つかりません" };
  }

  const nextSite = await prisma.site.findUnique({ where: { id: nextSiteId } });
  if (!nextSite) {
    return { status: "error", message: "現場が見つかりません" };
  }
  if (nextSiteId === existing.siteId) {
    return { status: "error", message: "現在と同じ現場が選択されています。違う現場を選ぶか、通常の「退勤」を使ってください" };
  }

  const now = new Date();
  const validKeys = new Set(
    getBreakWindowsWithinSpan(existing.workDate, existing.clockIn, now).map((w) => w.key),
  );
  const checked = checkedBreakKeysFromFormData(formData);
  const effectiveChecked = new Set([...checked].filter((k) => validKeys.has(k)));
  const dailyReport = formData.get("dailyReport");

  await prisma.$transaction([
    prisma.timeEntry.update({
      where: { id: entryId },
      data: {
        clockOut: now,
        originalClockOut: now,
        ...workedBreakFields(effectiveChecked),
        dailyReport: typeof dailyReport === "string" && dailyReport.trim() !== "" ? dailyReport.trim() : null,
      },
    }),
    prisma.timeEntry.create({
      data: {
        employeeId,
        siteId: nextSiteId,
        workDate: startOfToday(),
        clockIn: now,
        originalClockIn: now,
      },
    }),
  ]);

  revalidatePath("/clock");
  revalidatePath("/entries");
  triggerBigQuerySyncInBackground();
  redirect(`/clock?siteId=${nextSiteId}`);
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// リアルタイムで打刻できなかった分を後から手動で追加する。
export interface ManualEntryState {
  status: "idle" | "error";
  message: string;
}

// 打刻を後から手動で追加するフォームは、「+現場を追加」で複数の現場・時間帯を
// まとめて1回の送信で登録できる。各ブロックのフィールドは name="siteId-0", "siteId-1"...
// のようにインデックス付きで送られてくるため、ここでブロック単位に組み立て直す。
interface ManualEntryBlockInput {
  index: number;
  siteId: string;
  workDate: Date;
  clockIn: Date;
  clockOut: Date;
  checked: Set<BreakKey>;
  note: string | null;
  dailyReport: string | null;
}

export async function createManualTimeEntry(
  _prevState: ManualEntryState,
  formData: FormData,
): Promise<ManualEntryState> {
  const { employeeId } = await requireEmployeeSession();

  const indices = [...new Set(
    [...formData.keys()]
      .map((key) => key.match(/^siteId-(\d+)$/)?.[1])
      .filter((v): v is string => v !== undefined)
      .map(Number),
  )].sort((a, b) => a - b);

  if (indices.length === 0) {
    return { status: "error", message: "現場を選択してください" };
  }

  const blocks: ManualEntryBlockInput[] = [];
  for (const i of indices) {
    const label = indices.length > 1 ? `${i + 1}件目: ` : "";
    const siteId = formData.get(`siteId-${i}`);
    const dateStr = formData.get(`date-${i}`);
    const clockInTime = formData.get(`clockInTime-${i}`);
    const clockOutTime = formData.get(`clockOutTime-${i}`);

    if (typeof siteId !== "string" || siteId === "") {
      return { status: "error", message: `${label}現場を選択してください` };
    }
    if (typeof dateStr !== "string" || dateStr === "") {
      return { status: "error", message: `${label}日付を選択してください` };
    }
    if (typeof clockInTime !== "string" || typeof clockOutTime !== "string") {
      return { status: "error", message: `${label}時刻を選択してください` };
    }

    const workDate = startOfDateString(dateStr);
    if (workDate.getTime() > startOfToday().getTime()) {
      return { status: "error", message: `${label}未来の日付は追加できません` };
    }

    const clockIn = combineDateAndTime(workDate, clockInTime);
    const clockOut = combineDateAndTime(workDate, clockOutTime);
    if (clockOut <= clockIn) {
      return { status: "error", message: `${label}退勤時刻は出勤時刻より後にしてください` };
    }

    const note = formData.get(`note-${i}`);
    const dailyReport = formData.get(`dailyReport-${i}`);
    const checked = new Set<BreakKey>(
      BREAK_WINDOWS.map((w) => w.key).filter((key) => formData.get(`${key}-${i}`) != null),
    );

    blocks.push({
      index: i,
      siteId,
      workDate,
      clockIn,
      clockOut,
      checked,
      note: typeof note === "string" && note.trim() !== "" ? note.trim() : null,
      dailyReport: typeof dailyReport === "string" && dailyReport.trim() !== "" ? dailyReport.trim() : null,
    });
  }

  const multi = blocks.length > 1;
  const labelFor = (i: number) => (multi ? `${i + 1}件目: ` : "");

  const sites = await prisma.site.findMany({ where: { id: { in: [...new Set(blocks.map((b) => b.siteId))] } } });
  const siteMap = new Map(sites.map((s) => [s.id, s]));
  for (const b of blocks) {
    if (!siteMap.has(b.siteId)) {
      return { status: "error", message: `${labelFor(b.index)}現場が見つかりません` };
    }
  }

  // 同じ日の既存の打刻、および今回まとめて追加しようとしているブロック同士で
  // 時間帯が重なっていないか確認する（同時に2現場では働けないため）。
  const workDates = [...new Set(blocks.map((b) => b.workDate.getTime()))].map((t) => new Date(t));
  const existingEntries = await prisma.timeEntry.findMany({
    where: { employeeId, workDate: { in: workDates } },
  });

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const overlapsExisting = existingEntries.some((e) => {
      if (e.workDate.getTime() !== b.workDate.getTime() || !e.clockIn) return false;
      const existingEnd = e.clockOut ?? new Date(8640000000000000); // 退勤していない場合は無期限とみなす
      return rangesOverlap(b.clockIn, b.clockOut, e.clockIn, existingEnd);
    });
    if (overlapsExisting) {
      return { status: "error", message: `${labelFor(b.index)}同じ日の他の打刻と時間帯が重なっています` };
    }
    for (let j = 0; j < i; j++) {
      const other = blocks[j];
      if (
        other.workDate.getTime() === b.workDate.getTime() &&
        rangesOverlap(b.clockIn, b.clockOut, other.clockIn, other.clockOut)
      ) {
        return {
          status: "error",
          message: `${b.index + 1}件目が${other.index + 1}件目と時間帯が重なっています`,
        };
      }
    }
  }

  const session = await getSession();

  await prisma.$transaction(
    blocks.map((b) => {
      const validKeys = new Set(getBreakWindowsWithinSpan(b.workDate, b.clockIn, b.clockOut).map((w) => w.key));
      const effectiveChecked = new Set([...b.checked].filter((k) => validKeys.has(k)));
      return prisma.timeEntry.create({
        data: {
          employeeId,
          siteId: b.siteId,
          workDate: b.workDate,
          clockIn: b.clockIn,
          clockOut: b.clockOut,
          isManuallyAdjusted: true,
          adjustedAt: new Date(),
          adjustmentNote: b.note ?? "手動追加",
          adjustedByName: session?.email,
          dailyReport: b.dailyReport,
          ...workedBreakFields(effectiveChecked),
        },
      });
    }),
  );

  revalidatePath("/clock");
  revalidatePath("/entries");
  triggerBigQuerySyncInBackground();
  redirect(`/clock?siteId=${blocks[blocks.length - 1].siteId}`);
}

type AdjustTimeEntryResult =
  | { ok: true; entry: Awaited<ReturnType<typeof prisma.timeEntry.update>> }
  | { ok: false; message: string };

export async function adjustTimeEntry(
  entryId: string,
  newClockIn: Date,
  newClockOut: Date,
  newSiteId?: string,
  note?: string,
  dailyReport?: string,
): Promise<AdjustTimeEntryResult> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  if (newClockOut <= newClockIn) {
    return { ok: false, message: "退勤時刻は出勤時刻より後にしてください" };
  }

  const existing = await prisma.timeEntry.findUniqueOrThrow({ where: { id: entryId } });
  // 本人の打刻、または管理者のみ補正できる。
  if (existing.employeeId !== session.employeeId && !session.isAdmin) {
    return { ok: false, message: "この打刻を修正する権限がありません" };
  }

  // 従業員本人による修正は、今の締め期間(21日〜翌月20日)内の打刻のみ許可する
  // （それより前は集計・給与計算が締まっている想定のため）。管理者は制限なし。
  if (!session.isAdmin) {
    const { from, to } = currentBillingPeriod();
    if (existing.workDate < from || existing.workDate > to) {
      return { ok: false, message: "今の締め期間（21日〜20日）より前の打刻は修正できません" };
    }
  }

  const resolvedSiteId = newSiteId && newSiteId !== "" ? newSiteId : existing.siteId;
  if (resolvedSiteId !== existing.siteId) {
    const site = await prisma.site.findUnique({ where: { id: resolvedSiteId } });
    if (!site) {
      return { ok: false, message: "現場が見つかりません" };
    }
  }

  const now = new Date();
  const [entry] = await prisma.$transaction([
    prisma.timeEntry.update({
      where: { id: entryId },
      data: {
        clockIn: newClockIn,
        clockOut: newClockOut,
        siteId: resolvedSiteId,
        isManuallyAdjusted: true,
        adjustedAt: now,
        adjustmentNote: note,
        adjustedByName: session.email,
        dailyReport: dailyReport ?? null,
        // 初回の補正時のみ、補正前の元の打刻を退避する（監査用）
        ...(existing.isManuallyAdjusted
          ? {}
          : { originalClockIn: existing.clockIn, originalClockOut: existing.clockOut }),
      },
    }),
    prisma.timeEntryAdjustmentLog.create({
      data: {
        timeEntryId: entryId,
        adjustedByEmail: session.email,
        reason: note ?? null,
        beforeClockIn: existing.clockIn,
        afterClockIn: newClockIn,
        beforeClockOut: existing.clockOut,
        afterClockOut: newClockOut,
        beforeSiteId: existing.siteId,
        afterSiteId: resolvedSiteId,
      },
    }),
  ]);

  revalidatePath("/clock");
  revalidatePath("/entries");
  revalidatePath(`/entries/${entryId}/edit`);
  revalidatePath(`/admin/entries/${entryId}`);
  triggerBigQuerySyncInBackground();
  return { ok: true, entry };
}

// "HH:MM" 形式の文字列を、baseDateと同じ日本時間の日付・指定時刻を持つ絶対時刻に変換する
function combineDateAndTime(baseDate: Date, hhmm: string): Date {
  const { year, month, day } = toJstParts(baseDate);
  return jstDateTimeFromHHMM({ year, month, day }, hhmm);
}

export interface AdjustEntryState {
  status: "idle" | "error";
  message: string;
}

// /entries/[id]/edit のフォーム(useActionState)から呼び出すためのラッパー。
// フォームは時刻文字列(HH:MM)しか渡せないため、ここでDateに組み立ててadjustTimeEntryに委譲する。
export async function adjustTimeEntryForm(
  entryId: string,
  _prevState: AdjustEntryState,
  formData: FormData,
): Promise<AdjustEntryState> {
  const clockInTime = formData.get("clockInTime");
  const clockOutTime = formData.get("clockOutTime");
  const siteId = formData.get("siteId");
  const note = formData.get("note");
  const dailyReport = formData.get("dailyReport");

  if (typeof clockInTime !== "string" || typeof clockOutTime !== "string") {
    return { status: "error", message: "時刻を選択してください" };
  }

  const existing = await prisma.timeEntry.findUniqueOrThrow({ where: { id: entryId } });
  const newClockIn = combineDateAndTime(existing.workDate, clockInTime);
  const newClockOut = combineDateAndTime(existing.workDate, clockOutTime);

  const result = await adjustTimeEntry(
    entryId,
    newClockIn,
    newClockOut,
    typeof siteId === "string" && siteId !== "" ? siteId : undefined,
    typeof note === "string" && note.length > 0 ? note : undefined,
    typeof dailyReport === "string" && dailyReport.trim() !== "" ? dailyReport.trim() : undefined,
  );

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  redirect(`/clock?siteId=${result.entry.siteId}`);
}

// --- 現場の切り替わり（ペア）修正 ---

// ペア修正の対象2件を取得する。本人の打刻同士、または管理者なら誰の打刻でも取得できる。
export async function getEntryPairForCorrection(entryAId: string, entryBId: string) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [entryA, entryB] = await Promise.all([
    prisma.timeEntry.findUnique({ where: { id: entryAId }, include: { site: true } }),
    prisma.timeEntry.findUnique({ where: { id: entryBId }, include: { site: true } }),
  ]);
  if (!entryA || !entryB) return null;

  // 他人の打刻の場合はnullを返す（ページ側は「見つからない」場合と同じnotFound()にする）。
  if (!session.isAdmin && (entryA.employeeId !== session.employeeId || entryB.employeeId !== session.employeeId)) {
    return null;
  }

  return { entryA, entryB };
}

export interface AdjustPairState {
  status: "idle" | "error";
  message: string;
}

// 「A現場の退勤時刻」と「B現場の出勤時刻」をセットで直す。通常は移動時間を含めて同じ時刻に
// 揃える運用だが、実際に時間差があった場合のために個別の時刻も指定できる。
export async function adjustEntryPair(
  entryAId: string,
  entryBId: string,
  _prevState: AdjustPairState,
  formData: FormData,
): Promise<AdjustPairState> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const clockOutATime = formData.get("clockOutATime");
  const clockInBTime = formData.get("clockInBTime");
  const reason = formData.get("reason");
  const returnTo = formData.get("returnTo");

  if (typeof clockOutATime !== "string" || typeof clockInBTime !== "string") {
    return { status: "error", message: "時刻を選択してください" };
  }

  const [entryA, entryB] = await Promise.all([
    prisma.timeEntry.findUniqueOrThrow({ where: { id: entryAId } }),
    prisma.timeEntry.findUniqueOrThrow({ where: { id: entryBId } }),
  ]);

  for (const entry of [entryA, entryB]) {
    if (entry.employeeId !== session.employeeId && !session.isAdmin) {
      return { status: "error", message: "この打刻を修正する権限がありません" };
    }
  }

  if (!session.isAdmin) {
    const { from, to } = currentBillingPeriod();
    for (const entry of [entryA, entryB]) {
      if (entry.workDate < from || entry.workDate > to) {
        return { status: "error", message: "今の締め期間（21日〜20日）より前の打刻は修正できません" };
      }
    }
  }

  if (!entryA.clockIn) {
    return { status: "error", message: "A現場の出勤時刻が確定していません" };
  }

  const newClockOutA = combineDateAndTime(entryA.workDate, clockOutATime);
  const newClockInB = combineDateAndTime(entryB.workDate, clockInBTime);

  if (newClockOutA <= entryA.clockIn) {
    return { status: "error", message: "A現場の退勤時刻は出勤時刻より後にしてください" };
  }
  if (entryB.clockOut && newClockInB >= entryB.clockOut) {
    return { status: "error", message: "B現場の出勤時刻は退勤時刻より前にしてください" };
  }
  if (newClockOutA > newClockInB) {
    return { status: "error", message: "A現場の退勤時刻はB現場の出勤時刻より後にはできません" };
  }

  const reasonValue = typeof reason === "string" && reason.trim() !== "" ? reason.trim() : null;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.timeEntry.update({
      where: { id: entryAId },
      data: {
        clockOut: newClockOutA,
        isManuallyAdjusted: true,
        adjustedAt: now,
        adjustmentNote: reasonValue ?? "現場切り替えのペア修正",
        adjustedByName: session.email,
        ...(entryA.isManuallyAdjusted
          ? {}
          : { originalClockIn: entryA.clockIn, originalClockOut: entryA.clockOut }),
      },
    });
    await tx.timeEntry.update({
      where: { id: entryBId },
      data: {
        clockIn: newClockInB,
        isManuallyAdjusted: true,
        adjustedAt: now,
        adjustmentNote: reasonValue ?? "現場切り替えのペア修正",
        adjustedByName: session.email,
        ...(entryB.isManuallyAdjusted
          ? {}
          : { originalClockIn: entryB.clockIn, originalClockOut: entryB.clockOut }),
      },
    });

    const logA = await tx.timeEntryAdjustmentLog.create({
      data: {
        timeEntryId: entryAId,
        adjustedByEmail: session.email,
        reason: reasonValue,
        beforeClockOut: entryA.clockOut,
        afterClockOut: newClockOutA,
      },
    });
    const logB = await tx.timeEntryAdjustmentLog.create({
      data: {
        timeEntryId: entryBId,
        adjustedByEmail: session.email,
        reason: reasonValue,
        beforeClockIn: entryB.clockIn,
        afterClockIn: newClockInB,
        pairedLogId: logA.id,
      },
    });
    await tx.timeEntryAdjustmentLog.update({ where: { id: logA.id }, data: { pairedLogId: logB.id } });
  });

  revalidatePath("/clock");
  revalidatePath("/entries");
  revalidatePath(`/admin/entries/${entryAId}`);
  revalidatePath(`/admin/entries/${entryBId}`);
  triggerBigQuerySyncInBackground();
  redirect(typeof returnTo === "string" && returnTo !== "" ? returnTo : "/entries");
}

// --- 修正の監査ログ ---

// 打刻詳細ページ用。その打刻に対する全ての修正履歴を新しい順で返す。
export async function getAdjustmentLogsForEntry(entryId: string) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const entry = await prisma.timeEntry.findUnique({ where: { id: entryId } });
  if (!entry) return [];
  if (entry.employeeId !== session.employeeId && !session.isAdmin) {
    return [];
  }
  return prisma.timeEntryAdjustmentLog.findMany({
    where: { timeEntryId: entryId },
    orderBy: { createdAt: "desc" },
  });
}

export interface AdjustmentLogFilters {
  employeeId?: string;
  from: string; // "YYYY-MM-DD"（対象打刻のworkDateで絞り込む）
  to: string; // "YYYY-MM-DD"
}

// 管理画面の「修正履歴」一覧ページ用。対象打刻の勤務日(workDate)・従業員で絞り込む。
export async function getAdjustmentLogs(filters: AdjustmentLogFilters) {
  await requireAdminSession();
  return prisma.timeEntryAdjustmentLog.findMany({
    where: {
      timeEntry: {
        workDate: { gte: startOfDateString(filters.from), lte: startOfDateString(filters.to) },
        ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      },
    },
    include: { timeEntry: { include: { employee: true, site: true } } },
    orderBy: { createdAt: "desc" },
  });
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

// 管理者画面の打刻詳細ページ用。ペア修正の入口を出すため、同じ従業員・同じ日の
// 他の打刻（隣接判定に使う）を合わせて返す。
export async function getEntriesForEmployeeDay(employeeId: string, workDate: Date) {
  await requireAdminSession();
  return prisma.timeEntry.findMany({
    where: { employeeId, workDate },
    orderBy: { clockIn: "asc" },
  });
}

export async function getTimeEntryById(entryId: string) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const entry = await prisma.timeEntry.findUnique({ where: { id: entryId } });
  // 他人の打刻の場合はnullを返す（呼び出し側は「見つからない」場合と同じ扱いをする）。
  // 例外を投げると、フォーム操作ではなくページ読み込み時点でNext.jsの汎用エラー画面になってしまうため。
  if (entry && entry.employeeId !== session.employeeId && !session.isAdmin) {
    return null;
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

export interface AllowedEmailState {
  status: "idle" | "error" | "success";
  message: string;
}

function isDuplicateEmailError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function addAllowedEmail(
  _prevState: AllowedEmailState,
  formData: FormData,
): Promise<AllowedEmailState> {
  await requireAdminSession();

  const email = formData.get("email");
  const employeeId = formData.get("employeeId");
  const newEmployeeName = formData.get("newEmployeeName");
  const isAdmin = formData.get("isAdmin") != null;

  if (typeof email !== "string" || email.trim() === "") {
    return { status: "error", message: "メールアドレスを入力してください" };
  }

  const hasExistingSelection = typeof employeeId === "string" && employeeId !== "";
  const hasNewName = typeof newEmployeeName === "string" && newEmployeeName.trim() !== "";
  if (hasExistingSelection && hasNewName) {
    return {
      status: "error",
      message: "既存の従業員を選ぶか、新しい従業員名を入力するか、どちらか一方にしてください",
    };
  }

  try {
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
  } catch (error) {
    if (isDuplicateEmailError(error)) {
      return { status: "error", message: "このメールアドレスはすでに登録されています" };
    }
    throw error;
  }

  revalidatePath("/admin/whitelist");
  return { status: "success", message: `${email.trim().toLowerCase()} を追加しました。` };
}

// 既存のホワイトリスト登録の「従業員への紐付け」「管理者権限」を変更する。
// メールアドレス自体は変更不可（変更したい場合は削除して登録し直す）。
export async function updateAllowedEmail(
  id: string,
  _prevState: AllowedEmailState,
  formData: FormData,
): Promise<AllowedEmailState> {
  await requireAdminSession();

  const employeeId = formData.get("employeeId");
  const newEmployeeName = formData.get("newEmployeeName");
  const isAdmin = formData.get("isAdmin") != null;

  const hasExistingSelection = typeof employeeId === "string" && employeeId !== "";
  const hasNewName = typeof newEmployeeName === "string" && newEmployeeName.trim() !== "";
  if (hasExistingSelection && hasNewName) {
    return {
      status: "error",
      message: "既存の従業員を選ぶか、新しい従業員名を入力するか、どちらか一方にしてください",
    };
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
  return { status: "success", message: "保存しました。" };
}

export interface UpdateEmployeeNameState {
  status: "idle" | "error" | "success";
  message: string;
}

// ホワイトリスト画面から、既に紐付いている従業員の名前そのものを変更する（表記ゆれの修正など）。
// メールアドレスとの紐付け自体は変えない。従業員名はBigQueryの打刻テーブルにも
// 非正規化して持たせているため、変更のたびに再同期する。
export async function updateEmployeeName(
  employeeId: string,
  _prevState: UpdateEmployeeNameState,
  formData: FormData,
): Promise<UpdateEmployeeNameState> {
  await requireAdminSession();

  const name = formData.get("name");
  if (typeof name !== "string" || name.trim() === "") {
    return { status: "error", message: "名前を入力してください" };
  }

  await prisma.employee.update({ where: { id: employeeId }, data: { name: name.trim() } });

  revalidatePath("/admin/whitelist");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/sites");
  revalidatePath("/admin/reminder-emails");
  revalidatePath("/admin/adjustment-logs");
  triggerBigQuerySyncInBackground();

  return { status: "success", message: "名前を変更しました。" };
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

// --- 管理者: 喚起メール ---

// 稼働中の従業員を、喚起メールの送信可否を設定する画面用に返す。
// メールはホワイトリストに登録されたGoogleアカウントのアドレスへ送るため、
// 紐付けがない従業員は一覧には出すが送信対象にはできない。
export async function getEmployeesForReminderSettings() {
  await requireAdminSession();
  return prisma.employee.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: { allowedEmail: true },
  });
}

export async function setReminderEmailEnabled(employeeId: string, enabled: boolean): Promise<void> {
  await requireAdminSession();
  await prisma.employee.update({ where: { id: employeeId }, data: { reminderEmailEnabled: enabled } });
  revalidatePath("/admin/reminder-emails");
}
