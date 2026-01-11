import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// 問題開始時刻取得
export async function GET(
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

    const roomId = room.id;

    // 問題情報取得
    let question = await db.question.findFirst({
      where: {
        room_id: roomId,
        question_number: questionNumber,
      },
    });

    if (!question) {
      // 0〜12の範囲内なら自動作成
      if (questionNumber >= 0 && questionNumber <= 12) {
        try {
          question = await db.question.create({
            data: {
              room_id: roomId,
              question_number: questionNumber,
              answer_type: 'free_text',
            },
          });
        } catch (e) {
          // 並列リクエストなどで既に作成されている場合への対策
          question = await db.question.findFirst({
            where: {
              room_id: roomId,
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

    // チーム別開始時刻取得
    const teamStarts = await db.questionTeamStart.findMany({
      where: {
        question_id: question.id,
      },
      include: {
        team: true,
      },
      orderBy: {
        start_time: 'asc',
      },
    });

    return NextResponse.json({
      question: {
        id: question.id,
        question_number: question.question_number,
        global_start_time: question.global_start_time,
      },
      teamStarts,
    });
  } catch (error) {
    console.error('Get start times error:', error);
    return NextResponse.json(
      { error: '内部サーバーエラー' },
      { status: 500 }
    );
  }
}
