# Crypto Ledger

A simple yet powerful web application for tracking cryptocurrency investments and monitoring your portfolio.

## Features

- **Transaction Tracking**: Log all your cryptocurrency purchases with coin symbol, buy price, and amount
- **Portfolio Overview**: View the total value of your investments at a glance
- **Transaction History**: See a comprehensive list of all your recorded transactions
- **Status Indicators**: Verify which transactions have been audited
- **Responsive Design**: Works seamlessly across desktop and mobile devices

## Technology Stack

- **Frontend**: HTML, CSS, JavaScript
- **Templating**: EJS (Embedded JavaScript)
- **Backend**: Node.js with Express
- **Icons**: Font Awesome
- **Responsive Design**: Custom CSS

### Adding a Transaction

1. Navigate to the main page
2. Fill in the "Add New Transaction" form:
   - **Coin Symbol**: Enter the cryptocurrency symbol (e.g., BTC, ETH, DOGE)
   - **Buy Price**: Enter the price per coin at time of purchase
   - **Amount**: Enter the quantity of coins purchased
3. Click "Add Transaction" to save the entry

### Viewing Your Portfolio

The portfolio summary at the top of the page displays:
- Total amount invested in USD
- Total number of coins in your portfolio

### Transaction History

The transaction table displays all your recorded transactions including:
- Coin symbol
- Purchase price
- Amount purchased
- Total value
- Verification status

## Customization

### Styling

You can modify the appearance by editing the `public/styles.css` file.

### Adding Features

Some potential additions you might consider:
- Current market price API integration
- Profit/loss calculation
- Multiple portfolio support
- Data visualization with charts
- Export functionality

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Font Awesome for the icon library
- Express.js community for the excellent documentation
- All contributors who have helped improve this project

---

Made with Theophilus
