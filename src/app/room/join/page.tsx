'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Team {
  id: number;
  name: string;
  color: string;
}

export default function JoinPage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [userName, setUserName] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // チーム一覧を取得 & セッション復帰
  useEffect(() => {
    const prevRoom = localStorage.getItem('room_id');
    const prevName = localStorage.getItem('user_name');
    const token = localStorage.getItem('session_token');

    // セッション復元を試みる
    if (token && prevRoom) {
      router.push(`/room/${prevRoom}/answer`);
      return;
    }

    if (prevRoom) setRoomCode(prevRoom);
    if (prevName) setUserName(prevName);

    const fetchTeams = async () => {
      try {
        const response = await fetch('/api/teams');
        const data = await response.json();

        if (response.ok) {
          setTeams(data.teams || []);
        }
      } catch (err) {
        console.error('チーム取得エラー:', err);
      }
    };

    fetchTeams();
  }, [router]);

  const handleJoin = async () => {
    if (!roomCode.trim()) {
      setError('部屋番号を入力してください');
      return;
    }

    if (selectedTeam === null) {
      setError('チームを選択してください');
      return;
    }

    if (!userName.trim()) {
      setError('名前を入力してください');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/rooms/${roomCode}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          team_id: selectedTeam,
          username: userName,
          room_code: roomCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '部屋への参加に失敗しました');
        setLoading(false);
        return;
      }

      // セッショントークンを保存
      if (data.user && data.user.session_token) {
        localStorage.setItem('session_token', data.user.session_token);
        localStorage.setItem('room_id', roomCode);
        localStorage.setItem('user_name', data.user.username);
      }

      // 解答画面へ遷移
      router.push(`/room/${roomCode}/answer`);
    } catch (err) {
      console.error('Join error:', err);
      setError('部屋への参加に失敗しました');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-neutral-900 mb-2">
            部屋に参加
          </h2>
          <p className="text-neutral-600">クイズ解答システム</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              部屋番号
            </label>
            <input
              type="text"
              placeholder="例: 1234"
              className="w-full px-4 py-3 bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              あなたの名前
            </label>
            <input
              type="text"
              placeholder="例: 山田太郎"
              className="w-full px-4 py-3 bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              チームを選択
            </label>
            <div className="grid grid-cols-1 gap-3">
              {teams.map((team) => (
                <button
                  key={team.id}
                  className={`px-4 py-3 rounded-lg font-medium transition-all border-2 ${selectedTeam === team.id
                    ? 'text-white'
                    : 'bg-white text-neutral-900 hover:opacity-80'
                    }`}
                  style={{
                    backgroundColor: selectedTeam === team.id ? team.color : undefined,
                    borderColor: team.color,
                  }}
                  onClick={() => setSelectedTeam(team.id)}
                  disabled={loading}
                >
                  {team.name}
                </button>
              ))}
            </div>
          </div>

          <button
            className="w-full py-4 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleJoin}
            disabled={loading}
          >
            {loading ? '参加中...' : '部屋に参加'}
          </button>
        </div>
      </div>
    </div>
  );
}
