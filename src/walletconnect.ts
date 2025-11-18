import SignClient from '@walletconnect/sign-client';
import { SessionTypes } from '@walletconnect/types';
import { config } from './config';

export class WalletConnectManager {
  private client: SignClient | null = null;
  private sessions: Map<string, SessionTypes.Struct> = new Map();

  async initialize() {
    try {
      this.client = await SignClient.init({
        projectId: config.walletConnect.projectId,
        metadata: {
          name: 'Slack WalletConnect Bot',
          description: 'Connect your wallet through Slack',
          url: 'https://walletconnect.com',
          icons: ['https://avatars.githubusercontent.com/u/37784886'],
        },
      });

      console.log('WalletConnect client initialized');
      this.setupEventListeners();
      return this.client;
    } catch (error) {
      console.error('Failed to initialize WalletConnect:', error);
      throw error;
    }
  }

  private setupEventListeners() {
    if (!this.client) return;

    this.client.on('session_proposal', async (proposal) => {
      console.log('Session proposal received:', proposal);
    });

    this.client.on('session_event', (event) => {
      console.log('Session event:', event);
    });

    this.client.on('session_update', ({ topic, params }) => {
      console.log('Session updated:', topic, params);
      const session = this.client?.session.get(topic);
      if (session) {
        this.sessions.set(topic, session);
      }
    });

    this.client.on('session_delete', ({ topic }) => {
      console.log('Session deleted:', topic);
      this.sessions.delete(topic);
    });
  }

  async createConnection() {
    if (!this.client) {
      throw new Error('WalletConnect client not initialized');
    }

    try {
      const { uri, approval } = await this.client.connect({
        requiredNamespaces: {
          eip155: {
            methods: [
              'eth_sendTransaction',
              'eth_signTransaction',
              'eth_sign',
              'personal_sign',
              'eth_signTypedData',
            ],
            chains: ['eip155:1'],
            events: ['chainChanged', 'accountsChanged'],
          },
        },
      });

      return { uri, approval };
    } catch (error) {
      console.error('Failed to create connection:', error);
      throw error;
    }
  }

  async waitForConnection(approval: () => Promise<SessionTypes.Struct>) {
    try {
      const session = await approval();
      this.sessions.set(session.topic, session);
      console.log('Session established:', session);
      return session;
    } catch (error) {
      console.error('Connection approval failed:', error);
      throw error;
    }
  }

  getActiveSessions() {
    return Array.from(this.sessions.values());
  }

  async disconnectSession(topic: string) {
    if (!this.client) {
      throw new Error('WalletConnect client not initialized');
    }

    try {
      await this.client.disconnect({
        topic,
        reason: {
          code: 6000,
          message: 'User disconnected',
        },
      });
      this.sessions.delete(topic);
    } catch (error) {
      console.error('Failed to disconnect session:', error);
      throw error;
    }
  }

  async sendTransaction(topic: string, transaction: any) {
    if (!this.client) {
      throw new Error('WalletConnect client not initialized');
    }

    const session = this.sessions.get(topic);
    if (!session) {
      throw new Error('Session not found');
    }

    try {
      const result = await this.client.request({
        topic,
        chainId: 'eip155:1',
        request: {
          method: 'eth_sendTransaction',
          params: [transaction],
        },
      });
      return result;
    } catch (error) {
      console.error('Failed to send transaction:', error);
      throw error;
    }
  }

  async signMessage(topic: string, message: string, address: string) {
    if (!this.client) {
      throw new Error('WalletConnect client not initialized');
    }

    const session = this.sessions.get(topic);
    if (!session) {
      throw new Error('Session not found');
    }

    try {
      const result = await this.client.request({
        topic,
        chainId: 'eip155:1',
        request: {
          method: 'personal_sign',
          params: [message, address],
        },
      });
      return result;
    } catch (error) {
      console.error('Failed to sign message:', error);
      throw error;
    }
  }
}
