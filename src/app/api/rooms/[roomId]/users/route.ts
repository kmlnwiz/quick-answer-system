import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// 部屋の参加者一覧を取得
export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const roomId = parseInt(params.roomId);

    if (isNaN(roomId)) {
      return NextResponse.json(
        { error: '無効な部屋IDです' },
        { status: 400 }
      );
    }

    // 部屋の存在確認
    const room = await db.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return NextResponse.json(
        { error: '部屋が見つかりません' },
        { status: 404 }
      );
    }

    // 参加者一覧を取得
    const users = await db.user.findMany({
      where: {
        room_id: roomId,
      },
      include: {
        team: true,
      },
      orderBy: [
        { team_id: 'asc' },
        { username: 'asc' },
      ],
    });

    return NextResponse.json({
      users: users.map((user) => ({
        id: user.id,
        username: user.username,
        team: {
          id: user.team.id,
          name: user.team.name,
          color: user.team.color,
        },
      })),
    });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json(
      { error: '内部サーバーエラー' },
      { status: 500 }
    );
  }
}
