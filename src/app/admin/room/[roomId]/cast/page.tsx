'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';

interface CastAnswer {
  id: number;
  question_number: number;
  username: string;
  team_name: string;
  team_color: string;
  score: number;
  elapsed_time_ms: number;
  rank: number;
  answer_text?: string | null;
  selected_choice?: number | null;
  question?: {
    question_number: number;
    answer_type: string;
    choices: string[] | null;
  };
}

export default function CastPage() {
  const params = useParams();
  const roomId = params?.roomId as string;

  const [answers, setAnswers] = useState<CastAnswer[]>([]);
  const [roomCode, setRoomCode] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState<number | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (!roomId) return;

    // 部屋情報を取得
    const fetchRoom = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}`);
        if (res.ok) {
          const data = await res.json();
          setRoomCode(data.room.room_code);
        }
      } catch (err) {
        console.error('部屋情報取得エラー:', err);
      }
    };

    fetchRoom();

    // BroadcastChannelのセットアップ
    try {
      const channel = new BroadcastChannel(`cast-${roomId}`);
      bcRef.current = channel;

      channel.onmessage = (event) => {
        const { type, data } = event.data;

        if (type === 'cast-correct-answers') {
          // 正解者情報を受信して追加（既存の解答と統合し、解答時間順にソート）
          const { question_number, answers: newAnswers } = data;
          setCurrentQuestion(question_number);

          // 既存の解答と新しい解答を統合（重複を除く）
          setAnswers(prev => {
            const existingIds = new Set(prev.map(a => a.id));
            const uniqueNewAnswers = newAnswers.filter((a: CastAnswer) => !existingIds.has(a.id));
            const combined = [...prev, ...uniqueNewAnswers];

            // 解答時間順にソートして順位を再計算
            const sorted = combined.sort((a, b) => (a.elapsed_time_ms || 0) - (b.elapsed_time_ms || 0));
            return sorted.map((ans, index) => ({ ...ans, rank: index + 1 }));
          });
        } else if (type === 'cast-single-answer') {
          // 単一の解答を追加
          const newAnswer = data as CastAnswer;
          setCurrentQuestion(newAnswer.question_number);

          setAnswers(prev => {
            // 既に存在する場合は追加しない
            if (prev.some(a => a.id === newAnswer.id)) {
              return prev;
            }

            const combined = [...prev, newAnswer];
            // 解答時間順にソートして順位を再計算
            const sorted = combined.sort((a, b) => (a.elapsed_time_ms || 0) - (b.elapsed_time_ms || 0));
            return sorted.map((ans, index) => ({ ...ans, rank: index + 1 }));
          });
        } else if (type === 'remove-answer') {
          // 特定の解答を削除
          const { answerId } = data;
          setAnswers(prev => {
            const filtered = prev.filter(a => a.id !== answerId);
            // 順位を再計算
            return filtered.map((ans, index) => ({ ...ans, rank: index + 1 }));
          });
        } else if (type === 'clear-cast') {
          // 画面をクリア
          setAnswers([]);
          setCurrentQuestion(null);
        }
      };
    } catch (err) {
      console.error('BroadcastChannel初期化エラー:', err);
    }

    return () => {
      if (bcRef.current) {
        bcRef.current.close();
      }
    };
  }, [roomId]);

  const formatTimeParts = (ms: number) => {
    const seconds = ms / 1000;
    const [int, decimal] = seconds.toFixed(3).split(".");
    return { int, decimal };
  };

  const formatTime = (ms: number) => {
    const { int, decimal } = formatTimeParts(ms);

    return (
      <>
        {int}.
        <span className="text-4xl mr-4">{decimal}</span>
        秒
      </>
    );
  };


  const handleClearCast = () => {
    if (bcRef.current) {
      bcRef.current.postMessage({ type: 'clear-cast' });
    }
    setAnswers([]);
    setCurrentQuestion(null);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 flex flex-col">
      <div className="relative z-10 max-w-[1600px] mx-auto w-full flex-1 flex flex-col px-4">
        {/* Header */}
        <header className="flex justify-between items-end mb-6 border-b border-white/20 pb-4">
          <div>
            <h1 className="text-5xl font-bold tracking-tight uppercase">
              解答スピードランキング
            </h1>
            <p className="text-sm font-medium text-neutral-500 mt-1 tracking-wider uppercase">
              Speed Ranking • Room {roomCode}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {currentQuestion !== null && (
              <div className="bg-yellow-400 text-black px-6 py-2 rounded-lg font-black text-2xl shadow-xl">
                問題 {currentQuestion === 0 ? 'テスト' : currentQuestion}
              </div>
            )}
          </div>
        </header>

        {/* Content Area */}
        {answers.length > 0 ? (
          <div className="flex-1 overflow-y-auto pr-2 scroll-smooth">
            <div className="grid grid-cols-1 gap-2 pb-6">
              {answers.map((answer, index) => (
                <div
                  key={answer.id}
                  className={`flex items-center rounded-xl transition-all duration-300 ${(answer.elapsed_time_ms === answers[0].elapsed_time_ms && answer.elapsed_time_ms > 0)
                    ? 'bg-gradient-to-r from-yellow-400/20 to-transparent border border-yellow-400/50'
                    : 'bg-white/5 border border-white/10'
                    }`}
                >
                  <div className="w-full flex items-center p-3 gap-4">
                    {/* Rank Badge */}
                    <div className="w-24 h-16 flex-shrink-0 flex items-center justify-center border-r border-white/10">
                      <span className={`text-5xl font-black font-number ${(index === 0 || answer.elapsed_time_ms === answers[0].elapsed_time_ms) ? 'text-yellow-400' :
                        (index > 0 && answers[index].elapsed_time_ms === answers[1]?.elapsed_time_ms) ? 'text-neutral-300' :
                          (index > 0 && answers[index].elapsed_time_ms === answers[2]?.elapsed_time_ms) ? 'text-orange-400' :
                            'text-neutral-600'
                        }`}>
                        {(answers.findIndex(a => a.elapsed_time_ms === answer.elapsed_time_ms) + 1).toLocaleString()}
                      </span>
                    </div>

                    {/* Team & User Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: answer.team_color }}></div>
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
                          {answer.team_name}
                        </span>
                      </div>
                      <div className="text-4xl font-bold tracking-tight">
                        {answer.username}
                      </div>
                    </div>

                    {/* Speed & Score */}
                    <div className="text-right px-4 flex items-center gap-6">
                      <div className="border-l border-white/10 pl-6 min-w-[120px]">
                        <div className="text-[12px] font-bold text-neutral-500 mb-1 uppercase tracking-widest">Speed</div>
                        <div className="text-5xl font-bold text-white font-number">
                          {formatTime(answer.elapsed_time_ms)}
                        </div>
                      </div>
                      {/* テスト問題(問題0)の場合はポイントを表示しない */}
                      {answer.question_number !== 0 && (
                        <div className="border-l border-white/10 pl-6 min-w-[200px] text-right">
                          <div className="text-[12px] font-bold text-neutral-500 mb-1 uppercase tracking-widest">Points</div>
                          <div className="text-5xl font-black text-yellow-400 font-number">
                            +{answer.score.toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-3xl">
            <div className="text-3xl font-bold text-neutral-600 uppercase tracking-widest animate-pulse">
              {currentQuestion !== null ? '正解者を待っています...' : '待機中'}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-4 flex justify-between items-center opacity-40 px-2 pb-2 text-[10px] font-bold uppercase tracking-widest">
          <div>Quick Answer System • Results Feed</div>
          <div>Room: {roomCode}</div>
        </footer>
      </div>
    </div>
  );
}
