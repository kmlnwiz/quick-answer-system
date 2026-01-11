import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';

// 問題の得点を確定
export async function POST(
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
        const question = await db.question.findFirst({
            where: {
                room_id: resolvedRoomId,
                question_number: questionNumber,
            },
        });

        if (!question) {
            return NextResponse.json(
                { error: '問題が見つかりません' },
                { status: 404 }
            );
        }

        // 正解とマークされた解答を経過時間順に取得
        const correctAnswers = await db.answer.findMany({
            where: {
                room_id: resolvedRoomId,
                question_number: questionNumber,
                is_correct: true,
            },
            orderBy: {
                elapsed_time_ms: 'asc',
            },
        });

        // 得点テーブルを取得
        const scoreTable = room.score_table as any;
        const scores = Array.isArray(scoreTable) ? scoreTable : [50, 40, 30, 20, 10];

        // 各解答に得点を付与
        const updatePromises = correctAnswers.map((answer, index) => {
            const score = index < scores.length ? scores[index] : 0;
            return db.answer.update({
                where: { id: answer.id },
                data: { score },
            });
        });

        await Promise.all(updatePromises);

        // 問題を確定済みに設定
        const now = new Date();
        await db.question.update({
            where: { id: question.id },
            data: {
                is_finalized: true,
                finalized_at: now,
            },
        });

        return NextResponse.json({
            success: true,
            question_number: questionNumber,
            correct_answers_count: correctAnswers.length,
            finalized_at: now.toISOString(),
        });
    } catch (error) {
        console.error('Finalize question error:', error);
        return NextResponse.json(
            { error: '内部サーバーエラー' },
            { status: 500 }
        );
    }
}
