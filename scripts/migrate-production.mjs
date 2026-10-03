// Vercelの本番デプロイ時だけ、未適用のDBマイグレーション（prisma/migrations）を適用する。
// ビルドの最初に実行されるため、適用に失敗するとビルドごと失敗し、本番は直前の
// デプロイのまま動き続ける（新しいコードが未適用のDBに対して公開されることはない）。
// プレビュー・ローカルのビルドでは何もしない（本番DBを誤って変更しないため）。
import { spawnSync } from "node:child_process";

if (process.env.VERCEL_ENV !== "production") {
  console.log(`[migrate] VERCEL_ENV=${process.env.VERCEL_ENV ?? "(unset)"} のためマイグレーションをスキップします`);
  process.exit(0);
}

console.log("[migrate] 本番デプロイのため prisma migrate deploy を実行します");
const result = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", shell: true });
process.exit(result.status ?? 1);
