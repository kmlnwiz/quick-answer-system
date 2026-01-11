'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Room {
  id: number;
  room_code: string;
  is_active: boolean;
  allow_resubmission: boolean;
  score_table: number[];
  created_at: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [deletingRoomId, setDeletingRoomId] = useState<number | null>(null);
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);
  const [editScoreTable, setEditScoreTable] = useState<string>('');

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/admin/login');
      return;
    }

    fetchRooms();
  }, [router]);

  const fetchRooms = async () => {
    const token = localStorage.getItem('admin_token');

    try {
      const response = await fetch('/api/rooms', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setRooms(data.rooms || []);
      } else {
        if (response.status === 401 || response.status === 403) {
          router.push('/admin/login');
        } else {
          setError(data.error || '部屋一覧の取得に失敗しました');
        }
      }
    } catch (err) {
      console.error('Fetch rooms error:', err);
      setError('部屋一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async () => {
    const token = localStorage.getItem('admin_token');

    setCreating(true);
    setError('');

    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          allow_resubmission: false,
          score_table: [10, 7, 5, 3, 1],
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setRooms([data.room, ...rooms]);
      } else {
        setError(data.error || '部屋の作成に失敗しました');
      }
    } catch (err) {
      console.error('Create room error:', err);
      setError('部屋の作成に失敗しました');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteRoom = async (roomId: number, roomCode: string) => {
    if (!confirm(`部屋 ${roomCode} を削除してもよろしいですか？\nこの操作は取り消せません。`)) {
      return;
    }

    const token = localStorage.getItem('admin_token');
    setDeletingRoomId(roomId);
    setError('');

    try {
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setRooms(rooms.filter(room => room.id !== roomId));
      } else {
        setError(data.error || '部屋の削除に失敗しました');
      }
    } catch (err) {
      console.error('Delete room error:', err);
      setError('部屋の削除に失敗しました');
    } finally {
      setDeletingRoomId(null);
    }
  };

  const handleEditScoreTable = (room: Room) => {
    setEditingRoomId(room.id);
    setEditScoreTable(room.score_table.join(', '));
  };

  const handleSaveScoreTable = async (roomId: number) => {
    const token = localStorage.getItem('admin_token');
    setError('');

    try {
      // 得点表を配列にパース
      const scoreArray = editScoreTable
        .split(',')
        .map(s => parseInt(s.trim()))
        .filter(n => !isNaN(n));

      if (scoreArray.length === 0) {
        setError('有効な得点表を入力してください');
        return;
      }

      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ score_table: scoreArray }),
      });

      const data = await response.json();

      if (response.ok) {
        setRooms(rooms.map(room => room.id === roomId ? { ...room, score_table: scoreArray } : room));
        setEditingRoomId(null);
      } else {
        setError(data.error || '得点表の更新に失敗しました');
      }
    } catch (err) {
      console.error('Update score table error:', err);
      setError('得点表の更新に失敗しました');
    }
  };

  const handleLogout = async () => {
    const token = localStorage.getItem('admin_token');

    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (err) {
      console.error('Logout error:', err);
    }

    localStorage.removeItem('admin_token');
    router.push('/admin/login');
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
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-neutral-900">管理者ダッシュボード</h1>
          <button
            className="px-4 py-2 text-neutral-700 hover:text-neutral-900 font-medium transition-colors"
            onClick={handleLogout}
          >
            ログアウト
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-neutral-900 mb-2">新規部屋作成</h2>
          <p className="text-sm text-neutral-600 mb-4">
            新しいクイズ部屋を作成します（デフォルト設定: 再送信不可、得点表 [10, 7, 5, 3, 1]）
          </p>
          <button
            className="px-6 py-2.5 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all disabled:opacity-50"
            onClick={handleCreateRoom}
            disabled={creating}
          >
            {creating ? '作成中...' : '+ 新規部屋作成'}
          </button>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-6">
          <h2 className="text-xl font-bold text-neutral-900 mb-4">部屋一覧</h2>
          {rooms.length === 0 ? (
            <p className="text-center text-neutral-500 py-8">
              まだ部屋が作成されていません
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-200">
                    <th className="text-left py-3 px-4 font-semibold text-neutral-700">部屋コード</th>
                    <th className="text-left py-3 px-4 font-semibold text-neutral-700">状態</th>
                    <th className="text-left py-3 px-4 font-semibold text-neutral-700">再送信</th>
                    <th className="text-left py-3 px-4 font-semibold text-neutral-700">得点表</th>
                    <th className="text-left py-3 px-4 font-semibold text-neutral-700">作成日時</th>
                    <th className="text-left py-3 px-4 font-semibold text-neutral-700">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => (
                    <tr key={room.id} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-lg text-neutral-900">
                        {room.room_code}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${
                            room.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {room.is_active ? '有効' : '無効'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${
                            room.allow_resubmission
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {room.allow_resubmission ? '可' : '不可'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {editingRoomId === room.id ? (
                          <div className="flex gap-2 items-center">
                            <input
                              type="text"
                              className="px-2 py-1 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-neutral-900"
                              value={editScoreTable}
                              onChange={(e) => setEditScoreTable(e.target.value)}
                              placeholder="例: 10, 7, 5, 3, 1"
                            />
                            <button
                              className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                              onClick={() => handleSaveScoreTable(room.id)}
                            >
                              保存
                            </button>
                            <button
                              className="px-2 py-1 bg-neutral-300 text-neutral-700 text-xs rounded hover:bg-neutral-400"
                              onClick={() => setEditingRoomId(null)}
                            >
                              キャンセル
                            </button>
                          </div>
                        ) : (
                          <button
                            className="text-sm text-neutral-700 hover:text-neutral-900 underline"
                            onClick={() => handleEditScoreTable(room)}
                          >
                            [{room.score_table.join(', ')}]
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-4 text-neutral-600 text-sm">
                        {new Date(room.created_at).toLocaleString('ja-JP')}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button
                            className="px-4 py-2 bg-neutral-900 text-white text-sm rounded-lg font-medium hover:bg-neutral-800 transition-all"
                            onClick={() =>
                              router.push(`/admin/room/${room.id}/answers`)
                            }
                          >
                            管理画面へ
                          </button>
                          <button
                            className="px-3 py-2 bg-red-600 text-white text-sm rounded-lg font-medium hover:bg-red-700 transition-all disabled:opacity-50"
                            onClick={() => handleDeleteRoom(room.id, room.room_code)}
                            disabled={deletingRoomId === room.id}
                          >
                            {deletingRoomId === room.id ? '削除中...' : '削除'}
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
    </div>
  );
}
