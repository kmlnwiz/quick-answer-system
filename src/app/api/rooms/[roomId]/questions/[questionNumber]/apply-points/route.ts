import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';

// ポイントマップを再適用
export async function POST(
    request: NextRequest,
    { params }: { params: { roomId: string; questionNumber: string } }
) {
    try {
        const questionNumber = parseInt(params.questionNumber);

        if (isNaN(questionNumber)) {
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

        // 部屋情報を特定（部屋コードまたはID）
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

        // score_tableがnullの場合はデフォルト値を使用
        const defaultScoreTable = [10, 7, 5, 3, 2, 1];
        const scoreTable = (room.score_table as number[] | null) || defaultScoreTable;

        // まず全解答の得点を0にリセット（この問題かつ手動編集でないもの、または一括リセット）
        // ここでは仕様に合わせて、全解答の得点を再計算する
        await db.answer.updateMany({
            where: {
                room_id: roomId,
                question_number: questionNumber,
            },
            data: { score: 0 },
        });

        // 正解の解答を解答時間順に取得
        const correctAnswers = await db.answer.findMany({
            where: {
                room_id: roomId,
                question_number: questionNumber,
                is_correct: true,
            },
            orderBy: [
                { elapsed_time_ms: 'asc' },
            ],
        });

        // 順位に応じて得点を付与
        if (questionNumber !== 0) {
            for (let rank = 0; rank < correctAnswers.length; rank++) {
                const ans = correctAnswers[rank];
                const score = scoreTable[rank] || 0;

                await db.answer.update({
                    where: { id: ans.id },
                    data: { score },
                });
            }
        }

        // Pusherで通知（再計算が行われたことを通知）
        try {
            const { pusherServer } = await import('@/lib/pusher-server');
            await pusherServer.trigger(`room-${roomId}`, 'answer-updated', {
                questionNumber,
                recalculated: true
            });
        } catch (pusherError) {
            console.error('Pusher trigger error:', pusherError);
        }

        return NextResponse.json({
            success: true,
            message: 'ポイントマップを適用しました',
            recalculated_count: correctAnswers.length
        });
    } catch (error) {
        console.error('Apply point map error:', error);
        return NextResponse.json(
            { error: '内部サーバーエラー' },
            { status: 500 }
        );
    }
}
