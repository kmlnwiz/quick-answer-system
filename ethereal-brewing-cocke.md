# クイズ解答送信ツール - 実装計画

## プロジェクト概要

モバイル端末からリアルタイムでクイズ解答を送信・集計・表示できるシステム。
regacy の既存実装（PHP + jQuery + BroadcastChannel）を参考に、モダンな技術スタックで再構築します。

## 技術スタック

- **フロントエンド**: Next.js 14 + React + TypeScript
- **スタイリング**: Tailwind CSS + DaisyUI
- **データベース**: Vercel Postgres (Neon)
- **リアルタイム通信**: Pusher (管理画面更新用)
- **認証**: Next.js API + セッション管理
- **デプロイ**: Vercel

## システム構成

### 1. 画面構成

#### A. ユーザー画面（モバイル特化）

- **部屋入室画面** (`/room/join`)

  - 部屋番号入力
  - ユーザー名入力
  - チーム選択（5 チームから選択）
  - **セッショントークン管理**: localStorage にトークンを保存し、再入室時に自動復帰

- **解答送信画面** (`/room/[roomId]/answer`)

  - 問題番号選択
  - 解答入力（自由入力 or 択一選択）
  - リアルタイムコメント機能
  - 送信ボタン

- **送信確認・履歴画面** (`/room/[roomId]/history`)
  - 自分の送信履歴表示
  - 送信時間表示
  - 入力画面に戻るボタン

#### B. 管理画面（PC 特化）

- **部屋作成・管理画面** (`/admin`)

  - 認証（パスワード）
  - 新規部屋作成
  - 部屋設定
    - 問題数設定
    - 問題ごとの解答形式（自由入力/択一）と正解設定
    - 再送信許可の可否
    - **得点テーブル設定**（1 位=10pt, 2 位=8pt など）

- **解答一覧画面** (`/admin/room/[roomId]/answers`)

  - 全ユーザーの解答を時間順にソート
  - 問題ごとにフィルタリング
  - チーム別フィルタリング
  - **正解/不正解のマーク機能**（手動チェック or 自動判定の補助）
  - 正解者を選択して表示画面に送信（BroadcastChannel）

- **得点表示画面** (`/admin/room/[roomId]/scores`) ※解答一覧とは別タブ

  - 問題ごとの正解者ランキング
  - チーム別得点集計
  - ユーザー個人別得点集計

- **表示画面** (`/admin/room/[roomId]/cast`)

  - 選択されたユーザー（正解者）をランキング形式で表示
  - 表示内容: 順位・得点・チーム・解答時間（秒数）・ユーザー名
  - **解答内容は表示しない**
  - チームカラーで色分け
  - 早い順に自動ソート表示
  - BroadcastChannel で一覧画面から受信

- **問題開始管理画面** (`/admin/room/[roomId]/control`)
  - 全体開始ボタン（全チーム共通の開始時刻を記録）
  - チーム別開始ボタン（チームごとに個別の開始時刻を設定）
  - 開始時刻の表示・リセット機能

## データベース設計

### テーブル構造

#### 1. rooms テーブル

```sql
CREATE TABLE rooms (
  id SERIAL PRIMARY KEY,
  room_code VARCHAR(6) UNIQUE NOT NULL,  -- 6桁の部屋番号
  created_at TIMESTAMP DEFAULT NOW(),
  allow_resubmission BOOLEAN DEFAULT false,  -- 再送信許可
  total_questions INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  score_table JSONB DEFAULT '[50, 40, 30, 20, 10]'  -- 順位別得点テーブル
);
```

#### 2. questions テーブル

```sql
CREATE TABLE questions (
  id SERIAL PRIMARY KEY,
  room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  answer_type VARCHAR(20) NOT NULL,  -- 'free_text' or 'multiple_choice'
  choices JSONB,  -- 択一の場合の選択肢 ['A', 'B', 'C', 'D']
  correct_answer TEXT,  -- 正解（自動判定用・補助）
  global_start_time TIMESTAMP,  -- 全体開始時刻
  UNIQUE(room_id, question_number)
);
```

