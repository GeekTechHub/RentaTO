/**
 * RENTARD Currency Engine v1.0
 * Global Financial Synthesis (DOP/USD/BTC)
 */

const CurrencyEngine = {
    // Simulated Real-Time Exchange Rates
    rates: {
        USD_TO_DOP: 58.5,
        BTC_TO_DOP: 5670000, // Roughly $97k USD
        BTC_TO_USD: 97000
    },

    /**
     * Converts an amount from one currency to another.
     */
    convert: (amount, from, to) => {
        if (from === to) return amount;

        // Cross-Currency Logic
        if (from === 'DOP' && to === 'USD') return amount / CurrencyEngine.rates.USD_TO_DOP;
        if (from === 'USD' && to === 'DOP') return amount * CurrencyEngine.rates.USD_TO_DOP;
        if (from === 'DOP' && to === 'BTC') return amount / CurrencyEngine.rates.BTC_TO_DOP;
        if (from === 'BTC' && to === 'DOP') return amount * CurrencyEngine.rates.BTC_TO_DOP;
        if (from === 'USD' && to === 'BTC') return amount / CurrencyEngine.rates.BTC_TO_USD;
        if (from === 'BTC' && to === 'USD') return amount * CurrencyEngine.rates.BTC_TO_USD;

        return amount;
    },

    /**
     * Generates a multi-currency breakdown for a transaction.
     */
    getBreakdown: (amountDop) => {
        return {
            DOP: amountDop,
            USD: CurrencyEngine.convert(amountDop, 'DOP', 'USD'),
            BTC: CurrencyEngine.convert(amountDop, 'DOP', 'BTC'),
            timestamp: new Date().toISOString()
        };
    }
};

module.exports = CurrencyEngine;
