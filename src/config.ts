import dotenv from 'dotenv';

dotenv.config();

export const config = {
  slack: {
    token: process.env.SLACK_BOT_TOKEN || '',
    signingSecret: process.env.SLACK_SIGNING_SECRET || '',
    appToken: process.env.SLACK_APP_TOKEN || '',
  },
  walletConnect: {
    projectId: process.env.WALLETCONNECT_PROJECT_ID || '',
    relayUrl: process.env.WALLETCONNECT_RELAY_URL || 'wss://relay.walletconnect.com',
  },
};

export function validateConfig() {
  const required = [
    'SLACK_BOT_TOKEN',
    'SLACK_SIGNING_SECRET',
    'SLACK_APP_TOKEN',
    'WALLETCONNECT_PROJECT_ID',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