#### 2-1. question_team_starts テーブル（チーム別開始時刻）

```sql
CREATE TABLE question_team_starts (
  id SERIAL PRIMARY KEY,
  question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  start_time TIMESTAMP NOT NULL,  -- このチームの開始時刻
  UNIQUE(question_id, team_id)
);
```

#### 3. teams テーブル

```sql
CREATE TABLE teams (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(7) NOT NULL,  -- HEX color code
  display_order INTEGER NOT NULL
);

-- 初期データ（config.ts由来）
INSERT INTO teams (name, color, display_order) VALUES
  ('Team Red', '#EF4444', 1),
  ('Team Blue', '#3B82F6', 2),
  ('Team Green', '#10B981', 3),
  ('Team Yellow', '#F59E0B', 4),
  ('Team Purple', '#8B5CF6', 5);
```

#### 4. users テーブル

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
  username VARCHAR(100) NOT NULL,
  team_id INTEGER REFERENCES teams(id),
  joined_at TIMESTAMP DEFAULT NOW(),
  session_token VARCHAR(255) UNIQUE NOT NULL,  -- セッション管理用
  UNIQUE(room_id, username)  -- 同じ部屋では重複ユーザー名不可
);
```

#### 5. answers テーブル

```sql
CREATE TABLE answers (
  id SERIAL PRIMARY KEY,
  room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  answer_text TEXT NOT NULL,
  submitted_at TIMESTAMP DEFAULT NOW(),
  elapsed_time_ms BIGINT,  -- 問題開始からの解答時間（ミリ秒）
  submission_date DATE DEFAULT CURRENT_DATE,  -- 午前0時リセット用
  is_correct BOOLEAN DEFAULT NULL,  -- 正解判定（NULL=未判定、TRUE=正解、FALSE=不正解）
  score INTEGER DEFAULT 0,  -- この解答で獲得した得点
  INDEX idx_room_question (room_id, question_number),
  INDEX idx_user_date (user_id, question_number, submission_date),
  INDEX idx_elapsed_time (room_id, question_number, elapsed_time_ms)
);
```

#### 6. comments テーブル

```sql
CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 7. admin_sessions テーブル

```sql
CREATE TABLE admin_sessions (
  id SERIAL PRIMARY KEY,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);
```

## API Routes 設計

### 認証系

- `POST /api/admin/login` - 管理者ログイン（パスワード検証）
- `POST /api/admin/logout` - 管理者ログアウト

### 部屋管理系

- `POST /api/rooms` - 新規部屋作成（管理者のみ）
- `GET /api/rooms/[roomId]` - 部屋情報取得
- `PATCH /api/rooms/[roomId]` - 部屋設定変更（管理者のみ）

### ユーザー系

- `POST /api/rooms/[roomId]/join` - 部屋参加（ユーザー名+チーム選択）
- `GET /api/users/me` - 自分のユーザー情報取得

### 解答系

- `POST /api/rooms/[roomId]/answers` - 解答送信
- `GET /api/rooms/[roomId]/answers` - 解答一覧取得（管理者）
- `GET /api/rooms/[roomId]/answers/my` - 自分の解答履歴取得
- `PATCH /api/rooms/[roomId]/answers/[answerId]` - 正解/不正解マーク（管理者）

### 得点系

- `GET /api/rooms/[roomId]/scores` - チーム別・個人別得点取得
- `POST /api/rooms/[roomId]/scores/calculate` - 得点再計算（管理者）

### 問題開始制御系

- `POST /api/rooms/[roomId]/questions/[questionNumber]/start` - 全体開始（管理者）
- `POST /api/rooms/[roomId]/questions/[questionNumber]/start-team` - チーム別開始（管理者）
- `GET /api/rooms/[roomId]/questions/[questionNumber]/start-times` - 開始時刻取得

### コメント系

- `POST /api/rooms/[roomId]/comments` - コメント送信
- `GET /api/rooms/[roomId]/comments` - コメント一覧取得

