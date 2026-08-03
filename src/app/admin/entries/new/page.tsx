import { getEmployees, getSitesForAdmin } from "@/app/actions";
import { AdminEntryForm } from "./admin-entry-form";

export default async function NewAdminEntryPage() {
  const [employees, allSites] = await Promise.all([getEmployees(), getSitesForAdmin()]);
  const sites = allSites.filter((s) => s.isActive);

  return (
    <div className="flex max-w-md flex-col gap-6">
      <h2 className="text-lg font-bold">従業員の打刻を代理で入力する</h2>
      <p className="text-sm text-zinc-500">
        本人が打刻できなかった場合に、管理者が代わりに出勤・退勤時刻を入力できます。
      </p>
      <AdminEntryForm employees={employees} sites={sites} />
    </div>
  );
}
