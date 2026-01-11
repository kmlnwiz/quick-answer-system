'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface User {
  id: number;
  username: string;
  team: {
    id: number;
    name: string;
    color: string;
  };
}

interface TeamGroup {
  teamId: number;
  teamName: string;
  teamColor: string;
  users: User[];
}

export default function ParticipantsProjectionPage() {
  const params = useParams();
  const roomId = params?.roomId as string;

  const [users, setUsers] = useState<User[]>([]);
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      // 部屋情報を取得
      const roomRes = await fetch(`/api/rooms/${roomId}`);
      if (roomRes.ok) {
        const roomData = await roomRes.json();
        setRoomCode(roomData.room.room_code);
      }

      // 参加者一覧を取得
      const usersRes = await fetch(`/api/rooms/${roomId}/users`);
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users || []);
      }
    } catch (err) {
      console.error('データ取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!roomId) return;
    fetchData();

    // 定期的に更新（5秒おき）
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [roomId]);

  // チームごとにグループ化
  const teamGroups: TeamGroup[] = users.reduce((acc, user) => {
    const existingGroup = acc.find((g) => g.teamId === user.team.id);
    if (existingGroup) {
      existingGroup.users.push(user);
    } else {
      acc.push({
        teamId: user.team.id,
        teamName: user.team.name,
        teamColor: user.team.color,
        users: [user],
      });
    }
    return acc;
  }, [] as TeamGroup[]);

  // チームIDでソート
  teamGroups.sort((a, b) => a.teamId - b.teamId);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
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
              参加者一覧
            </h1>
            <p className="text-lg font-medium text-neutral-500 mt-2 tracking-wider uppercase">
              Registered Entry • Room {roomCode}
            </p>
          </div>
          <div className="text-right flex flex-col items-end">
            <div className="text-sm font-bold text-neutral-500 mb-1 uppercase tracking-widest">Total members</div>
            <div className="text-6xl font-black text-white flex items-baseline leading-none font-number">
              {users.length.toLocaleString()}
            </div>
          </div>
        </header>

        {/* Content Area - Team Grid */}
        <div className="flex-1 overflow-y-auto pr-2 scroll-smooth">
          {teamGroups.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-12">
              {teamGroups.map((group) => (
                <div
                  key={group.teamId}
                  className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col h-fit"
                >
                  {/* Team Header */}
                  <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-2 h-8 rounded-full"
                        style={{ backgroundColor: group.teamColor }}
                      ></div>
                      <h2 className="text-xl font-bold tracking-tight uppercase" style={{ color: group.teamColor }}>
                        {group.teamName}
                      </h2>
                    </div>
                    <div className="text-lg font-bold text-white/30 font-number">
                      {group.users.length}
                    </div>
                  </div>

                  {/* Member List */}
                  <div className="space-y-2">
                    {group.users.map((user) => (
                      <div
                        key={user.id}
                        className="bg-white/5 rounded-xl px-4 py-3 border border-white/5 flex items-center justify-between"
                      >
                        <span className="text-lg font-medium text-white/90">
                          {user.username}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-3xl">
              <div className="text-4xl font-bold text-neutral-600 uppercase tracking-widest animate-pulse">
                参加者を待っています...
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-8 flex justify-between items-center opacity-40 px-2 pb-4 text-[11px] font-bold uppercase tracking-widest">
          <div className="flex gap-6">
            <span>Real-time Sync Active</span>
            <span>•</span>
            <span>Auto-refresh every 5s</span>
          </div>
          <div>Room: {roomCode}</div>
        </footer>
      </div>
    </div>
  );
}
