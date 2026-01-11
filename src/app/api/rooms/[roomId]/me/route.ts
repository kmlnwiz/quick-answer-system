import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromToken } from '@/lib/auth';

/**
 * GET /api/rooms/[roomId]/me
 * 現在の参加者の情報を取得
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

        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: '認証トークンが必要です' },
                { status: 401 }
            );
        }

        const token = authHeader.substring(7);
        const user = await getUserFromToken(token);

        if (!user || user.room_id !== roomId) {
            return NextResponse.json(
                { error: 'ユーザーが見つからないか、別の部屋に所属しています' },
                { status: 404 }
            );
        }

        // 正解数と合計得点を計算
        const correctAnswers = await prisma.answer.findMany({
            where: {
                user_id: user.id,
                room_id: roomId,
                is_correct: true,
            },
        });

        const totalScore = correctAnswers.reduce((sum, ans) => sum + ans.score, 0);

        return NextResponse.json({
            user: {
                id: user.id,
                username: user.username,
                team: {
                    id: user.team.id,
                    name: user.team.name,
                    color: user.team.color,
                },
                total_score: totalScore,
                correct_count: correctAnswers.length,
            },
        });
    } catch (error) {
        console.error('Get me error:', error);
        return NextResponse.json(
            { error: '情報の取得に失敗しました' },
            { status: 500 }
        );
    }
}
