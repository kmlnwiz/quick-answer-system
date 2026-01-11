import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';

/**
 * POST /api/rooms/[roomId]/scores/calculate
 * 全問題の得点を再計算する（管理者のみ）
 *
 * 各問題について：
 * 1. 正解（is_correct=true）の解答を elapsed_time_ms の昇順で取得
 * 2. score_table に基づいて順位ごとに得点を付与
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    // 管理者認証
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '認証トークンが必要です' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const isAdmin = await verifyAdminSession(token);

    if (!isAdmin) {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      );
    }

    const roomId = parseInt(params.roomId);

    if (isNaN(roomId)) {
      return NextResponse.json(
        { error: '無効な部屋IDです' },
        { status: 400 }
      );
    }

    // 部屋情報を取得
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return NextResponse.json(
        { error: '部屋が見つかりません' },
        { status: 404 }
      );
    }

    const scoreTable = room.score_table as number[];
    let totalUpdated = 0;

    // 全問題について得点を再計算
    for (let questionNumber = 1; questionNumber <= room.total_questions; questionNumber++) {
      // まず全解答の得点を0にリセット
      await prisma.answer.updateMany({
        where: {
          room_id: roomId,
          question_number: questionNumber,
        },
        data: { score: 0 },
      });

      // 正解の解答を経過時間順に取得
      const correctAnswers = await prisma.answer.findMany({
        where: {
          room_id: roomId,
          question_number: questionNumber,
          is_correct: true,
        },
        orderBy: [
          { elapsed_time_ms: 'asc' }, // 経過時間が短い順
        ],
        include: {
          user: {
            include: {
              team: true,
            },
          },
        },
      });

      // 順位に応じて得点を付与
      for (let rank = 0; rank < correctAnswers.length; rank++) {
        const answer = correctAnswers[rank];
        const score = scoreTable[rank] || 0; // 得点テーブルの範囲外は0点

        await prisma.answer.update({
          where: { id: answer.id },
          data: { score },
        });

        totalUpdated++;
      }
    }

    // 更新後のチーム別得点を取得
    const teams = await prisma.team.findMany({
      orderBy: { display_order: 'asc' },
    });

    const teamScores = await Promise.all(
      teams.map(async (team) => {
        const users = await prisma.user.findMany({
          where: {
            room_id: roomId,
            team_id: team.id,
          },
          select: { id: true },
        });

        const userIds = users.map((u) => u.id);

        const totalScore = await prisma.answer.aggregate({
          where: {
            room_id: roomId,
            user_id: { in: userIds },
            is_correct: true,
          },
          _sum: { score: true },
        });

        const correctCount = await prisma.answer.count({
          where: {
            room_id: roomId,
            user_id: { in: userIds },
            is_correct: true,
          },
        });

        return {
          team_id: team.id,
          team_name: team.name,
          team_color: team.color,
          total_score: totalScore._sum.score || 0,
          correct_count: correctCount,
        };
      })
    );

    return NextResponse.json({
      success: true,
      message: `${totalUpdated}件の解答の得点を再計算しました`,
      updated_count: totalUpdated,
      team_scores: teamScores.sort((a, b) => b.total_score - a.total_score),
    });
  } catch (error) {
    console.error('得点再計算エラー:', error);
    return NextResponse.json(
      { error: '得点の再計算に失敗しました' },
      { status: 500 }
    );
  }
}
