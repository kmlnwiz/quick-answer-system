'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { pusherClient } from '@/lib/pusher-client';

interface Answer {
  id: number;
  answer_text: string | null;
  selected_choice: number | null;
  elapsed_time_ms: number | null;
  is_correct: boolean | null;
  submitted_at: string;
  score: number;
  user: {
    id: number;
    username: string;
    team: {
      id: number;
      team_name: string;
      team_color: string;
    };
  };
  question: {
    id: number;
    question_number: number;
    answer_type: string;
    choices: string[] | null;
    is_finalized: boolean;
    finalized_at: string | null;
  };
  question_number: number;
}

interface Room {
  id: number;
  room_code: string;
}

interface Team {
  id: number;
  name: string;
  color: string;
}

interface Comment {
  id: number;
  comment_text: string;
  created_at: string;
  user: {
    id: number;
    username: string;
    team: {
      id: number;
      name: string;
      color: string;
    };
  };
}

export default function AnswersPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const [room, setRoom] = useState<Room | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [error, setError] = useState('');
  const [filterQuestion, setFilterQuestion] = useState<number | null>(null);
  const [filterTeam, setFilterTeam] = useState<number | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Set<number>>(new Set());

  // フィルターの値を最新状態で参照するためのRef
  const filterQuestionRef = useRef<number | null>(null);
  const filterTeamRef = useRef<number | null>(null);

  useEffect(() => {
    filterQuestionRef.current = filterQuestion;
  }, [filterQuestion]);

  useEffect(() => {
    filterTeamRef.current = filterTeam;
  }, [filterTeam]);

  // Pusherのセットアップ（初回のみ）
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/admin/login');
      return;
    }

    let channel: any;
    let adminChannel: any;
    let dbRoomId: number;

    const setupPusher = async () => {
      try {
        // 部屋情報を取得してIDを特定
        const res = await fetch(`/api/rooms/${roomId}`);
        if (res.ok) {
          const data = await res.json();
          dbRoomId = data.room.id;

          channel = pusherClient.subscribe(`room-${dbRoomId}`);
          adminChannel = pusherClient.subscribe(`admin-room-${dbRoomId}`);

          // 管理者専用チャンネルのイベント（詳細データを含む）
          adminChannel.bind('new-answer', (data: { answer: Answer }) => {
            console.log('新しい解答を受信:', data);
            const currentFilterQuestion = filterQuestionRef.current;
            const currentFilterTeam = filterTeamRef.current;

            const matchesQuestion = currentFilterQuestion === null || data.answer.question_number === currentFilterQuestion;
            const matchesTeam = currentFilterTeam === null || (data.answer.user && data.answer.user.team.id === currentFilterTeam);

            if (matchesQuestion && matchesTeam) {
              setAnswers(prev => {
                if (prev.some(ans => ans.id === data.answer.id)) return prev;
                return [data.answer, ...prev];
              });
            }
          });

          adminChannel.bind('answer-updated', (data: { answerId: number; questionNumber: number; updatedAnswer?: any; recalculated?: boolean }) => {
            console.log('解答が更新されました(admin):', data);
            if (data.updatedAnswer && !data.recalculated) {
              setAnswers(prev => prev.map(ans =>
                ans.id === data.answerId ? { ...ans, ...data.updatedAnswer } : ans
              ));
            } else {
              fetchData();
            }
          });

          adminChannel.bind('answer-deleted', (data: { answerId: number; questionNumber: number }) => {
            console.log('解答が削除されました:', data);
            setAnswers(prev => prev.filter(ans => ans.id !== data.answerId));
          });

          // 一般チャンネルのイベント
          channel.bind('new-comment', (data: { comment: Comment }) => {
            console.log('新しいコメントを受信:', data);
            setComments(prev => {
              if (prev.some(c => c.id === data.comment.id)) return prev;
              return [...prev, data.comment];
            });
          });

          channel.bind('answer-updated', (data: { recalculated?: boolean }) => {
            if (data.recalculated) {
              console.log('一括再計算を受信、データを再取得します');
              fetchData();
            }
          });

          console.log(`Pusherチャンネル room-${dbRoomId} & admin-room-${dbRoomId} に接続しました`);
        }
      } catch (err) {
        console.error('Pusherセットアップエラー:', err);
      }
    };

    setupPusher();

    // BroadcastChannelのセットアップ
    try {
      const bChannel = new BroadcastChannel(`cast-${roomId}`);
      bcRef.current = bChannel;
    } catch (err) {
      console.error('BroadcastChannel初期化エラー:', err);
    }

    return () => {
      if (channel) {
        channel.unbind_all();
        pusherClient.unsubscribe(`room-${dbRoomId}`);
      }
      if (adminChannel) {
        adminChannel.unbind_all();
        pusherClient.unsubscribe(`admin-room-${dbRoomId}`);
      }
      if (bcRef.current) {
        bcRef.current.close();
      }
    };
  }, [roomId, router]);

  // データ取得（初回 + フィルター変更時）
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      return;
    }

    fetchData();
    fetchComments();
  }, [roomId, filterQuestion, filterTeam]);

  // オートスクロール
  useEffect(() => {
    if (autoScroll && commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments, autoScroll]);

  const fetchData = async () => {
    const token = localStorage.getItem('admin_token');

    try {
      // 部屋情報取得
      const roomResponse = await fetch(`/api/rooms/${roomId}`);
      const roomData = await roomResponse.json();

      if (roomResponse.ok) {
        setRoom(roomData.room);
      }

      // チーム一覧取得
      const teamsResponse = await fetch('/api/teams');
      const teamsData = await teamsResponse.json();

      if (teamsResponse.ok) {
        setTeams(teamsData.teams || []);
      }

      // 解答一覧取得
      const params = new URLSearchParams();
      if (filterQuestion !== null) {
        params.append('question_number', filterQuestion.toString());
      }
      if (filterTeam !== null) {
        params.append('team_id', filterTeam.toString());
      }

      const answersResponse = await fetch(
        `/api/rooms/${roomId}/answers?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const answersData = await answersResponse.json();

      if (answersResponse.ok) {
        setAnswers(answersData.answers);
      } else {
        setError(answersData.error || '解答一覧の取得に失敗しました');
      }
    } catch (err) {
      console.error('Fetch data error:', err);
      setError('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await fetch(`/api/rooms/${roomId}/comments?limit=50`);
      if (response.ok) {
        const data = await response.json();
        setComments([...data.comments].reverse());
        setTimeout(() => {
          if (commentsEndRef.current) {
            commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      }
    } catch (err) {
      console.error('Fetch comments error:', err);
    }
  };

  const handleMarkAnswer = async (answerId: number, isCorrect: boolean) => {
    const token = localStorage.getItem('admin_token');

    try {
      const response = await fetch(`/api/rooms/${roomId}/answers/${answerId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Pusher-Socket-ID': pusherClient.connection.socket_id || '',
        },
        body: JSON.stringify({ is_correct: isCorrect }),
      });

      if (response.ok) {
        setAnswers(
          answers.map((answer) =>
            answer.id === answerId ? { ...answer, is_correct: isCorrect } : answer
          )
        );
      } else {
        const data = await response.json();
        setError(data.error || '正解/不正解マークに失敗しました');
      }
    } catch (err) {
      console.error('Mark answer error:', err);
      setError('正解/不正解マークに失敗しました');
    }
  };

  const handleUpdateAnswerManual = async (answerId: number, updates: { score?: number; elapsed_time_ms?: number }) => {
    const token = localStorage.getItem('admin_token');

    try {
      const response = await fetch(`/api/rooms/${roomId}/answers/${answerId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Pusher-Socket-ID': pusherClient.connection.socket_id || '',
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        setAnswers(
          answers.map((answer) =>
            answer.id === answerId ? { ...answer, ...updates } : answer
          )
        );
      } else {
        const data = await response.json();
        setError(data.error || '更新に失敗しました');
      }
    } catch (err) {
      console.error('Update answer error:', err);
      setError('更新に失敗しました');
    }
  };

  const handleDeleteAnswer = async (answerId: number, username: string) => {
    if (!confirm(`${username}の解答を削除しますか？\n削除後、このユーザーは再送信が可能になります。`)) {
      return;
    }

    const token = localStorage.getItem('admin_token');

    try {
      const response = await fetch(`/api/rooms/${roomId}/answers/${answerId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Pusher-Socket-ID': pusherClient.connection.socket_id || '',
        },
      });

      if (response.ok) {
        // 解答が削除されたことは Pusher で通知されるが、即座に反映させる
        setAnswers(prev => prev.filter(ans => ans.id !== answerId));
        alert('解答を削除しました');
      } else {
        const data = await response.json();
        setError(data.error || '解答の削除に失敗しました');
      }
    } catch (err) {
      console.error('Delete answer error:', err);
      setError('解答の削除に失敗しました');
    }
  };

  const formatTime = (ms: number | null) => {
    if (ms === null) return '未計測';
    const seconds = (ms / 1000).toFixed(3);
    return `${seconds}秒`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const sendToCast = async (questionNumber: number) => {
    if (!bcRef.current) {
      alert('BroadcastChannelが初期化されていません');
      return;
    }

    try {
      const correctAnswers = answers.filter(
        (ans) =>
          ans.question.question_number === questionNumber &&
          ans.is_correct === true
      );

      if (correctAnswers.length === 0) {
        alert('この問題の正解者がまだいません');
        return;
      }

      const sortedAnswers = [...correctAnswers].sort((a, b) => {
        const timeA = a.elapsed_time_ms || 0;
        const timeB = b.elapsed_time_ms || 0;
        return timeA - timeB;
      });

      const scoresRes = await fetch(`/api/rooms/${roomId}/scores`);
      if (!scoresRes.ok) {
        throw new Error('得点情報の取得に失敗しました');
      }
      const scoresData = await scoresRes.json();

      const questionScore = scoresData.question_scores.find(
        (qs: any) => qs.question_number === questionNumber
      );

      const castData = sortedAnswers.map((ans, index) => {
        const teamScore = questionScore?.team_scores.find(
          (ts: any) => ts.team_id === ans.user.team.id
        );

        return {
          id: ans.id,
          question_number: questionNumber,
          username: ans.user.username,
          team_name: ans.user.team.team_name,
          team_color: ans.user.team.team_color,
          score: teamScore?.score || 0,
          elapsed_time_ms: ans.elapsed_time_ms || 0,
          rank: index + 1,
        };
      });

      bcRef.current.postMessage({
        type: 'cast-correct-answers',
        data: {
          question_number: questionNumber,
          answers: castData,
        },
      });

      alert(`問題${questionNumber}の正解者情報を表示画面に送信しました`);
    } catch (err: any) {
      console.error('表示画面送信エラー:', err);
      alert(err.message);
    }
  };

  const sendSelectedToCast = async () => {
    if (!bcRef.current) { alert('BroadcastChannelが初期化されていません'); return; }
    if (selectedAnswers.size === 0) { alert('送信する解答を選択してください'); return; }
    try {
      const selectedAnswersList = answers.filter(ans => selectedAnswers.has(ans.id) && ans.is_correct === true);
      if (selectedAnswersList.length === 0) {
        alert('正解の解答が選択されていません');
        return;
      }
      const sortedAnswers = [...selectedAnswersList].sort((a, b) => (a.elapsed_time_ms || 0) - (b.elapsed_time_ms || 0));
      const castData = sortedAnswers.map((ans, index) => ({ id: ans.id, question_number: ans.question_number, username: ans.user.username, team_name: ans.user.team.team_name, team_color: ans.user.team.team_color, score: ans.score || 0, elapsed_time_ms: ans.elapsed_time_ms || 0, rank: index + 1, answer_text: ans.answer_text, selected_choice: ans.selected_choice, question: ans.question }));
      bcRef.current.postMessage({ type: 'cast-correct-answers', data: { question_number: sortedAnswers[0]?.question_number || 0, answers: castData } });
      alert(`${selectedAnswersList.length}件の正解を表示画面に送信しました`);
    } catch (err: any) { console.error('表示画面送信エラー:', err); alert(err.message); }
  };

  const toggleAnswerSelection = (answerId: number) => {
    setSelectedAnswers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(answerId)) {
        newSet.delete(answerId);
      } else {
        newSet.add(answerId);
      }
      return newSet;
    });
  };

  const selectAllCorrect = () => {
    const correctIds = answers
      .filter(ans => ans.is_correct === true && (filterQuestion === null || ans.question_number === filterQuestion))
      .map(ans => ans.id);
    setSelectedAnswers(new Set(correctIds));
  };

  const clearSelection = () => {
    setSelectedAnswers(new Set());
  };

  const handleFinalizeQuestion = async (questionNumber: number) => {
    const undecidedAnswers = answers.filter(
      ans => ans.question_number === questionNumber && ans.is_correct === null
    );

    if (undecidedAnswers.length > 0) {
      alert(
        `未判定の解答が${undecidedAnswers.length}件あります。\n` +
        `すべての解答を正解/不正解に判定してから確定してください。`
      );
      return;
    }

    if (!confirm(`問題${questionNumber}の得点を確定しますか？\n確定後も再確定可能です。`)) return;

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(
        `/api/rooms/${roomId}/questions/${questionNumber}/finalize`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '得点確定に失敗しました');
      }

      const result = await res.json();
      alert(`問題${questionNumber}の得点を確定しました\n正解者数: ${result.correct_answers_count}`);

      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleApplyPointMap = async (questionNumber: number) => {
    if (!confirm(`問題${questionNumber}のポイントマップを再適用しますか？\n全ての正解者の得点が解答スピード順に再計算されます。`)) return;

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(
        `/api/rooms/${roomId}/questions/${questionNumber}/apply-points`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'ポイントマップの適用に失敗しました');
      }

      const result = await res.json();
      alert(`問題${questionNumber}のポイントマップを適用しました\n再計算対象: ${result.recalculated_count}件`);

      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-neutral-900">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">解答一覧</h1>
            {room && (
              <p className="text-sm text-neutral-600">部屋コード: {room.room_code}</p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link
              href={`/admin/room/${roomId}/control`}
              target="_blank"
              className="px-3 py-2 bg-white text-neutral-900 text-sm rounded-lg font-medium border border-red-600 hover:bg-red-600 hover:text-white transition-all"
            >
              問題管理
            </Link>
            <Link
              href={`/admin/room/${roomId}/scores`}
              target="_blank"
              className="px-3 py-2 bg-white text-neutral-900 text-sm rounded-lg font-medium border border-blue-600 hover:bg-blue-600 hover:text-white transition-all"
            >
              チーム得点
            </Link>
            <Link
              href={`/admin/room/${roomId}/individual-scores`}
              target="_blank"
              className="px-3 py-2 bg-white text-neutral-900 text-sm rounded-lg font-medium border border-blue-600 hover:bg-blue-600 hover:text-white transition-all"
            >
              個人得点
            </Link>
            <Link
              href={`/admin/room/${roomId}/cast`}
              target="_blank"
              className="px-3 py-2 bg-white text-neutral-900 text-sm rounded-lg font-medium border border-blue-600 hover:bg-blue-600 hover:text-white transition-all"
            >
              解答スピード
            </Link>
            <Link
              href={`/admin/room/${roomId}/participants`}
              target="_blank"
              className="px-3 py-2 bg-white text-neutral-900 text-sm rounded-lg font-medium border border-blue-600 hover:bg-blue-600 hover:text-white transition-all"
            >
              参加者
            </Link>
            <button
              className="px-3 py-2 bg-white text-neutral-900 text-sm rounded-lg font-medium border border-neutral-900 hover:bg-neutral-900 hover:text-white transition-all"
              onClick={() => router.push('/admin')}
            >
              ダッシュボードに戻る
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-bold text-neutral-900 mb-4">フィルター</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                問題番号
              </label>
              <select
                className="w-full px-4 py-3 bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
                value={filterQuestion ?? ''}
                onChange={(e) =>
                  setFilterQuestion(e.target.value ? parseInt(e.target.value) : null)
                }
              >
                <option value="">すべて</option>
                <option value="0">テスト</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => (
                  <option key={num} value={num}>
                    問題 {num}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                チーム
              </label>
              <select
                className="w-full px-4 py-3 bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
                value={filterTeam ?? ''}
                onChange={(e) =>
                  setFilterTeam(e.target.value ? parseInt(e.target.value) : null)
                }
              >
                <option value="">すべて</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <div className="bg-white border border-neutral-200 rounded-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-neutral-900">解答一覧（{answers.length}件）</h2>
                <div className="flex gap-2">
                  {filterQuestion !== null && (
                    <>
                      <button
                        className="px-4 py-2 bg-orange-600 text-white text-sm rounded-lg font-medium hover:bg-orange-700 transition-all"
                        onClick={() => handleApplyPointMap(filterQuestion)}
                      >
                        ポイントマップを再適用
                      </button>
                    </>
                  )}
                  {selectedAnswers.size > 0 && (
                    <button
                      className="px-4 py-2 bg-neutral-900 text-white text-sm rounded-lg font-medium hover:bg-neutral-800 transition-all"
                      onClick={sendSelectedToCast}
                    >
                      選択した{selectedAnswers.size}件を表示画面に送信
                    </button>
                  )}
                  <button
                    className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg font-medium hover:bg-green-700 transition-all"
                    onClick={selectAllCorrect}
                  >
                    正解を全選択
                  </button>
                  {filterQuestion !== null && (
                    <button
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 transition-all"
                      onClick={() => sendToCast(filterQuestion)}
                    >
                      問題{filterQuestion}の正解者を一括送信
                    </button>
                  )}
                </div>
              </div>

              {answers.length === 0 ? (
                <p className="text-center text-neutral-500 py-8">
                  解答がまだ送信されていません
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-neutral-200">
                        <th className="text-left py-3 px-4 font-semibold text-neutral-700">選択</th>
                        <th className="text-left py-3 px-4 font-semibold text-neutral-700">問題</th>
                        <th className="text-left py-3 px-4 font-semibold text-neutral-700">チーム</th>
                        <th className="text-left py-3 px-4 font-semibold text-neutral-700">ユーザー名</th>
                        <th className="text-left py-3 px-4 font-semibold text-neutral-700">解答内容</th>
                        <th className="text-left py-3 px-4 font-semibold text-neutral-700">解答時間</th>
                        <th className="text-left py-3 px-4 font-semibold text-neutral-700">ポイント</th>
                        <th className="text-left py-3 px-4 font-semibold text-neutral-700">送信日時</th>
                        <th className="text-left py-3 px-4 font-semibold text-neutral-700">判定</th>
                        <th className="text-left py-3 px-4 font-semibold text-neutral-700">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {answers.map((answer) => (
                        <tr key={answer.id} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              checked={selectedAnswers.has(answer.id)}
                              onChange={() => toggleAnswerSelection(answer.id)}
                              disabled={answer.is_correct !== true}
                              className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="py-3 px-4 font-bold text-neutral-900 whitespace-nowrap">
                            {answer.question_number === 0 ? 'テスト' : `問題 ${answer.question_number}`}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-block px-2.5 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-700 whitespace-nowrap">
                              {answer.user.team.team_name}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-neutral-900 whitespace-nowrap">{answer.user.username}</td>
                          <td className="py-3 px-4 min-w-[200px] text-neutral-700">
                            {answer.question?.answer_type === 'free_text' || !answer.question
                              ? answer.answer_text
                              : answer.selected_choice !== null &&
                                answer.question.choices
                                ? `${answer.selected_choice + 1}. ${answer.question.choices[answer.selected_choice]
                                }`
                                : '選択肢不明'}
                          </td>
                          <td className="py-3 px-4 text-left">
                            <input
                              type="number"
                              step="0.001"
                              className="w-24 px-2 py-1 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900 bg-transparent font-mono"
                              defaultValue={(Number(answer.elapsed_time_ms || 0) / 1000).toFixed(3)}
                              onBlur={(e) => {
                                const newSeconds = parseFloat(e.target.value);
                                if (!isNaN(newSeconds)) {
                                  const newMs = Math.round(newSeconds * 1000);
                                  if (newMs !== Number(answer.elapsed_time_ms)) {
                                    handleUpdateAnswerManual(answer.id, { elapsed_time_ms: newMs });
                                  }
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                            />
                            <span className="ml-1 text-xs text-neutral-500">秒</span>
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="number"
                              className="w-16 px-2 py-1 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900 bg-transparent"
                              defaultValue={answer.score}
                              onBlur={(e) => {
                                const newScore = parseInt(e.target.value);
                                if (!isNaN(newScore) && newScore !== answer.score) {
                                  handleUpdateAnswerManual(answer.id, { score: newScore });
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                            />
                            <span className="ml-1 text-xs text-neutral-500">pt</span>
                          </td>
                          <td className="py-3 px-4 text-xs text-neutral-600 whitespace-nowrap">
                            {formatDate(answer.submitted_at)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex justify-center">
                              {answer.is_correct === null ? (
                                <span className="inline-block w-16 text-center py-1 rounded-md text-xs font-medium bg-neutral-100 text-neutral-600">未判定</span>
                              ) : answer.is_correct ? (
                                <span className="inline-block w-16 text-center py-1 rounded-md text-xs font-medium bg-green-100 text-green-700">正解</span>
                              ) : (
                                <span className="inline-block w-16 text-center py-1 rounded-md text-xs font-medium bg-red-100 text-red-700">不正解</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex gap-1 justify-end">
                              <button
                                className={`p-1.5 rounded transition-colors ${answer.is_correct === true ? 'bg-green-600 text-white' : 'bg-neutral-100 text-neutral-400 hover:text-green-600'}`}
                                onClick={() => handleMarkAnswer(answer.id, true)}
                                title="正解にする"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button
                                className={`p-1.5 rounded transition-colors ${answer.is_correct === false ? 'bg-red-600 text-white' : 'bg-neutral-100 text-neutral-400 hover:text-red-600'}`}
                                onClick={() => handleMarkAnswer(answer.id, false)}
                                title="不正解にする"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                              <button
                                className="p-1.5 bg-neutral-100 text-neutral-400 hover:bg-red-100 hover:text-red-600 rounded transition-colors"
                                onClick={() => handleDeleteAnswer(answer.id, answer.user.username)}
                                title="削除"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="w-80 flex-shrink-0">
            <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm sticky top-6 max-h-[calc(100vh-3rem)] flex flex-col">
              <div className="p-4 border-b border-neutral-200 bg-neutral-50 flex justify-between items-center">
                <h2 className="font-bold text-neutral-900">リアルタイムコメント</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAutoScroll(!autoScroll)}
                    className={`p-1.5 rounded text-[10px] font-bold uppercase transition-all ${autoScroll ? 'bg-green-600 text-white' : 'bg-neutral-200 text-neutral-500'}`}
                  >
                    Auto
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {comments.length === 0 ? (
                  <p className="text-center text-neutral-500 py-4 text-sm mt-8">
                    コメントはまだありません
                  </p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="animate-slide-in">
                      <div className="flex justify-between items-center mb-1">
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white uppercase"
                          style={{ backgroundColor: comment.user.team.color }}
                        >
                          {comment.user.team.name}
                        </span>
                        <span className="text-[9px] text-neutral-400 font-mono">
                          {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-2.5">
                        <p className="text-[11px] font-black text-neutral-900 mb-0.5">{comment.user.username}</p>
                        <p className="text-xs text-neutral-700 leading-normal">{comment.comment_text}</p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={commentsEndRef}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
