import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface AnchorDepositParams {
  asset_code: string;
  account: string;
  amount?: string;
  lang?: string;
}

@Injectable()
export class AnchorService {
  private readonly logger = new Logger(AnchorService.name);
  private readonly anchorDomain: string;
  private readonly anchorUrl: string;

  constructor(private readonly config: ConfigService) {
    this.anchorDomain = this.config.get('SEP24_ANCHOR_DOMAIN') || 'testanchor.stellar.org';
    this.anchorUrl = `https://${this.anchorDomain}`;
  }

  async getDepositUrl(params: AnchorDepositParams): Promise<string> {
    try {
      // Get SEP-24 info
      const infoResponse = await axios.get(`${this.anchorUrl}/.well-known/stellar.toml`);
      const toml = this.parseToml(infoResponse.data);
      const transferServerUrl = toml.TRANSFER_SERVER_SEP0024 || `${this.anchorUrl}/sep24`;

      // Request interactive deposit
      const response = await axios.post(
        `${transferServerUrl}/transactions/deposit/interactive`,
        new URLSearchParams({
          asset_code: params.asset_code,
          account: params.account,
          ...(params.amount && { amount: params.amount }),
          lang: params.lang || 'en',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      return response.data.url;
    } catch (error) {
      this.logger.error(`Failed to get deposit URL: ${error.message}`);
      throw error;
    }
  }

  async getTransactionStatus(transactionId: string) {
    try {
      const infoResponse = await axios.get(`${this.anchorUrl}/.well-known/stellar.toml`);
      const toml = this.parseToml(infoResponse.data);
      const transferServerUrl = toml.TRANSFER_SERVER_SEP0024 || `${this.anchorUrl}/sep24`;

      const response = await axios.get(`${transferServerUrl}/transaction`, {
        params: { id: transactionId },
      });

      return response.data.transaction;
    } catch (error) {
      this.logger.error(`Failed to get transaction status: ${error.message}`);
      throw error;
    }
  }

  private parseToml(tomlString: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = tomlString.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts
            .join('=')
            .trim()
            .replace(/^["']|["']$/g, '');
          result[key.trim()] = value;
        }
      }
    }

    return result;
  }
}