### Pusher 通知系

- `POST /api/pusher/trigger` - リアルタイム通知送信（内部用）

## リアルタイム通信設計

### Pusher Channels

- `room-[roomId]` - 部屋ごとのチャンネル
  - イベント: `new-answer` - 新しい解答が送信された
  - イベント: `new-comment` - 新しいコメントが送信された
  - イベント: `room-updated` - 部屋設定が変更された
  - イベント: `question-started` - 問題開始合図（全体 or チーム別）

### BroadcastChannel（表示画面）

- チャンネル名: `cast-[roomId]`
- メッセージタイプ:
  - `cast-correct-answers`: 正解とマークされた解答を表示画面に送信
  - `update-scores`: チーム得点を更新

## 再送信制限ロジック

```typescript
// 再送信チェックの擬似コード
async function canResubmit(
  userId: number,
  roomId: number,
  questionNumber: number
): Promise<boolean> {
  const room = await db.rooms.findUnique({ where: { id: roomId } });

  if (room.allow_resubmission) {
    return true; // 親が許可していればOK
  }

  // 今日の日付で既に送信済みかチェック
  const today = new Date().toISOString().split("T")[0];
  const existing = await db.answers.findFirst({
    where: {
      user_id: userId,
      question_number: questionNumber,
      submission_date: today,
    },
  });

  return !existing; // 既存がなければtrue
}
```

## 問題開始とタイム計測ロジック

### 1. 問題開始合図

```typescript
// 全体開始ボタン
async function startQuestionGlobal(questionId: number) {
  const startTime = new Date();

  await db.questions.update({
    where: { id: questionId },
    data: { global_start_time: startTime },
  });

  // Pusherで全ユーザーに通知
  await pusherServer.trigger(`room-${roomId}`, "question-started", {
    questionNumber,
    startTime: startTime.toISOString(),
    type: "global",
  });
}

// チーム別開始ボタン
async function startQuestionForTeam(questionId: number, teamId: number) {
  const startTime = new Date();

  await db.question_team_starts.upsert({
    where: {
      question_id_team_id: { question_id: questionId, team_id: teamId },
    },
    update: { start_time: startTime },
    create: { question_id: questionId, team_id: teamId, start_time: startTime },
  });

  // Pusherでそのチームのみに通知
  await pusherServer.trigger(`room-${roomId}`, "question-started", {
    questionNumber,
    teamId,
    startTime: startTime.toISOString(),
    type: "team",
  });
}
```

### 2. 解答送信時の解答時間計算

**重要**: 解答時間の計算終点は、ユーザーがボタンを押してサーバーが受け付けた瞬間です。
クライアント側でボタン押下時刻を送信するのではなく、サーバー側で受信時刻を記録します。
これにより、ネットワークの応答時間による不公平を回避します。

```typescript
// 解答送信時に解答時間を計算（サーバー受付時点で計算）
async function submitAnswer(
  userId: number,
  questionNumber: number,
  answerText: string
) {
  // サーバーが受け付けた瞬間の時刻を記録
  const receivedAt = new Date();

  const user = await db.users.findUnique({
    where: { id: userId },
    include: { team: true },
  });
  const question = await db.questions.findFirst({
    where: { room_id: user.room_id, question_number: questionNumber },
  });

  // このユーザーのチームの開始時刻を取得（優先順位: チーム別 > 全体）
  const teamStart = await db.question_team_starts.findFirst({
    where: { question_id: question.id, team_id: user.team_id },
  });

  const startTime = teamStart?.start_time || question.global_start_time;

  if (!startTime) {
    throw new Error("問題がまだ開始されていません");
  }

  // 解答時間をミリ秒で計算（開始時刻 → サーバー受付時刻）
  const elapsedMs = receivedAt.getTime() - startTime.getTime();

  // 解答を保存
  await db.answers.create({
    data: {
      user_id: userId,
      room_id: user.room_id,
      question_number: questionNumber,
      answer_text: answerText,
      submitted_at: receivedAt, // サーバー受付時刻
      elapsed_time_ms: elapsedMs, // 開始からの解答時間（ミリ秒）
    },
  });

  return { elapsedMs, receivedAt };
}
```

