import { App } from '@slack/bolt';
import { config } from './config';
import { WalletConnectManager, SUPPORTED_CHAINS } from './walletconnect';
import { generateQRCodeDataURL } from './qr-generator';

export class SlackBot {
  private app: App;
  private wcManager: WalletConnectManager;
  private pendingConnections: Map<string, any> = new Map();

  constructor(wcManager: WalletConnectManager) {
    this.wcManager = wcManager;
    this.app = new App({
      token: config.slack.token,
      signingSecret: config.slack.signingSecret,
      socketMode: true,
      appToken: config.slack.appToken,
    });

    this.setupCommands();
    this.setupActions();
    this.setupHomeTab();
  }

  private setupCommands() {
    // /connect 명령어 - 지갑 연결
    this.app.command('/connect', async ({ command, ack, say, client }) => {
      await ack();

      try {
        const { uri, approval } = await this.wcManager.createConnection();

        if (!uri) {
          await say('연결 URI를 생성하는데 실패했습니다.');
          return;
        }

        // QR 코드 생성
        const qrDataURL = await generateQRCodeDataURL(uri);

        // QR 코드를 파일로 업로드
        const base64Data = qrDataURL.replace(/^data:image\/png;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        await client.files.uploadV2({
          channel_id: command.channel_id,
          file: buffer,
          filename: 'walletconnect-qr.png',
          title: 'WalletConnect QR Code',
          initial_comment: `🔗 *지갑을 연결하세요!*\n\n지원하는 체인: Ethereum, BSC, Kaia, Tron\n\nWalletConnect 앱에서 QR 코드를 스캔하거나 아래 URI를 사용하세요:\n\`\`\`${uri}\`\`\`\n\n⏳ 연결을 기다리는 중...`,
        });

        // 연결 대기 (비동기)
        this.waitForApproval(approval, command.channel_id, command.user_id);
      } catch (error: any) {
        console.error('Connect command error:', error);
        await say(`❌ 오류가 발생했습니다: ${error.message}`);
      }
    });

    // /sessions 명령어 - 활성 세션 조회
    this.app.command('/sessions', async ({ command, ack, say }) => {
      await ack();

      try {
        const sessions = this.wcManager.getActiveSessions();

        if (sessions.length === 0) {
          await say('활성화된 세션이 없습니다.');
          return;
        }

        const sessionList = sessions.map((session, index) => {
          const accounts = this.wcManager.getSessionAccounts(session);
          const accountInfo = accounts.map((acc) => {
            const chainName = this.getChainName(acc.namespace, acc.chainId);
            return `   • ${chainName}: \`${acc.address}\``;
          }).join('\n');

          return `${index + 1}. Session ID: \`${session.topic.substring(0, 16)}...\`\n${accountInfo}`;
        }).join('\n\n');

        await say(`📋 *활성 세션 목록*\n\n${sessionList}`);
      } catch (error: any) {
        console.error('Sessions command error:', error);
        await say(`❌ 오류가 발생했습니다: ${error.message}`);
      }
    });

    // /disconnect 명령어 - 세션 연결 해제
    this.app.command('/disconnect', async ({ command, ack, say }) => {
      await ack();

      try {
        const sessions = this.wcManager.getActiveSessions();

        if (sessions.length === 0) {
          await say('연결 해제할 세션이 없습니다.');
          return;
        }

        // 모든 세션 연결 해제
        for (const session of sessions) {
          await this.wcManager.disconnectSession(session.topic);
        }

        await say(`✅ ${sessions.length}개의 세션이 연결 해제되었습니다.`);
      } catch (error: any) {
        console.error('Disconnect command error:', error);
        await say(`❌ 오류가 발생했습니다: ${error.message}`);
      }
    });

    // /sign 명령어 - 메시지 서명
    this.app.command('/sign', async ({ command, ack, say }) => {
      await ack();

      try {
        const sessions = this.wcManager.getActiveSessions();

        if (sessions.length === 0) {
          await say('활성화된 세션이 없습니다. 먼저 /connect 명령어로 지갑을 연결하세요.');
          return;
        }

        const message = command.text || 'Hello from Slack WalletConnect Bot!';
        const session = sessions[0];
        const accounts = this.wcManager.getSessionAccounts(session);

        if (accounts.length === 0) {
          await say('계정 정보를 찾을 수 없습니다.');
          return;
        }

        const account = accounts[0];
        const chainName = this.getChainName(account.namespace, account.chainId);

        await say(`🔏 메시지를 서명하는 중...\nChain: ${chainName}\nMessage: "${message}"`);

        const signature = await this.wcManager.signMessage(session.topic, message, account.address);

        await say(`✅ *서명 완료!*\n\nChain: ${chainName}\nAddress: \`${account.address}\`\nSignature:\n\`\`\`${signature}\`\`\``);
      } catch (error: any) {
        console.error('Sign command error:', error);
        await say(`❌ 오류가 발생했습니다: ${error.message}`);
      }
    });

    // /help 명령어 - 도움말
    this.app.command('/help', async ({ command, ack, say }) => {
      await ack();

      const helpText = `
*🤖 WalletConnect Bot 도움말*

*지원하는 체인:*
• Ethereum (ETH) - Chain ID: 1
• BSC (BNB) - Chain ID: 56
• Kaia (KAIA) - Chain ID: 8217
• Tron (TRX) - Chain ID: 0x2b6653dc

*사용 가능한 명령어:*

• \`/connect\` - WalletConnect를 통해 지갑 연결
• \`/sessions\` - 활성화된 세션 목록 조회
• \`/disconnect\` - 모든 세션 연결 해제
• \`/sign [message]\` - 메시지 서명 (기본값: "Hello from Slack WalletConnect Bot!")
• \`/help\` - 이 도움말 표시

*사용 방법:*
1. \`/connect\` 명령어로 QR 코드를 받습니다
2. WalletConnect 지원 지갑 앱에서 QR 코드를 스캔합니다
3. 연결이 완료되면 다른 명령어를 사용할 수 있습니다
      `;

      await say(helpText);
    });
  }

  private setupActions() {
    // 지갑 연결 버튼
    this.app.action('connect_wallet', async ({ ack, body, client }) => {
      await ack();

      try {
        const { uri, approval } = await this.wcManager.createConnection();

        if (!uri) {
          await client.chat.postMessage({
            token: config.slack.token,
            channel: (body as any).user.id,
            text: '연결 URI를 생성하는데 실패했습니다.',
          });
          return;
        }

        // QR 코드 생성
        const qrDataURL = await generateQRCodeDataURL(uri);
        const base64Data = qrDataURL.replace(/^data:image\/png;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        await client.files.uploadV2({
          channel_id: (body as any).user.id,
          file: buffer,
          filename: 'walletconnect-qr.png',
          title: 'WalletConnect QR Code',
          initial_comment: `🔗 *지갑을 연결하세요!*\n\n지원하는 체인: Ethereum, BSC, Kaia, Tron\n\nWalletConnect 앱에서 QR 코드를 스캔하거나 아래 URI를 사용하세요:\n\`\`\`${uri}\`\`\`\n\n⏳ 연결을 기다리는 중...`,
        });

        this.waitForApproval(approval, (body as any).user.id, (body as any).user.id);
      } catch (error: any) {
        console.error('Connect button error:', error);
        await client.chat.postMessage({
          token: config.slack.token,
          channel: (body as any).user.id,
          text: `❌ 오류가 발생했습니다: ${error.message}`,
        });
      }
    });

    // 세션 조회 버튼
    this.app.action('view_sessions', async ({ ack, body, client }) => {
      await ack();

      try {
        const sessions = this.wcManager.getActiveSessions();

        if (sessions.length === 0) {
          await client.chat.postMessage({
            token: config.slack.token,
            channel: (body as any).user.id,
            text: '활성화된 세션이 없습니다.',
          });
          return;
        }

        const sessionList = sessions.map((session, index) => {
          const accounts = this.wcManager.getSessionAccounts(session);
          const accountInfo = accounts.map((acc) => {
            const chainName = this.getChainName(acc.namespace, acc.chainId);
            return `   • ${chainName}: \`${acc.address}\``;
          }).join('\n');

          return `${index + 1}. Session ID: \`${session.topic.substring(0, 16)}...\`\n${accountInfo}`;
        }).join('\n\n');

        await client.chat.postMessage({
          token: config.slack.token,
          channel: (body as any).user.id,
          text: `📋 *활성 세션 목록*\n\n${sessionList}`,
        });
      } catch (error: any) {
        console.error('View sessions button error:', error);
        await client.chat.postMessage({
          token: config.slack.token,
          channel: (body as any).user.id,
          text: `❌ 오류가 발생했습니다: ${error.message}`,
        });
      }
    });

    // 연결 해제 버튼
    this.app.action('disconnect_wallet', async ({ ack, body, client }) => {
      await ack();

      try {
        const sessions = this.wcManager.getActiveSessions();

        if (sessions.length === 0) {
          await client.chat.postMessage({
            token: config.slack.token,
            channel: (body as any).user.id,
            text: '연결 해제할 세션이 없습니다.',
          });
          return;
        }

        for (const session of sessions) {
          await this.wcManager.disconnectSession(session.topic);
        }

        await client.chat.postMessage({
          token: config.slack.token,
          channel: (body as any).user.id,
          text: `✅ ${sessions.length}개의 세션이 연결 해제되었습니다.`,
        });

        // 홈 탭 업데이트
        await this.updateHomeTab((body as any).user.id);
      } catch (error: any) {
        console.error('Disconnect button error:', error);
        await client.chat.postMessage({
          token: config.slack.token,
          channel: (body as any).user.id,
          text: `❌ 오류가 발생했습니다: ${error.message}`,
        });
      }
    });

    // 메시지 서명 버튼
    this.app.action('sign_message', async ({ ack, body, client }) => {
      await ack();

      try {
        const sessions = this.wcManager.getActiveSessions();

        if (sessions.length === 0) {
          await client.chat.postMessage({
            token: config.slack.token,
            channel: (body as any).user.id,
            text: '활성화된 세션이 없습니다. 먼저 지갑을 연결하세요.',
          });
          return;
        }

        // 모달 열기
        await client.views.open({
          token: config.slack.token,
          trigger_id: (body as any).trigger_id,
          view: {
            type: 'modal',
            callback_id: 'sign_message_modal',
            title: {
              type: 'plain_text',
              text: '메시지 서명',
            },
            submit: {
              type: 'plain_text',
              text: '서명',
            },
            close: {
              type: 'plain_text',
              text: '취소',
            },
            blocks: [
              {
                type: 'input',
                block_id: 'message_input',
                element: {
                  type: 'plain_text_input',
                  action_id: 'message',
                  placeholder: {
                    type: 'plain_text',
                    text: '서명할 메시지를 입력하세요',
                  },
                  initial_value: 'Hello from Slack WalletConnect Bot!',
                },
                label: {
                  type: 'plain_text',
                  text: '메시지',
                },
              },
            ],
          },
        });
      } catch (error: any) {
        console.error('Sign message button error:', error);
        await client.chat.postMessage({
          token: config.slack.token,
          channel: (body as any).user.id,
          text: `❌ 오류가 발생했습니다: ${error.message}`,
        });
      }
    });

    // 모달 제출 처리
    this.app.view('sign_message_modal', async ({ ack, body, view, client }) => {
      await ack();

      try {
        const sessions = this.wcManager.getActiveSessions();

        if (sessions.length === 0) {
          return;
        }

        const message = view.state.values.message_input.message.value || 'Hello from Slack WalletConnect Bot!';
        const session = sessions[0];
        const accounts = this.wcManager.getSessionAccounts(session);

        if (accounts.length === 0) {
          await client.chat.postMessage({
            token: config.slack.token,
            channel: body.user.id,
            text: '계정 정보를 찾을 수 없습니다.',
          });
          return;
        }

        const account = accounts[0];
        const chainName = this.getChainName(account.namespace, account.chainId);

        await client.chat.postMessage({
          token: config.slack.token,
          channel: body.user.id,
          text: `🔏 메시지를 서명하는 중...\nChain: ${chainName}\nMessage: "${message}"`,
        });

        const signature = await this.wcManager.signMessage(session.topic, message, account.address);

        await client.chat.postMessage({
          token: config.slack.token,
          channel: body.user.id,
          text: `✅ *서명 완료!*\n\nChain: ${chainName}\nAddress: \`${account.address}\`\nSignature:\n\`\`\`${signature}\`\`\``,
        });
      } catch (error: any) {
        console.error('Sign message modal error:', error);
        await client.chat.postMessage({
          token: config.slack.token,
          channel: body.user.id,
          text: `❌ 오류가 발생했습니다: ${error.message}`,
        });
      }
    });
  }

  private setupHomeTab() {
    // 홈 탭 열기 이벤트
    this.app.event('app_home_opened', async ({ event, client }) => {
      try {
        await this.updateHomeTab(event.user);
      } catch (error) {
        console.error('Error updating home tab:', error);
      }
    });
  }

  private async updateHomeTab(userId: string) {
    const sessions = this.wcManager.getActiveSessions();
    const hasActiveSessions = sessions.length > 0;

    let sessionInfoBlocks: any[] = [];

    if (hasActiveSessions) {
      const sessionInfo = sessions.map((session, index) => {
        const accounts = this.wcManager.getSessionAccounts(session);
        const accountInfo = accounts.map((acc) => {
          const chainName = this.getChainName(acc.namespace, acc.chainId);
          return `• ${chainName}: \`${acc.address}\``;
        }).join('\n');

        return `*세션 ${index + 1}*\nID: \`${session.topic.substring(0, 16)}...\`\n${accountInfo}`;
      }).join('\n\n');

      sessionInfoBlocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `📋 *활성 세션*\n\n${sessionInfo}`,
          },
        },
        {
          type: 'divider',
        },
      ];
    }

