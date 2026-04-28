// Express Server with Firebase Database Handler
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const databaseHandler = require('./databaseHandler');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server and initialize Socket.io
const server = http.createServer(app);

// Define the exact frontend URLs allowed to connect to this backend
const allowedOrigins = '*'; // Allow all origins to bypass CORS blocks

const io = new Server(server, {
    cors: { 
        origin: allowedOrigins,
        methods: ["GET", "POST"]
    }
});

// Listen to Firebase and emit to connected dashboards
databaseHandler.listenToAccessLogs((newLog) => {
    io.emit('new_access_log', newLog);
});

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']
}));
app.use(express.json());

// ===== USER ENDPOINTS =====

/**
 * GET /api/users - Get all users
 */
app.get('/api/users', async (req, res) => {
  try {
    const users = await databaseHandler.getAllUsers();
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/users/:userId - Get specific user
 */
app.get('/api/users/:userId', async (req, res) => {
  try {
    const user = await databaseHandler.getUser(req.params.userId);
    if (user) {
      res.json({ success: true, data: user });
    } else {
      res.status(404).json({ success: false, error: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/users - Create new user
 */
app.post('/api/users', async (req, res) => {
  try {
    const { userId, email, name, role, department, uid } = req.body;
    
    if (!userId || !name) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const result = await databaseHandler.createUser(userId, {
      email: email || '',
      name,
      uid: uid || '',
      role: role || 'user',
      department: department || '',
      active: true
    });
    
    // Register the tag if a UID was provided
    if (uid) {
      await databaseHandler.registerNFCTag(uid, userId);
    }

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/users/:userId - Update user
 */
app.put('/api/users/:userId', async (req, res) => {
  try {
    const result = await databaseHandler.updateUser(req.params.userId, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/users/:userId - Delete user
 */
app.delete('/api/users/:userId', async (req, res) => {
  try {
    const result = await databaseHandler.deleteUser(req.params.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== NFC TAG ENDPOINTS =====

/**
 * POST /api/nfc-tags/register - Register NFC tag
 */
app.post('/api/nfc-tags/register', async (req, res) => {
  try {
    const { tagUID, userId } = req.body;
    
    if (!tagUID || !userId) {
      return res.status(400).json({ success: false, error: 'Missing tagUID or userId' });
    }

    const result = await databaseHandler.registerNFCTag(tagUID, userId);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/nfc-tags/:tagUID - Get NFC tag
 */
app.get('/api/nfc-tags/:tagUID', async (req, res) => {
  try {
    const tag = await databaseHandler.getNFCTag(req.params.tagUID);
    if (tag) {
      res.json({ success: true, data: tag });
    } else {
      res.status(404).json({ success: false, error: 'Tag not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/users/:userId/nfc-tags - Get user's NFC tags
 */
app.get('/api/users/:userId/nfc-tags', async (req, res) => {
  try {
    const tags = await databaseHandler.getUserNFCTags(req.params.userId);
    res.json({ success: true, data: tags });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/nfc-tags/:tagUID/deactivate - Deactivate NFC tag
 */
app.put('/api/nfc-tags/:tagUID/deactivate', async (req, res) => {
  try {
    const result = await databaseHandler.deactivateNFCTag(req.params.tagUID);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== ACCESS LOG ENDPOINTS =====

/**
 * POST /api/access-logs - Log access event
 */
app.post('/api/access-logs', async (req, res) => {
  try {
    const { tagUID, location } = req.body;
    
    if (!tagUID || !location) {
      return res.status(400).json({ success: false, error: 'Missing tagUID or location' });
    }

    const result = await databaseHandler.logAccessEvent(tagUID, location, true);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/access-logs - Get access logs
 */
app.get('/api/access-logs', async (req, res) => {
  try {
    const limit = req.query.limit || 50;
    const logs = await databaseHandler.getAccessLogs(parseInt(limit));
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/users/:userId/access-logs - Get user's access logs
 */
app.get('/api/users/:userId/access-logs', async (req, res) => {
  try {
    const limit = req.query.limit || 50;
    const logs = await databaseHandler.getUserAccessLogs(req.params.userId, parseInt(limit));
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Root endpoint for testing the URL directly
app.get('/', (req, res) => {
  res.send(`
    <div style="font-family: sans-serif; padding: 2rem; text-align: center; margin-top: 50px;">
      <h1 style="color: #16a34a;">✅ NFC Backend is Live!</h1>
      <p>The Node.js server is successfully running and connected to Firebase.</p>
      <p>Health Check: <a href="/health">/health</a></p>
    </div>
  `);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 NFC Access Control Server running on port ${PORT} with WebSockets enabled!`);
  console.log(`📊 Access logs: http://localhost:${PORT}/api/access-logs`);
  console.log(`👥 Users: http://localhost:${PORT}/api/users`);

  // Monitor Firebase Connection
  databaseHandler.checkConnection();
});
