import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';

interface TeamScore {
  team_id: number;
  team_name: string;
  team_color: string;
  total_score: number;
  correct_count: number;
  answer_count: number;
}

interface UserScore {
  user_id: number;
  username: string;
  team_id: number;
  team_name: string;
  team_color: string;
  total_score: number;
  correct_count: number;
  answer_count: number;
}

interface QuestionScore {
  question_number: number;
  team_scores: {
    team_id: number;
    team_name: string;
    score: number;
    answered_by?: string;
    elapsed_time_ms?: number;
  }[];
}

/**
 * GET /api/rooms/[roomId]/scores
 * チーム別・個人別の得点を取得
 */
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
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return NextResponse.json(
        { error: '部屋が見つかりません' },
        { status: 404 }
      );
    }

    // 全チームを取得
    const teams = await prisma.team.findMany({
      orderBy: { display_order: 'asc' },
    });

    // 全正解の解答を取得（チーム別集計用）
    const correctAnswers = await prisma.answer.findMany({
      where: {
        room_id: roomId,
        is_correct: true,
        question_number: { not: 0 },
      },
      include: {
        user: {
          include: {
            team: true,
          },
        },
      },
      orderBy: [
        { question_number: 'asc' },
        { elapsed_time_ms: 'asc' },
      ],
    });

    // チーム別得点を集計
    const teamScoresMap = new Map<number, TeamScore>();
    teams.forEach((team) => {
      teamScoresMap.set(team.id, {
        team_id: team.id,
        team_name: team.name,
        team_color: team.color,
        total_score: 0,
        correct_count: 0,
        answer_count: 0,
      });
    });

    // 全解答数をチーム別にカウント
    const answerCounts = await prisma.answer.groupBy({
      by: ['user_id'],
      where: { room_id: roomId },
      _count: { id: true },
    });

    const userTeamMap = new Map<number, number>();
    const users = await prisma.user.findMany({
      where: { room_id: roomId },
      select: { id: true, team_id: true },
    });
    users.forEach((user) => {
      userTeamMap.set(user.id, user.team_id);
    });

    answerCounts.forEach((count) => {
      const teamId = userTeamMap.get(count.user_id);
      if (teamId) {
        const teamScore = teamScoresMap.get(teamId);
        if (teamScore) {
          teamScore.answer_count += count._count.id;
        }
      }
    });

    // 正解数と得点を集計
    correctAnswers.forEach((answer) => {
      const teamId = answer.user.team_id;
      const teamScore = teamScoresMap.get(teamId);
      if (teamScore) {
        teamScore.total_score += answer.score;
        teamScore.correct_count += 1;
      }
    });

    const teamScores = Array.from(teamScoresMap.values()).sort(
      (a, b) => {
        if (b.total_score !== a.total_score) {
          return b.total_score - a.total_score;
        }
        return b.correct_count - a.correct_count;
      }
    );

    // ユーザー別得点を集計
    const userScoresMap = new Map<number, UserScore>();

    const allUsers = await prisma.user.findMany({
      where: { room_id: roomId },
      include: { team: true },
    });

    allUsers.forEach((user) => {
      userScoresMap.set(user.id, {
        user_id: user.id,
        username: user.username,
        team_id: user.team_id,
        team_name: user.team.name,
        team_color: user.team.color,
        total_score: 0,
        correct_count: 0,
        answer_count: 0,
      });
    });

    // ユーザー別解答数をカウント
    answerCounts.forEach((count) => {
      const userScore = userScoresMap.get(count.user_id);
      if (userScore) {
        userScore.answer_count = count._count.id;
      }
    });

    // ユーザー別正解数と得点を集計
    correctAnswers.forEach((answer) => {
      const userScore = userScoresMap.get(answer.user_id);
      if (userScore) {
        userScore.total_score += answer.score;
        userScore.correct_count += 1;
      }
    });

    const userScores = Array.from(userScoresMap.values()).sort(
      (a, b) => {
        if (b.total_score !== a.total_score) {
          return b.total_score - a.total_score;
        }
        return b.correct_count - a.correct_count;
      }
    );

    // 全正解の解答を取得（問題別集計用 - すでに取得済みの correctAnswers を再利用可能だが、
    // ここでは question_scores 用に構造化する）

    // 正解の解答を問題番号ごとにグループ化
    const answersByQuestion = new Map<number, typeof correctAnswers>();
    correctAnswers.forEach(ans => {
      const qNum = ans.question_number;
      if (!answersByQuestion.has(qNum)) {
        answersByQuestion.set(qNum, []);
      }
      answersByQuestion.get(qNum)!.push(ans);
    });

    const questionScores: QuestionScore[] = [];
    for (let q = 0; q <= room.total_questions; q++) {
      const questionAnswers = answersByQuestion.get(q) || [];

      const teamScoresForQuestion = teams.map((team) => {
        const teamAnswer = questionAnswers.find(
          (ans) => ans.user.team_id === team.id
        );

        return {
          team_id: team.id,
          team_name: team.name,
          team_color: team.color,
          score: teamAnswer?.score || 0,
          answered_by: teamAnswer?.user.username,
          elapsed_time_ms: teamAnswer?.elapsed_time_ms
            ? Number(teamAnswer.elapsed_time_ms)
            : undefined,
        };
      });

      questionScores.push({
        question_number: q,
        team_scores: teamScoresForQuestion,
      });
    }

    return NextResponse.json({
      team_scores: teamScores,
      user_scores: userScores,
      question_scores: questionScores,
      room: {
        id: room.id,
        room_code: room.room_code,
        total_questions: room.total_questions,
        score_table: room.score_table,
      },
    });
  } catch (error) {
    console.error('得点取得エラー:', error);
    return NextResponse.json(
      { error: '得点の取得に失敗しました' },
      { status: 500 }
    );
  }
}
