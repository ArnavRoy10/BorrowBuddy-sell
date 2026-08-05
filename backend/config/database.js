const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');

let db = null;
let client = null;

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI;

        // 1. Connect Mongoose (for User model / auth middleware)
        await mongoose.connect(uri);
        console.log('✅ Mongoose connected to MongoDB Atlas');

        // 2. Connect native MongoDB driver (for items, etc.)
        client = new MongoClient(uri);
        await client.connect();
        const dbName = process.env.DB_NAME || mongoose.connection.name || 'borrowbuddy';
        db = client.db(dbName);
        console.log(`✅ Native driver connected to MongoDB Atlas`);
        console.log(`📦 Database: ${dbName}`);

        await createIndexes();

        return db;
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        process.exit(1);
    }
};

const createIndexes = async () => {
    try {
        await db.collection('items').createIndex({ owner: 1 });
        await db.collection('items').createIndex({ category: 1 });
        await db.collection('items').createIndex({ available: 1 });
        console.log('✅ Database indexes created successfully');
    } catch (error) {
        console.log('⚠️  Some indexes may already exist');
    }
};

const getDB = () => {
    if (!db) throw new Error('Database not initialized. Call connectDB first.');
    return db;
};

const closeDB = async () => {
    if (client) {
        await client.close();
        db = null;
        client = null;
    }
    await mongoose.disconnect();
    console.log('🔌 MongoDB connections closed');
};

module.exports = { connectDB, getDB, closeDB };