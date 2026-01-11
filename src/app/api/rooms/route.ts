import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';

// 部屋一覧取得（管理者のみ）
export async function GET(request: NextRequest) {
  try {
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

    const rooms = await db.room.findMany({
      orderBy: {
        created_at: 'desc',
      },
    });

    return NextResponse.json({ rooms });
  } catch (error) {
    console.error('Get rooms error:', error);
    return NextResponse.json(
      { error: '内部サーバーエラー' },
      { status: 500 }
    );
  }
}

// 部屋作成（管理者のみ）
export async function POST(request: NextRequest) {
  try {
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

    const {
      total_questions = 12,
      allow_resubmission = false,
      score_table = [50, 40, 30, 20, 10],
    } = await request.json();

    // 6桁のランダムな部屋コードを生成
    const generateRoomCode = () => {
      return Math.floor(100000 + Math.random() * 900000).toString();
    };

    let roomCode = generateRoomCode();
    let isUnique = false;

    // 重複しないコードを生成
    while (!isUnique) {
      const existing = await db.room.findUnique({
        where: { room_code: roomCode },
      });
      if (!existing) {
        isUnique = true;
      } else {
        roomCode = generateRoomCode();
      }
    }

    const room = await db.room.create({
      data: {
        room_code: roomCode,
        total_questions,
        allow_resubmission,
        score_table,
      },
    });

    // 問題を初期作成 (0番から開始)
    const questions = [];
    for (let i = 0; i <= total_questions; i++) {
      questions.push({
        room_id: room.id,
        question_number: i,
        answer_type: 'free_text', // デフォルトは自由入力
      });
    }

    await db.question.createMany({
      data: questions,
    });

    return NextResponse.json({
      room: {
        id: room.id,
        room_code: room.room_code,
        created_at: room.created_at,
        total_questions: room.total_questions,
        allow_resubmission: room.allow_resubmission,
        score_table: room.score_table,
      },
    });
  } catch (error) {
    console.error('Create room error:', error);
    return NextResponse.json(
      { error: '内部サーバーエラー' },
      { status: 500 }
    );
  }
}