    await this.app.client.views.publish({
      token: config.slack.token,
      user_id: userId,
      view: {
        type: 'home',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🔗 WalletConnect Bot',
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'WalletConnect를 통해 블록체인 지갑을 연결하고 관리할 수 있습니다.',
            },
          },
          {
            type: 'divider',
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*지원하는 체인*\n• Ethereum (ETH)\n• BSC (BNB)\n• Kaia (KAIA)\n• Tron (TRX)',
            },
          },
          {
            type: 'divider',
          },
          ...sessionInfoBlocks,
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '🔗 지갑 연결',
                  emoji: true,
                },
                style: 'primary',
                action_id: 'connect_wallet',
              },
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '📋 세션 조회',
                  emoji: true,
                },
                action_id: 'view_sessions',
              },
            ],
          },
          ...(hasActiveSessions
            ? [
                {
                  type: 'actions',
                  elements: [
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: '✍️ 메시지 서명',
                        emoji: true,
                      },
                      action_id: 'sign_message',
                    },
                    {
                      type: 'button',
                      text: {
                        type: 'plain_text',
                        text: '🔌 연결 해제',
                        emoji: true,
                      },
                      style: 'danger',
                      action_id: 'disconnect_wallet',
                    },
                  ],
                },
              ]
            : []),
          {
            type: 'divider',
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: '슬래시 커맨드도 사용 가능합니다: `/connect`, `/sessions`, `/sign`, `/disconnect`, `/help`',
              },
            ],
          },
        ],
      },
    });
  }

  private async waitForApproval(approval: () => Promise<any>, channelId: string, userId: string) {
    try {
      const session = await this.wcManager.waitForConnection(approval);

      const accounts = this.wcManager.getSessionAccounts(session);
      const accountInfo = accounts.map((acc) => {
        const chainName = this.getChainName(acc.namespace, acc.chainId);
        return `• ${chainName}: \`${acc.address}\``;
      }).join('\n');

      await this.app.client.chat.postMessage({
        token: config.slack.token,
        channel: channelId,
        text: `✅ *지갑 연결 성공!*\n\n연결된 계정:\n${accountInfo}\n\n세션 ID: \`${session.topic.substring(0, 16)}...\`\n\n이제 \`/sign\` 명령어를 사용하거나 홈 탭의 버튼을 눌러 메시지를 서명할 수 있습니다.`,
      });

      // 홈 탭 업데이트
      await this.updateHomeTab(userId);
    } catch (error: any) {
      console.error('Approval waiting error:', error);
      await this.app.client.chat.postMessage({
        token: config.slack.token,
        channel: channelId,
        text: `❌ 지갑 연결에 실패했습니다: ${error.message}`,
      });
    }
  }

  private getChainName(namespace: string, chainId: string): string {
    const chainIdNum = parseInt(chainId, 10);

    for (const [, chain] of Object.entries(SUPPORTED_CHAINS)) {
      if (chain.namespace === namespace && chain.id === chainIdNum) {
        return `${chain.name} (${chain.symbol})`;
      }
    }

    return `${namespace}:${chainId}`;
  }

  async start() {
    await this.app.start();
    console.log('⚡️ Slack bot is running!');
  }

  async stop() {
    await this.app.stop();
    console.log('Slack bot stopped');
  }
}
