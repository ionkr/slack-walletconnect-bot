import { validateConfig } from './config';
import { WalletConnectManager } from './walletconnect';
import { SlackBot } from './slack-bot';

async function main() {
  try {
    // 환경 변수 검증
    validateConfig();
    console.log('✅ Configuration validated');

    // WalletConnect 초기화
    const wcManager = new WalletConnectManager();
    await wcManager.initialize();
    console.log('✅ WalletConnect initialized');

    // Slack Bot 시작
    const bot = new SlackBot(wcManager);
    await bot.start();
    console.log('✅ Slack bot started');

    console.log('\n🚀 Slack WalletConnect Bot is ready!\n');

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n⏳ Shutting down gracefully...');
      await bot.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n⏳ Shutting down gracefully...');
      await bot.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
  }
}

main();
