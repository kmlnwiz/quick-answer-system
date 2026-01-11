import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';

// 正解/不正解マーク（管理者のみ）
export async function PATCH(
  request: NextRequest,
  { params }: { params: { roomId: string; answerId: string } }
) {
  try {
    const answerId = parseInt(params.answerId);

    if (isNaN(answerId)) {
      return NextResponse.json(
        { error: '無効な解答IDです' },
        { status: 400 }
      );
    }

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

    const { is_correct } = await request.json();

    if (is_correct === undefined || is_correct === null) {
      return NextResponse.json(
        { error: '正解/不正解の値が必要です' },
        { status: 400 }
      );
    }

    // 部屋情報を特定（部屋コードまたはID）
    let room = await db.room.findUnique({
      where: { room_code: params.roomId },
    });

    if (!room) {
      const roomIdInt = parseInt(params.roomId);
      if (!isNaN(roomIdInt)) {
        room = await db.room.findUnique({
          where: { id: roomIdInt },
        });
      }
    }

    if (!room) {
      return NextResponse.json(
        { error: '部屋が見つかりません' },
        { status: 404 }
      );
    }

    const roomId = room.id;

    // 解答が指定された部屋に属しているか確認
    const answer = await db.answer.findFirst({
      where: {
        id: answerId,
        room_id: roomId,
      },
    });

    if (!answer) {
      return NextResponse.json(
        { error: '解答が見つかりません' },
        { status: 404 }
      );
    }

    // 正解/不正解を更新
    const updatedAnswer = await db.answer.update({
      where: { id: answerId },
      data: {
        is_correct,
      },
      include: {
        user: {
          include: {
            team: true,
          },
        },
        room: true,
      },
    });

    // この問題の得点を再計算
    try {
      const questionNumber = updatedAnswer.question_number;
      const room = updatedAnswer.room;
      // score_tableがnullの場合はデフォルト値を使用
      const defaultScoreTable = [10, 7, 5, 3, 2, 1];
      const scoreTable = (room.score_table as number[] | null) || defaultScoreTable;

      // まず全解答の得点を0にリセット（この問題のみ）
      await db.answer.updateMany({
        where: {
          room_id: roomId,
          question_number: questionNumber,
        },
        data: { score: 0 },
      });

      // 正解の解答を経過時間順に取得
      const correctAnswers = await db.answer.findMany({
        where: {
          room_id: roomId,
          question_number: questionNumber,
          is_correct: true,
        },
        orderBy: [
          { elapsed_time_ms: 'asc' },
        ],
      });

      // 順位に応じて得点を付与
      for (let rank = 0; rank < correctAnswers.length; rank++) {
        const ans = correctAnswers[rank];
        const score = scoreTable[rank] || 0;

        await db.answer.update({
          where: { id: ans.id },
          data: { score },
        });
      }
    } catch (recalcError) {
      console.error('Score recalculation error:', recalcError);
      // 再計算エラーはログに記録するが、レスポンスは返す
    }

    // Pusherで通知（解答が更新されたことを通知）
    try {
      const { pusherServer } = await import('@/lib/pusher-server');
      await pusherServer.trigger(`room-${roomId}`, 'answer-updated', {
        answerId: updatedAnswer.id,
        questionNumber: updatedAnswer.question_number,
      });
    } catch (pusherError) {
      console.error('Pusher trigger error:', pusherError);
    }

    return NextResponse.json({ answer: updatedAnswer });
  } catch (error) {
    console.error('Mark answer error:', error);
    return NextResponse.json(
      { error: '内部サーバーエラー' },
      { status: 500 }
    );
  }
}

// 解答削除（管理者のみ）
export async function DELETE(
  request: NextRequest,
  { params }: { params: { roomId: string; answerId: string } }
) {
  try {
    const answerId = parseInt(params.answerId);

    if (isNaN(answerId)) {
      return NextResponse.json(
        { error: '無効な解答IDです' },
        { status: 400 }
      );
    }

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

    // 部屋情報を特定（部屋コードまたはID）
    let room = await db.room.findUnique({
      where: { room_code: params.roomId },
    });

    if (!room) {
      const roomIdInt = parseInt(params.roomId);
      if (!isNaN(roomIdInt)) {
        room = await db.room.findUnique({
          where: { id: roomIdInt },
        });
      }
    }

    if (!room) {
      return NextResponse.json(
        { error: '部屋が見つかりません' },
        { status: 404 }
      );
    }

    const roomId = room.id;

    // 解答が指定された部屋に属しているか確認
    const answer = await db.answer.findFirst({
      where: {
        id: answerId,
        room_id: roomId,
      },
    });

    if (!answer) {
      return NextResponse.json(
        { error: '解答が見つかりません' },
        { status: 404 }
      );
    }

    const questionNumber = answer.question_number;

    // 解答を削除
    await db.answer.delete({
      where: { id: answerId },
    });

    // この問題の得点を再計算
    try {
      // score_tableがnullの場合はデフォルト値を使用
      const defaultScoreTable = [10, 7, 5, 3, 2, 1];
      const scoreTable = (room.score_table as number[] | null) || defaultScoreTable;

      // まず全解答の得点を0にリセット（この問題のみ）
      await db.answer.updateMany({
        where: {
          room_id: roomId,
          question_number: questionNumber,
        },
        data: { score: 0 },
      });

      // 正解の解答を経過時間順に取得
      const correctAnswers = await db.answer.findMany({
        where: {
          room_id: roomId,
          question_number: questionNumber,
          is_correct: true,
        },
        orderBy: [
          { elapsed_time_ms: 'asc' },
        ],
      });

      // 順位に応じて得点を付与
      for (let rank = 0; rank < correctAnswers.length; rank++) {
        const ans = correctAnswers[rank];
        const score = scoreTable[rank] || 0;

        await db.answer.update({
          where: { id: ans.id },
          data: { score },
        });
      }
    } catch (recalcError) {
      console.error('Score recalculation error:', recalcError);
      // 再計算エラーはログに記録するが、レスポンスは返す
    }

    // Pusherで通知（解答が削除されたことを通知）
    try {
      const { pusherServer } = await import('@/lib/pusher-server');
      await pusherServer.trigger(`room-${roomId}`, 'answer-deleted', {
        answerId,
        questionNumber,
      });
    } catch (pusherError) {
      console.error('Pusher trigger error:', pusherError);
    }

    return NextResponse.json({
      message: '解答を削除しました',
      deleted_answer_id: answerId
    });
  } catch (error) {
    console.error('Delete answer error:', error);
    return NextResponse.json(
      { error: '内部サーバーエラー' },
      { status: 500 }
    );
  }
}
