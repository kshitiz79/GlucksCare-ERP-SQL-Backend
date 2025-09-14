#!/bin/bash

# GlucksCare ERP PostgreSQL Backend Installation Script

echo "🚀 Installing GlucksCare ERP PostgreSQL Backend..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v16 or higher."
    exit 1
fi

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed. Please install PostgreSQL v12 or higher."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Install dependencies
echo "📦 Installing Node.js dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Please create one based on .env.example"
    echo "📝 You need to configure:"
    echo "   - Database connection (DB_HOST, DB_NAME, DB_USER, DB_PASSWORD)"
    echo "   - JWT secret"
    echo "   - Email configuration"
    echo "   - Cloudinary configuration"
    exit 1
fi

echo "✅ Environment configuration found"

# Test database connection
echo "🔍 Testing database connection..."
node -e "
const { sequelize } = require('./src/config/database');
sequelize.authenticate()
  .then(() => {
    console.log('✅ Database connection successful');
    process.exit(0);
  })
  .catch(err => {
    console.log('❌ Database connection failed:', err.message);
    process.exit(1);
  });
"

if [ $? -ne 0 ]; then
    echo "❌ Database connection failed. Please check your configuration."
    exit 1
fi

echo "🎉 Installation completed successfully!"
echo ""
echo "🚀 To start the server:"
echo "   npm run dev    # Development mode"
echo "   npm start      # Production mode"
echo ""
echo "📊 Health check: http://localhost:5051/health"
echo "📚 API docs: http://localhost:5051/"