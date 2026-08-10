"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { deleteTimeEntry, type DeleteEntryState } from "@/app/actions";

const initialState: DeleteEntryState = { status: "idle", message: "" };

// 誤った現場を選んで出勤ボタンを押してしまった場合、その場で取り消して
// 現場選択からやり直せるようにする（退勤してから打刻一覧で削除する、という
// 遠回りをしなくて済むように）。
export function CancelClockInButton({ entryId }: { entryId: string }) {
  const router = useRouter();
  const action = deleteTimeEntry.bind(null, entryId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.status === "success") {
      router.push("/sites");
    }
  }, [state, router]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm("この現場の出勤を取り消します。よろしいですか？")) {
          e.preventDefault();
        }
      }}
      className="flex flex-col items-center gap-1"
    >
      <button type="submit" disabled={isPending} className="text-sm text-red-600 underline disabled:opacity-50">
        {isPending ? "処理中…" : "現場を間違えた場合はこちら（出勤を取り消す）"}
      </button>
      {state.status === "error" && <p className="text-xs text-red-600">{state.message}</p>}
    </form>
  );
}