## 正解判定と得点計算ロジック

### 1. 正解判定（自動 + 手動）

```typescript
// 解答送信時に自動判定を試みる
async function autoJudgeAnswer(
  questionId: number,
  answerText: string
): Promise<boolean | null> {
  const question = await db.questions.findUnique({
    where: { id: questionId },
  });

  if (!question.correct_answer) {
    return null; // 正解が設定されていない場合は未判定
  }

  // 択一問題は完全一致、自由入力は部分一致など
  if (question.answer_type === "multiple_choice") {
    return answerText.trim() === question.correct_answer.trim();
  } else {
    // 自由入力は手動判定を推奨（nullを返す）
    return null;
  }
}

// 管理者が手動でマーク
async function markAnswer(answerId: number, isCorrect: boolean) {
  await db.answers.update({
    where: { id: answerId },
    data: { is_correct: isCorrect },
  });

  // 得点を再計算
  await recalculateScores(answerId);
}
```

### 2. 得点計算ロジック（elapsed_time_ms 基準）

```typescript
// 問題ごとの正解者に得点を付与
async function recalculateScores(roomId: number, questionNumber: number) {
  // 1. 正解とマークされた解答を取得（解答時間順）
  const correctAnswers = await db.answers.findMany({
    where: {
      room_id: roomId,
      question_number: questionNumber,
      is_correct: true, // 正解のみ
    },
    orderBy: { elapsed_time_ms: "asc" }, // 解答時間が短い順
    include: { user: { include: { team: true } } },
  });

  // 2. 部屋の得点テーブルを取得
  const room = await db.rooms.findUnique({ where: { id: roomId } });
  const scoreTable = room.score_table as number[]; // [50, 40, 30, 20, 10]

  // 3. 順位に応じて得点を付与
  for (let i = 0; i < correctAnswers.length; i++) {
    const score = scoreTable[i] || 0;
    await db.answers.update({
      where: { id: correctAnswers[i].id },
      data: { score },
    });
  }
}

// チームごとの合計得点を算出
async function calculateTeamScores(roomId: number) {
  const answers = await db.answers.findMany({
    where: { room_id: roomId, is_correct: true },
    include: { user: true },
  });

  const teamScores = {};
  answers.forEach((answer) => {
    const teamId = answer.user.team_id;
    teamScores[teamId] = (teamScores[teamId] || 0) + answer.score;
  });

  return teamScores;
}
```

## ディレクトリ構造

