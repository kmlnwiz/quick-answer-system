import { db } from './db';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// 管理者認証
export async function verifyAdminPassword(password: string): Promise<boolean> {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error('ADMIN_PASSWORD is not configured');
  }
  return password === adminPassword;
}

// 管理者セッション作成
export async function createAdminSession(): Promise<string> {
  const sessionToken = uuidv4();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24時間後

  await db.adminSession.create({
    data: {
      session_token: sessionToken,
      expires_at: expiresAt,
    },
  });

  return sessionToken;
}

// 管理者セッション検証
export async function verifyAdminSession(token: string): Promise<boolean> {
  const session = await db.adminSession.findUnique({
    where: { session_token: token },
  });

  if (!session) return false;
  if (new Date() > session.expires_at) {
    // 期限切れセッションを削除
    await db.adminSession.delete({
      where: { id: session.id },
    });
    return false;
  }

  return true;
}

// ユーザーセッショントークン生成
export function generateUserSessionToken(): string {
  return uuidv4();
}

// セッショントークンからユーザー取得
export async function getUserFromToken(token: string) {
  return await db.user.findUnique({
    where: { session_token: token },
    include: {
      team: true,
      room: true,
    },
  });
}

// リクエストからセッショントークンを取得してユーザー情報を返す
export async function getUserFromSession(request: Request) {
  const sessionToken = request.headers.get('x-session-token');
  if (!sessionToken) {
    return null;
  }
  return await getUserFromToken(sessionToken);
}
