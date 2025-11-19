import SignClient from '@walletconnect/sign-client';
import { SessionTypes } from '@walletconnect/types';
import { config } from './config';

// Supported chains configuration
export const SUPPORTED_CHAINS = {
  ethereum: { id: 1, namespace: 'eip155', name: 'Ethereum', symbol: 'ETH' },
  bsc: { id: 56, namespace: 'eip155', name: 'BSC', symbol: 'BNB' },
  kaia: { id: 8217, namespace: 'eip155', name: 'Kaia', symbol: 'KAIA' },
  tron: { id: 0x2b6653dc, namespace: 'tron', name: 'Tron', symbol: 'TRX' },
} as const;

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
        optionalNamespaces: {
          eip155: {
            methods: [
              'eth_sendTransaction',
              'eth_signTransaction',
              'eth_sign',
              'personal_sign',
              'eth_signTypedData',
            ],
            chains: [
              `eip155:${SUPPORTED_CHAINS.ethereum.id}`, // Ethereum
              `eip155:${SUPPORTED_CHAINS.bsc.id}`,      // BSC
              `eip155:${SUPPORTED_CHAINS.kaia.id}`,     // Kaia
            ],
            events: ['chainChanged', 'accountsChanged'],
          },
          tron: {
            methods: ['tron_signTransaction', 'tron_signMessage'],
            chains: [`tron:0x${SUPPORTED_CHAINS.tron.id.toString(16)}`], // Tron
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

  // Get all accounts from a session across all namespaces
  getSessionAccounts(session: SessionTypes.Struct): Array<{ namespace: string; chainId: string; address: string }> {
    const accounts: Array<{ namespace: string; chainId: string; address: string }> = [];

    Object.entries(session.namespaces).forEach(([namespace, namespaceData]) => {
      namespaceData.accounts.forEach((account) => {
        const [ns, chainId, address] = account.split(':');
        accounts.push({ namespace: ns, chainId, address });
      });
    });

    return accounts;
  }

  // Get the primary chain ID from a session (first account's chain)
  getPrimaryChainId(session: SessionTypes.Struct): string {
    const accounts = this.getSessionAccounts(session);
    if (accounts.length === 0) {
      return 'eip155:1'; // Default to Ethereum
    }
    return `${accounts[0].namespace}:${accounts[0].chainId}`;
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

  async sendTransaction(topic: string, transaction: any, chainId?: string) {
    if (!this.client) {
      throw new Error('WalletConnect client not initialized');
    }

    const session = this.sessions.get(topic);
    if (!session) {
      throw new Error('Session not found');
    }

    const targetChainId = chainId || this.getPrimaryChainId(session);
    const namespace = targetChainId.split(':')[0];

    try {
      const method = namespace === 'tron' ? 'tron_signTransaction' : 'eth_sendTransaction';

      const result = await this.client.request({
        topic,
        chainId: targetChainId,
        request: {
          method,
          params: namespace === 'tron' ? transaction : [transaction],
        },
      });
      return result;
    } catch (error) {
      console.error('Failed to send transaction:', error);
      throw error;
    }
  }

  async signMessage(topic: string, message: string, address: string, chainId?: string) {
    if (!this.client) {
      throw new Error('WalletConnect client not initialized');
    }

    const session = this.sessions.get(topic);
    if (!session) {
      throw new Error('Session not found');
    }

    const targetChainId = chainId || this.getPrimaryChainId(session);
    const namespace = targetChainId.split(':')[0];

    try {
      const method = namespace === 'tron' ? 'tron_signMessage' : 'personal_sign';
      const params = namespace === 'tron'
        ? { message, address }
        : [message, address];

      const result = await this.client.request({
        topic,
        chainId: targetChainId,
        request: {
          method,
          params,
        },
      });
      return result;
    } catch (error) {
      console.error('Failed to sign message:', error);
      throw error;
    }
  }
}
