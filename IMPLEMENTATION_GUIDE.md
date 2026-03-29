# SEP-24 Fiat On-Ramp Implementation Guide

## Overview

This implementation adds Stellar SEP-24 interactive deposit flow to NovaFund, allowing users to deposit fiat currency directly into their Stellar wallets as USDC through anchor providers like MoneyGram Access.

## What Was Implemented

### Backend (NestJS)

1. **SEP-24 Module** (`backend/src/sep24/`)
   - `anchor.service.ts` - Communicates with SEP-24 anchor providers
   - `sep24.service.ts` - Business logic for deposit management
   - `sep24.controller.ts` - REST API endpoints
   - `sep24.module.ts` - Module configuration
   - `dto/sep24.dto.ts` - Data transfer objects
   - `tasks/deposit-poll.task.ts` - Background task for polling deposit status

2. **Database Schema**
   - Added `FiatDeposit` model to Prisma schema
   - Migration file: `backend/prisma/migrations/20260327000000_add_fiat_deposits/migration.sql`

3. **API Endpoints**
   - `POST /api/v1/sep24/deposit` - Initiate fiat deposit
   - `GET /api/v1/sep24/deposit/:id` - Get deposit status
   - `POST /api/v1/sep24/callback` - Webhook for anchor updates

### Frontend (Next.js)

1. **On-Ramp Page** (`frontend/src/app/onramp/page.tsx`)
   - User interface for initiating deposits
   - Amount input and wallet selection
   - Opens anchor interactive window
   - Real-time status polling with visual feedback
   - Transaction completion tracking

2. **Wallet Context** (`frontend/src/contexts/WalletContext.tsx`)
   - Manages Freighter wallet connection
   - Provides wallet address to components
   - Persists connection state

3. **UI Components**
   - `OnRampButton.tsx` - Quick access button for navigation
   - Integrated with existing NovaFund theme (dark mode, gradients)

## Setup Instructions

### 1. Backend Setup

```bash
cd backend

# Install dependencies (if needed)
npm install axios @nestjs/schedule

# Update environment variables
cp .env.example .env
```

Edit `.env` and add:
```bash
SEP24_ANCHOR_DOMAIN=testanchor.stellar.org
SEP24_CALLBACK_URL=https://your-domain.com/api/v1/sep24/callback
```

### 2. Database Migration

```bash
cd backend

# Run Prisma migration
npx prisma migrate dev

# Generate Prisma client
npx prisma generate
```

### 3. Frontend Setup

No additional dependencies needed. The implementation uses existing packages.

### 4. Start Services

```bash
# Backend
cd backend
npm run start:dev

# Frontend
cd frontend
npm run dev
```

## Usage Flow

1. User navigates to `/onramp` page or clicks "Add Funds" button
2. User connects Freighter wallet (if not already connected)
3. User enters deposit amount in USD
4. User clicks "Continue to Deposit"
5. Backend generates interactive URL from anchor
6. Frontend opens anchor window (popup)
7. User completes deposit with anchor (bank transfer, card, etc.)
8. Frontend polls for status updates every 5 seconds
9. Backend receives webhook from anchor on completion
10. USDC appears in user's Stellar wallet

## Testing

### Test on Stellar Testnet

1. Install Freighter wallet extension
2. Switch Freighter to Testnet
3. Fund wallet with testnet XLM from friendbot: https://friendbot.stellar.org
4. Navigate to http://localhost:3000/onramp
5. Connect wallet and initiate deposit
6. Complete deposit flow in anchor window

### Manual API Testing

```bash
# Initiate deposit
curl -X POST http://localhost:3000/api/v1/sep24/deposit \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "GXXX...XXX",
    "assetCode": "USDC",
    "amount": 100,
    "anchorProvider": "moneygram"
  }'

# Check status
curl http://localhost:3000/api/v1/sep24/deposit/{depositId}
```

## Configuration Options

### Anchor Providers

The default anchor is `testanchor.stellar.org` for testing. For production:

1. **MoneyGram Access**
   - Domain: `moneygram.stellar.org`
   - Supports: USD, EUR, GBP
   - KYC required for larger amounts

2. **Other SEP-24 Anchors**
   - Update `SEP24_ANCHOR_DOMAIN` in `.env`
   - Ensure anchor supports USDC

### Customization

**Styling**: The on-ramp page uses NovaFund's existing theme:
- Dark mode (slate-950 background)
- Gradient accents (cyan-to-blue)
- Glassmorphism effects
- Responsive design

**Branding**: Modify `frontend/src/app/onramp/page.tsx`:
- Update header text
- Change color gradients
- Adjust feature descriptions

## Integration Points

### Add On-Ramp Button to Navigation

Add to `frontend/src/components/layout/Header.tsx`:

```tsx
import OnRampButton from '../OnRampButton';

// In the navigation section:
<OnRampButton />
```

### Link to Project Funding

To auto-fund a project after deposit, pass `projectId`:

```typescript
await fetch(`${apiUrl}/sep24/deposit`, {
  method: "POST",
  body: JSON.stringify({
    walletAddress,
    assetCode: "USDC",
    amount: 100,
    projectId: "project-id-here", // Optional
  }),
});
```

## Monitoring

### Database Queries

```sql
-- Check recent deposits
SELECT * FROM fiat_deposits 
ORDER BY created_at DESC 
LIMIT 10;

-- Check pending deposits
SELECT * FROM fiat_deposits 
WHERE status NOT IN ('completed', 'error') 
AND created_at > NOW() - INTERVAL '24 hours';

-- Deposit success rate
SELECT 
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_duration_seconds
FROM fiat_deposits
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY status;
```

### Logs

Backend logs include:
- Deposit initiation
- Status polling
- Anchor callbacks
- Errors and failures

## Security Considerations

1. **Wallet Validation**: Stellar addresses are validated before processing
2. **Rate Limiting**: Add rate limiting to deposit endpoints (recommended)
3. **Webhook Verification**: Verify webhook signatures from anchors (TODO)
4. **HTTPS**: Use HTTPS in production for all communications
5. **Error Handling**: Sensitive errors are logged but not exposed to users

## Troubleshooting

### Deposit Stuck in Pending

- Check anchor status page
- Verify webhook URL is accessible
- Check backend logs for errors
- Manually poll anchor API

### Wallet Not Connecting

- Ensure Freighter is installed
- Check network (testnet vs mainnet)
- Clear browser cache
- Check console for errors

### Interactive Window Blocked

- Allow popups for the domain
- Alternative: Use iframe mode (modify frontend)

## Future Enhancements

- [ ] Support multiple anchor providers
- [ ] Withdrawal flow (SEP-24 withdraw)
- [ ] KYC integration
- [ ] Transaction limits and compliance
- [ ] Multi-currency support (EUR, GBP)
- [ ] Direct project funding from on-ramp
- [ ] Email notifications on completion
- [ ] Mobile app support
- [ ] Webhook signature verification
- [ ] Rate limiting and abuse prevention

## Documentation

- SEP-24 Spec: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0024.md
- Stellar Anchors: https://www.stellar.org/anchors
- MoneyGram Access: https://moneygram.stellar.org

## Support

For issues or questions:
1. Check backend logs: `backend/logs/`
2. Review database records: `fiat_deposits` table
3. Test with testnet anchor first
4. Consult SEP-24 documentation
