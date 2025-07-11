const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const axios = require('axios');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// In-memory storage for transactions (in production, use a database)
let transactions = [];
let nextId = 1;
let marketData = {};
let globalMetrics = {};

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
function calculatePortfolioSummary() {
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
}

// Helper function to get portfolio breakdown
function getPortfolioBreakdown() {
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
}

// Update market data periodically
async function updateMarketData() {
  const uniqueSymbols = [...new Set(transactions.map(t => t.coinSymbol))];
  if (uniqueSymbols.length > 0) {
    marketData = await fetchMarketData(uniqueSymbols);
  }
  globalMetrics = await fetchGlobalMetrics();
  console.log('Market data updated:', new Date().toISOString());
}

// Update market data every 5 minutes
cron.schedule('*/5 * * * *', updateMarketData);

// Initial market data fetch
setTimeout(updateMarketData, 2000);

// Routes
app.get('/', (req, res) => {
  const summary = calculatePortfolioSummary();
  const breakdown = getPortfolioBreakdown();
  
  res.render('dashboard', { 
    transactions: transactions,
    summary: summary,
    breakdown: breakdown,
    marketData: marketData,
    globalMetrics: globalMetrics
  });
});

// API endpoint for real-time data
app.get('/api/portfolio', (req, res) => {
  const summary = calculatePortfolioSummary();
  const breakdown = getPortfolioBreakdown();
  
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
  
  const transaction = {
    id: nextId++,
    coinSymbol: coinSymbol.toUpperCase(),
    buyPrice: price,
    amount: qty,
    totalValue: price * qty,
    timestamp: new Date().toISOString(),
    verified: false
  };
  
  transactions.push(transaction);
  
  // Update market data to include new coin
  await updateMarketData();
  
  res.redirect('/');
});

app.post('/verify-transaction/:id', (req, res) => {
  const transactionId = parseInt(req.params.id);
  const transaction = transactions.find(t => t.id === transactionId);
  
  if (transaction) {
    transaction.verified = !transaction.verified;
  }
  
  res.redirect('/');
});

app.delete('/delete-transaction/:id', async (req, res) => {
  const transactionId = parseInt(req.params.id);
  transactions = transactions.filter(t => t.id !== transactionId);
  
  // Update market data after deletion
  await updateMarketData();
  
  res.json({ success: true });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Crypto Ledger running on http://localhost:${PORT}`);
  console.log(`📊 Ready to track your cryptocurrency investments!`);
});
