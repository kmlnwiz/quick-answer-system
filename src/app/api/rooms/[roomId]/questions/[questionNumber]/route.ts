import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';

// 問題設定変更（管理者のみ）
export async function PATCH(
  request: NextRequest,
  { params }: { params: { roomId: string; questionNumber: string } }
) {
  try {
    const roomId = parseInt(params.roomId);
    const questionNumber = parseInt(params.questionNumber);

    if (isNaN(roomId) || isNaN(questionNumber)) {
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
    const isAdmin = await verifyAdminSession(token);

    if (!isAdmin) {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      );
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

    const { answer_type, choices, correct_answer, allow_resubmission } = await request.json();

    const updateData: any = {};

    if (answer_type !== undefined) {
      if (answer_type !== 'free_text' && answer_type !== 'multiple_choice') {
        return NextResponse.json(
          { error: 'answer_typeは "free_text" または "multiple_choice" である必要があります' },
          { status: 400 }
        );
      }
      updateData.answer_type = answer_type;
    }

    if (choices !== undefined) {
      // 択一問題の場合のみ選択肢を設定可能
      if (answer_type === 'multiple_choice' || question.answer_type === 'multiple_choice') {
        updateData.choices = choices;
      } else {
        return NextResponse.json(
          { error: '選択肢は択一問題でのみ設定できます' },
          { status: 400 }
        );
      }
    }

    if (correct_answer !== undefined) {
      updateData.correct_answer = correct_answer;
    }

    if (allow_resubmission !== undefined) {
      updateData.allow_resubmission = allow_resubmission;
    }

    // 問題設定を更新
    const updatedQuestion = await db.question.update({
      where: { id: question.id },
      data: updateData,
    });

    return NextResponse.json({ question: updatedQuestion });
  } catch (error) {
    console.error('Update question error:', error);
    return NextResponse.json(
      { error: '内部サーバーエラー' },
      { status: 500 }
    );
  }
}

// 問題情報取得
export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string; questionNumber: string } }
) {
  try {
    const roomId = parseInt(params.roomId);
    const questionNumber = parseInt(params.questionNumber);

    if (isNaN(roomId) || isNaN(questionNumber)) {
      return NextResponse.json(
        { error: '無効なパラメータです' },
        { status: 400 }
      );
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

    return NextResponse.json({ question });
  } catch (error) {
    console.error('Get question error:', error);
    return NextResponse.json(
      { error: '内部サーバーエラー' },
      { status: 500 }
    );
  }
}
