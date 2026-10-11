import { getEmployees, getSitesForAdmin } from "@/app/actions";
// getEmployees()は外注（isSubcontractor: true）も含めて返すため、このフォームでは
// 従業員・外注どちらも同じプルダウンから選べる（グループ分け表示にする）。
import { AdminEntryForm } from "./admin-entry-form";

// 現場の詳細画面から来た場合は、その現場を最初から選んだ状態にする（?siteId=）。
export default async function NewAdminEntryPage({ searchParams }: { searchParams: Promise<{ siteId?: string }> }) {
  const { siteId } = await searchParams;
  const [employees, allSites] = await Promise.all([getEmployees(), getSitesForAdmin()]);
  const sites = allSites.filter((s) => s.isActive);

  return (
    <div className="flex max-w-md flex-col gap-6">
      <h2 className="text-lg font-bold">従業員の打刻を代理で入力する</h2>
      <p className="text-sm text-zinc-500">
        本人が打刻できなかった場合に、管理者が代わりに出勤・退勤時刻を入力できます。
      </p>
      <AdminEntryForm employees={employees} sites={sites} defaultSiteId={sites.some((s) => s.id === siteId) ? siteId : undefined} />
    </div>
  );
}
