const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const axios = require('axios');
const cron = require('node-cron');
require('dotenv').config();

// MongoDB imports
const database = require('./config/database');
const User = require('./models/User');
const Transaction = require('./models/Transaction');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Market data storage (still in memory for performance)
let marketData = {};
let globalMetrics = {};

// For demo purposes, we'll use a default user ID
// In production, this would come from authentication middleware
let defaultUserId = null;

// CoinMarketCap API Configuration
const CMC_API_KEY = process.env.COINMARKETCAP_API_KEY;
const CMC_BASE_URL = 'https://pro-api.coinmarketcap.com/v1';

// Helper function to fetch market data from CoinMarketCap
async function fetchMarketData(symbols) {
  try {
    const response = await axios.get(`${CMC_BASE_URL}/cryptocurrency/quotes/latest`, {
      headers: {
        'X-CMC_PRO_API_KEY': CMC_API_KEY,
        'Accept': 'application/json'
      },
      params: {
        symbol: symbols.join(','),
        convert: 'USD'
      }
    });
    return response.data.data;
  } catch (error) {
    console.error('Error fetching market data:', error.response?.data || error.message);
    return {};
  }
}

// Helper function to fetch global crypto metrics
async function fetchGlobalMetrics() {
  try {
    const response = await axios.get(`${CMC_BASE_URL}/global-metrics/quotes/latest`, {
      headers: {
        'X-CMC_PRO_API_KEY': CMC_API_KEY,
        'Accept': 'application/json'
      }
    });
    return response.data.data;
  } catch (error) {
    console.error('Error fetching global metrics:', error.response?.data || error.message);
    return {};
  }
}

// Helper function to calculate portfolio summary with current market prices
async function calculatePortfolioSummary(userId) {
  try {
    const transactions = await Transaction.find({ userId });
    const totalInvested = transactions.reduce((sum, transaction) => {
      return sum + (transaction.buyPrice * transaction.amount);
    }, 0);
    
    let currentValue = 0;
    const holdings = {};
    
    transactions.forEach(transaction => {
      if (!holdings[transaction.coinSymbol]) {
        holdings[transaction.coinSymbol] = 0;
      }
      holdings[transaction.coinSymbol] += transaction.amount;
      
      // Calculate current value if market data is available
      if (marketData[transaction.coinSymbol]) {
        currentValue += transaction.amount * marketData[transaction.coinSymbol].quote.USD.price;
      }
    });
    
    const totalCoins = Object.keys(holdings).length;
    const profitLoss = currentValue - totalInvested;
    const profitLossPercentage = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;
    
    return {
      totalInvested: totalInvested.toFixed(2),
      currentValue: currentValue.toFixed(2),
      profitLoss: profitLoss.toFixed(2),
      profitLossPercentage: profitLossPercentage.toFixed(2),
      totalCoins: totalCoins,
      transactionCount: transactions.length,
      holdings: holdings
    };
  } catch (error) {
    console.error('Error calculating portfolio summary:', error);
    return {
      totalInvested: '0.00',
      currentValue: '0.00',
      profitLoss: '0.00',
      profitLossPercentage: '0.00',
      totalCoins: 0,
      transactionCount: 0,
      holdings: {}
    };
  }
}

// Helper function to get portfolio breakdown
async function getPortfolioBreakdown(userId) {
  try {
    const transactions = await Transaction.find({ userId });
    const holdings = {};
    const breakdown = [];
    
    transactions.forEach(transaction => {
      if (!holdings[transaction.coinSymbol]) {
        holdings[transaction.coinSymbol] = {
          symbol: transaction.coinSymbol,
          amount: 0,
          invested: 0,
          currentValue: 0,
          transactions: 0
        };
      }
      
      holdings[transaction.coinSymbol].amount += transaction.amount;
      holdings[transaction.coinSymbol].invested += transaction.buyPrice * transaction.amount;
      holdings[transaction.coinSymbol].transactions += 1;
      
      if (marketData[transaction.coinSymbol]) {
        holdings[transaction.coinSymbol].currentValue = holdings[transaction.coinSymbol].amount * marketData[transaction.coinSymbol].quote.USD.price;
        holdings[transaction.coinSymbol].currentPrice = marketData[transaction.coinSymbol].quote.USD.price;
        holdings[transaction.coinSymbol].change24h = marketData[transaction.coinSymbol].quote.USD.percent_change_24h || 0;
      } else {
        holdings[transaction.coinSymbol].currentValue = 0;
        holdings[transaction.coinSymbol].currentPrice = 0;
        holdings[transaction.coinSymbol].change24h = 0;
      }
    });
    
    Object.values(holdings).forEach(holding => {
      holding.profitLoss = holding.currentValue - holding.invested;
      holding.profitLossPercentage = holding.invested > 0 ? (holding.profitLoss / holding.invested) * 100 : 0;
      breakdown.push(holding);
    });
    
    return breakdown.sort((a, b) => b.currentValue - a.currentValue);
  } catch (error) {
    console.error('Error getting portfolio breakdown:', error);
    return [];
  }
}

