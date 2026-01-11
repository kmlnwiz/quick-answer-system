import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/teams
 * 全チームの一覧を取得
 */
export async function GET() {
  try {
    const teams = await prisma.team.findMany({
      orderBy: { display_order: 'asc' },
    });

    return NextResponse.json({ teams });
  } catch (error) {
    console.error('チーム取得エラー:', error);
    return NextResponse.json(
      { error: 'チームの取得に失敗しました' },
      { status: 500 }
    );
  }
}
