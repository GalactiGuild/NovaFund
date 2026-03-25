#!/bin/bash

echo "🔍 Verifying Backend Setup..."
echo ""

# Check Node.js
echo "✓ Node.js version:"
node --version

# Check npm
echo "✓ npm version:"
npm --version

# Check Docker
echo "✓ Docker version:"
docker --version

# Check if dependencies are installed
if [ -d "node_modules" ]; then
  echo "✓ Dependencies installed"
else
  echo "✗ Dependencies not installed. Run: npm install"
  exit 1
fi

# Check if build works
echo ""
echo "🔨 Testing build..."
npm run build
if [ $? -eq 0 ]; then
  echo "✓ Build successful"
else
  echo "✗ Build failed"
  exit 1
fi

# Check if linting works
echo ""
echo "🔍 Testing linter..."
npm run lint
if [ $? -eq 0 ]; then
  echo "✓ Linting passed"
else
  echo "✗ Linting failed"
  exit 1
fi

# Check Docker Compose config
echo ""
echo "🐳 Validating Docker Compose..."
docker-compose config > /dev/null
if [ $? -eq 0 ]; then
  echo "✓ Docker Compose configuration valid"
else
  echo "✗ Docker Compose configuration invalid"
  exit 1
fi

echo ""
echo "✅ All checks passed!"
echo ""
echo "Next steps:"
echo "1. Start development: npm run start:dev"
echo "2. Or use Docker: docker-compose up"
echo "3. Access API at: http://localhost:3000/api/v1"
