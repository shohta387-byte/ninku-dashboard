import { getSubcontractors, setSubcontractorActive } from "@/app/actions";
import { AddSubcontractorForm } from "./add-subcontractor-form";

export default async function SubcontractorsPage() {
  const subcontractors = await getSubcontractors();
  const active = subcontractors.filter((s) => s.isActive);
  const inactive = subcontractors.filter((s) => !s.isActive);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">外注会社の管理</h2>
        <p className="text-sm text-zinc-500">
          ここで登録した会社は、「従業員の打刻を代理入力」画面から選んで代理打刻できます。
          個々の作業員は区別せず、会社単位で人工を合算します。
        </p>
      </section>

      <SubcontractorTable title="登録中の外注会社" items={active} />
      {inactive.length > 0 && <SubcontractorTable title="無効化した外注会社" items={inactive} />}

      <section className="flex max-w-md flex-col gap-3">
        <h2 className="text-lg font-bold">新しく登録する</h2>
        <AddSubcontractorForm />
      </section>
    </div>
  );
}

function SubcontractorTable({
  title,
  items,
}: {
  title: string;
  items: { id: string; name: string; isActive: boolean }[];
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-bold text-zinc-500">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2">会社名</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id} className="border-t border-black/10 dark:border-white/10">
                <td className="px-4 py-2">{s.name}</td>
                <td className="px-4 py-2 text-right">
                  <form action={setSubcontractorActive.bind(null, s.id, !s.isActive)}>
                    <button type="submit" className="text-blue-600 underline">
                      {s.isActive ? "無効にする" : "有効にする"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-4 text-center text-zinc-500">
                  該当する外注会社はありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
