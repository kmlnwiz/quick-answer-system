import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';

// チーム別問題開始（管理者のみ）
export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string; questionNumber: string } }
) {
  const questionNumber = parseInt(params.questionNumber);
  if (isNaN(questionNumber)) {
    return NextResponse.json(
      { error: '無効な問題番号です' },
      { status: 400 }
    );
  }

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '認証トークンが必要です' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const isAdmin = await verifyAdminSession(token);
    if (!isAdmin) {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    const { team_id } = await request.json();
    if (!team_id) {
      return NextResponse.json({ error: 'チームIDが必要です' }, { status: 400 });
    }

    // 部屋情報取得
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

    // 問題情報取得
    let question = await db.question.findFirst({
      where: {
        room_id: resolvedRoomId,
        question_number: questionNumber,
      },
    });

    if (!question) {
      // 0〜12の範囲内なら自動作成
      if (questionNumber >= 0 && questionNumber <= 12) {
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
    }

    if (!question) {
      return NextResponse.json(
        { error: '問題が見つかりません' },
        { status: 404 }
      );
    }

    // チーム存在確認
    const team = await db.team.findUnique({
      where: { id: team_id },
    });

    if (!team) {
      return NextResponse.json(
        { error: 'チームが見つかりません' },
        { status: 404 }
      );
    }

    // 既にチーム別開始されているかチェック
    const existingStart = await db.questionTeamStart.findFirst({
      where: {
        question_id: question.id,
        team_id: team_id,
      },
    });

    if (existingStart) {
      return NextResponse.json(
        { error: 'このチームは既に開始されています', teamStart: existingStart },
        { status: 400 }
      );
    }

    // チーム別開始時刻を記録
    const teamStart = await db.questionTeamStart.create({
      data: {
        question_id: question.id,
        team_id: team_id,
        start_time: new Date(),
      },
      include: {
        team: true,
        question: true,
      },
    });

    // Pusherで通知
    try {
      const { pusherServer } = await import('@/lib/pusher-server');
      await pusherServer.trigger(`room-${resolvedRoomId}`, 'question-started', {
        questionNumber: teamStart.question.question_number,
        teamId: team_id,
        startTime: teamStart.start_time.toISOString(),
        type: 'team',
      });
    } catch (pusherError) {
      console.error('Pusher trigger error:', pusherError);
    }

    return NextResponse.json({ teamStart }, { status: 201 });
  } catch (error) {
    console.error('Start team question error:', error);
    return NextResponse.json(
      { error: '内部サーバーエラー' },
      { status: 500 }
    );
  }
}
