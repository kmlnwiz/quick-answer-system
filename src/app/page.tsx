import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="w-full max-w-md px-6">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-neutral-900 mb-2">
            クイズ解答集計システム
          </h1>
          <p className="text-neutral-600">リアルタイム解答集計</p>
        </div>

        <div className="space-y-4">
          <Link
            href="/room/join"
            className="block w-full py-4 bg-neutral-900 text-white text-center rounded-xl font-medium hover:bg-neutral-800 transition-all duration-200 active:scale-95"
          >
            部屋に参加する
          </Link>
          <Link
            href="/admin/login"
            className="block w-full py-4 bg-white text-neutral-900 text-center rounded-xl font-medium border border-neutral-300 hover:border-neutral-900 transition-all duration-200 active:scale-95"
          >
            管理画面
          </Link>
        </div>
      </div>
    </div>
  );
}
