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

### Stockists
- `GET /api/stockists` - Get all stockists
- `GET /api/stockists/:id` - Get stockist by ID
- `POST /api/stockists` - Create new stockist
- `PUT /api/stockists/:id` - Update stockist
- `DELETE /api/stockists/:id` - Delete stockist
- `POST /api/stockists/:id/documents` - Upload stockist documents

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
- **Stockist** - Pharmaceutical distributor records

### Key Features
- **UUID Primary Keys** for better scalability
- **JSONB Fields** for flexible data structures
- **Automatic Timestamps** (createdAt, updatedAt)
- **Soft Deletes** via isActive flag
- **Password Hashing** with bcrypt
- **Field Validation** with Sequelize validators

## File Storage

### Cloudinary Integration
Stockist documents are stored using Cloudinary to save hosting space on the VPS.

**Supported Document Types:**
1. GST Registration Certificate
2. Drug License
3. PAN Card Copy
4. Cancelled Cheque
5. Business Profile

**Database Storage:**
Document URLs are stored in the PostgreSQL database in the `stockists` table:
- `gst_certificate_url`
- `drug_license_url`
- `pan_card_url`
- `cancelled_cheque_url`
- `business_profile_url`

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
```