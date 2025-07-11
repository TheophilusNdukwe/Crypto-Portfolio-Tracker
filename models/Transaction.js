const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  coinSymbol: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  coinName: {
    type: String,
    trim: true
  },
  transactionType: {
    type: String,
    enum: ['buy', 'sell'],
    default: 'buy'
  },
  buyPrice: {
    type: Number,
    required: true,
    min: 0
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  totalValue: {
    type: Number,
    required: true,
    min: 0
  },
  fees: {
    type: Number,
    default: 0,
    min: 0
  },
  exchange: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  verified: {
    type: Boolean,
    default: false
  },
  transactionHash: {
    type: String,
    trim: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
transactionSchema.index({ userId: 1, coinSymbol: 1 });
transactionSchema.index({ userId: 1, timestamp: -1 });

// Calculate total value before saving
transactionSchema.pre('save', function(next) {
  if (this.isModified('buyPrice') || this.isModified('amount')) {
    this.totalValue = this.buyPrice * this.amount;
  }
  next();
});

// Virtual for profit/loss calculation (requires current market price)
transactionSchema.virtual('currentValue').get(function() {
  // This will be calculated dynamically with current market data
  return this.totalValue;
});

// Static method to get user's portfolio summary
transactionSchema.statics.getPortfolioSummary = async function(userId) {
  const pipeline = [
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$coinSymbol',
        totalAmount: { $sum: '$amount' },
        totalInvested: { $sum: '$totalValue' },
        totalFees: { $sum: '$fees' },
        transactionCount: { $sum: 1 },
        avgBuyPrice: { $avg: '$buyPrice' },
        firstPurchase: { $min: '$timestamp' },
        lastPurchase: { $max: '$timestamp' }
      }
    },
    {
      $sort: { totalInvested: -1 }
    }
  ];
  
  return await this.aggregate(pipeline);
};

// Static method to get transaction history for a user
transactionSchema.statics.getUserTransactions = async function(userId, limit = 50, skip = 0) {
  return await this.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .skip(skip)
    .populate('userId', 'username email firstName lastName');
};

module.exports = mongoose.model('Transaction', transactionSchema);
