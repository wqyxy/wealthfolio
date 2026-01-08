import type { OpenPosition } from '../types';

/**
 * Merged position interface with all required fields for the feature
 */
export interface MergedPosition {
  symbol: string;
  assetName: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPL: number;
  unrealizedReturnPercent: number;
  daysOpenWeighted: number;
  currency: string;
  accounts: string;
  positionPct: number;
}

/**
 * Hardcoded exchange rates for USD conversion (as of 2026-01-07)
 * These will be used when Wealthfolio's exchange rates are not available
 */
const HARDCODED_EXCHANGE_RATES: Record<string, number> = {
  'USD': 1,
  'HKD': 0.1284,
  'CNY': 0.1430,
};

/**
 * Convert currency amount to USD equivalent using exchange rates
 * @param amount - The amount to convert
 * @param currency - The currency of the amount
 * @param exchangeRates - Exchange rates from Wealthfolio
 * @returns USD equivalent amount
 */
function convertToUSD(
  amount: number,
  currency: string,
  exchangeRates: any[] | undefined
): number {
  // Try to use Wealthfolio's exchange rates first
  if (exchangeRates && exchangeRates.length > 0) {
    // Find direct rate from currency to USD
    const directRate = exchangeRates.find(
      rate => rate.fromCurrency === currency && rate.toCurrency === 'USD'
    );
    if (directRate) {
      return amount * directRate.rate;
    }

    // Find reverse rate from USD to currency
    const reverseRate = exchangeRates.find(
      rate => rate.fromCurrency === 'USD' && rate.toCurrency === currency
    );
    if (reverseRate && reverseRate.rate > 0) {
      return amount / reverseRate.rate;
    }
  }

  // Fallback to hardcoded rates
  const rate = HARDCODED_EXCHANGE_RATES[currency] || 1;
  return amount * rate;
}

/**
 * Convert amount from one currency to another using base currency as intermediate
 * @param amount - The amount to convert
 * @param fromCurrency - The currency to convert from
 * @param toCurrency - The currency to convert to
 * @param baseCurrency - The base currency for conversion
 * @param convertToBaseCurrency - Function to convert to base currency
 * @returns Converted amount
 */
function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  baseCurrency: string,
  convertToBaseCurrency?: (amount: number, fromCurrency: string) => number
): number {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  // If we have a conversion function, use it
  if (convertToBaseCurrency) {
    // Convert from fromCurrency to base currency
    const amountInBase = convertToBaseCurrency(amount, fromCurrency);
    // Convert from base currency to toCurrency
    // For this, we need to convert 1 unit of toCurrency to base currency, then divide
    const oneUnitInBase = convertToBaseCurrency(1, toCurrency);
    return oneUnitInBase > 0 ? amountInBase / oneUnitInBase : amountInBase;
  }

  // Fallback to USD conversion
  const usdAmount = convertToUSD(amount, fromCurrency, undefined);
  const rate = HARDCODED_EXCHANGE_RATES[toCurrency] || 1;
  return usdAmount / rate;
}

/**
 * Merge open positions by symbol and currency or by asset name
 * @param positions - Array of open positions to merge
 * @param mode - Merge mode: 'symbol' or 'asset'
 * @param exchangeRates - Exchange rates for currency conversion
 * @param baseCurrency - Base currency for conversion
 * @param convertToBaseCurrency - Function to convert to base currency
 * @returns Array of merged positions
 */
