'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { pusherClient } from '@/lib/pusher-client';

interface Question {
  id: number;
  question_number: number;
  answer_type: 'free_text' | 'multiple_choice';
  choices: string[] | null;
  started_at: string | null;
}

interface UserStatus {
  id: number;
  username: string;
  team: {
    id: number;
    name: string;
    color: string;
  };
  total_score: number;
  correct_count: number;
}

interface Room {
  id: number;
  room_code: string;
  allow_resubmission: boolean;
  questions: Question[];
}

interface Answer {
  id: number;
  answer_text: string | null;
  selected_choice: number | null;
  elapsed_time_ms: number | null;
  is_correct: boolean | null;
  submitted_at: string;
  question: {
    question_number: number;
    answer_type: string;
    choices: string[] | null;
  };
}

interface Comment {
  id: number;
  comment_text: string;
  created_at: string;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

interface SubmittedAnswer {
  username: string;
  question_number: number;
  answer_text: string | null;
  selected_choice: number | null;
  elapsed_time_ms: number | null;
  answer_type: string;
  choices: string[] | null;
  submitted_at: string;
}

export default function AnswerPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const [room, setRoom] = useState<Room | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<number>(0);
  const [answerText, setAnswerText] = useState('');
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  // トースト通知
  const [toasts, setToasts] = useState<Toast[]>([]);

  // 解答確認モーダル
  const [showAnswerModal, setShowAnswerModal] = useState(false);
  const [lastSubmittedAnswer, setLastSubmittedAnswer] = useState<SubmittedAnswer | null>(null);

