// ================================================
// HOW TO RUN:
//   1. Copy this file into D:\BorrowBuddy\backend\
//   2. Open terminal IN that folder:
//      cd D:\BorrowBuddy\backend
//   3. Run: node createSuperAdmin.js
// ================================================

const path = require('path');
// Force .env load from same directory as this script
require('dotenv').config({ path: path.join(__dirname, '.env') });

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI
               || process.env.MONGODB_URI
               || 'mongodb://localhost:27017/borrowbuddy';

async function run() {
    // ── Edit these before running ──────────────────
    const NAME     = 'Arnav';
    const EMAIL    = 'arnavbhi5@gmail.com';
    const PASSWORD = 'Arnav@123';
    // ──────────────────────────────────────────────

    console.log('Connecting to:', MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB\n');

    const db = mongoose.connection.db;

    const existing = await db.collection('admins').findOne({ email: EMAIL.toLowerCase() });
    if (existing) {
        console.log('Admin already exists with this email. Delete it first or change the EMAIL above.');
        await mongoose.disconnect();
        return;
    }

    const salt     = await bcrypt.genSalt(10);
    const password = await bcrypt.hash(PASSWORD, salt);

    const POWERS = [
        'view_users','edit_users','delete_users',
        'view_items','edit_items','delete_items',
        'view_requests','manage_requests',
        'view_payments','manage_payments',
        'view_reports','manage_admins'
    ];

    await db.collection('admins').insertOne({
        name:      NAME,
        email:     EMAIL.toLowerCase(),
        password,
        role:      'super_admin',
        powers:    POWERS,
        isActive:  true,
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
    });

    console.log('Super admin created!');
    console.log('  Email   :', EMAIL);
    console.log('  Password:', PASSWORD);
    console.log('  Role    : super_admin');
    console.log('\nOpen frontend/admin.html to log in.');

    await mongoose.disconnect();
}

run().catch(e => {
    console.error('Failed:', e.message);
    process.exit(1);
});
