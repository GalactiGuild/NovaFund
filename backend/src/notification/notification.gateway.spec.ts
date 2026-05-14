import { Test, TestingModule } from '@nestjs/testing';
import { NotificationGateway } from './notification.gateway';
import { PrismaService } from '../prisma.service';

describe('NotificationGateway', () => {
  let gateway: NotificationGateway;
  let prisma: PrismaService;

  const mockPrisma = {
    notification: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationGateway,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    gateway = module.get<NotificationGateway>(NotificationGateway);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('subscribe', () => {
    it('should register a client', () => {
      const controller = {
        enqueue: jest.fn(),
      } as any;
      const encoder = new TextEncoder();
      const clientId = gateway.subscribe(controller, 'user123');

      expect(clientId).toBeDefined();
      expect(clientId).toContain('client_');
      expect(gateway.getClientCount()).toBe(1);
    });

    it('should support multiple subscriptions', () => {
      const controller1 = { enqueue: jest.fn() } as any;
      const controller2 = { enqueue: jest.fn() } as any;

      gateway.subscribe(controller1, 'user123');
      gateway.subscribe(controller2, 'user456');

      expect(gateway.getClientCount()).toBe(2);
    });
  });

  describe('unsubscribe', () => {
    it('should remove a client', () => {
      const controller = { enqueue: jest.fn() } as any;
      const clientId = gateway.subscribe(controller);

      expect(gateway.getClientCount()).toBe(1);

      gateway.unsubscribe(clientId);

      expect(gateway.getClientCount()).toBe(0);
    });
  });

  describe('broadcast', () => {
    it('should send notification to all clients', () => {
      const controller1 = { enqueue: jest.fn() } as any;
      const controller2 = { enqueue: jest.fn() } as any;

      gateway.subscribe(controller1, 'user123');
      gateway.subscribe(controller2, 'user456');

      const notification = { id: 'n1', type: 'test', title: 'Test' };
      gateway.broadcast(notification);

      expect(controller1.enqueue).toHaveBeenCalled();
      expect(controller2.enqueue).toHaveBeenCalled();
    });

    it('should send only to specific user if targetUserId is provided', () => {
      const controller1 = { enqueue: jest.fn() } as any;
      const controller2 = { enqueue: jest.fn() } as any;

      gateway.subscribe(controller1, 'user123');
      gateway.subscribe(controller2, 'user456');

      const notification = { id: 'n1', type: 'test', title: 'Test' };
      gateway.broadcast(notification, 'user123');

      expect(controller1.enqueue).toHaveBeenCalled();
      expect(controller2.enqueue).not.toHaveBeenCalled();
    });

    it('should handle client errors', () => {
      const controller1 = { enqueue: jest.fn().mockImplementation(() => {
        throw new Error('Connection closed');
      }) } as any;
      const controller2 = { enqueue: jest.fn() } as any;

      gateway.subscribe(controller1, 'user123');
      gateway.subscribe(controller2, 'user456');

      gateway.broadcast({ id: 'n1', type: 'test' });

      expect(gateway.getClientCount()).toBe(1); // Failed client should be removed
    });
  });

  describe('sendNotification', () => {
    it('should create notification in database and broadcast', async () => {
      const mockNotification = {
        id: 'n1',
        userId: 'user123',
        type: 'test',
        title: 'Test',
        message: 'Test message',
        link: null,
        createdAt: new Date(),
        read: false,
      };

      (mockPrisma.notification.create as jest.Mock).mockResolvedValue(mockNotification);

      const controller = { enqueue: jest.fn() } as any;
      gateway.subscribe(controller, 'user123');

      const result = await gateway.sendNotification(
        'user123',
        'test',
        'Test',
        'Test message'
      );

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          type: 'test',
          title: 'Test',
          message: 'Test message',
          data: {},
          read: false,
        },
      });

      expect(controller.enqueue).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({
        id: 'n1',
        type: 'test',
      }));
    });

    it('should include link if provided', async () => {
      const mockNotification = {
        id: 'n1',
        userId: 'user123',
        type: 'test',
        title: 'Test',
        message: 'Test message',
        link: '/projects/123',
        createdAt: new Date(),
        read: false,
      };

      (mockPrisma.notification.create as jest.Mock).mockResolvedValue(mockNotification);

      await gateway.sendNotification(
        'user123',
        'test',
        'Test',
        'Test message',
        '/projects/123'
      );

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          data: { link: '/projects/123' },
        }),
      });
    });
  });

  describe('getClientCount', () => {
    it('should return 0 initially', () => {
      expect(gateway.getClientCount()).toBe(0);
    });

    it('should return correct count after subscriptions', () => {
      const controller1 = { enqueue: jest.fn() } as any;
      const controller2 = { enqueue: jest.fn() } as any;

      gateway.subscribe(controller1);
      expect(gateway.getClientCount()).toBe(1);

      gateway.subscribe(controller2);
      expect(gateway.getClientCount()).toBe(2);
    });
  });
});
