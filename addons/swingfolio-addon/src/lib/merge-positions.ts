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
 * Merge open positions by symbol and currency
 * @param positions - Array of open positions to merge
 * @param exchangeRates - Exchange rates for currency conversion
 * @returns Array of merged positions
 */
export function mergePositions(
  positions: OpenPosition[],
  exchangeRates: any[] | undefined
): MergedPosition[] {
  // Group positions by symbol and currency
  const groupedPositions = new Map<string, OpenPosition[]>();

  positions.forEach(position => {
    const key = `${position.symbol}|${position.currency}`;
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
    const [symbol, currency] = key.split('|');

    // Take asset name from first position (should be the same for all in group)
    const assetName = group[0].assetName || '';

    // Calculate totals
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
  });

  // Sort by position percentage descending, then symbol ascending
  return mergedPositions.sort((a, b) => {
    if (b.positionPct !== a.positionPct) {
      return b.positionPct - a.positionPct;
    }
    return a.symbol.localeCompare(b.symbol);
  });
}
