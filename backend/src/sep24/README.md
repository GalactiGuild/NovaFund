# SEP-24 Fiat On-Ramp Integration

This module implements Stellar SEP-24 interactive deposit flow, allowing users to deposit fiat currency directly into their Stellar wallets as USDC.

## Features

- Interactive deposit flow via anchor providers (e.g., MoneyGram Access)
- Real-time transaction status tracking
- Webhook support for anchor callbacks
- Redis caching for performance
- Database persistence for audit trail

## Architecture

### Backend Components

1. **AnchorService** (`anchor.service.ts`)
   - Communicates with SEP-24 anchor providers
   - Fetches stellar.toml configuration
   - Initiates interactive deposit flows
   - Polls transaction status

2. **Sep24Service** (`sep24.service.ts`)
   - Business logic for deposit management
   - Database operations via Prisma
   - Redis caching
   - Status polling and updates

3. **Sep24Controller** (`sep24.controller.ts`)
   - REST API endpoints:
     - `POST /sep24/deposit` - Initiate deposit
     - `GET /sep24/deposit/:id` - Get deposit status
     - `POST /sep24/callback` - Webhook for anchor updates

### Frontend Components

1. **OnRamp Page** (`frontend/src/app/onramp/page.tsx`)
   - User interface for initiating deposits
   - Amount input and wallet selection
   - Opens anchor interactive window
   - Real-time status polling
   - Transaction completion tracking

2. **WalletContext** (`frontend/src/contexts/WalletContext.tsx`)
   - Manages Freighter wallet connection
   - Provides wallet address to components

## Configuration

### Environment Variables

```bash
# SEP-24 Configuration
SEP24_ANCHOR_DOMAIN=testanchor.stellar.org
SEP24_CALLBACK_URL=https://your-domain.com/api/v1/sep24/callback
```

### Supported Anchors

- MoneyGram Access (default)
- Any SEP-24 compliant anchor

## Usage Flow

1. User navigates to `/onramp` page
2. User enters deposit amount
3. Frontend calls `POST /sep24/deposit` with wallet address
4. Backend fetches anchor interactive URL
5. Frontend opens anchor window (popup or iframe)
6. User completes deposit with anchor
7. Frontend polls `GET /sep24/deposit/:id` for status
8. Anchor sends webhook to `POST /sep24/callback` on completion
9. USDC appears in user's wallet

## Database Schema

```prisma
model FiatDeposit {
  id                   String    @id @default(cuid())
  walletAddress        String
  assetCode            String    @default("USDC")
  amount               Float?
  status               String
  anchorProvider       String
  anchorTransactionId  String?   @unique
  stellarTransactionId String?
  interactiveUrl       String
  projectId            String?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
  completedAt          DateTime?
}
```

## Status Flow

1. `pending_user_transfer_start` - Waiting for user to complete deposit
2. `pending_anchor` - Anchor processing fiat deposit
3. `pending_stellar` - Submitting to Stellar network
4. `completed` - USDC deposited to wallet
5. `error` - Deposit failed

## API Reference

### POST /sep24/deposit

Initiate a new fiat deposit.

**Request:**
```json
{
  "walletAddress": "GXXX...XXX",
  "assetCode": "USDC",
  "amount": 100,
  "anchorProvider": "moneygram",
  "language": "en"
}
```

**Response:**
```json
{
  "id": "clxxx",
  "interactiveUrl": "https://anchor.com/deposit?token=xxx",
  "status": "pending_user_transfer_start"
}
```

### GET /sep24/deposit/:id

Get deposit status.

**Response:**
```json
{
  "id": "clxxx",
  "status": "completed",
  "amount": 100,
  "assetCode": "USDC",
  "stellarTransactionId": "abc123..."
}
```

## Testing

### Test with Stellar Testnet

1. Use testnet anchor: `testanchor.stellar.org`
2. Connect Freighter wallet to testnet
3. Fund wallet with testnet XLM from friendbot
4. Initiate deposit through UI

### Manual Testing

```bash
# Initiate deposit
curl -X POST http://localhost:3000/api/v1/sep24/deposit \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "GXXX...XXX",
    "assetCode": "USDC",
    "amount": 100
  }'

# Check status
curl http://localhost:3000/api/v1/sep24/deposit/{depositId}
```

## Security Considerations

- Validate wallet addresses before processing
- Rate limit deposit endpoints
- Verify webhook signatures from anchors
- Use HTTPS for all communications
- Store sensitive data encrypted
- Implement proper error handling

## Future Enhancements

- Support for multiple anchor providers
- Withdrawal flow (SEP-24 withdraw)
- KYC integration
- Transaction limits and compliance
- Multi-currency support
- Direct project funding from on-ramp
