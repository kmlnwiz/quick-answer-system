import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateUserSessionToken } from '@/lib/auth';

// 部屋に参加
export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const { username, team_id, room_code } = await request.json();

    if (!username || !team_id) {
      return NextResponse.json(
        { error: 'ユーザー名とチームが必要です' },
        { status: 400 }
      );
    }

    // 部屋コードまたはIDで部屋を検索
    let room;
    if (room_code) {
      room = await db.room.findUnique({
        where: { room_code },
      });
    } else {
      const roomId = parseInt(params.roomId);
      if (isNaN(roomId)) {
        return NextResponse.json(
          { error: '無効な部屋IDです' },
          { status: 400 }
        );
      }
      room = await db.room.findUnique({
        where: { id: roomId },
      });
    }

    if (!room || !room.is_active) {
      return NextResponse.json(
        { error: '部屋が見つからないか、無効です' },
        { status: 404 }
      );
    }

    // チームの存在確認
    const team = await db.team.findUnique({
      where: { id: team_id },
    });

    if (!team) {
      return NextResponse.json(
        { error: 'チームが見つかりません' },
        { status: 404 }
      );
    }

    // 同じ部屋で同じユーザー名が既に存在する場合はそのユーザーを返す（セッション復帰）
    let user = await db.user.findUnique({
      where: {
        room_id_username: {
          room_id: room.id,
          username,
        },
      },
      include: { team: true },
    });

    if (user) {
      // 既存ユーザー：チームを更新
      user = await db.user.update({
        where: { id: user.id },
        data: { team_id },
        include: { team: true },
      });
    } else {
      // 新規ユーザー作成
      const sessionToken = generateUserSessionToken();
      user = await db.user.create({
        data: {
          room_id: room.id,
          username,
          team_id,
          session_token: sessionToken,
        },
        include: { team: true },
      });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        room_id: room.id,
        room_code: room.room_code,
        team: user.team,
        session_token: user.session_token,
      },
    });
  } catch (error) {
    console.error('Join room error:', error);
    return NextResponse.json(
      { error: '内部サーバーエラー' },
      { status: 500 }
    );
  }
}
