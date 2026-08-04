import { SyncButton } from "./sync-button";

export default function BigQueryPage() {
  return (
    <div className="flex max-w-md flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">BigQueryへの同期</h2>
        <p className="text-sm text-zinc-500">
          退勤済みの打刻を、従業員名・現場名・稼働時間・人工まで計算した状態でBigQueryのテーブルへ書き出します。
          押すたびに全件を作り直すので、常に最新の状態に洗い替えられます（現在進行中で退勤していない打刻は対象外です）。
        </p>
        <SyncButton />
      </section>
    </div>
  );
}
