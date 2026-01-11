# クイズ解答集計システム

モバイル端末からリアルタイムでクイズ解答を送信・集計・表示できるシステム

## クイックスタート（開発環境）

初めて使う方向けの簡単なセットアップ手順:

```bash
# 1. リポジトリをクローン
git clone https://github.com/yourusername/quick-answer-system.git
cd quick-answer-system

# 2. 依存パッケージをインストール
npm install

# 3. 環境変数を設定
cp .env.example .env
# .envファイルを編集して、DATABASE_URLとPusher情報を設定

# 4. データベースをセットアップ
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed

# 5. 開発サーバーを起動
npm run dev
```

開発サーバーが起動したら:

- **ユーザー画面**: http://localhost:3000
- **管理画面**: http://localhost:3000/admin （パスワード: `.env`の`ADMIN_PASSWORD`）
- **Prisma Studio**: `npx prisma studio` → http://localhost:5555

## 技術スタック

- **フロントエンド**: Next.js 14 + React + TypeScript
- **スタイリング**: Tailwind CSS + DaisyUI
- **データベース**: PostgreSQL (Prisma ORM)
- **リアルタイム通信**: Pusher
- **デプロイ**: Vercel

## セットアップ手順

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example`を参考に`.env`ファイルをプロジェクトルートに作成:

```bash
# .env.exampleをコピー
cp .env.example .env
```

`.env`ファイルを編集し、以下の内容を設定:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/quiz_system"

# Pusher
PUSHER_APP_ID="your_app_id"
PUSHER_SECRET="your_secret"
NEXT_PUBLIC_PUSHER_KEY="your_key"
NEXT_PUBLIC_PUSHER_CLUSTER="ap3"

# Admin Auth
ADMIN_PASSWORD="your_secure_password"
SESSION_SECRET="your_session_secret_32chars_or_more"
```

#### 環境変数の詳細