```
quick-answer-system/
├── src/
│   ├── app/
│   │   ├── page.tsx                        # トップページ（部屋入室 or 管理画面へ）
│   │   ├── room/
│   │   │   ├── join/
│   │   │   │   └── page.tsx                # 部屋入室画面
│   │   │   └── [roomId]/
│   │   │       ├── answer/
│   │   │       │   └── page.tsx            # 解答送信画面
│   │   │       └── history/
│   │   │           └── page.tsx            # 送信履歴画面
│   │   ├── admin/
│   │   │   ├── page.tsx                    # 管理トップ（部屋一覧・作成）
│   │   │   ├── login/
│   │   │   │   └── page.tsx                # 管理者ログイン
│   │   │   └── room/
│   │   │       └── [roomId]/
│   │   │           ├── answers/
│   │   │           │   └── page.tsx        # 解答一覧・管理画面
│   │   │           ├── scores/
│   │   │           │   └── page.tsx        # 得点表示画面（別タブ）
│   │   │           ├── control/
│   │   │           │   └── page.tsx        # 問題開始管理画面
│   │   │           └── cast/
│   │   │               └── page.tsx        # 表示画面
│   │   └── api/
│   │       ├── admin/
│   │       │   ├── login/route.ts
│   │       │   └── logout/route.ts
│   │       ├── rooms/
│   │       │   ├── route.ts                # POST: 部屋作成
│   │       │   └── [roomId]/
│   │       │       ├── route.ts            # GET/PATCH: 部屋情報
│   │       │       ├── join/route.ts       # POST: 部屋参加
│   │       │       ├── answers/
│   │       │       │   ├── route.ts        # POST/GET: 解答
│   │       │       │   ├── [answerId]/route.ts  # PATCH: 正解マーク
│   │       │       │   └── my/route.ts     # GET: 自分の履歴
│   │       │       ├── scores/
│   │       │       │   ├── route.ts        # GET: 得点取得
│   │       │       │   └── calculate/route.ts  # POST: 得点再計算
│   │       │       ├── questions/
│   │       │       │   └── [questionNumber]/
│   │       │       │       ├── start/route.ts  # POST: 全体開始
│   │       │       │       ├── start-team/route.ts  # POST: チーム別開始
│   │       │       │       └── start-times/route.ts  # GET: 開始時刻取得
│   │       │       └── comments/
│   │       │           └── route.ts        # POST/GET: コメント
│   │       └── pusher/
│   │           └── trigger/route.ts
│   ├── components/
│   │   ├── user/
│   │   │   ├── AnswerForm.tsx              # 解答フォーム
│   │   │   ├── CommentBox.tsx              # コメント入力
│   │   │   └── HistoryList.tsx             # 送信履歴表示
│   │   ├── admin/
│   │   │   ├── RoomCreator.tsx             # 部屋作成フォーム
│   │   │   ├── AnswerTable.tsx             # 解答一覧テーブル（正解マーク機能含む）
│   │   │   ├── ScoreBoard.tsx              # 得点表示コンポーネント
│   │   │   └── CastView.tsx                # 表示画面コンポーネント
│   │   └── shared/
│   │       ├── TeamBadge.tsx               # チームバッジ
│   │       └── LoadingSpinner.tsx
│   ├── lib/
│   │   ├── db.ts                           # Vercel Postgres接続
│   │   ├── pusher-server.ts                # Pusher Server SDK
│   │   ├── pusher-client.ts                # Pusher Client SDK
│   │   └── auth.ts                         # 認証ヘルパー
│   ├── config/
│   │   └── teams.ts                        # チーム設定
│   └── types/
│       └── index.ts                        # 型定義
├── prisma/
│   └── schema.prisma                       # Prisma schema
├── public/
├── tailwind.config.ts
├── next.config.js
└── package.json
```

## 主要ファイルの役割

### 1. config/teams.ts

```typescript
export const TEAMS = [
  { id: 1, name: "Team Red", color: "#EF4444" },
  { id: 2, name: "Team Blue", color: "#3B82F6" },
  { id: 3, name: "Team Green", color: "#10B981" },
  { id: 4, name: "Team Yellow", color: "#F59E0B" },
  { id: 5, name: "Team Purple", color: "#8B5CF6" },
] as const;
```

### 2. lib/pusher-server.ts

```typescript
import Pusher from "pusher";

export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});
```

### 3. lib/pusher-client.ts

```typescript
import PusherClient from "pusher-js";

export const pusherClient = new PusherClient(
  process.env.NEXT_PUBLIC_PUSHER_KEY!,
  {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  }
);
```

### 4. components/admin/CastView.tsx

```typescript
// BroadcastChannelで一覧画面から正解データを受信
useEffect(() => {
  const channel = new BroadcastChannel(`cast-${roomId}`);

  channel.onmessage = (event) => {
    if (event.data.type === "cast-correct-answers") {
      // 正解とマークされた解答を受信し、早い順にソート済み
      setCorrectAnswers(event.data.payload);
    }
  };

  return () => channel.close();
}, [roomId]);
```

### 5. セッショントークン管理（localStorage）

