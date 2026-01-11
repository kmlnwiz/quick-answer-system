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

    const { is_correct, score: manual_score, elapsed_time_ms: manual_time } = await request.json();

    if (is_correct === undefined && manual_score === undefined && manual_time === undefined) {
      return NextResponse.json(
        { error: '更新内容が必要です' },
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

    const updateData: any = {};
    if (is_correct !== undefined) updateData.is_correct = is_correct;
    if (manual_score !== undefined) updateData.score = manual_score;
    if (manual_time !== undefined) updateData.elapsed_time_ms = manual_time;

    // 正解/不正解を更新
    const updatedAnswer = await db.answer.update({
      where: { id: answerId },
      data: updateData,
      include: {
        user: {
          include: {
            team: true,
          },
        },
        room: true,
      },
    });

    // Pusherで通知（解答が更新されたことを通知）
    try {
      const { pusherServer } = await import('@/lib/pusher-server');
      const socketId = request.headers.get('x-pusher-socket-id');

      // 管理者向けに詳細な情報を通知
      await pusherServer.trigger(`admin-room-${roomId}`, 'answer-updated', {
        answerId: updatedAnswer.id,
        questionNumber: updatedAnswer.question_number,
        updatedAnswer: {
          ...updatedAnswer,
          elapsed_time_ms: updatedAnswer.elapsed_time_ms ? Number(updatedAnswer.elapsed_time_ms) : null,
        },
        recalculated: false
      }, socketId ? { socket_id: socketId } : undefined);

      // 本人向けに更新があったことのみを通知（機密保護のため、詳細な比較ロジックはクライアント側に任せる）
      await pusherServer.trigger(`room-${roomId}`, 'answer-updated', {
        answerId: updatedAnswer.id,
        userId: updatedAnswer.user_id,
        recalculated: false
      });
    } catch (pusherError) {
      console.error('Pusher trigger error:', pusherError);
    }

    return NextResponse.json({
      answer: {
        ...updatedAnswer,
        elapsed_time_ms: updatedAnswer.elapsed_time_ms ? Number(updatedAnswer.elapsed_time_ms) : null,
      }
    });
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

    // Pusherで通知（解答が削除されたことを通知）
    try {
      const { pusherServer } = await import('@/lib/pusher-server');
      const socketId = request.headers.get('x-pusher-socket-id');

      await pusherServer.trigger(`room-${roomId}`, 'answer-deleted', {
        answerId,
        questionNumber,
        userId: answer.user_id,
      }, socketId ? { socket_id: socketId } : undefined);
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
