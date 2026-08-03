import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { buildGoogleAuthUrl, originFromRequest } from "@/lib/google-auth";

const STATE_COOKIE = "oauth_state";

// CSRF対策のstateを発行し、短命Cookieに保存してからGoogleの認可画面へ遷移する。
export async function GET(request: NextRequest) {
  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  // アクセスされた実際のオリジン(localhostでもLAN経由のホスト名でも)からコールバックURIを組み立てる。
  // Google側にはそのオリジンぶんのリダイレクトURIを事前に登録しておく必要がある。
  const redirectUri = `${originFromRequest(request)}/api/auth/google/callback`;
  return NextResponse.redirect(buildGoogleAuthUrl(state, redirectUri));
}
