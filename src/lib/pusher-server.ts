import Pusher from 'pusher';

const appId = process.env.PUSHER_APP_ID;
const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
const secret = process.env.PUSHER_SECRET;
const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

// プレースホルダーのリスト
const placeholders = ['your_pusher_app_id', 'your_pusher_secret', 'your_pusher_key', '12345', 'xyz789', 'your_app_id', 'your_secret', 'your_key'];

const isConfigured =
  appId && key && secret && cluster &&
  !placeholders.includes(appId) &&
  !placeholders.includes(key) &&
  !placeholders.includes(secret);

if (!isConfigured) {
  console.warn('\x1b[33m%s\x1b[0m', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.warn('\x1b[33m%s\x1b[0m', '⚠️  [Pusher Server] Pusher is NOT configured correctly!');
  console.warn('\x1b[33m%s\x1b[0m', 'Real-time updates (answers, scores, etc.) will be disabled.');
  if (appId && key && secret && cluster) {
    console.warn(`Current config: appId=${appId}, key=${key}, cluster=${cluster}`);
  }
  console.warn('\x1b[36m%s\x1b[0m', 'Please set up real credentials in your .env file:');
  console.warn('https://dashboard.pusher.com/');
  console.warn('\x1b[33m%s\x1b[0m', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

export const pusherServer = isConfigured
  ? new Pusher({
    appId: appId!,
    key: key!,
    secret: secret!,
    cluster: cluster!,
    useTLS: true,
  })
  : ({
    trigger: async (channel: string, event: string, data: any) => {
      console.warn(`[Pusher Skip] Real-time message skipped (${channel}/${event}): Pusher is not configured.`);
      return {};
    }
  } as unknown as Pusher);
