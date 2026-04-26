// src/services/reputation.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class ReputationService {
  // Mock for now — later connect to DB or analytics
  async getUserReputation(userId: string): Promise<number> {
    // Example: fetch from DB
    // return user.reputationScore;

    // Temporary mock (0–100)
    return Math.floor(Math.random() * 100);
  }
}