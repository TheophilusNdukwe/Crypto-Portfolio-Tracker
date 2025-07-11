const mongoose = require('mongoose');

class Database {
  constructor() {
    this.mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/cryptoledger';
    this.options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4
    };
  }

  async connect() {
    try {
      await mongoose.connect(this.mongoUri, this.options);
      console.log('✅ Connected to MongoDB successfully');
      
      // Handle connection events
      mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB connection error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️  MongoDB disconnected');
      });

      mongoose.connection.on('reconnected', () => {
        console.log('🔄 MongoDB reconnected');
      });

      return mongoose.connection;
    } catch (error) {
      console.error('❌ Failed to connect to MongoDB:', error);
      process.exit(1);
    }
  }

  async disconnect() {
    try {
      await mongoose.disconnect();
      console.log('✅ Disconnected from MongoDB');
    } catch (error) {
      console.error('❌ Error disconnecting from MongoDB:', error);
    }
  }

  async dropDatabase() {
    try {
      await mongoose.connection.db.dropDatabase();
      console.log('✅ Database dropped successfully');
    } catch (error) {
      console.error('❌ Error dropping database:', error);
    }
  }

  getConnection() {
    return mongoose.connection;
  }
}

module.exports = new Database();