```typescript
// 部屋入室時にトークンを保存
function saveSessionToken(token: string, roomId: string, username: string) {
  localStorage.setItem("session_token", token);
  localStorage.setItem("room_id", roomId);
  localStorage.setItem("username", username);
}

// 再入室時に自動復帰
async function restoreSession() {
  const token = localStorage.getItem("session_token");
  if (!token) return null;

  const response = await fetch("/api/users/me", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.ok) {
    return await response.json();
  } else {
    // トークンが無効な場合はクリア
    localStorage.clear();
    return null;
  }
}
```

## 実装ステップ

### Phase 1: 環境構築

1. Next.js 14 プロジェクトセットアップ
2. Tailwind CSS + DaisyUI 導入
3. Vercel Postgres 設定
4. Prisma 設定とマイグレーション
5. Pusher 設定

### Phase 2: データベース・API

1. Prisma スキーマ定義
2. 認証 API 実装
3. 部屋管理 API 実装
4. ユーザー参加 API 実装
5. 解答・コメント API 実装

### Phase 3: ユーザー画面（モバイル）

1. 部屋入室画面
2. 解答送信画面
3. コメント機能
4. 送信履歴画面

### Phase 4: 管理画面（PC）

1. 管理者ログイン
2. 部屋作成・設定画面（得点テーブル設定含む）
3. 解答一覧画面（正解マーク機能）
4. 得点表示画面（別タブ）
5. 表示画面（BroadcastChannel 連携）

### Phase 5: リアルタイム機能・得点計算

1. Pusher 統合（新規解答通知）
2. BroadcastChannel 統合（表示画面）
3. 正解判定ロジック（自動 + 手動）
4. 得点計算・再計算ロジック
5. チーム得点集計リアルタイム更新

## 検証・テスト計画

### 手動テスト

1. **モバイルでの解答送信**

   - スマートフォンで部屋に参加
   - 問題を選択して解答送信
   - 送信履歴の確認
   - コメント送信

2. **管理画面の操作**

   - PC で管理者ログイン
   - 新規部屋作成
   - 問題設定（自由入力/択一）
   - 再送信許可の切替

3. **リアルタイム同期**

   - 複数デバイスで同時アクセス
   - 解答送信時の即時反映
   - 表示画面への選択データ送信

4. **チーム機能**

   - 異なるチームで複数ユーザー参加
   - チーム得点の集計確認
   - チームカラーの表示確認

5. **再送信制限**

   - 再送信不可の状態で 2 回送信試行
   - 再送信許可後に複数回送信
   - 日付変更後のリセット確認

6. **正解判定と得点計算**

   - 択一問題の自動判定確認
   - 自由入力問題の手動マーク
   - 正解マーク後の得点自動付与
   - 得点テーブルに基づく順位別得点確認

7. **表示画面の動作**

   - 管理画面で正解者を選択
   - BroadcastChannel 経由で表示画面に反映
   - 早い順でのソート表示
   - チームカラーの表示

8. **セッション復帰機能**
   - ブラウザを閉じて再度開く
   - localStorage からトークン復元
   - 以前の部屋・チームに自動復帰

### 自動テスト（推奨）

- API Route のユニットテスト（Jest）
- E2E テスト（Playwright）

## 環境変数

```env
# Database
DATABASE_URL="postgresql://..."

# Pusher
PUSHER_APP_ID="..."
PUSHER_SECRET="..."
NEXT_PUBLIC_PUSHER_KEY="..."
NEXT_PUBLIC_PUSHER_CLUSTER="..."

# Admin Auth
ADMIN_PASSWORD="your_secure_password"
SESSION_SECRET="your_session_secret"
```

## 主な新規要件と実装内容のまとめ

### 追加要件の反映

1. **セッション復帰機能**

   - localStorage にトークンを保存
   - ブラウザを閉じても再入室時にデータ引き継ぎ
   - 同じユーザー名で自動マッチング

2. **問題開始合図システム**

   - 管理者が「開始」ボタンを押して問題開始を合図
   - 全体開始ボタン（全チーム共通）
   - チーム別開始ボタン（チームごとに個別設定）
   - チーム別開始時刻がない場合は全体開始時刻を参照
   - Pusher でリアルタイム通知

