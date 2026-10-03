import { getContractorsWithSites, renameContractor, setContractorActive, setSiteContractor } from "@/app/actions";
import { AddContractorForm } from "./add-contractor-form";

type ContractorOption = { id: string; name: string; isActive: boolean };
type SiteRow = { id: string; name: string; isActive: boolean; contractorId: string | null };

export default async function ContractorsPage() {
  const { contractors, unassignedSites } = await getContractorsWithSites();
  const options: ContractorOption[] = contractors.map(({ id, name, isActive }) => ({ id, name, isActive }));

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">元請けの管理</h2>
        <p className="text-sm text-zinc-500">
          現場を元請けごとにまとめると、現場選択で元請けから探せるようになり、同じ名前の現場も
          「現場名（元請け名）」で見分けられるようになります。各現場の「元請け」を選んで「変更」を押してください。
        </p>
      </section>

      <section className="flex max-w-md flex-col gap-3">
        <h3 className="text-sm font-bold text-zinc-500">元請けを登録する</h3>
        <AddContractorForm />
      </section>

      {unassignedSites.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-base font-bold">
            元請け未設定の現場
            <span className="ml-2 text-sm font-normal text-zinc-500">{unassignedSites.length}現場</span>
          </h3>
          <SiteTable sites={unassignedSites} options={options} />
        </section>
      )}

      {contractors.map((c) => (
        <section key={c.id} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <form action={renameContractor.bind(null, c.id)} className="flex items-center gap-2">
              <input
                name="name"
                defaultValue={c.name}
                required
                aria-label="元請け名"
                className="rounded-lg border border-black/20 px-3 py-1.5 font-bold dark:border-white/20 dark:bg-zinc-900"
              />
              <button type="submit" className="text-sm text-blue-600 underline">
                名前を変更
              </button>
            </form>
            <span className="text-sm text-zinc-500">{c.sites.length}現場</span>
            {!c.isActive && <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs dark:bg-zinc-700">無効</span>}
            <form action={setContractorActive.bind(null, c.id, !c.isActive)} className="ml-auto">
              <button type="submit" className="text-sm text-blue-600 underline">
                {c.isActive ? "無効にする" : "有効にする"}
              </button>
            </form>
          </div>
          {c.sites.length > 0 ? (
            <SiteTable sites={c.sites} options={options} />
          ) : (
            <p className="text-sm text-zinc-500">まだ現場が結びついていません。</p>
          )}
        </section>
      ))}

      {contractors.length === 0 && <p className="text-zinc-500">元請けはまだ登録されていません。</p>}
    </div>
  );
}

function SiteTable({ sites, options }: { sites: SiteRow[]; options: ContractorOption[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-50 dark:bg-zinc-900">
          <tr>
            <th className="px-4 py-2">現場名</th>
            <th className="px-4 py-2">元請け</th>
          </tr>
        </thead>
        <tbody>
          {sites.map((site) => (
            <tr key={site.id} className="border-t border-black/10 dark:border-white/10">
              <td className="px-4 py-2">
                {site.name}
                {!site.isActive && <span className="ml-2 text-xs text-zinc-500">（無効）</span>}
              </td>
              <td className="px-4 py-2">
                <form action={setSiteContractor.bind(null, site.id)} className="flex items-center gap-2">
                  <select
                    name="contractorId"
                    defaultValue={site.contractorId ?? ""}
                    className="rounded-lg border border-black/20 px-2 py-1.5 dark:border-white/20 dark:bg-zinc-900"
                  >
                    <option value="">未設定</option>
                    {options
                      .filter((o) => o.isActive || o.id === site.contractorId)
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                          {o.isActive ? "" : "（無効）"}
                        </option>
                      ))}
                  </select>
                  <button type="submit" className="shrink-0 text-blue-600 underline">
                    変更
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