| 変数名                       | 説明                              | 開発環境での設定例                                       |
| ---------------------------- | --------------------------------- | -------------------------------------------------------- |
| `DATABASE_URL`               | PostgreSQL 接続 URL               | `postgresql://postgres:postgres@localhost:5432/quiz_dev` |
| `PUSHER_APP_ID`              | Pusher アプリケーション ID        | [Pusher Dashboard](https://dashboard.pusher.com/)で取得  |
| `PUSHER_SECRET`              | Pusher シークレットキー           | Pusher Dashboard で取得                                  |
| `NEXT_PUBLIC_PUSHER_KEY`     | Pusher 公開キー（クライアント用） | Pusher Dashboard で取得                                  |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | Pusher クラスター                 | `ap3`（アジア太平洋）                                    |
| `ADMIN_PASSWORD`             | 管理者ログイン用パスワード        | 任意の安全なパスワード（例: `admin123`）                 |
| `SESSION_SECRET`             | セッション暗号化キー              | 32 文字以上のランダム文字列                              |

**開発環境での簡易設定例（※これらは仮の値です。実際のキーに置き換えてください）:**

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/quiz_dev"
PUSHER_APP_ID="12345" # <-- 実際のApp IDに書き換えてください
PUSHER_SECRET="abcdef123456" # <-- 実際のSecretに書き換えてください
NEXT_PUBLIC_PUSHER_KEY="xyz789" # <-- 実際のKeyに書き換えてください
NEXT_PUBLIC_PUSHER_CLUSTER="ap3"
ADMIN_PASSWORD="admin123"
SESSION_SECRET="development_secret_key_32_chars_minimum_length"
```

### 3. データベースの準備

このプロジェクトは**PostgreSQL**と**MySQL**の両方に対応しています。

#### 使用するデータベースの選択

デフォルトでは**MySQL**が設定されています。PostgreSQL を使用する場合は、[prisma/schema.prisma](prisma/schema.prisma)の`provider`を変更してください。

```prisma
datasource db {
  provider = "mysql"      // または "postgresql"
  url      = env("DATABASE_URL")
}
```

---

#### オプション A: ローカル MySQL を使用

MySQL がインストール済みの場合:

```bash
# MySQLにログイン
mysql -u root -p

# データベースを作成
CREATE DATABASE quiz_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

`.env`の設定:

```env
DATABASE_URL="mysql://root:password@localhost:3306/quiz_dev"
```

#### オプション B: ローカル PostgreSQL を使用

PostgreSQL がインストール済みの場合:

```bash
# データベースを作成
createdb quiz_dev

# または、psqlコマンドで
psql -U postgres
CREATE DATABASE quiz_dev;
\q
```

`.env`の設定:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/quiz_dev"
```

**重要**: [prisma/schema.prisma](prisma/schema.prisma)の`provider`を`"postgresql"`に変更してください。

#### オプション C: Docker を使用

**MySQL (推奨)**:

```bash
# MySQLコンテナを起動
docker run --name quiz-mysql \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=quiz_dev \
  -p 3306:3306 \
  -d mysql:8

# 接続確認
docker exec -it quiz-mysql mysql -uroot -proot quiz_dev
```

`.env`の設定:

```env
DATABASE_URL="mysql://root:root@localhost:3306/quiz_dev"
```

**PostgreSQL**:

```bash
# PostgreSQLコンテナを起動
docker run --name quiz-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=quiz_dev \
  -p 5432:5432 \
  -d postgres:15

# 接続確認
docker exec -it quiz-postgres psql -U postgres -d quiz_dev
```

`.env`の設定:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/quiz_dev"
```

**重要**: PostgreSQL を使用する場合は、[prisma/schema.prisma](prisma/schema.prisma)の`provider`を`"postgresql"`に変更してください。

#### オプション D: クラウドデータベース（無料プラン）

**MySQL**:

- **PlanetScale**: https://planetscale.com （MySQL 互換、推奨）
- **Railway**: https://railway.app

**PostgreSQL**:

- **Neon**: https://neon.tech （Serverless PostgreSQL、推奨）
- **Supabase**: https://supabase.com
- **Railway**: https://railway.app

### 4. データベースのセットアップ

```bash
# Prisma Clientを生成
npx prisma generate

# マイグレーション実行（テーブル作成）
npx prisma migrate dev --name init

# シードデータ投入（5チームのデータを作成）
npx prisma db seed
```

**シードデータの内容:**

- Team 池袋（青色: #3246a5）
- Team 秋葉原（オレンジ色: #eb6405）
- Team 蒲田（茶色: #824628）
- Team 名古屋（ピンク色: #e61e55）
- Team 大阪（水色: #1eaabe）

### 5. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで以下の URL を開く:

- **トップページ**: http://localhost:3000
- **管理画面**: http://localhost:3000/admin

#### 管理画面へのログイン

管理画面（`/admin`）にアクセスすると、パスワード認証が求められます。

- **パスワード**: `.env`ファイルの`ADMIN_PASSWORD`に設定した値
  - 開発環境の例: `admin123`

## プロジェクト構造

```
quick-answer-system/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API Routes
│   │   │   ├── admin/          # 管理者認証
│   │   │   ├── rooms/          # 部屋管理
│   │   │   └── users/          # ユーザー情報
│   │   ├── room/               # ユーザー画面
│   │   └── admin/              # 管理画面
│   ├── components/             # Reactコンポーネント
│   │   ├── user/               # ユーザー用
│   │   ├── admin/              # 管理者用
│   │   └── shared/             # 共通
│   ├── lib/                    # ライブラリ
│   │   ├── db.ts               # Prisma Client
│   │   ├── auth.ts             # 認証ヘルパー
│   │   ├── pusher-server.ts    # Pusher Server SDK
│   │   └── pusher-client.ts    # Pusher Client SDK
│   ├── config/                 # 設定
│   │   └── teams.ts            # チーム設定
│   └── types/                  # TypeScript型定義
│       └── index.ts
├── prisma/
│   ├── schema.prisma           # Prismaスキーマ
│   └── seed.ts                 # シードデータ
├── ethereal-brewing-cocke.md   # 詳細な実装計画
└── IMPLEMENTATION_STATUS.md    # 実装進捗状況
```

## 実装進捗

現在の実装状況は [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) を参照してください。

## 主要機能

### ユーザー機能（モバイル対応）

- 部屋への参加（部屋番号入力）
- チーム選択（5 チーム）
- 解答送信
- 送信履歴表示
- リアルタイムコメント

### 管理者機能（PC 対応）

- 部屋作成・管理
- 問題設定（自由入力/択一選択）
- 解答一覧表示
- 正解/不正解マーク
- 得点計算・集計
- 表示画面（BroadcastChannel）
- 問題開始管理（全体/チーム別）

## 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# プロダクションビルド
npm run build

# プロダクションサーバー起動
npm start

# リント実行
npm run lint
```

## データベース管理コマンド

```bash
# Prisma Studio（データベースGUIツール）を起動
npx prisma studio
# → http://localhost:5555 でデータベースを視覚的に編集可能

# Prisma Clientを再生成（schema.prisma変更時）
npx prisma generate

# マイグレーション作成（スキーマ変更時）
npx prisma migrate dev --name migration_name

# シードデータを再投入
npx prisma db seed

# データベースをリセット（全データ削除 + マイグレーション + シード）
npx prisma migrate reset

# マイグレーションステータス確認
npx prisma migrate status

# 本番環境へのマイグレーション適用
npx prisma migrate deploy
```

### データベースのトラブルシューティング

#### データベース接続エラー

```bash
# PostgreSQLが起動しているか確認
# ローカルの場合
pg_isready

# Dockerの場合
docker ps | grep postgres

# 接続テスト
psql -h localhost -U postgres -d quiz_dev
```

#### マイグレーションエラー

```bash
# マイグレーション履歴をクリーンアップ
npx prisma migrate resolve --applied migration_name

# データベースを完全にリセット（開発環境のみ）
npx prisma migrate reset
```

#### シードデータの再投入

```bash
# 既存のチームデータを削除してから再投入
npx prisma db seed
```

## データベーススキーマ

主要テーブル:

- `rooms` - 部屋情報
- `teams` - チーム情報（5 チーム固定）
- `users` - ユーザー情報
- `questions` - 問題情報
- `question_team_starts` - チーム別開始時刻
- `answers` - 解答情報
- `comments` - コメント情報
- `admin_sessions` - 管理者セッション

詳細は [prisma/schema.prisma](prisma/schema.prisma) を参照

## Vercel へのデプロイ

### 前提条件

- GitHub アカウント
- Vercel アカウント（GitHub 連携推奨）
- PostgreSQL データベース（Neon、Supabase、Railway 等）

### デプロイ手順

#### 1. データベースの準備

本番環境用の PostgreSQL データベースを用意します。推奨サービス:

- **Neon** (https://neon.tech) - Serverless PostgreSQL、無料プランあり
- **Supabase** (https://supabase.com) - 無料プランあり
- **Railway** (https://railway.app) - デプロイも可能

#### 2. GitHub へのプッシュ

```bash
# リポジトリの初期化（まだの場合）
git init
git add .
git commit -m "Initial commit"

# GitHubリポジトリを作成後
git remote add origin https://github.com/yourusername/quick-answer-system.git
git push -u origin main
```

#### 3. Vercel へのデプロイ

1. [Vercel Dashboard](https://vercel.com/dashboard)にアクセス
2. **New Project** をクリック
3. GitHub リポジトリを選択してインポート
4. プロジェクト設定:
   - **Framework Preset**: Next.js（自動検出）
   - **Root Directory**: `./`（デフォルト）
   - **Build Command**: `npm run build`（デフォルト）
   - **Output Directory**: `.next`（デフォルト）

#### 4. 環境変数の設定

Vercel の **Environment Variables** セクションで以下を設定:

```env
# Database (本番環境用のURL)
DATABASE_URL=postgresql://user:password@your-db-host/your-db-name

# Pusher (本番環境用)
PUSHER_APP_ID=your_prod_app_id
PUSHER_SECRET=your_prod_secret
NEXT_PUBLIC_PUSHER_KEY=your_prod_key
NEXT_PUBLIC_PUSHER_CLUSTER=ap3

# Admin Auth (強固なパスワードを設定)
ADMIN_PASSWORD=your_very_secure_admin_password
SESSION_SECRET=your_random_32_characters_or_more_secret_key
```

**重要**: 本番環境では開発環境と異なる強固なパスワードとシークレットキーを使用してください。

#### 5. デプロイの実行

**Deploy** をクリックしてデプロイを開始します。初回デプロイには数分かかります。

#### 6. データベースのマイグレーション

デプロイ完了後、データベースのマイグレーションを実行:

```bash
# Vercel CLIをインストール（初回のみ）
npm i -g vercel

# Vercelにログイン
vercel login

# 本番環境のデータベースURLを設定
vercel env pull .env.production.local

# マイグレーション実行
DATABASE_URL="your_production_database_url" npx prisma migrate deploy

# シードデータ投入（初回のみ）
DATABASE_URL="your_production_database_url" npx prisma db seed
```

または、Vercel Dashboard から:

1. プロジェクトの **Settings** → **General** → **Build & Development Settings**
2. **Install Command** に以下を追加:
   ```bash
   npm install && npx prisma generate && npx prisma migrate deploy
   ```

#### 7. デプロイの確認

デプロイが完了すると、Vercel が URL を発行します（例: `https://your-app.vercel.app`）

確認項目:

- トップページが表示されるか
- 管理者ログイン `/admin` が動作するか
- 部屋作成・参加ができるか

### 継続的デプロイ

GitHub の `main` ブランチへのプッシュで自動的に本番環境が更新されます。

```bash
git add .
git commit -m "Update feature"
git push origin main
```

プレビューデプロイ（Pull Request 作成時に自動作成）も利用可能です。

### カスタムドメインの設定

1. Vercel Dashboard → プロジェクト → **Settings** → **Domains**
2. カスタムドメインを追加
3. DNS レコードを設定（Vercel の指示に従う）

### トラブルシューティング

#### ビルドエラーが発生する場合

- 環境変数が正しく設定されているか確認
- `DATABASE_URL` が本番環境のものか確認
- Vercel のビルドログを確認

#### データベース接続エラー

- `DATABASE_URL` の形式が正しいか確認（`postgresql://` で始まるか）
- データベースサービスが外部接続を許可しているか確認
- Prisma Client が生成されているか確認（`postinstall` スクリプトで自動実行）

#### Pusher が動作しない

- 環境変数の値が正しいか確認
- `NEXT_PUBLIC_` プレフィックスが付いているか確認
- Pusher ダッシュボードでアプリの設定を確認

## 次の実装予定

1. 解答 API 完全実装
2. 問題開始制御 API
3. ユーザー画面 UI
4. 管理画面 UI
5. リアルタイム通信統合

詳細な実装計画は [ethereal-brewing-cocke.md](ethereal-brewing-cocke.md) を参照してください。
