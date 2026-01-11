import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromSession } from '@/lib/auth';

/**
 * GET /api/rooms/[roomId]/comments/my
 * 自分のコメント一覧を取得
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { roomId: string } }
) {
    try {
        // 部屋IDまたはルームコードで検索
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

        const roomId = room.id;

        // ユーザー認証
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: '認証が必要です' },
                { status: 401 }
            );
        }

        const token = authHeader.substring(7);

        // ユーザー情報取得
        const user = await prisma.user.findFirst({
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

        // 自分のコメント一覧を取得
        const comments = await prisma.comment.findMany({
            where: {
                room_id: roomId,
                user_id: user.id,
            },
            include: {
                user: {
                    include: {
                        team: true,
                    },
                },
            },
            orderBy: { created_at: 'desc' },
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
        });
    } catch (error) {
        console.error('個人コメント取得エラー:', error);
        return NextResponse.json(
            { error: 'コメントの取得に失敗しました' },
            { status: 500 }
        );
    }
}