3. **解答時間の計測**

   - 開始時刻からサーバー受付時刻までの解答時間をミリ秒単位で計算
   - ネットワーク遅延の影響を最小化（サーバー側で受付時刻を記録）
   - 解答時間で早い順にソート

4. **正解判定システム**

   - 問題作成時に正解を設定（補助用）
   - 択一問題は自動判定可能
   - 自由入力問題は管理者が手動でマーク
   - 正解/不正解のフラグを DB に保存

5. **得点管理システム**

   - 部屋ごとに得点テーブル設定（1 位=10pt, 2 位=8pt など）
   - 正解者のみを対象に、早い順（elapsed_time_ms）に得点付与
   - チーム別・個人別の得点集計
   - 得点表示は解答一覧とは別タブで表示

6. **表示画面の表示**
   - 管理者が正解とマークした解答を選択
   - BroadcastChannel で表示画面に送信
   - 表示内容: 順位・得点・チーム・解答時間（秒数）・ユーザー名
   - **解答内容は表示しない**（公平性のため）
   - 早い順に自動ソート表示
   - チームカラーで色分け

### システムの特徴

このプランは、regacy の実装を参考にしつつ、以下の点を改善します：

- **モバイルファースト設計**: ユーザー画面はモバイル最適化
- **チーム機能**: 5 チームでの得点集計・カラー表示
- **柔軟な解答形式**: 問題ごとに自由入力/択一を設定可能
- **再送信制御**: 親が許可すれば何度でも送信可能、日付でリセット
- **正解判定**: 自動判定（補助） + 手動マーク（確定）
- **得点計算**: 正解者を早い順にソートして得点付与
- **リアルタイム性**: Pusher で全クライアントに即座に反映
- **セッション管理**: localStorage でトークン保存、再入室時に復帰
- **スケーラビリティ**: Vercel でのサーバーレス構成

### 重要ファイル

#### データベース

- [prisma/schema.prisma](prisma/schema.prisma) - データベーススキーマ（得点・正解判定・開始時刻フィールド含む）

#### 設定

- [src/config/teams.ts](src/config/teams.ts) - チーム設定（5 チーム、カラー定義）

#### API Routes

- [src/app/api/rooms/[roomId]/answers/route.ts](src/app/api/rooms/[roomId]/answers/route.ts) - 解答送信・一覧取得 API
- [src/app/api/rooms/[roomId]/answers/[answerId]/route.ts](src/app/api/rooms/[roomId]/answers/[answerId]/route.ts) - 正解マーク API
- [src/app/api/rooms/[roomId]/scores/route.ts](src/app/api/rooms/[roomId]/scores/route.ts) - 得点計算 API
- [src/app/api/rooms/[roomId]/questions/[questionNumber]/start/route.ts](src/app/api/rooms/[roomId]/questions/[questionNumber]/start/route.ts) - 全体開始 API
- [src/app/api/rooms/[roomId]/questions/[questionNumber]/start-team/route.ts](src/app/api/rooms/[roomId]/questions/[questionNumber]/start-team/route.ts) - チーム別開始 API
- [src/app/api/rooms/[roomId]/questions/[questionNumber]/start-times/route.ts](src/app/api/rooms/[roomId]/questions/[questionNumber]/start-times/route.ts) - 開始時刻取得 API

#### コンポーネント（管理画面）

- [src/components/admin/AnswerTable.tsx](src/components/admin/AnswerTable.tsx) - 解答一覧（正解マーク機能）
- [src/components/admin/ScoreBoard.tsx](src/components/admin/ScoreBoard.tsx) - 得点表示
- [src/components/admin/QuestionControl.tsx](src/components/admin/QuestionControl.tsx) - 問題開始管理
- [src/components/admin/CastView.tsx](src/components/admin/CastView.tsx) - 表示画面

#### ライブラリ

- [src/lib/auth.ts](src/lib/auth.ts) - セッション管理ヘルパー
- [src/lib/time-calculator.ts](src/lib/time-calculator.ts) - 解答時間計算ロジック
