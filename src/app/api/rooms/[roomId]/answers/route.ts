import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';

// 解答送信
export async function POST(
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

    const { question_number, answer_text, selected_choice } = await request.json();

    if (question_number === undefined || question_number === null) {
      return NextResponse.json(
        { error: '問題番号が必要です' },
        { status: 400 }
      );
    }

    // 問題情報取得
    let question = await db.question.findFirst({
      where: {
        room_id: roomId,
        question_number,
      },
    });

    // 問題が存在しないが、有効な範囲内であれば自動作成する
    if (!question && question_number >= 0 && question_number <= room.total_questions) {
      try {
        question = await db.question.create({
          data: {
            room_id: roomId,
            question_number,
            answer_type: 'free_text',
          },
        });
      } catch (e) {
        // 並列リクエストなどで既に作成されている場合への対策
        question = await db.question.findFirst({
          where: {
            room_id: roomId,
            question_number,
          },
        });
      }
    }

    if (!question) {
      return NextResponse.json(
        { error: '問題が見つかりません' },
        { status: 404 }
      );
    }

    // 部屋情報取得 (再送信制限チェック)
    // roomは既に上で取得済み
    if (!room) {
      return NextResponse.json(
        { error: '部屋が見つかりません' },
        { status: 404 }
      );
    }

    // 再送信制限チェック (問題0(テスト)は例外的に常に許可)
    // 問題ごとの設定を優先し、nullの場合は部屋の設定を使用
    const allowResubmission = (question as any).allow_resubmission !== null
      ? (question as any).allow_resubmission
      : room.allow_resubmission;

    if (!allowResubmission && question_number !== 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const existingAnswer = await db.answer.findFirst({
        where: {
          user_id: user.id,
          room_id: roomId,
          question_number: question_number,
          submission_date: {
            gte: today,
          },
        },
      });

      if (existingAnswer) {
        return NextResponse.json(
          { error: 'この問題には既に解答済みです（再送信不可）' },
          { status: 400 }
        );
      }
    }

    // チーム別開始時刻取得
    const teamStart = await db.questionTeamStart.findFirst({
      where: {
        question_id: question.id,
        team_id: user.team_id,
      },
    });

    // 問題開始時刻の決定（チーム別 > 全体）
    let startTime: Date | null = null;
    if (teamStart) {
      startTime = teamStart.start_time;
    } else if (question.global_start_time) {
      startTime = question.global_start_time;
    }

    // 解答時間計算（ミリ秒）
    let elapsedTime: bigint | null = null;
    if (startTime) {
      const now = new Date();
      elapsedTime = BigInt(now.getTime() - startTime.getTime());
    }

    // 自動判定
    let isCorrect: boolean | null = null;

    // 択一問題の場合
    if (question.answer_type === 'multiple_choice' && question.correct_answer) {
      if (selected_choice !== undefined && selected_choice !== null) {
        isCorrect = selected_choice === parseInt(question.correct_answer);
      }
    }

    // 自由入力問題の場合、想定解答との照合
    if (question.answer_type === 'free_text' && question.correct_answer && answer_text) {
      // 想定解答をカンマ区切りで分割し、それぞれを正規化（前後の空白を削除、小文字に変換）
      const correctAnswers = question.correct_answer
        .split(',')
        .map(ans => ans.trim().toLowerCase())
        .filter(ans => ans.length > 0);

      // 解答を正規化
      const normalizedAnswer = answer_text.trim().toLowerCase();

      // いずれかの想定解答と一致すれば正解
      if (correctAnswers.includes(normalizedAnswer)) {
        isCorrect = true;
      } else {
        isCorrect = false;
      }
    }

    // 解答テキストの決定
    let finalAnswerText = answer_text || '';
    if (question.answer_type === 'multiple_choice' && selected_choice !== undefined && selected_choice !== null) {
      finalAnswerText = selected_choice.toString();
    }

    // 問題0（テスト）の場合は得点0、判定なし
    if (question_number === 0) {
      isCorrect = null;
    }

    // スコアは確定時に付与するため、初期値は0に設定
    const initialScore = 0;

    // 解答保存
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const answer = await db.answer.create({
      data: {
        user_id: user.id,
        room_id: roomId,
        question_number: question_number,
        answer_text: finalAnswerText,
        elapsed_time_ms: elapsedTime,
        is_correct: isCorrect,
        score: initialScore,
        submission_date: today,
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
      const socketId = request.headers.get('x-pusher-socket-id');

      // 管理者向けに詳細な情報を通知
      await pusherServer.trigger(`admin-room-${roomId}`, 'new-answer', {
        answer: {
          ...answer,
          elapsed_time_ms: answer.elapsed_time_ms ? Number(answer.elapsed_time_ms) : null,
        },
      }, socketId ? { socket_id: socketId } : undefined);

      // 全体（ランキング画面など）には更新があったことのみを通知（機密データを含まない）
      await pusherServer.trigger(`room-${roomId}`, 'answer-submitted', {
        userId: user.id,
        questionNumber: question_number
      });
    } catch (pusherError) {
      console.error('Pusher trigger error:', pusherError);
      // Pusherエラーは無視してレスポンスを返す（処理の継続を優先）
    }

    return NextResponse.json({
      answer: {
        ...answer,
        elapsed_time_ms: answer.elapsed_time_ms ? Number(answer.elapsed_time_ms) : null,
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Submit answer error:', error);
    return NextResponse.json(
      { error: '内部サーバーエラー' },
      { status: 500 }
    );
  }
}

// 解答一覧取得（管理者）
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
    const isAdmin = await verifyAdminSession(token);

    if (!isAdmin) {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      );
    }

    // クエリパラメータ取得
    const { searchParams } = new URL(request.url);
    const questionNumber = searchParams.get('question_number');
    const teamId = searchParams.get('team_id');

    // フィルタ条件構築
    const where: any = {
      room_id: roomId,
    };

    if (questionNumber) {
      where.question_number = parseInt(questionNumber);
    }

    if (teamId) {
      where.user = {
        team_id: parseInt(teamId),
      };
    }

    // 解答一覧取得
    const answers = await db.answer.findMany({
      where,
      include: {
        user: {
          include: {
            team: true,
          },
        },
      },
      orderBy: {
        submitted_at: 'asc',
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
    const answersWithQuestions = answers.map(answer => ({
      ...answer,
      elapsed_time_ms: answer.elapsed_time_ms ? Number(answer.elapsed_time_ms) : null,
      question: questionMap.get(answer.question_number) || null,
    }));

    return NextResponse.json({ answers: answersWithQuestions });
  } catch (error) {
    console.error('Get answers error:', error);
    return NextResponse.json(
      { error: '内部サーバーエラー' },
      { status: 500 }
    );
  }
}
