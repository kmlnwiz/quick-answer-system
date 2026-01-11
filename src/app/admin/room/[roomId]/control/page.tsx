'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface User {
  id: number;
  username: string;
  team: {
    id: number;
    name: string;
    color: string;
  };
}

interface Team {
  id: number;
  name: string;
  color: string;
}

interface QuestionStartInfo {
  question_number: number;
  global_start_time: string | null;
  team_starts: {
    team_id: number;
    team_name: string;
    start_time: string;
  }[];
}

interface QuestionInfo {
  id: number;
  question_number: number;
  answer_type: string;
  choices: string[] | null;
  correct_answer: string | null;
  allow_resubmission: boolean | null;
  is_finalized: boolean;
  finalized_at: string | null;
}

interface RoomInfo {
  id: number;
  room_code: string;
  total_questions: number;
}

export default function QuestionControlPage() {
  const params = useParams();
  const roomId = params?.roomId as string;

  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [startInfos, setStartInfos] = useState<QuestionStartInfo[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 問題設定用のstate
  const [questionInfo, setQuestionInfo] = useState<QuestionInfo | null>(null);
  const [answerType, setAnswerType] = useState('free_text');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [choices, setChoices] = useState<string[]>(['', '', '', '']);
  const [allowResubmission, setAllowResubmission] = useState<boolean | null>(null);

  // データを一括取得
  useEffect(() => {
    if (!roomId) return;

    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        // 部屋情報とチーム情報を並列で取得
        const [roomRes, teamsRes] = await Promise.all([
          fetch(`/api/rooms/${roomId}`),
          fetch('/api/teams')
        ]);

        if (!roomRes.ok) throw new Error('部屋情報の取得に失敗しました');
        const roomData = await roomRes.json();

        const roomInfo = roomData.room;
        setRoom(roomInfo);
        setSelectedQuestion(0);

        if (teamsRes.ok) {
          const teamsData = await teamsRes.json();
          setTeams(teamsData.teams || []);
        }

        // 部屋情報の questions から開始時刻情報を構築
        if (roomInfo && roomInfo.questions) {
          const infos: QuestionStartInfo[] = roomInfo.questions.map((q: any) => ({
            question_number: q.question_number,
            global_start_time: q.global_start_time,
            team_starts: (q.question_team_starts || []).map((ts: any) => ({
              team_id: ts.team_id,
              team_name: ts.team?.name || '不明',
              start_time: ts.start_time,
            })),
          }));
          setStartInfos(infos);
        }
      } catch (err: any) {
        console.error('Data fetch error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [roomId]);

  // 問題情報を取得
  useEffect(() => {
    if (!roomId || selectedQuestion === null) return;

    const fetchQuestionInfo = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}/questions/${selectedQuestion}`);
        if (res.ok) {
          const data = await res.json();
          const q = data.question;
          setQuestionInfo(q);
          setAnswerType(q.answer_type || 'free_text');
          setCorrectAnswer(q.correct_answer || '');
          setChoices(q.choices || ['', '', '', '']);
          setAllowResubmission(q.allow_resubmission);
        }
      } catch (err) {
        console.error('問題情報取得エラー:', err);
      }
    };

    fetchQuestionInfo();
  }, [roomId, selectedQuestion]);

  // 全問題の開始時刻情報を更新する関数（操作後のリロード用）
  const fetchAllStartTimes = async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}`);
      if (res.ok) {
        const data = await res.json();
        const roomInfo = data.room;
        if (roomInfo && roomInfo.questions) {
          const infos: QuestionStartInfo[] = roomInfo.questions.map((q: any) => ({
            question_number: q.question_number,
            global_start_time: q.global_start_time,
            team_starts: (q.question_team_starts || []).map((ts: any) => ({
              team_id: ts.team_id,
              team_name: ts.team?.name || '不明',
              start_time: ts.start_time,
            })),
          }));
          setStartInfos(infos);
        }
      }
    } catch (err: any) {
      console.error('開始状況更新エラー:', err);
    }
  };

  // 全体開始ボタン
  const handleGlobalStart = async () => {
    if (!confirm(`問題${selectedQuestion}を全体開始しますか？`)) return;

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(
        `/api/rooms/${roomId}/questions/${selectedQuestion}/start`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '全体開始に失敗しました');
      }

      alert('全体開始しました');
      fetchAllStartTimes(); // リロードの代わりに情報を再取得
    } catch (err: any) {
      alert(err.message);
    }
  };

  // チーム別開始ボタン
  const handleTeamStart = async (teamId: number, teamName: string) => {
    if (!confirm(`問題${selectedQuestion}を${teamName}のみ開始しますか？`))
      return;

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(
        `/api/rooms/${roomId}/questions/${selectedQuestion}/start-team`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ team_id: teamId }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'チーム別開始に失敗しました');
      }

      alert(`${teamName}の開始合図を送りました`);
      fetchAllStartTimes(); // リロードの代わりに情報を再取得
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 問題設定を保存
  const handleSaveQuestionSettings = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const body: any = {
        answer_type: answerType,
        correct_answer: correctAnswer,
        allow_resubmission: allowResubmission,
      };

      if (answerType === 'multiple_choice') {
        body.choices = choices.filter(c => c.trim() !== '');
      }

      const res = await fetch(
        `/api/rooms/${roomId}/questions/${selectedQuestion}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '設定の保存に失敗しました');
      }

      alert('問題設定を保存しました');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const currentStartInfo = startInfos.find(
    (info) => info.question_number === selectedQuestion
  );

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('ja-JP');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-neutral-900">読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-neutral-900">問題管理</h1>
          <Link
            href={`/admin/room/${roomId}/answers`}
            className="px-4 py-2 bg-white text-neutral-700 rounded-lg font-medium border border-neutral-300 hover:border-neutral-900 transition-all"
          >
            解答一覧に戻る
          </Link>
        </div>

        {room && (
          <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-bold text-neutral-900 mb-3">部屋情報</h2>
            <p className="text-neutral-700">
              部屋コード: <span className="font-bold text-neutral-900">{room.room_code}</span>
            </p>
            <p className="text-neutral-700">問題数: {room.total_questions}</p>
          </div>
        )}

        {/* 問題番号選択 */}
        <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-bold text-neutral-900 mb-4">問題番号を選択</h2>
          <div className="max-w-xs">
            <select
              className="w-full px-4 py-3 bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
              value={selectedQuestion}
              onChange={(e) => setSelectedQuestion(parseInt(e.target.value))}
            >
              <option value="0">テスト</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((q) => (
                <option key={q} value={q}>
                  問題 {q}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 問題設定セクション */}
        <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-bold text-neutral-900 mb-4">問題設定</h2>

          {/* 問題タイプ */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">問題タイプ</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="free_text"
                  checked={answerType === 'free_text'}
                  onChange={(e) => setAnswerType(e.target.value)}
                  className="w-4 h-4 text-neutral-900 focus:ring-neutral-900"
                />
                <span className="text-sm text-neutral-700">自由入力</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="multiple_choice"
                  checked={answerType === 'multiple_choice'}
                  onChange={(e) => setAnswerType(e.target.value)}
                  className="w-4 h-4 text-neutral-900 focus:ring-neutral-900"
                />
                <span className="text-sm text-neutral-700">択一選択</span>
              </label>
            </div>
          </div>

          {/* 選択肢（択一選択の場合のみ） */}
          {answerType === 'multiple_choice' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 mb-2">選択肢</label>
              {choices.map((choice, index) => (
                <input
                  key={index}
                  type="text"
                  value={choice}
                  onChange={(e) => {
                    const newChoices = [...choices];
                    newChoices[index] = e.target.value;
                    setChoices(newChoices);
                  }}
                  placeholder={`選択肢 ${index + 1}`}
                  className="w-full px-4 py-2 mb-2 bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                />
              ))}
            </div>
          )}

          {/* 想定解答 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              想定解答
              {answerType === 'multiple_choice' && '（選択肢のインデックス: 0, 1, 2, 3）'}
              {answerType === 'free_text' && '（カンマ区切りで複数指定可能）'}
            </label>
            <input
              type="text"
              value={correctAnswer}
              onChange={(e) => setCorrectAnswer(e.target.value)}
              placeholder={answerType === 'multiple_choice' ? '例: 0' : '例: 東京, とうきょう, Tokyo'}
              className="w-full px-4 py-2 bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
            />
            {answerType === 'free_text' && (
              <p className="text-xs text-neutral-500 mt-1">
                ※ 複数の解答を許容する場合はカンマで区切って入力してください。大文字・小文字、前後の空白は区別されません。
              </p>
            )}
          </div>

          {/* 再送許可 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">再送許可</label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={allowResubmission === null}
                  onChange={() => setAllowResubmission(null)}
                  className="w-4 h-4 text-neutral-900 focus:ring-neutral-900"
                />
                <span className="text-sm text-neutral-700">部屋の設定を使用</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={allowResubmission === true}
                  onChange={() => setAllowResubmission(true)}
                  className="w-4 h-4 text-neutral-900 focus:ring-neutral-900"
                />
                <span className="text-sm text-neutral-700">この問題のみ許可</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={allowResubmission === false}
                  onChange={() => setAllowResubmission(false)}
                  className="w-4 h-4 text-neutral-900 focus:ring-neutral-900"
                />
                <span className="text-sm text-neutral-700">この問題のみ不許可</span>
              </label>
            </div>
          </div>

          {/* 保存ボタン */}
          <button
            onClick={handleSaveQuestionSettings}
            className="px-6 py-3 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all"
          >
            設定を保存
          </button>
        </div>

        {/* 現在の状態表示 */}
        {currentStartInfo && (
          <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-bold text-neutral-900 mb-4">問題{selectedQuestion}の状態</h2>

            <div className="mb-6">
              <h3 className="font-semibold text-neutral-900 mb-2">全体開始時刻</h3>
              <p>
                {currentStartInfo.global_start_time ? (
                  <span className="inline-block px-3 py-1.5 rounded-md text-sm font-medium bg-green-100 text-green-700">
                    {formatDateTime(currentStartInfo.global_start_time)}
                  </span>
                ) : (
                  <span className="inline-block px-3 py-1.5 rounded-md text-sm font-medium bg-neutral-100 text-neutral-600">未開始</span>
                )}
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-neutral-900 mb-3">チーム別開始時刻</h3>
              <div className="space-y-2">
                {teams.map((team) => {
                  const teamStart = currentStartInfo.team_starts.find(
                    (ts) => ts.team_id === team.id
                  );
                  return (
                    <div
                      key={team.id}
                      className="flex justify-between items-center p-3 rounded-lg bg-neutral-50 border border-neutral-200"
                    >
                      <span className="font-semibold text-neutral-900">
                        {team.name}
                      </span>
                      <span>
                        {teamStart ? (
                          <span className="inline-block px-2.5 py-1 rounded-md text-xs font-medium bg-green-100 text-green-700">
                            {formatDateTime(teamStart.start_time)}
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-1 rounded-md text-xs font-medium bg-neutral-100 text-neutral-600">未開始</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 操作パネル */}
        <div className="bg-white border border-neutral-200 rounded-xl p-6">
          <h2 className="text-lg font-bold text-neutral-900 mb-6">操作</h2>

          <div className="mb-6">
            <h3 className="font-semibold text-neutral-900 mb-3">全体開始</h3>
            <button
              className="px-6 py-3 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all"
              onClick={handleGlobalStart}
            >
              問題{selectedQuestion}を全体開始
            </button>
            <p className="text-sm text-neutral-600 mt-2">
              全チームに対して同時に開始合図を送ります
            </p>
          </div>

          <div className="border-t border-neutral-200 my-6"></div>

          <div>
            <h3 className="font-semibold text-neutral-900 mb-3">チーム別開始</h3>
            <div className="flex flex-wrap gap-2">
              {teams.map((team) => (
                <button
                  key={team.id}
                  className="px-4 py-2 bg-white text-neutral-900 border border-neutral-300 rounded-lg font-medium hover:border-neutral-900 transition-all"
                  onClick={() => handleTeamStart(team.id, team.name)}
                >
                  {team.name} 開始
                </button>
              ))}
            </div>
            <p className="text-sm text-neutral-600 mt-2">
              特定のチームのみに開始合図を送ります
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
