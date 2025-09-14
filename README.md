# GlucksCare ERP - PostgreSQL Backend

A Node.js backend API built with Express.js, Sequelize ORM, and PostgreSQL for the GlucksCare ERP system.

## Features

- **PostgreSQL Database** with Sequelize ORM
- **JWT Authentication** with role-based authorization
- **RESTful API** endpoints matching the original MongoDB structure
- **Real-time Communication** with Socket.IO
- **File Upload** support with Cloudinary integration
- **Email Services** with Nodemailer
- **API Response Compatibility** with existing frontend

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Installation

1. **Clone and navigate to the project:**
   ```bash
   cd Sql-Backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up PostgreSQL database:**
   ```bash
   # Create database
   createdb gluckscare_erp
   
   # Run the database schema
   psql -d gluckscare_erp -f database.sql
   ```

4. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your configuration:
   ```env
   PORT=5051
   JWT_SECRET=your_jwt_secret_here
   
   # PostgreSQL Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=gluckscare_erp
   DB_USER=postgres
   DB_PASSWORD=your_password_here
   
   # Cloudinary Configuration
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   
   # Email Configuration
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   ```

5. **Start the server:**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/email-login` - Passwordless email login
- `POST /api/auth/generate-otp` - Generate OTP for email
- `POST /api/auth/verify-otp` - Verify OTP
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user (Admin only)
- `PUT /api/users/:id` - Update user (Admin only)
- `DELETE /api/users/:id` - Deactivate user (Admin only)

### Master Data
- `GET /api/master/states` - Get all states
- `GET /api/master/head-offices` - Get all head offices
- `GET /api/master/roles` - Get available roles

### Head Offices
- `GET /api/headoffices` - Get all head offices
- `GET /api/headoffices/:id` - Get head office by ID
- `POST /api/headoffices` - Create head office (Admin only)

### States
- `GET /api/states` - Get all states

### Doctors
- `GET /api/doctors` - Get all doctors

### Sales
- `GET /api/sales` - Get sales activities

### Attendance
- `GET /api/attendance` - Get attendance records

### Leaves
- `GET /api/leaves` - Get leave records

### Shifts
- `GET /api/shifts` - Get all shifts

### Locations
- `GET /api/locations` - Get location records

## Database Models

### Core Models
- **User** - Employee/user management
- **State** - Geographic states
- **HeadOffice** - Company office locations
- **Attendance** - Daily attendance tracking
- **Leave** - Leave applications
- **LeaveType** - Types of leaves
- **Shift** - Work shift definitions
- **Doctor** - Healthcare professional contacts
- **SalesActivity** - Sales call records
- **Location** - GPS tracking data

### Key Features
- **UUID Primary Keys** for better scalability
- **JSONB Fields** for flexible data structures
- **Automatic Timestamps** (createdAt, updatedAt)
- **Soft Deletes** via isActive flag
- **Password Hashing** with bcrypt
- **Field Validation** with Sequelize validators

## API Response Format

All API responses follow a consistent format:

```json
{
  "success": true,
  "data": {...},
  "msg": "Operation successful",
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10
  }
}
```

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Role-based Access Control

- **Super Admin** - Full system access
- **Admin** - Administrative functions
- **Manager** - Team management
- **User** - Basic user functions

## Socket.IO Events

### Real-time Features
- User-specific rooms for attendance updates
- Location tracking for admin monitoring
- Real-time notifications

### Events
- `join-user-room` - Join user-specific room
- `join-location-tracking` - Join location tracking
- `location-update` - Real-time location updates

## Development

### Project Structure
```
Sql-Backend/
├── src/
│   ├── auth/           # Authentication routes
│   ├── config/         # Database and service configs
│   ├── middleware/     # Express middleware
│   ├── models/         # Sequelize models
│   ├── user/           # User management
│   ├── attendance/     # Attendance management
│   ├── leave/          # Leave management
│   └── ...             # Other modules
├── database.sql        # Database schema
├── index.js           # Main server file
└── package.json       # Dependencies
```

### Adding New Models

1. Create model in `src/models/`
2. Add to `src/config/database.js`
3. Define associations
4. Create routes in respective module

### Database Migrations

For production deployments, use proper migrations instead of `sequelize.sync()`:

```bash
# Generate migration
npx sequelize-cli migration:generate --name create-new-table

# Run migrations
npx sequelize-cli db:migrate
```

## Deployment

### Environment Setup
1. Set `NODE_ENV=production`
2. Configure production database
3. Set up SSL certificates
4. Configure reverse proxy (nginx)

### Docker Deployment
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5051
CMD ["npm", "start"]
```

## Health Check

Check API health at: `GET /health`

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "database": {
    "type": "PostgreSQL",
    "connected": true
  },
  "uptime": 3600
}
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check PostgreSQL is running
   - Verify connection credentials
   - Ensure database exists

2. **JWT Token Invalid**
   - Check JWT_SECRET in environment
   - Verify token format in Authorization header

3. **Model Association Errors**
   - Ensure all models are imported in database.js
   - Check foreign key relationships

### Logs

Enable detailed logging in development:
```env
NODE_ENV=development
```

## Migration from MongoDB

This backend maintains API compatibility with the original MongoDB version:

- **Same endpoint URLs** and request/response formats
- **Compatible field names** (camelCase in responses)
- **Preserved data structures** using JSONB fields
- **Maintained authentication flow**

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request

## License

Private - GlucksCare Pharmaceuticals# GlucksCare-ERP-SQL-Backend
