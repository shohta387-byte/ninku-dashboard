"use client";

import { useActionState } from "react";
import { deleteTimeEntry, type DeleteEntryState } from "@/app/actions";

const initialState: DeleteEntryState = { status: "idle", message: "" };

export function DeleteEntryButton({ entryId }: { entryId: string }) {
  const action = deleteTimeEntry.bind(null, entryId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm("この打刻を削除します。元に戻せませんが、よろしいですか？")) {
          e.preventDefault();
        }
      }}
      className="flex flex-col items-end gap-1"
    >
      <button
        type="submit"
        disabled={isPending}
        className="text-red-600 underline disabled:opacity-50"
      >
        {isPending ? "削除中…" : "削除"}
      </button>
      {state.status === "error" && (
        <p className="text-right text-xs text-red-600">{state.message}</p>
      )}
    </form>
  );
}
