import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// 自分の解答履歴取得
export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
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

    const roomId = room.id;

    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '認証トークンが必要です' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // ユーザー情報取得
    const user = await db.user.findFirst({
      where: {
        room_id: roomId,
        session_token: token,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'ユーザーが見つかりません' },
        { status: 404 }
      );
    }

    // 自分の解答履歴取得
    const answers = await db.answer.findMany({
      where: {
        user_id: user.id,
        room_id: roomId,
      },
      orderBy: {
        submitted_at: 'desc',
      },
    });

    // 問題情報を取得
    const questionNumbers = Array.from(new Set(answers.map(a => a.question_number)));
    const questions = await db.question.findMany({
      where: {
        room_id: roomId,
        question_number: {
          in: questionNumbers,
        },
      },
    });

    // 問題情報をマップに変換
    const questionMap = new Map(
      questions.map(q => [q.question_number, q])
    );

    // 解答に問題情報を追加し、BigIntを数値に変換（JSONシリアライズ用）
    const answersWithQuestions = answers.map(answer => {
      const plainAnswer = { ...answer };
      return {
        ...plainAnswer,
        elapsed_time_ms: plainAnswer.elapsed_time_ms ? Number(plainAnswer.elapsed_time_ms) : null,
        question: questionMap.get(plainAnswer.question_number) || null,
      };
    });

    console.log(`解答履歴取得成功: ${answersWithQuestions.length}件`);

    return NextResponse.json({ answers: answersWithQuestions });
  } catch (error) {
    console.error('Get my answers error:', error);
    return NextResponse.json(
      { error: '解凍履歴が空、または内部サーバーエラー' },
      { status: 500 }
    );
  }
}
