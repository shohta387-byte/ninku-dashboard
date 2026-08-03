import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { originFromRequest, verifyGoogleAuthCode } from "@/lib/google-auth";
import { createSession } from "@/lib/session";

const STATE_COOKIE = "oauth_state";

export async function GET(request: NextRequest) {
  // request.nextUrl はdevサーバーではlocalhostに正規化されてしまうため、
  // ブラウザが実際に戻れるリダイレクト先には必ずこのoriginを使う。
  const origin = originFromRequest(request);
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  // stateが一致しない場合はCSRF/リプレイの疑いがあるため即座に拒否する。
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${origin}/login?error=invalid_request`);
  }

  // Googleはstartで渡したredirect_uriと同じURLへ戻してくる。トークン交換時も同じ値を渡す必要がある。
  const redirectUri = `${origin}/api/auth/google/callback`;

  let email: string;
  try {
    email = (await verifyGoogleAuthCode(code, redirectUri)).email;
  } catch (error) {
    console.error("Google auth verification failed", error);
    return NextResponse.redirect(`${origin}/login?error=verification_failed`);
  }

  const allowed = await prisma.allowedEmail.findUnique({ where: { email } });
  if (!allowed) {
    return NextResponse.redirect(`${origin}/login?error=not_allowed`);
  }

  await createSession({
    email: allowed.email,
    employeeId: allowed.employeeId,
    isAdmin: allowed.isAdmin,
  });

  return NextResponse.redirect(origin);
}
