# Backend Services

A robust and scalable TypeScript backend built with NestJS.

## Features

- **NestJS Framework**: Modular architecture ready for microservices
- **TypeScript**: Type-safe development
- **Docker Support**: Containerized PostgreSQL and Redis
- **Environment Validation**: Runtime validation of environment variables
- **Code Quality**: ESLint + Prettier with pre-commit hooks
- **Testing**: Jest configuration included

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- npm or yarn

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration.

### 3. Start Development Server

**Option A: Local Development (without Docker)**

```bash
npm run start:dev
```

**Option B: Docker Development**

```bash
docker-compose up
```

The API will be available at `http://localhost:3000/api/v1`

### 4. Setup Git Hooks

```bash
npm run prepare
```

This installs Husky for pre-commit linting and formatting.

## Available Scripts

- `npm run start:dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start:prod` - Start production server
- `npm run lint` - Lint and fix code
- `npm run format` - Format code with Prettier
- `npm run test` - Run tests
- `npm run test:cov` - Run tests with coverage

## Docker Commands

```bash
# Start all services
docker-compose up

# Start in detached mode
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f app

# Rebuild containers
docker-compose up --build
```

## Project Structure

```
backend/
├── src/
│   ├── config/           # Configuration files
│   │   └── env.validation.ts
│   ├── app.controller.ts
│   ├── app.module.ts
│   ├── app.service.ts
│   └── main.ts
├── test/                 # E2E tests
├── .env                  # Environment variables
├── .env.example          # Example environment file
├── docker-compose.yml    # Docker services
├── Dockerfile            # Container definition
├── nest-cli.json         # NestJS CLI config
├── package.json
└── tsconfig.json
```

## API Endpoints

- `GET /api/v1` - Welcome message
- `GET /api/v1/health` - Health check

## Next Steps

1. Add database integration (TypeORM or Prisma)
2. Implement authentication module
3. Create domain-specific modules
4. Add API documentation (Swagger)
5. Setup CI/CD pipeline

## License

MIT
