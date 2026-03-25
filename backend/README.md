# NFC Access Control Backend

Firebase database handler for NFC Access Control system.

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Firebase Configuration
1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Generate a service account key:
   - Go to Project Settings → Service Accounts
   - Click "Generate new private key"
   - Save as `serviceAccountKey.json` in this directory

### 3. Environment Variables
```bash
cp .env.example .env
```

Edit `.env` with your Firebase credentials:
```
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
FIREBASE_PROJECT_ID=your-project-id
PORT=3000
```

### 4. Run Server
```bash
# Development with auto-reload
npm run dev

# Production
npm start
```

## Database Handler API

The `databaseHandler.js` module provides these methods:

### User Management
- `createUser(userId, userData)` - Create new user
- `getUser(userId)` - Fetch user by ID
- `getAllUsers()` - Fetch all users
- `updateUser(userId, updates)` - Update user properties
- `deleteUser(userId)` - Delete a user

### NFC Tag Management
- `registerNFCTag(tagUID, userId, tagData)` - Register NFC tag to user
- `getNFCTag(tagUID)` - Get NFC tag details
- `getUserNFCTags(userId)` - Get user's NFC tags
- `deactivateNFCTag(tagUID)` - Deactivate a tag

### Access Logging
- `logAccessEvent(tagUID, location, granted)` - Log access attempt
- `getAccessLogs(limit)` - Fetch recent access logs
- `getUserAccessLogs(userId, limit)` - Fetch user's access logs

### Real-Time Listeners
- `listenToAccessLogs(callback)` - Listen for new access logs
- `listenToUserChanges(userId, callback)` - Listen for user updates
- `removeListener(path)` - Remove listener

## API Endpoints

### Users
- `GET /api/users` - Get all users
- `GET /api/users/:userId` - Get specific user
- `POST /api/users` - Create user
- `PUT /api/users/:userId` - Update user
- `DELETE /api/users/:userId` - Delete user

### NFC Tags
- `POST /api/nfc-tags/register` - Register tag
- `GET /api/nfc-tags/:tagUID` - Get tag details
- `GET /api/users/:userId/nfc-tags` - Get user's tags
- `PUT /api/nfc-tags/:tagUID/deactivate` - Deactivate tag

### Access Logs
- `POST /api/access-logs` - Log access event
- `GET /api/access-logs` - Get recent logs
- `GET /api/users/:userId/access-logs` - Get user's logs

## Database Structure

```
/users/{userId}
  ├── email
  ├── name
  ├── role
  ├── active
  ├── createdAt
  └── updatedAt

/nfc_tags/{tagUID}
  ├── userId
  ├── tagUID
  ├── active
  ├── registeredAt
  └── deactivatedAt

/access_logs/{logId}
  ├── tagUID
  ├── userId
  ├── location
  ├── granted
  └── timestamp
```

## Usage Example

```javascript
const databaseHandler = require('./databaseHandler');

// Create user
await databaseHandler.createUser('user1', {
  email: 'john@example.com',
  name: 'John Doe',
  role: 'admin'
});

// Register NFC tag
await databaseHandler.registerNFCTag('A1B2C3D4', 'user1');

// Log access
await databaseHandler.logAccessEvent('A1B2C3D4', 'Main Gate', true);

// Get logs
const logs = await databaseHandler.getAccessLogs(50);
```
