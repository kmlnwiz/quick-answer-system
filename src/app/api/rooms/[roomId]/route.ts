import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';

// 部屋情報取得
export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const includeQuery = {
      questions: {
        orderBy: { question_number: 'asc' as const },
        include: {
          question_team_starts: {
            include: {
              team: true,
            },
          },
        },
      },
    };

    // まずroom_codeとして検索を試みる
    let room: any = await db.room.findUnique({
      where: { room_code: params.roomId },
      include: includeQuery as any,
    });

    // room_codeで見つからない場合、IDとして検索
    if (!room) {
      const roomId = parseInt(params.roomId);
      if (!isNaN(roomId)) {
        room = await db.room.findUnique({
          where: { id: roomId },
          include: includeQuery as any,
        });
      }
    }

    if (!room) {
      return NextResponse.json(
        { error: '部屋が見つかりません' },
        { status: 404 }
      );
    }

    // 問題 0-12 が存在することを確認し、なければ作成する
    const existingQNumbers = new Set((room.questions || []).map((q: any) => q.question_number));
    const missingQNumbers = [];
    for (let i = 0; i <= 12; i++) {
      if (!existingQNumbers.has(i)) {
        missingQNumbers.push(i);
      }
    }

    if (missingQNumbers.length > 0) {
      await db.question.createMany({
        data: missingQNumbers.map(num => ({
          room_id: room!.id,
          question_number: num,
          answer_type: 'free_text',
        })),
        skipDuplicates: true,
      });

      // 作成したので再取得
      room = await db.room.findUnique({
        where: { id: room!.id },
        include: includeQuery as any,
      });
    }

    return NextResponse.json({ room });
  } catch (error) {
    console.error('Get room error:', error);
    return NextResponse.json(
      { error: '内部サーバーエラー' },
      { status: 500 }
    );
  }
}

// 部屋設定変更（管理者のみ）
export async function PATCH(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
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

    const roomId = parseInt(params.roomId);

    if (isNaN(roomId)) {
      return NextResponse.json(
        { error: '無効な部屋IDです' },
        { status: 400 }
      );
    }

    const { allow_resubmission, score_table, is_active } = await request.json();

    const updateData: any = {};
    if (allow_resubmission !== undefined) updateData.allow_resubmission = allow_resubmission;
    if (score_table !== undefined) updateData.score_table = score_table;
    if (is_active !== undefined) updateData.is_active = is_active;

    const room = await db.room.update({
      where: { id: roomId },
      data: updateData,
    });

    return NextResponse.json({ room });
  } catch (error) {
    console.error('Update room error:', error);
    return NextResponse.json(
      { error: '内部サーバーエラー' },
      { status: 500 }
    );
  }
}

// 部屋削除（管理者のみ）
export async function DELETE(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
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

    const roomId = parseInt(params.roomId);

    if (isNaN(roomId)) {
      return NextResponse.json(
        { error: '無効な部屋IDです' },
        { status: 400 }
      );
    }

    // 部屋が存在するか確認
    const room = await db.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return NextResponse.json(
        { error: '部屋が見つかりません' },
        { status: 404 }
      );
    }

    // 部屋を削除（カスケード削除により関連データも削除される）
    await db.room.delete({
      where: { id: roomId },
    });

    return NextResponse.json({
      message: '部屋を削除しました',
      deleted_room_code: room.room_code
    });
  } catch (error) {
    console.error('Delete room error:', error);
    return NextResponse.json(
      { error: '内部サーバーエラー' },
      { status: 500 }
    );
  }
}
