export class KYCAuditEntity {
  id: string; // UUID
  userId: string; // whose KYC is being overridden
  adminId: string; // the admin performing the override
  action: 'APPROVE' | 'REJECT';
  reason?: string;
  createdAt: Date;
}
