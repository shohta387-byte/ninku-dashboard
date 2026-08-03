import { Readable } from "stream";
import { BigQuery, type Table } from "@google-cloud/bigquery";
import { prisma } from "@/lib/prisma";
import { calculateNinkuForEntry, getWorkedBreakKeysFromEntry } from "@/lib/ninku";
import { toJstInputValue } from "@/lib/jst-date";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} が設定されていません。.env を確認し、BigQueryを使うGoogle Cloudプロジェクトの情報を設定してください。`,
    );
  }
  return value;
}

const DATASET_ID = process.env.BIGQUERY_DATASET || "ninku_system";
const TIME_ENTRY_TABLE_ID = "time_entries";
const SITE_TABLE_ID = "sites";
const LOCATION = process.env.BIGQUERY_LOCATION || "asia-northeast1";

function getClient(): BigQuery {
  const projectId = requireEnv("BIGQUERY_PROJECT_ID");

  // Vercelなどサーバーレス環境ではローカルに鍵ファイルを置けないため、
  // サービスアカウントキーのJSON本文をそのまま環境変数(GOOGLE_APPLICATION_CREDENTIALS_JSON)
  // に入れられるようにする。ローカル開発では従来通りGOOGLE_APPLICATION_CREDENTIALS(ファイルパス)
  // をライブラリが自動で読み込む。
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (credentialsJson) {
    let credentials: Record<string, unknown>;
    try {
      credentials = JSON.parse(credentialsJson);
    } catch {
      throw new Error(
        "GOOGLE_APPLICATION_CREDENTIALS_JSON の中身がJSONとして解析できません。サービスアカウント鍵ファイルの内容をそのまま貼り付けてください。",
      );
    }
    return new BigQuery({ projectId, credentials });
  }

  return new BigQuery({ projectId });
}

type BqFieldType = "STRING" | "TIMESTAMP" | "DATE" | "FLOAT" | "BOOLEAN";
interface BqField {
  name: string;
  type: BqFieldType;
  mode: "REQUIRED" | "NULLABLE";
}

const TIME_ENTRY_SCHEMA: BqField[] = [
  { name: "entry_id", type: "STRING", mode: "REQUIRED" },
  { name: "employee_id", type: "STRING", mode: "REQUIRED" },
  { name: "employee_name", type: "STRING", mode: "REQUIRED" },
  { name: "site_id", type: "STRING", mode: "REQUIRED" },
  { name: "site_name", type: "STRING", mode: "REQUIRED" },
  { name: "work_date", type: "DATE", mode: "REQUIRED" },
  { name: "clock_in", type: "TIMESTAMP", mode: "REQUIRED" },
  { name: "clock_out", type: "TIMESTAMP", mode: "REQUIRED" },
  { name: "worked_hours", type: "FLOAT", mode: "REQUIRED" },
  { name: "regular_hours", type: "FLOAT", mode: "REQUIRED" },
  { name: "overtime_hours", type: "FLOAT", mode: "REQUIRED" },
  { name: "regular_ninku", type: "FLOAT", mode: "REQUIRED" },
  { name: "overtime_ninku", type: "FLOAT", mode: "REQUIRED" },
  { name: "total_ninku", type: "FLOAT", mode: "REQUIRED" },
  { name: "worked_break1", type: "BOOLEAN", mode: "REQUIRED" },
  { name: "worked_break2", type: "BOOLEAN", mode: "REQUIRED" },
  { name: "worked_break3", type: "BOOLEAN", mode: "REQUIRED" },
  { name: "is_manually_adjusted", type: "BOOLEAN", mode: "REQUIRED" },
  { name: "synced_at", type: "TIMESTAMP", mode: "REQUIRED" },
];

const SITE_SCHEMA: BqField[] = [
  { name: "site_id", type: "STRING", mode: "REQUIRED" },
  { name: "name", type: "STRING", mode: "REQUIRED" },
  { name: "lat", type: "FLOAT", mode: "NULLABLE" },
  { name: "lng", type: "FLOAT", mode: "NULLABLE" },
  { name: "is_active", type: "BOOLEAN", mode: "REQUIRED" },
  { name: "created_at", type: "TIMESTAMP", mode: "REQUIRED" },
  { name: "synced_at", type: "TIMESTAMP", mode: "REQUIRED" },
];

function toBigQueryDate(date: Date): string {
  return toJstInputValue(date);
}

export interface SyncResult {
  rowCount: number;
  datasetId: string;
  tableId: string;
}

// NDJSON形式でロードジョブとして読み込む(streaming insertは課金設定の無いプロジェクトでは
// 「Streaming insert is not allowed in the free tier」で拒否されるため使わない)。
function loadRowsViaJob(
  table: Table,
  schema: BqField[],
  rows: Record<string, unknown>[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = table.createWriteStream({
      sourceFormat: "NEWLINE_DELIMITED_JSON",
      schema: { fields: schema },
      writeDisposition: "WRITE_TRUNCATE",
    });
    stream.on("error", reject);
    stream.on("complete", () => resolve());
    const ndjson = rows.map((row) => JSON.stringify(row)).join("\n");
    Readable.from([ndjson]).pipe(stream);
  });
}

async function ensureDatasetAndFreshTable(
  bigquery: BigQuery,
  tableId: string,
  schema: BqField[],
): Promise<Table> {
  const dataset = bigquery.dataset(DATASET_ID);
  const [datasetExists] = await dataset.exists();
  if (!datasetExists) {
    await bigquery.createDataset(DATASET_ID, { location: LOCATION });
  }

  const table = dataset.table(tableId);
  const [tableExists] = await table.exists();
  if (tableExists) {
    await table.delete();
  }
  await dataset.createTable(tableId, { schema });
  return table;
}

// TimeEntry(退勤済みのもの)を人工計算した上でBigQueryへ全件洗い替えする。
// 件数が小規模な社内システム向けの想定で、都度テーブルを作り直す単純な方式にしている。
export async function syncTimeEntriesToBigQuery(): Promise<SyncResult> {
  const bigquery = getClient();
  const table = await ensureDatasetAndFreshTable(bigquery, TIME_ENTRY_TABLE_ID, TIME_ENTRY_SCHEMA);

  const entries = await prisma.timeEntry.findMany({
    where: { clockIn: { not: null }, clockOut: { not: null } },
    include: { employee: true, site: true },
    orderBy: { workDate: "asc" },
  });

  const syncedAt = new Date().toISOString();
  const rows = entries
    .filter((e) => e.clockIn && e.clockOut)
    .map((e) => {
      const workedBreakKeys = getWorkedBreakKeysFromEntry(e);
      const result = calculateNinkuForEntry(e.clockIn!, e.clockOut!, workedBreakKeys);
      return {
        entry_id: e.id,
        employee_id: e.employeeId,
        employee_name: e.employee.name,
        site_id: e.siteId,
        site_name: e.site.name,
        work_date: toBigQueryDate(e.workDate),
        clock_in: e.clockIn!.toISOString(),
        clock_out: e.clockOut!.toISOString(),
        worked_hours: result.workedHours,
        regular_hours: result.regularHours,
        overtime_hours: result.overtimeHours,
        regular_ninku: result.regularNinku,
        overtime_ninku: result.overtimeNinku,
        total_ninku: result.totalNinku,
        worked_break1: e.workedBreak1,
        worked_break2: e.workedBreak2,
        worked_break3: e.workedBreak3,
        is_manually_adjusted: e.isManuallyAdjusted,
        synced_at: syncedAt,
      };
    });

  if (rows.length > 0) {
    await loadRowsViaJob(table, TIME_ENTRY_SCHEMA, rows);
  }

  return { rowCount: rows.length, datasetId: DATASET_ID, tableId: TIME_ENTRY_TABLE_ID };
}

// 現場マスタ（緯度経度・稼働状態を含む）をBigQueryへ全件洗い替えする。
// time_entriesには現場名しか入っていないため、地図分析や稼働中/過去の現場での
// フィルタをBigQuery側だけで完結させたい場合はこちらを使う。
export async function syncSitesToBigQuery(): Promise<SyncResult> {
  const bigquery = getClient();
  const table = await ensureDatasetAndFreshTable(bigquery, SITE_TABLE_ID, SITE_SCHEMA);

  const sites = await prisma.site.findMany({ orderBy: { name: "asc" } });
  const syncedAt = new Date().toISOString();
  const rows = sites.map((s) => ({
    site_id: s.id,
    name: s.name,
    lat: s.lat,
    lng: s.lng,
    is_active: s.isActive,
    created_at: s.createdAt.toISOString(),
    synced_at: syncedAt,
  }));

  if (rows.length > 0) {
    await loadRowsViaJob(table, SITE_SCHEMA, rows);
  }

  return { rowCount: rows.length, datasetId: DATASET_ID, tableId: SITE_TABLE_ID };
}

export async function syncAllToBigQuery(): Promise<{ timeEntries: SyncResult; sites: SyncResult }> {
  const [timeEntries, sites] = await Promise.all([
    syncTimeEntriesToBigQuery(),
    syncSitesToBigQuery(),
  ]);
  return { timeEntries, sites };
}
