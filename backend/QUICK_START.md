# Quick Start Guide

## ✅ Acceptance Criteria Checklist

### 1. npm run start:dev launches the server without errors

```bash
cd backend
npm run start:dev
```

Expected output: Server starts on `http://localhost:3000/api/v1`

### 2. Docker containers start successfully

```bash
cd backend
docker-compose up
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379
- Backend app on port 3000

### 3. Linter and formatter enforced via pre-commit hooks

Pre-commit hooks are configured to run:
- ESLint (auto-fix)
- Prettier (auto-format)

Test by making a commit:
```bash
git add .
git commit -m "test commit"
```

## Manual Testing

### Test Endpoints

```bash
# Health check
curl http://localhost:3000/api/v1/health

# Root endpoint
curl http://localhost:3000/api/v1
```

### Test Linting

```bash
npm run lint
```

### Test Formatting

```bash
npm run format
```

## Environment Validation

The app validates all required environment variables on startup. Try removing a variable from `.env` to see validation in action.

## Docker Services

Check service health:
```bash
docker-compose ps
```

View logs:
```bash
docker-compose logs -f
```

Stop services:
```bash
docker-compose down
```

## Next Steps

1. Add database ORM (TypeORM/Prisma)
2. Create authentication module
3. Add Swagger documentation
4. Implement business logic modules