// Update market data periodically
async function updateMarketData() {
  try {
    const transactions = await Transaction.find({});
    const uniqueSymbols = [...new Set(transactions.map(t => t.coinSymbol))];
    if (uniqueSymbols.length > 0) {
      marketData = await fetchMarketData(uniqueSymbols);
    }
    globalMetrics = await fetchGlobalMetrics();
    console.log('Market data updated:', new Date().toISOString());
  } catch (error) {
    console.error('Error updating market data:', error);
  }
}

// Update market data every 5 minutes
cron.schedule('*/5 * * * *', updateMarketData);

// Initial market data fetch
setTimeout(updateMarketData, 2000);

// API Routes
const userRoutes = require('./routes/users');
app.use('/api/users', userRoutes);

// Existing Routes
app.get('/', async (req, res) => {
  if (!defaultUserId) {
    defaultUserId = (await User.findOne())._id;
  }
  const summary = await calculatePortfolioSummary(defaultUserId);
  const breakdown = await getPortfolioBreakdown(defaultUserId);
  const transactions = await Transaction.find({ userId: defaultUserId }).sort({ timestamp: -1 });
  
  res.render('dashboard', { 
    summary: summary,
    breakdown: breakdown,
    transactions: transactions,
    marketData: marketData,
    globalMetrics: globalMetrics
  });
});

// API endpoint for real-time data
app.get('/api/portfolio', async (req, res) => {
  if (!defaultUserId) {
    defaultUserId = (await User.findOne())._id;
  }
  const summary = await calculatePortfolioSummary(defaultUserId);
  const breakdown = await getPortfolioBreakdown(defaultUserId);
  
  res.json({
    summary: summary,
    breakdown: breakdown,
    marketData: marketData,
    globalMetrics: globalMetrics
  });
});

// API endpoint to get market data for a specific coin
app.get('/api/market/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  try {
    const data = await fetchMarketData([symbol]);
    res.json(data[symbol] || {});
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch market data' });
  }
});

app.post('/add-transaction', async (req, res) => {
  const { coinSymbol, buyPrice, amount } = req.body;
  
  // Validate input
  if (!coinSymbol || !buyPrice || !amount) {
    return res.redirect('/?error=missing-fields');
  }
  
  const price = parseFloat(buyPrice);
  const qty = parseFloat(amount);
  
  if (isNaN(price) || isNaN(qty) || price <= 0 || qty <= 0) {
    return res.redirect('/?error=invalid-values');
  }
  
  if (!defaultUserId) {
    defaultUserId = (await User.findOne())._id;
  }

  const transaction = new Transaction({
    userId: defaultUserId,
    coinSymbol: coinSymbol.toUpperCase(),
    buyPrice: price,
    amount: qty
  });
  
  await transaction.save();

  // Update market data to include new coin
  await updateMarketData();
  
  res.redirect('/');
});

app.post('/verify-transaction/:id', async (req, res) => {
  const transactionId = req.params.id;
  try {
    const transaction = await Transaction.findById(transactionId);
    if (transaction) {
      transaction.verified = !transaction.verified;
      await transaction.save();
    }
    res.redirect('/');
  } catch (error) {
    console.error('Failed to verify transaction:', error);
    res.redirect('/?error=verification-failed');
  }
});

app.delete('/delete-transaction/:id', async (req, res) => {
  const transactionId = req.params.id;
  try {
    await Transaction.findByIdAndDelete(transactionId);
    // Update market data after deletion
    await updateMarketData();
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete transaction:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// Initialize database and start server
async function startServer() {
  try {
    // Connect to MongoDB
    await database.connect();
    
    // Create default user if none exists
    const existingUser = await User.findOne();
    if (!existingUser) {
      const defaultUser = new User({
        username: 'demo_user',
        email: 'demo@example.com',
        password: 'password123',
        firstName: 'Demo',
        lastName: 'User'
      });
      await defaultUser.save();
      console.log('✅ Default user created');
    }
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`🚀 Crypto Ledger running on http://localhost:${PORT}`);
      console.log(`📊 Ready to track your cryptocurrency investments!`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⏹️  Shutting down gracefully...');
  await database.disconnect();
  process.exit(0);
});

startServer();
