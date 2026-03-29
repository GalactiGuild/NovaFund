import { AprRepository } from 'modules/apr/apr.repository';
import { AprService } from 'modules/apr/apr.service';

describe('AprService', () => {
  it('calculates APR correctly', async () => {
    const repo = new AprRepository();
    const service = new AprService(repo);

    const result = await service.calculateAPR();

    expect(result).toHaveProperty('apr');
    expect(result.apr).toBeGreaterThanOrEqual(0);
  });
});
