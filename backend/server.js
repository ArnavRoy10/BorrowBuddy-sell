require('dotenv').config();
const express = require('express');
const cors = require('cors');
const passport = require('passport');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const { connectDB } = require('./config/database');

// Initialize Express
const app = express();

// Connect to database
connectDB();

// ==================== MIDDLEWARE ====================

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));
app.use(cookieParser());

// CORS Configuration
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        const allowedOrigins = [
            process.env.FRONTEND_URL,
            'http://localhost:3000',
            'http://127.0.0.1:5500',
            'http://localhost:5500'
        ];
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn('⚠️  Blocked by CORS:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Express session (required for Passport)
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Passport configuration
require('./config/passport')(passport);

// Request logging middleware (development only)
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`📨 ${req.method} ${req.path}`);
        next();
    });
}

// ==================== ROUTES ====================

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/items',    require('./routes/items'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/admin',    require('./routes/admin'));
app.use('/api/upload',   require('./routes/upload'));
app.use('/api/disputes', require('./routes/disputes'));

// Health check endpoints
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'BorrowBuddy API is running',
        version: '1.0.0',
        endpoints: {
            health:      '/health',
            auth:        '/api/auth',
            items:       '/api/items',
            payments:    '/api/payments',
            requests:    '/api/requests',
            messages:    '/api/messages',
            admin:       '/api/admin',
            upload:      '/api/upload',
            disputes:    '/api/disputes',
            googleOAuth: '/api/auth/google'
        }
    });
});

app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'API is healthy',
        timestamp: new Date().toISOString(),
        database: 'connected'
    });
});

// ==================== ERROR HANDLING ====================

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err.stack);
    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log('');
    console.log('================================================');
    console.log('🚀 BorrowBuddy Backend Server Started');
    console.log('================================================');
    console.log(`📡 Server running on: http://localhost:${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📊 MongoDB Atlas: ${process.env.MONGODB_URI ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`🔐 Google OAuth: ${process.env.GOOGLE_CLIENT_ID ? '✅' : '❌'}`);
    console.log(`💳 Stripe: ${process.env.STRIPE_SECRET_KEY ? '✅' : '❌'}`);
    console.log(`☁️  Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME ? '✅' : '❌'}`);
    console.log('================================================');
    console.log('');
    console.log('Available Endpoints:');
    console.log('  GET    /                           - API Info');
    console.log('  GET    /health                     - Health Check');
    console.log('  POST   /api/auth/register          - Register User');
    console.log('  POST   /api/auth/login             - Login User');
    console.log('  GET    /api/auth/me                - Get Current User');
    console.log('  PUT    /api/auth/updateprofile     - Update Profile');
    console.log('  POST   /api/auth/logout            - Logout');
    console.log('  DELETE /api/auth/deleteaccount     - Delete Account');
    console.log('  GET    /api/auth/google            - Google OAuth');
    console.log('  GET    /api/items                  - Browse Items');
    console.log('  POST   /api/items                  - Add Item');
    console.log('  GET    /api/items/my-items         - My Items');
    console.log('  GET    /api/items/:id              - Single Item');
    console.log('  PUT    /api/items/:id              - Update Item');
    console.log('  DELETE /api/items/:id              - Delete Item');
    console.log('  POST   /api/payments/create-order  - Create Payment');
    console.log('  POST   /api/payments/verify        - Verify Payment');
    console.log('  GET    /api/payments/history        - Payment History');
    console.log('  POST   /api/requests               - Submit Request');
    console.log('  GET    /api/requests/incoming      - Incoming Requests');
    console.log('  GET    /api/requests/outgoing      - Outgoing Requests');
    console.log('  POST   /api/requests/cancel-by-item- Cancel by Item');
    console.log('  PUT    /api/requests/:id/approve   - Approve Request');
    console.log('  PUT    /api/requests/:id/reject    - Reject Request');
    console.log('  PUT    /api/requests/:id/cancel    - Cancel Request');
    console.log('  GET    /api/messages/inbox         - Message Inbox');
    console.log('  GET    /api/messages/conversation  - Get Conversation');
    console.log('  POST   /api/messages/send          - Send Message');
    console.log('  POST   /api/messages/read          - Mark Read');
    console.log('  POST   /api/admin/login            - Admin Login');
    console.log('  GET    /api/admin/admins           - List Admins');
    console.log('  POST   /api/admin/admins           - Create Admin');
    console.log('  PUT    /api/admin/admins/:id       - Update Admin');
    console.log('  DELETE /api/admin/admins/:id       - Delete Admin');
    console.log('  GET    /api/admin/users            - List Users');
    console.log('  DELETE /api/admin/users/:id        - Delete User');
    console.log('  GET    /api/admin/items            - List Items');
    console.log('  DELETE /api/admin/items/:id        - Delete Item');
    console.log('  GET    /api/admin/stats            - Platform Stats');
    console.log('  POST   /api/upload/images          - Upload to Cloudinary');
    console.log('  DELETE /api/upload/images/:id      - Delete Cloudinary Image');
    console.log('================================================');
    console.log('');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error(`❌ Unhandled Rejection: ${err.message}`);
    server.close(() => process.exit(1));
});

// Handle SIGTERM
process.on('SIGTERM', () => {
    console.log('👋 SIGTERM received. Shutting down gracefully...');
    server.close(() => console.log('✅ Process terminated'));
});