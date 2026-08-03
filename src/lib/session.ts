import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30日

export interface SessionPayload {
  email: string;
  employeeId: string | null;
  isAdmin: boolean;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

function encode(payload: SessionPayload): string {
  const json = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${json}.${sign(json)}`;
}

// 署名を検証し、改ざん・偽造されたCookieを弾く。タイミング攻撃を避けるため timingSafeEqual を使う。
function decode(token: string): SessionPayload | null {
  const [json, signature] = token.split(".");
  if (!json || !signature) return null;

  const expected = Buffer.from(sign(json));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(json, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, encode(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decode(token);
}

// ページ(Server Component)から呼ぶ。未ログイン/従業員未紐付けなら /login へリダイレクトする。
export async function requireEmployeeSession(): Promise<{
  email: string;
  employeeId: string;
  isAdmin: boolean;
}> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (!session.employeeId) {
    redirect("/login?error=no_employee");
  }
  return { email: session.email, employeeId: session.employeeId, isAdmin: session.isAdmin };
}

// ページ(Server Component)から呼ぶ。管理者でなければ /login へリダイレクトする。
export async function requireAdminSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (!session.isAdmin) {
    redirect("/login?error=forbidden");
  }
  return session;
}
