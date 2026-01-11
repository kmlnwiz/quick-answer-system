import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromSession } from '@/lib/auth';

/**
 * POST /api/rooms/[roomId]/comments
 * コメントを送信
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    // 部屋情報を特定
    let room = await prisma.room.findUnique({
      where: { room_code: params.roomId },
    });

    if (!room) {
      const roomIdInt = parseInt(params.roomId);
      if (!isNaN(roomIdInt)) {
        room = await prisma.room.findUnique({
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

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }
    const token = authHeader.substring(7);
    const user = await prisma.user.findUnique({
      where: { session_token: token },
    });

    if (!user) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // ユーザーが指定された部屋に参加しているか確認
    if (user.room_id !== resolvedRoomId) {
      return NextResponse.json(
        { error: 'この部屋へのアクセス権限がありません' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { comment_text } = body;

    // バリデーション
    if (!comment_text || typeof comment_text !== 'string') {
      return NextResponse.json(
        { error: 'コメント内容が必要です' },
        { status: 400 }
      );
    }

    if (comment_text.trim().length === 0) {
      return NextResponse.json(
        { error: 'コメントは空にできません' },
        { status: 400 }
      );
    }

    if (comment_text.length > 1000) {
      return NextResponse.json(
        { error: 'コメントは1000文字以内で入力してください' },
        { status: 400 }
      );
    }

    // コメントを作成
    const comment = await prisma.comment.create({
      data: {
        room_id: resolvedRoomId,
        user_id: user.id,
        comment_text: comment_text.trim(),
      },
      include: {
        user: {
          include: {
            team: true,
          },
        },
      },
    });

    // Pusherで通知
    try {
      const { pusherServer } = await import('@/lib/pusher-server');
      await pusherServer.trigger(`room-${resolvedRoomId}`, 'new-comment', {
        comment: {
          id: comment.id,
          comment_text: comment.comment_text,
          created_at: comment.created_at,
          user: {
            id: comment.user.id,
            username: comment.user.username,
            team: {
              id: comment.user.team.id,
              name: comment.user.team.name,
              color: comment.user.team.color,
            },
          },
        },
      });
    } catch (pusherError) {
      console.error('Pusher trigger error:', pusherError);
    }

    return NextResponse.json({
      success: true,
      comment: {
        id: comment.id,
        comment_text: comment.comment_text,
        created_at: comment.created_at,
        user: {
          id: comment.user.id,
          username: comment.user.username,
          team: {
            id: comment.user.team.id,
            name: comment.user.team.name,
            color: comment.user.team.color,
          },
        },
      },
    });
  } catch (error) {
    console.error('コメント送信エラー:', error);
    return NextResponse.json(
      { error: 'コメントの送信に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/rooms/[roomId]/comments
 * コメント一覧を取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    // 部屋情報を特定
    let room = await prisma.room.findUnique({
      where: { room_code: params.roomId },
    });

    if (!room) {
      const roomIdInt = parseInt(params.roomId);
      if (!isNaN(roomIdInt)) {
        room = await prisma.room.findUnique({
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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // コメント一覧を取得（新しい順）
    const comments = await prisma.comment.findMany({
      where: { room_id: resolvedRoomId },
      include: {
        user: {
          include: {
            team: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    });

    // 総コメント数を取得
    const total = await prisma.comment.count({
      where: { room_id: resolvedRoomId },
    });


    return NextResponse.json({
      comments: comments.map((comment) => ({
        id: comment.id,
        comment_text: comment.comment_text,
        created_at: comment.created_at,
        user: {
          id: comment.user.id,
          username: comment.user.username,
          team: {
            id: comment.user.team.id,
            name: comment.user.team.name,
            color: comment.user.team.color,
          },
        },
      })),
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('コメント取得エラー:', error);
    return NextResponse.json(
      { error: 'コメントの取得に失敗しました' },
      { status: 500 }
    );
  }
}
