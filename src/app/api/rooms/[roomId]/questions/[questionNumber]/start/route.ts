import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';

// 問題全体開始（管理者のみ）
export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string; questionNumber: string } }
) {
  try {
    const questionNumber = parseInt(params.questionNumber);

    if (isNaN(questionNumber)) { // params.roomIdのチェックは下で一括で行う
      return NextResponse.json(
        { error: '無効なパラメータです' },
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
    // 部屋IDまたはルームコードで検索
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

    const resolvedRoomId = room.id;


    const isAdmin = await verifyAdminSession(token);

    if (!isAdmin) {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      );
    }

    // 問題情報取得
    let question = await db.question.findFirst({
      where: {
        room_id: resolvedRoomId,
        question_number: questionNumber,
      },
    });

    // 問題がないが、0〜12の範囲内なら自動作成
    if (!question && questionNumber >= 0 && questionNumber <= 12) {
      try {
        question = await db.question.create({
          data: {
            room_id: resolvedRoomId,
            question_number: questionNumber,
            answer_type: 'free_text',
          },
        });
      } catch (e) {
        // 並列リクエストなどで既に作成されている場合への対策
        question = await db.question.findFirst({
          where: {
            room_id: resolvedRoomId,
            question_number: questionNumber,
          },
        });
      }
    }

    if (!question) {
      return NextResponse.json(
        { error: '問題が見つかりません' },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { start_time } = body;

    // 問題を開始 (上書きを許可するために既に開始されているかのチェックは削除)
    const updatedQuestion = await db.question.update({
      where: { id: question.id },
      data: {
        global_start_time: start_time ? new Date(start_time) : new Date(),
      },
    });

    // Pusherで通知
    try {
      const { pusherServer } = await import('@/lib/pusher-server');
      await pusherServer.trigger(`room-${resolvedRoomId}`, 'question-started', {
        questionNumber: updatedQuestion.question_number,
        startTime: updatedQuestion.global_start_time?.toISOString(),
        type: 'global',
      });
    } catch (pusherError) {
      console.error('Pusher trigger error:', pusherError);
    }

    return NextResponse.json({ question: updatedQuestion });
  } catch (error) {
    console.error('Start question error:', error);
    return NextResponse.json(
      { error: '内部サーバーエラー' },
      { status: 500 }
    );
  }
}
