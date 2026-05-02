// Express Server with Firebase Database Handler
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const databaseHandler = require('./databaseHandler');
const axios = require('axios');

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

// Listen for payment scans from RTDB and emit to dashboard
databaseHandler.listenToPaymentSession((session) => {
    io.emit('payment_scan_result', session);
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
    const { userId, email, name, phone, role, department, uid } = req.body;
    
    if (!userId || !name) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Check if the NFC tag is already registered
    if (uid) {
      const existingTag = await databaseHandler.getNFCTag(uid);
      if (existingTag) {
        return res.status(400).json({ success: false, error: 'This NFC card is already registered to another user.' });
      }
    }

    const result = await databaseHandler.createUser(userId, {
      email: email || '',
      name,
      phone: phone || '',
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

    // Check if the NFC tag is already registered
    const existingTag = await databaseHandler.getNFCTag(tagUID);
    if (existingTag) {
      return res.status(400).json({ success: false, error: 'This NFC card is already registered to another user.' });
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

// ===== M-PESA PAYMENT ENDPOINTS =====

/**
 * GET /api/payments - Get all payments
 */
app.get('/api/payments', async (req, res) => {
  try {
    const limit = req.query.limit || 50;
    const payments = await databaseHandler.getAllPayments(parseInt(limit));
    res.json({ success: true, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/payments/:transactionId - Get specific payment
 */
app.get('/api/payments/:transactionId', async (req, res) => {
  try {
    const payment = await databaseHandler.getPayment(req.params.transactionId);
    if (payment) {
      res.json({ success: true, data: payment });
    } else {
      res.status(404).json({ success: false, error: 'Payment not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Trigger Payment Scan Session (Hardware Integration)
app.post('/api/payments/start-scan', async (req, res) => {
    try {
        const { readerId } = req.body;
        await databaseHandler.startPaymentSession(readerId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Cancel Payment Scan Session
app.post('/api/payments/cancel-scan', async (req, res) => {
    try {
        await databaseHandler.cancelPaymentSession();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== M-PESA STK PUSH ENDPOINTS =====

// --- M-Pesa Configuration ---
const BUSINESS_SHORT_CODE = process.env.MPESA_SHORTCODE || "174379";
const PASSKEY = process.env.MPESA_PASSKEY || "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";
const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY || "bsAnhvj1VJDYoruubasQaBQdrhbmfFESeObTeGoFkexM34XY";
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || "ZBWeuZHq6R7GKgbiBnYpFQ9eGXK1k9jQusHmzD50zJ891r67O364KP9Nnn0QaUhY";

const DARASA_AUTH_URL = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
const DARASA_STK_PUSH_URL = "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";

// --- M-Pesa Utility Functions ---
const getTimestamp = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

const generatePassword = (shortcode, passkey, timestamp) => {
    return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
};

const getAuthToken = async () => {
    const credentials = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString("base64");
    try {
        const response = await axios.get(DARASA_AUTH_URL, {
            headers: { "Authorization": `Basic ${credentials}` },
        });
        return response.data.access_token;
    } catch (error) {
        console.error("Failed to get M-Pesa auth token:", error.message);
        throw new Error("Could not authenticate with M-Pesa.");
    }
};

// Trigger Payment Route
app.post('/api/mpesa/pay', async (req, res) => {
    const { amount, phone } = req.body;

    if (!amount || !phone) return res.status(400).json({ success: false, error: "Missing amount or phone" });

    const parsedAmount = parseInt(amount, 10);

    // Auto-format the phone number to 254XXXXXXXXX
    let formattedPhone = phone.replace(/\D/g, ''); // Remove spaces, +, etc.
    if (formattedPhone.startsWith('0')) formattedPhone = '254' + formattedPhone.slice(1);
    if (formattedPhone.startsWith('7') || formattedPhone.startsWith('1')) formattedPhone = '254' + formattedPhone;

    if (!/^254\d{9}$/.test(formattedPhone)) {
        return res.status(400).json({ success: false, error: `Invalid phone format (${formattedPhone}). Must be exactly 12 digits.` });
    }

    try {
        const token = await getAuthToken();
        const timestamp = getTimestamp();
        const password = generatePassword(BUSINESS_SHORT_CODE, PASSKEY, timestamp);

        const payload = {
            BusinessShortCode: BUSINESS_SHORT_CODE,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline", 
            Amount: parsedAmount,
            PartyA: formattedPhone, 
            PartyB: BUSINESS_SHORT_CODE, 
            PhoneNumber: formattedPhone, 
            CallBackURL: `https://nfc-access-system-1.onrender.com/api/mpesa/callback`, // Safaricom will call this Render URL
            AccountReference: "NFC-Payment", 
            TransactionDesc: "Payment for NFC service",
        };

        const response = await axios.post(DARASA_STK_PUSH_URL, payload, {
            headers: { "Authorization": `Bearer ${token}` },
        });

        console.log("M-Pesa STK Push initiated successfully:", response.data);
        res.status(200).json({ success: true, data: response.data });
    } catch (error) {
        console.error("Error initiating M-Pesa payment:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Trigger Payment via Tag Route
app.post('/api/mpesa/pay-via-tag', async (req, res) => {
    const { tagUID, amount } = req.body;

    if (!tagUID || !amount) return res.status(400).json({ success: false, error: "Missing tagUID or amount" });

    const parsedAmount = parseInt(amount, 10);

    try {
        // 1. Get Tag
        const tag = await databaseHandler.getNFCTag(tagUID);
        if (!tag) return res.status(404).json({ success: false, error: "NFC Tag not registered." });

        // 2. Get User
        const user = await databaseHandler.getUser(tag.userId);
        if (!user || !user.phone) return res.status(404).json({ success: false, error: "User or phone number not found." });

        // Auto-format the phone number to 254XXXXXXXXX
        let formattedPhone = user.phone.replace(/\D/g, ''); // Remove spaces, +, etc.
        if (formattedPhone.startsWith('0')) formattedPhone = '254' + formattedPhone.slice(1);
        if (formattedPhone.startsWith('7') || formattedPhone.startsWith('1')) formattedPhone = '254' + formattedPhone;

        if (!/^254\d{9}$/.test(formattedPhone)) {
            return res.status(400).json({ success: false, error: `Invalid user phone format (${formattedPhone}). Must be exactly 12 digits.` });
        }

        const token = await getAuthToken();
        const timestamp = getTimestamp();
        const password = generatePassword(BUSINESS_SHORT_CODE, PASSKEY, timestamp);

        const payload = {
            BusinessShortCode: BUSINESS_SHORT_CODE,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline", 
            Amount: parsedAmount,
            PartyA: formattedPhone, 
            PartyB: BUSINESS_SHORT_CODE, 
            PhoneNumber: formattedPhone, 
            CallBackURL: `https://nfc-access-system-1.onrender.com/api/mpesa/callback`,
            AccountReference: "NFC-Payment", 
            TransactionDesc: "Payment via NFC Tag",
        };

        const response = await axios.post(DARASA_STK_PUSH_URL, payload, {
            headers: { "Authorization": `Bearer ${token}` },
        });

        console.log("M-Pesa STK Push initiated successfully via Tag:", response.data);
        res.status(200).json({ success: true, data: response.data, phone: formattedPhone });
    } catch (error) {
        console.error("Error initiating M-Pesa payment via Tag:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Safaricom Callback Route
app.post('/api/mpesa/callback', async (req, res) => {
    console.log("Received M-Pesa callback:", JSON.stringify(req.body, null, 2));
    
    const stkCallback = req.body?.Body?.stkCallback;
    
    if (stkCallback?.ResultCode === 0) {
        console.log("Payment successful!");
        
        // Extract payment details from callback
        const callbackMetadata = stkCallback.CallbackMetadata;
        let paymentRecord = {
            status: 'completed',
            amount: 0,
            phone: '',
            transactionId: '',
            transactionDate: '',
            accountReference: stkCallback.AccountReference || 'NFC-Payment'
        };
        
        // Parse metadata items
        if (callbackMetadata?.Item) {
            callbackMetadata.Item.forEach(item => {
                switch (item.Name) {
                    case 'Amount':
                        paymentRecord.amount = item.Value;
                        break;
                    case 'MpesaReceiptNumber':
                        paymentRecord.transactionId = item.Value;
                        break;
                    case 'PhoneNumber':
                        paymentRecord.phone = String(item.Value);
                        break;
                    case 'TransactionDate':
                        paymentRecord.transactionDate = String(item.Value);
                        break;
                }
            });
        }
        
        // Save to Firebase
        try {
            await databaseHandler.savePayment(paymentRecord);
            console.log("Payment record saved to Firestore");
        } catch (err) {
            console.error("Error saving payment to Firestore:", err);
        }
    } else {
        console.log("Payment failed or cancelled by user.");
        
        // Save failed payment record
        try {
            await databaseHandler.savePayment({
                status: 'failed',
                resultCode: stkCallback?.ResultCode,
                resultDesc: stkCallback?.ResultDesc,
                accountReference: stkCallback?.AccountReference || 'NFC-Payment',
                phone: stkCallback?.PhoneNumber || ''
            });
        } catch (err) {
            console.error("Error saving failed payment:", err);
        }
    }

    // Always acknowledge receipt to Safaricom
    res.status(200).json({ "ResultCode": 0, "ResultDesc": "Accepted" });
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