export function mergePositions(
  positions: OpenPosition[],
  mode: 'symbol' | 'asset',
  exchangeRates: any[] | undefined,
  baseCurrency: string,
  convertToBaseCurrency?: (amount: number, fromCurrency: string) => number
): MergedPosition[] {
  // Group positions based on mode
  const groupedPositions = new Map<string, OpenPosition[]>();
  positions.forEach(position => {
    let key: string;
    if (mode === 'asset') {
      // Group by asset name for asset mode
      key = position.assetName || position.symbol;
    } else {
      // Group by symbol and currency for symbol mode
      key = `${position.symbol}|${position.currency}`;
    }

    if (!groupedPositions.has(key)) {
      groupedPositions.set(key, []);
    }
    groupedPositions.get(key)?.push(position);
  });

  // Convert to merged positions
  const mergedPositions: MergedPosition[] = [];

  // Calculate total USD value for position percentage calculation
  let totalUsdValue = 0;
  const positionsWithUsdValue: Array<{ position: OpenPosition; usdValue: number }> = [];
  groupedPositions.forEach(group => {
    // Calculate USD value for each position in the group
    group.forEach(position => {
      const usdValue = convertToUSD(position.marketValue, position.currency, exchangeRates);
      positionsWithUsdValue.push({ position, usdValue });
      totalUsdValue += usdValue;
    });
  });

  // Process each group
  groupedPositions.forEach((group, key) => {
    // For asset mode, we need to determine the primary position
    let primaryPosition: OpenPosition;
    let symbol: string;
    let currency: string;

    if (mode === 'asset') {
      // Find primary position (largest market value in base currency)
      let maxMarketValueBase = 0;
      let primaryIndex = 0;

      group.forEach((position, index) => {
        const marketValueBase = convertToBaseCurrency
          ? convertToBaseCurrency(position.marketValue, position.currency)
          : convertToUSD(position.marketValue, position.currency, exchangeRates);

        if (marketValueBase > maxMarketValueBase) {
          maxMarketValueBase = marketValueBase;
          primaryIndex = index;
        }
      });

      // Move primary position to the front
      const primary = group.splice(primaryIndex, 1)[0];
      group.unshift(primary);
      primaryPosition = primary;
      symbol = primary.symbol;
      currency = primary.currency;
    } else {
      // Symbol mode - use existing logic
      const parts = key.split('|');
      symbol = parts[0];
      currency = parts[1];
      primaryPosition = group[0];
    }

    const assetName = primaryPosition.assetName || '';

    if (mode === 'asset' && group.length > 1) {
      // Asset mode with multiple positions - merge them
      const primary = group[0];

      // Calculate total quantity using the formula: primary quantity + (sum of secondary market values in primary currency / primary price)
      let totalQuantity = primary.quantity;
      let totalCostBasis = primary.quantity * primary.averageCost;

      // Process secondary positions
      for (let i = 1; i < group.length; i++) {
        const secondary = group[i];
        // Convert secondary market value to primary currency
        const secondaryMarketValueInPrimaryCurrency = convertToBaseCurrency
          ? convertToBaseCurrency(secondary.marketValue, secondary.currency)
          : convertToUSD(secondary.marketValue, secondary.currency, exchangeRates);

        // Convert to primary currency if needed
        const secondaryMarketValuePrimary = convertToBaseCurrency
          ? convertCurrency(secondaryMarketValueInPrimaryCurrency, currency, primary.currency, baseCurrency, convertToBaseCurrency)
          : secondaryMarketValueInPrimaryCurrency;

        // Add equivalent quantity based on primary price
        const equivalentQuantity = primary.currentPrice > 0
          ? secondaryMarketValuePrimary / primary.currentPrice
          : 0;

        totalQuantity += equivalentQuantity;

        // Add cost basis of secondary position
        totalCostBasis += secondary.quantity * secondary.averageCost;
      }

      // Calculate weighted average cost
      const averageCost = totalQuantity > 0 ? totalCostBasis / totalQuantity : 0;

      // Use primary position's current price
      const currentPrice = primary.currentPrice;
      const marketValue = totalQuantity * currentPrice;

      // Calculate total unrealized P/L
      const unrealizedPL = group.reduce((sum, pos) => sum + pos.unrealizedPL, 0);

      // Calculate unrealized return
      const costBasis = totalQuantity * averageCost;
      const unrealizedReturnPercent = costBasis > 0 ? unrealizedPL / costBasis : 0;

      // Calculate weighted average days open using quantity weighting
      const weightedDaysSum = group.reduce((sum, pos) => sum + (pos.quantity * pos.daysOpen), 0);
      const totalOriginalQuantity = group.reduce((sum, pos) => sum + pos.quantity, 0);
      const daysOpenWeighted = totalOriginalQuantity > 0 ? weightedDaysSum / totalOriginalQuantity : 0;

      // Collect unique accounts and sort them alphabetically
      const uniqueAccounts = [...new Set(group.map(pos => pos.accountName))].sort();
      const accounts = uniqueAccounts.join(', ');

      // Calculate position percentage based on USD value
      const groupUsdValue = positionsWithUsdValue
        .filter(item => group.includes(item.position))
        .reduce((sum, item) => sum + item.usdValue, 0);
      const positionPct = totalUsdValue > 0 ? (groupUsdValue / totalUsdValue) * 100 : 0;

      mergedPositions.push({
        symbol,
        assetName,
        quantity: totalQuantity,
        averageCost,
        currentPrice,
        marketValue,
        unrealizedPL,
        unrealizedReturnPercent,
        daysOpenWeighted,
        currency,
        accounts,
        positionPct,
      });
    } else {
      // Symbol mode or single position in asset mode - use existing logic
      const totalQuantity = group.reduce((sum, pos) => sum + pos.quantity, 0);

      // Calculate weighted average cost: (∑ (quantity × averageCost)) / totalQuantity
      const weightedCostSum = group.reduce((sum, pos) => sum + (pos.quantity * pos.averageCost), 0);
      const averageCost = totalQuantity > 0 ? weightedCostSum / totalQuantity : 0;

      // Take current price from first position (should be the same for all in group)
      const currentPrice = group[0].currentPrice;

      // Calculate total market value
      const marketValue = totalQuantity * currentPrice;

      // Calculate total unrealized P/L
      const unrealizedPL = group.reduce((sum, pos) => sum + pos.unrealizedPL, 0);

      // Calculate unrealized return: total unrealized P/L / (total quantity × weighted average cost)
      const costBasis = totalQuantity * averageCost;
      const unrealizedReturnPercent = costBasis > 0 ? unrealizedPL / costBasis : 0;

      // Calculate weighted average days open: (∑ (quantity × daysOpen)) / totalQuantity
      const weightedDaysSum = group.reduce((sum, pos) => sum + (pos.quantity * pos.daysOpen), 0);
      const daysOpenWeighted = totalQuantity > 0 ? weightedDaysSum / totalQuantity : 0;

      // Collect unique accounts and sort them alphabetically
      const uniqueAccounts = [...new Set(group.map(pos => pos.accountName))].sort();
      const accounts = uniqueAccounts.join(', ');

      // Calculate position percentage based on USD value
      const groupUsdValue = positionsWithUsdValue
        .filter(item => group.includes(item.position))
        .reduce((sum, item) => sum + item.usdValue, 0);
      const positionPct = totalUsdValue > 0 ? (groupUsdValue / totalUsdValue) * 100 : 0;

      mergedPositions.push({
        symbol,
        assetName,
        quantity: totalQuantity,
        averageCost,
        currentPrice,
        marketValue,
        unrealizedPL,
        unrealizedReturnPercent,
        daysOpenWeighted,
        currency,
        accounts,
        positionPct,
      });
    }
  });

  // Sort by position percentage descending, then symbol ascending
  return mergedPositions.sort((a, b) => {
    if (b.positionPct !== a.positionPct) {
      return b.positionPct - a.positionPct;
    }
    return a.symbol.localeCompare(b.symbol);
  });
}