  // 履歴データ
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);

  // 履歴セクションの開閉状態
  const [showAnswerHistory, setShowAnswerHistory] = useState(false);
  const [showCommentHistory, setShowCommentHistory] = useState(false);

  // 最新のユーザー情報を参照するためのRef (Pusherのクロージャ用)
  const userStatusRef = useRef<UserStatus | null>(null);
  useEffect(() => {
    userStatusRef.current = userStatus;
  }, [userStatus]);

  useEffect(() => {
    const token = localStorage.getItem('session_token');
    if (!token) {
      router.push('/room/join');
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        // 部屋情報取得
        const roomRes = await fetch(`/api/rooms/${roomId}`);
        const roomData = await roomRes.json();
        if (roomRes.ok) {
          setRoom(roomData.room);
        } else {
          setError(roomData.error || '部屋情報の取得に失敗しました');
        }

        // ユーザーStatus取得
        const meRes = await fetch(`/api/rooms/${roomId}/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const meData = await meRes.json();
        if (meRes.ok) {
          setUserStatus(meData.user);
          // 念のためlocalStorageを更新
          localStorage.setItem('user_name', meData.user.username);
          localStorage.setItem('room_id', roomId);
        } else {
          // 404の場合はジョインし直す
          if (meRes.status === 404) {
            router.push('/room/join');
          }
        }
      } catch (err) {
        console.error('Fetch error:', err);
        setError('通信エラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [roomId, router]);

  // 履歴データの取得
  useEffect(() => {
    // 部屋情報がまだ取得できていない場合は待つ
    if (!room) return;

    const fetchHistory = async () => {
      const token = localStorage.getItem('session_token');
      if (!token) return;

      try {
        // 解答履歴取得
        const ansResponse = await fetch(`/api/rooms/${roomId}/answers/my`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const ansData = await ansResponse.json();
        if (ansResponse.ok) {
          setAnswers(ansData.answers || []);
        }

        // コメント履歴取得
        const comResponse = await fetch(`/api/rooms/${roomId}/comments/my`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const comData = await comResponse.json();
        if (comResponse.ok) {
          setComments(comData.comments || []);
        }
      } catch (err) {
        console.error('Fetch history error:', err);
      }
    };

    fetchHistory();
  }, [roomId, room?.id]);

  // Pusherのセットアップ
  useEffect(() => {
    if (!room) return;

    const channel = pusherClient.subscribe(`room-${room.id}`);

    channel.bind('question-started', (data: any) => {
      // 全体開始、または自分のチームへの開始通知の場合
      // userStatusはクロージャにより最新ではない可能性があるが、team IDは通常変わらない
      if (data.type === 'global' || (data.type === 'team' && userStatus && data.teamId === userStatus.team.id)) {
        setSelectedQuestion(data.questionNumber);
      }
    });

    const refreshUserData = async () => {
      const token = localStorage.getItem('session_token');
      if (!token) return;

      // ユーザーStatus（スコア等）取得
      const meRes = await fetch(`/api/rooms/${roomId}/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (meRes.ok) {
        const meData = await meRes.json();
        setUserStatus(meData.user);
      }

      // 解答履歴再取得
      const ansResponse = await fetch(`/api/rooms/${roomId}/answers/my`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (ansResponse.ok) {
        const ansData = await ansResponse.json();
        setAnswers(ansData.answers || []);
      }
    };

    channel.bind('answer-updated', (data: any) => {
      // 自分の解答が更新された場合、または再計算が行われた場合のみリフレッシュ
      const updatedUserId = data.updatedAnswer?.user_id || data.userId;
      if (data.recalculated || (userStatusRef.current && updatedUserId === userStatusRef.current.id)) {
        refreshUserData();
      }
    });

    channel.bind('answer-deleted', (data: any) => {
      // 自分の解答が削除された可能性があるためリフレッシュ
      if (!data.userId || (userStatusRef.current && data.userId === userStatusRef.current.id)) {
        refreshUserData();
      }
    });

    channel.bind('question-finalized', (data: any) => {
      addToast(`問題 ${data.questionNumber} の得点が確定しました！`, 'success');
      refreshUserData();
    });

    return () => {
      pusherClient.unsubscribe(`room-${room.id}`);
    };
  }, [room?.id]);

  // トースト自動削除
  useEffect(() => {
    if (toasts.length > 0) {
      const timer = setTimeout(() => {
        setToasts((prev) => prev.slice(1));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toasts]);

  // トースト追加
  const addToast = (message: string, type: 'success' | 'error') => {
    const newToast: Toast = {
      id: Date.now(),
      message,
      type,
    };
    setToasts((prev) => [...prev, newToast]);
  };

  const handleSubmit = async () => {
    const token = localStorage.getItem('session_token');

    if (!token) {
      router.push('/room/join');
      return;
    }

    // Question 0 または 存在しない問題番号の場合はデフォルト設定を使用
    let currentQuestion = room?.questions.find(
      (q) => q.question_number === selectedQuestion
    );

    // Q0や未登録の問題の場合のフォールバック
    if (!currentQuestion) {
      currentQuestion = {
        id: -1,
        question_number: selectedQuestion,
        answer_type: 'free_text',
        choices: null,
        started_at: null
      };
    }

    if (currentQuestion.answer_type === 'free_text' && !answerText.trim()) {
      setError('解答を入力してください');
      return;
    }

    if (currentQuestion.answer_type === 'multiple_choice' && selectedChoice === null) {
      setError('選択肢を選んでください');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/rooms/${roomId}/answers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          question_number: selectedQuestion,
          answer_text: currentQuestion.answer_type === 'free_text' ? answerText : undefined,
          selected_choice:
            currentQuestion.answer_type === 'multiple_choice' ? selectedChoice : undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // 送信された解答データを保存
        const submittedData: SubmittedAnswer = {
          username: userStatus?.username || '',
          question_number: selectedQuestion,
          answer_text: currentQuestion.answer_type === 'free_text' ? answerText : null,
          selected_choice: currentQuestion.answer_type === 'multiple_choice' ? selectedChoice : null,
          elapsed_time_ms: data.answer.elapsed_time_ms || null,
          answer_type: currentQuestion.answer_type,
          choices: currentQuestion.choices,
          submitted_at: new Date().toISOString(),
        };
        setLastSubmittedAnswer(submittedData);
        setShowAnswerModal(true);

        setAnswerText('');
        setSelectedChoice(null);

        // スコア更新のために最新情報を取得
        const meRes = await fetch(`/api/rooms/${roomId}/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          setUserStatus(meData.user);
        }

        // 履歴を再取得
        const ansResponse = await fetch(`/api/rooms/${roomId}/answers/my`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const ansData = await ansResponse.json();
        if (ansResponse.ok) {
          setAnswers(ansData.answers || []);
          // 解答履歴を開く
          setShowAnswerHistory(true);
        }
      } else {
        setError(data.error || '解答の送信に失敗しました');
      }
    } catch (err) {
      console.error('Submit answer error:', err);
      setError('解答の送信に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendComment = async () => {
    const token = localStorage.getItem('session_token');

    if (!token) {
      router.push('/room/join');
      return;
    }

    if (!commentText.trim()) {
      setError('コメントを入力してください');
      return;
    }

    setSendingComment(true);
    setError('');

    try {
      const response = await fetch(`/api/rooms/${roomId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          comment_text: commentText,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        addToast('コメントを送信しました！', 'success');
        setCommentText('');

        // コメント履歴を再取得
        const comResponse = await fetch(`/api/rooms/${roomId}/comments/my`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const comData = await comResponse.json();
        if (comResponse.ok) {
          setComments(comData.comments || []);
          // コメント履歴を開く
          setShowCommentHistory(true);
        }
      } else {
        addToast(data.error || 'コメントの送信に失敗しました', 'error');
      }
    } catch (err) {
      console.error('Send comment error:', err);
      setError('コメントの送信に失敗しました');
    } finally {
      setSendingComment(false);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-neutral-900">読み込み中...</div>
      </div>
    );
  }

  if (!room || !userStatus) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg max-w-md">
          <p className="text-red-700 text-sm">{error || '部屋またはユーザー情報が見つかりません'}</p>
          <button
            onClick={() => router.push('/room/join')}
            className="mt-4 w-full py-2 bg-red-600 text-white rounded-md text-sm font-medium"
          >
            ログイン画面に戻る
          </button>
        </div>
      </div>
    );
  }

  const dbQuestion = room.questions.find((q) => q.question_number === selectedQuestion);
  const currentQuestion = dbQuestion || {
    id: -1,
    question_number: selectedQuestion,
    answer_type: 'free_text' as const,
    choices: null,
    started_at: null
  };

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-neutral-900 mb-1">
                部屋: {room.room_code}
              </h2>
              <div className="flex items-center gap-2">
                <span
                  className="px-2 py-0.5 rounded text-md w-32 text-center font-bold text-white uppercase mr-2"
                  style={{ backgroundColor: userStatus.team.color }}
                >
                  {userStatus.team.name}
                </span>
                <p className="text-xl text-neutral-600 font-medium">
                  {userStatus.username}
                </p>
              </div>
            </div>
            <div className="text-right flex flex-col items-end">
              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-1">Your Total Score</p>
              <div className="px-6 py-2 rounded-2xl bg-neutral-100 min-w-[180px] text-right">
                <p className="text-5xl font-black text-rose-700 font-number tracking-normal">
                  {userStatus.total_score.toLocaleString()}<span className="text-xl ml-2 font-bold opacity-50 font-sans tracking-normal">pts</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="bg-white border border-neutral-200 rounded-xl p-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">問題番号を選択</h3>
          <div className="max-w-xs mb-6">
            <select
              className="w-full px-4 py-3 bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
              value={selectedQuestion}
              onChange={(e) => setSelectedQuestion(parseInt(e.target.value))}
            >
              <option value="0">テスト</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => (
                <option key={num} value={num}>
                  問題 {num}
                </option>
              ))}
            </select>
          </div>

          {currentQuestion && (
            <>
              <div className="border-t border-neutral-200 my-6"></div>
              <h3 className="text-xl font-bold text-neutral-900 mb-6">
                {selectedQuestion === 0 ? 'テスト' : `問題 ${selectedQuestion}`}
              </h3>

              {currentQuestion.answer_type === 'free_text' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    解答を入力
                  </label>
                  <textarea
                    className="w-full px-4 py-3 bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all resize-none h-24"
                    placeholder="ここに解答を入力してください"
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    disabled={submitting}
                  ></textarea>
                </div>
              )}

              {currentQuestion.answer_type === 'multiple_choice' &&
                currentQuestion.choices && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      選択肢を選択
                    </label>
                    <div className="space-y-2">
                      {currentQuestion.choices.map((choice, index) => (
                        <button
                          key={index}
                          className={`w-full px-4 py-3 text-left rounded-lg font-medium transition-all border ${selectedChoice === index
                            ? 'bg-neutral-900 text-white border-neutral-900'
                            : 'bg-white text-neutral-900 border-neutral-300 hover:border-neutral-900'
                            }`}
                          onClick={() => setSelectedChoice(index)}
                          disabled={submitting}
                        >
                          {index + 1}. {choice}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              <button
                className="w-full py-4 bg-blue-900 text-white rounded-lg font-medium hover:bg-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-3"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? '送信中...' : '解答を送信'}
              </button>
            </>
          )}
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-6 mt-6">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">コメント</h3>
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              コメントを入力
            </label>
            <textarea
              className="w-full px-4 py-3 bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all resize-none h-24"
              placeholder="質問やコメントを入力してください"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              disabled={sendingComment}
            ></textarea>
          </div>
          <button
            className="w-full py-3 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-xs"
            onClick={handleSendComment}
            disabled={sendingComment}
          >
            {sendingComment ? '送信中...' : 'コメントを送信'}
          </button>
        </div>

        {/* 解答履歴セクション */}
        <div className="bg-white border border-neutral-200 rounded-xl mt-6 overflow-hidden">
          <button
            className="w-full px-6 py-4 flex justify-between items-center hover:bg-neutral-50 transition-all"
            onClick={() => setShowAnswerHistory(!showAnswerHistory)}
          >
            <h3 className="text-lg font-bold text-neutral-900">解答履歴</h3>
            <svg
              className={`w-5 h-5 text-neutral-600 transition-transform ${showAnswerHistory ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showAnswerHistory && (
            <div className="p-6 pt-2 border-t border-neutral-200">
              {answers.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-neutral-500">解答履歴がまだありません</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {answers.map((answer) => (
                    <div
                      key={answer.id}
                      className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 hover:border-neutral-900 transition-all"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-bold text-neutral-900">
                            {answer.question?.question_number === 0 ? 'テスト' : `問題 ${answer.question?.question_number ?? answer.id}`}
                          </h4>
                          <p className="text-xs text-neutral-500 mt-1">
                            {formatDate(answer.submitted_at)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="text-sm font-bold text-neutral-700 font-number">
                            {formatTime(answer.elapsed_time_ms)}
                          </span>
                        </div>
                      </div>
                      <div className="bg-white rounded-md p-3 border border-neutral-200">
                        <p className="text-xs font-medium text-neutral-500 mb-1">あなたの解答:</p>
                        <p className="text-neutral-900 font-bold text-sm whitespace-pre-wrap">
                          {answer.question?.answer_type === 'free_text'
                            ? answer.answer_text
                            : answer.selected_choice !== null && answer.question?.choices
                              ? `${answer.selected_choice + 1}. ${answer.question.choices[answer.selected_choice]}`
                              : answer.answer_text || '-'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* コメント履歴セクション */}
        <div className="bg-white border border-neutral-200 rounded-xl mt-6 overflow-hidden">
          <button
            className="w-full px-6 py-4 flex justify-between items-center hover:bg-neutral-50 transition-all"
            onClick={() => setShowCommentHistory(!showCommentHistory)}
          >
            <h3 className="text-lg font-bold text-neutral-900">コメント履歴</h3>
            <svg
              className={`w-5 h-5 text-neutral-600 transition-transform ${showCommentHistory ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showCommentHistory && (
            <div className="p-6 pt-2 border-t border-neutral-200">
              {comments.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-neutral-500">コメント履歴がまだありません</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 hover:border-neutral-900 transition-all"
                    >
                      <p className="text-xs text-neutral-500 mb-2">
                        {formatDate(comment.created_at)}
                      </p>
                      <p className="text-neutral-900 font-bold text-sm whitespace-pre-wrap">
                        {comment.comment_text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* トースト通知 (右上) */}
      <div className="fixed top-6 right-6 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-6 py-4 rounded-lg shadow-lg border-2 font-medium text-sm transition-all transform animate-slide-in ${toast.type === 'success'
              ? 'bg-green-50 border-green-500 text-green-800'
              : 'bg-red-50 border-red-500 text-red-800'
              }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* 解答確認モーダル (オフキャンバス) */}
      {showAnswerModal && lastSubmittedAnswer && (
        <>
          {/* 背景オーバーレイ */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
            onClick={() => setShowAnswerModal(false)}
          ></div>

          {/* オフキャンバス本体 */}
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto animate-slide-from-right">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold text-neutral-900">解答を送信しました</h2>
                <button
                  onClick={() => setShowAnswerModal(false)}
                  className="text-neutral-500 hover:text-neutral-900 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
                  <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">ユーザー</p>
                  <p className="text-lg font-bold text-neutral-900">{lastSubmittedAnswer.username}</p>
                </div>

                <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
                  <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">問題番号</p>
                  <p className="text-lg font-bold text-neutral-900">
                    {lastSubmittedAnswer.question_number === 0 ? 'テスト' : `問題 ${lastSubmittedAnswer.question_number}`}
                  </p>
                </div>

                <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
                  <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">解答内容</p>
                  <p className="text-neutral-900 font-bold text-base whitespace-pre-wrap">
                    {lastSubmittedAnswer.answer_type === 'free_text'
                      ? lastSubmittedAnswer.answer_text
                      : lastSubmittedAnswer.selected_choice !== null && lastSubmittedAnswer.choices
                        ? `${lastSubmittedAnswer.selected_choice + 1}. ${lastSubmittedAnswer.choices[lastSubmittedAnswer.selected_choice]}`
                        : '-'}
                  </p>
                </div>

                <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
                  <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">解答時間</p>
                  <p className="text-lg font-bold text-neutral-900 font-number">
                    {formatTime(lastSubmittedAnswer.elapsed_time_ms)}
                  </p>
                </div>

                <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
                  <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">送信日時</p>
                  <p className="text-sm font-medium text-neutral-700">
                    {formatDate(lastSubmittedAnswer.submitted_at)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowAnswerModal(false)}
                className="w-full mt-6 py-4 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all"
              >
                閉じる
              </button>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes slide-from-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }

        .animate-slide-from-right {
          animation: slide-from-right 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
