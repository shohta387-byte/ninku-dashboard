import { OAuth2Client } from "google-auth-library";
import type { NextRequest } from "next/server";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} が設定されていません。.env を確認し、Google Cloud ConsoleでOAuthクライアントを作成してください。`,
    );
  }
  return value;
}

// Next.jsのdevサーバーは request.nextUrl / request.url を常に localhost に正規化してしまい、
// 実際にアクセスされたHost（LAN IPやnip.io経由のホスト名）を反映しない。そのため、Hostヘッダーから
// 直接オリジンを組み立てる必要がある（OAuthのredirect_uriやログイン失敗時のリダイレクト先など、
// 実際にブラウザが戻れる場所を指定する箇所すべてに使うこと）。
export function originFromRequest(request: NextRequest): string {
  const host = request.headers.get("host");
  if (!host) {
    throw new Error("Hostヘッダーが取得できませんでした");
  }
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

function getClient(redirectUri: string): OAuth2Client {
  return new OAuth2Client({
    clientId: requireEnv("GOOGLE_CLIENT_ID"),
    clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
    redirectUri,
  });
}

// redirectUriは呼び出し元(Route Handler)がアクセス元のオリジン(request.nextUrl.origin)から
// 組み立てて渡す。PC(localhost)とスマホ(LAN経由のホスト名)など、アクセス元が複数あっても
// 固定のAPP_URLに縛られず、実際にアクセスされたオリジンでそのままGoogleに認可要求できる。
export function buildGoogleAuthUrl(state: string, redirectUri: string): string {
  return getClient(redirectUri).generateAuthUrl({
    scope: ["openid", "email"],
    state,
    prompt: "select_account",
  });
}

export interface GoogleIdentity {
  email: string;
}

// 認可コードをトークンに交換し、IDトークンの署名・audience・有効期限を検証する。
// email_verified が false のアカウントは、なりすまし防止のため拒否する。
// redirectUriは generateAuthUrl に渡したものと同一である必要がある(OAuth2の仕様)。
export async function verifyGoogleAuthCode(
  code: string,
  redirectUri: string,
): Promise<GoogleIdentity> {
  const client = getClient(redirectUri);
  const clientId = requireEnv("GOOGLE_CLIENT_ID");

  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) {
    throw new Error("Googleからidトークンを取得できませんでした");
  }

  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: clientId });
  const payload = ticket.getPayload();
  if (!payload?.email || !payload.email_verified) {
    throw new Error("メールアドレスを確認できませんでした");
  }

  return { email: payload.email.toLowerCase() };
}
