# Slack WalletConnect Bot

Slack에서 WalletConnect를 통해 암호화폐 지갑을 연결하고 상호작용할 수 있는 봇입니다. QR 코드를 통해 간편하게 지갑을 연결할 수 있습니다.

## 주요 기능

- 🔗 **지갑 연결**: WalletConnect를 통한 안전한 지갑 연결
- 📱 **QR 코드**: QR 코드 스캔으로 간편한 연결
- ✍️ **메시지 서명**: 연결된 지갑으로 메시지 서명
- 📋 **세션 관리**: 활성 세션 조회 및 관리
- 🔌 **연결 해제**: 안전한 세션 종료

## 사전 요구사항

- Node.js 18.x 이상
- npm 또는 yarn
- Slack Workspace 관리자 권한
- WalletConnect Project ID

## 설치 방법

### 1. 저장소 클론

```bash
git clone https://github.com/yourusername/slack-walletconnect-bot.git
cd slack-walletconnect-bot
```

### 2. 의존성 설치

```bash
npm install
```

### 3. Slack App 생성

1. [Slack API](https://api.slack.com/apps)에 접속하여 새 앱 생성
2. **Socket Mode** 활성화
3. **OAuth & Permissions**에서 다음 권한 추가:
   - `chat:write`
   - `commands`
   - `files:write`
4. **Slash Commands** 생성:
   - `/connect` - 지갑 연결
   - `/sessions` - 세션 조회
   - `/disconnect` - 연결 해제
   - `/sign` - 메시지 서명
   - `/help` - 도움말
5. **App-Level Token** 생성 (`connections:write` 권한)
6. 워크스페이스에 앱 설치

### 4. WalletConnect Project ID 획득

1. [WalletConnect Cloud](https://cloud.walletconnect.com)에 접속
2. 새 프로젝트 생성
3. Project ID 복사

### 5. 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열고 다음 정보를 입력:

```env
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token
WALLETCONNECT_PROJECT_ID=your-walletconnect-project-id
```

### 6. 빌드 및 실행

```bash
# TypeScript 빌드
npm run build

# 프로덕션 실행
npm start

# 개발 모드 (자동 재시작)
npm run dev
```

## 사용 방법

### 1. 지갑 연결

Slack에서 `/connect` 명령어를 입력하면 QR 코드가 표시됩니다.

```
/connect
```

WalletConnect를 지원하는 지갑 앱(MetaMask, Trust Wallet 등)에서 QR 코드를 스캔하면 연결이 완료됩니다.

### 2. 활성 세션 조회

```
/sessions
```

현재 연결된 지갑 세션 목록을 확인할 수 있습니다.

### 3. 메시지 서명

```
/sign Hello World!
```

연결된 지갑으로 메시지를 서명합니다. 메시지를 지정하지 않으면 기본 메시지가 서명됩니다.

### 4. 연결 해제

```
/disconnect
```

모든 활성 세션의 연결을 해제합니다.

### 5. 도움말

```
/help
```

사용 가능한 명령어와 사용 방법을 확인할 수 있습니다.

## 프로젝트 구조

```
slack-walletconnect-bot/
├── src/
│   ├── index.ts           # 애플리케이션 진입점
│   ├── config.ts          # 환경 변수 설정
│   ├── slack-bot.ts       # Slack 봇 로직
│   ├── walletconnect.ts   # WalletConnect 클라이언트
│   └── qr-generator.ts    # QR 코드 생성
├── dist/                  # 빌드 결과물
├── .env.example          # 환경 변수 예제
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## 지원하는 블록체인

현재 Ethereum (EIP-155) 체인을 지원합니다:
- Ethereum Mainnet
- 기타 EVM 호환 체인

추가 체인 지원이 필요한 경우 `src/walletconnect.ts`의 `requiredNamespaces`를 수정하세요.

## 보안 고려사항

- 환경 변수 파일(`.env`)은 절대 공개 저장소에 커밋하지 마세요
- Slack Bot Token과 App Token을 안전하게 보관하세요
- 프로덕션 환경에서는 적절한 접근 제어를 설정하세요
- WalletConnect 세션은 민감한 정보이므로 적절히 관리하세요

## 문제 해결

### "Missing required environment variables" 오류

`.env` 파일이 올바르게 설정되었는지 확인하세요. 모든 필수 변수가 입력되어야 합니다.

### QR 코드가 표시되지 않음

Slack 앱에 `files:write` 권한이 부여되었는지 확인하세요.

### 지갑 연결이 실패함

1. WalletConnect Project ID가 올바른지 확인
2. 네트워크 연결 상태 확인
3. 지갑 앱이 WalletConnect v2를 지원하는지 확인

## 라이선스

MIT License

## 기여

이슈와 풀 리퀘스트는 언제나 환영합니다!

## 연락처

문의사항이 있으시면 이슈를 생성해주세요.
