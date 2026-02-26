import { Test, TestingModule } from '@nestjs/testing';
import { WebPushService } from './web-push.service';

describe('WebPushService', () => {
  let service: WebPushService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WebPushService],
    }).compile();

    service = module.get<WebPushService>(WebPushService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
