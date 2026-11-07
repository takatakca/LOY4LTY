import { customerBalance } from '@/lib/domain/customer-balances';

export const dynamic = 'force-dynamic';

// Server-only Food Hub customer projection. No browser CORS, phone input, redemption or issuance.
export const POST = customerBalance;
