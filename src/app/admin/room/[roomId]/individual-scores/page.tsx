'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

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

interface RoomInfo {
    id: number;
    room_code: string;
    total_questions: number;
}

export default function IndividualScoresPage() {
    const params = useParams();
    const roomId = params?.roomId as string;

    const [room, setRoom] = useState<RoomInfo | null>(null);
    const [userScores, setUserScores] = useState<UserScore[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchScores = async () => {
        try {
            const res = await fetch(`/api/rooms/${roomId}/scores`);
            if (!res.ok) throw new Error('得点の取得に失敗しました');

            const data = await res.json();
            setRoom(data.room);
            setUserScores(data.user_scores);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!roomId) return;
        fetchScores();

        // 定期的な自動更新 (5秒おき)
        const interval = setInterval(fetchScores, 5000);
        return () => clearInterval(interval);
    }, [roomId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-6 text-white text-center">
                <div className="p-8 border border-red-500/30 bg-red-500/10 rounded-3xl">
                    <p className="text-xl font-bold">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white p-12 flex flex-col">
            <div className="relative z-10 max-w-[1600px] mx-auto w-full flex-1 flex flex-col px-4">
                {/* Header */}
                <header className="flex justify-between items-end mb-12 border-b border-white/20 pb-8">
                    <div>
                        <h1 className="text-7xl font-bold tracking-tight uppercase">
                            個人ランキング
                        </h1>
                        <p className="text-lg font-medium text-neutral-500 mt-2 tracking-wider uppercase">
                            Individual Rankings • Room {room?.room_code}
                        </p>
                        <div className="flex gap-4 mt-6">
                            <Link
                                href={`/admin/room/${roomId}/scores`}
                                className="px-6 py-3 bg-white/10 text-white rounded-xl font-bold border border-white/20 hover:bg-white/20 transition-all"
                            >
                                TEAM
                            </Link>
                            <Link
                                href={`/admin/room/${roomId}/individual-scores`}
                                className="px-6 py-3 bg-yellow-400 text-black rounded-xl font-bold border border-yellow-400/50 hover:bg-yellow-500 transition-all shadow-[0_0_20px_rgba(250,204,21,0.2)]"
                            >
                                INDIVIDUAL
                            </Link>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="flex gap-2 items-center justify-end text-green-500">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            <span className="text-sm font-bold tracking-widest">LIVE</span>
                        </div>
                    </div>
                </header>

                {/* Content Area - Rankings List */}
                <div className="flex-1 space-y-4 overflow-y-auto pr-2 scroll-smooth">
                    {userScores.map((user, index) => (
                        <div
                            key={user.user_id}
                            className={`flex items-center rounded-2xl transition-all duration-300 ${index === 0
                                ? 'bg-gradient-to-r from-yellow-400/20 to-transparent border border-yellow-400/50 shadow-[0_0_40px_rgba(250,204,21,0.1)]'
                                : 'bg-white/5 border border-white/10'
                                }`}
                        >
                            <div className="w-full flex items-center p-6 gap-8">
                                {/* Rank Number */}
                                <div className="w-24 flex-shrink-0 flex items-center justify-center border-r border-white/10">
                                    <span className={`text-6xl font-black ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-neutral-300' : index === 2 ? 'text-orange-400' : 'text-neutral-600'
                                        }`}>
                                        {index + 1}
                                    </span>
                                </div>

                                {/* User Info */}
                                <div className="flex-1">
                                    <div className="flex items-center gap-6">
                                        <div
                                            className="w-2 h-12 rounded-full"
                                            style={{ backgroundColor: user.team_color }}
                                        ></div>
                                        <div className="flex flex-col">
                                            <div className="text-4xl font-bold tracking-tight">
                                                {user.username}
                                            </div>
                                            <div className="text-xl font-medium text-neutral-500">
                                                {user.team_name}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="flex items-center gap-12 text-right">
                                    <div className="px-6 border-l border-white/10">
                                        <div className="text-xs font-bold text-neutral-500 mb-1 uppercase tracking-widest">Correct</div>
                                        <div className="text-3xl font-bold">{user.correct_count}</div>
                                    </div>
                                    <div className="px-6 border-l border-white/10">
                                        <div className="text-xs font-bold text-neutral-500 mb-1 uppercase tracking-widest">Total Pts</div>
                                        <div className="text-5xl font-black text-white flex items-baseline">
                                            {user.total_score}
                                            <span className="text-lg ml-2 font-bold text-neutral-500 uppercase">pt</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <footer className="mt-8 flex justify-between items-center opacity-40 px-2 pb-4 text-[11px] font-bold uppercase tracking-widest">
                    <div className="flex gap-6">
                        <span>Score Refresh Active</span>
                        <span>•</span>
                        <span>{room?.room_code}</span>
                    </div>
                    <div>
                        {new Date().toLocaleTimeString()}
                    </div>
                </footer>
            </div>
        </div>
    );
}
