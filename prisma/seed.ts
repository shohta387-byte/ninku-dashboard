import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.employee.createMany({
    data: [
      { name: "山田 太郎" },
      { name: "佐藤 次郎" },
      { name: "鈴木 三郎" },
      { name: "田中 四郎" },
      { name: "高橋 五郎" },
    ],
  });

  await prisma.site.createMany({
    data: [
      { name: "新宿現場", lat: 35.6938, lng: 139.7034 },
      { name: "渋谷現場", lat: 35.658, lng: 139.7016 },
      { name: "池袋現場", lat: 35.7295, lng: 139.7109 },
      { name: "上野現場", lat: 35.7141, lng: 139.7774 },
    ],
  });

  const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  if (initialAdminEmail) {
    await prisma.allowedEmail.upsert({
      where: { email: initialAdminEmail },
      update: { isAdmin: true },
      create: { email: initialAdminEmail, isAdmin: true },
    });
    console.log(`初期管理者を登録しました: ${initialAdminEmail}`);
  } else {
    console.warn(
      "INITIAL_ADMIN_EMAIL が未設定のため、初期管理者は登録されませんでした（.envを確認してください）。",
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
