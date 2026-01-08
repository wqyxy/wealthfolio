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
 * Check if all positions in a group have the same asset name
 * @param positions - Array of positions to check
 * @returns true if all positions have the same asset name
 */
function hasSameAssetName(positions: OpenPosition[]): boolean {
  if (positions.length <= 1) return true;

  const firstAssetName = positions[0].assetName || positions[0].symbol;
  return positions.every(pos => {
    const assetName = pos.assetName || pos.symbol;
    return assetName === firstAssetName;
  });
}

/**
 * Convert currency amount to base currency equivalent using the provided conversion function
 * @param amount - The amount to convert
 * @param currency - The currency of the amount
 * @param baseCurrency - The base currency for conversion
 * @param convertToBaseCurrency - Function to convert to base currency
 * @returns Base currency equivalent amount
 */
function convertToBaseCurrencyAmount(
  amount: number,
  currency: string,
  baseCurrency: string,
  convertToBaseCurrency?: (amount: number, fromCurrency: string) => number
): number {
  if (!convertToBaseCurrency || currency === baseCurrency) {
    return amount;
  }

  return convertToBaseCurrency(amount, currency);
}

/**
 * Convert currency amount from base currency to target currency
 * @param amount - The amount in base currency to convert
 * @param baseCurrency - The base currency
 * @param targetCurrency - The target currency to convert to
 * @param convertToBaseCurrency - Function to convert to base currency
 * @returns Amount in target currency
 */
function convertFromBaseCurrencyAmount(
  amount: number,
  baseCurrency: string,
  targetCurrency: string,
  convertToBaseCurrency?: (amount: number, fromCurrency: string) => number
): number {
  if (!convertToBaseCurrency || baseCurrency === targetCurrency) {
    return amount;
  }

  // To convert from base currency to target currency, we need to:
  // 1. Find the rate from target currency to base currency
  // 2. Use the inverse of that rate
  const rate = convertToBaseCurrency(1, targetCurrency);
  return rate > 0 ? amount / rate : amount;
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

  // Calculate total base currency value for position percentage calculation
  let totalBaseCurrencyValue = 0;
  const positionsWithBaseCurrencyValue: Array<{ position: OpenPosition; baseCurrencyValue: number }> = [];

  groupedPositions.forEach(group => {
    // Calculate base currency value for each position in the group
    group.forEach(position => {
      const baseCurrencyValue = convertToBaseCurrencyAmount(
        position.marketValue,
        position.currency,
        baseCurrency,
        convertToBaseCurrency
      );
      positionsWithBaseCurrencyValue.push({ position, baseCurrencyValue });
      totalBaseCurrencyValue += baseCurrencyValue;
    });
  });

  // Process each group
  groupedPositions.forEach((group, key) => {
    // For asset mode, we need to determine the primary position
    let primaryPosition: OpenPosition;
    let symbol: string;
    let currency: string;
    let assetName: string;

    if (mode === 'asset') {
      // Find primary position (largest market value in base currency)
      let maxMarketValueBase = 0;
      let primaryIndex = 0;

      group.forEach((position, index) => {
        const marketValueBase = convertToBaseCurrencyAmount(
          position.marketValue,
          position.currency,
          baseCurrency,
          convertToBaseCurrency
        );

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
      assetName = primary.assetName || '';
    } else {
      // Symbol mode - use existing logic
      const parts = key.split('|');
      symbol = parts[0];
      currency = parts[1];
      primaryPosition = group[0];
      assetName = primaryPosition.assetName || '';
    }

    if (mode === 'asset' && group.length > 1 && hasSameAssetName(group)) {
      // Asset mode with multiple positions and same asset name - execute 8-step process
      const primary = group[0];

      // Step 1: Unified pricing currency conversion
      // Convert all amounts to base currency
      const convertedPositions = group.map(pos => ({
        ...pos,
        marketValueBase: convertToBaseCurrencyAmount(pos.marketValue, pos.currency, baseCurrency, convertToBaseCurrency),
        averageCostBase: convertToBaseCurrencyAmount(pos.averageCost, pos.currency, baseCurrency, convertToBaseCurrency),
        currentPriceBase: convertToBaseCurrencyAmount(pos.currentPrice, pos.currency, baseCurrency, convertToBaseCurrency),
      }));

      // Step 2: Determine primary and secondary positions
      // Primary position is already determined (largest market value in base currency)
      const secondaryPositions = convertedPositions.slice(1);

      // Step 3: Calculate equivalent quantity for secondary positions
      let totalEquivalentQuantity = primary.quantity;

      secondaryPositions.forEach(secondary => {
        // Calculate equivalent quantity: secondary market value (base currency) / primary current price (base currency)
        const equivalentQuantity = convertedPositions[0].currentPriceBase > 0
          ? secondary.marketValueBase / convertedPositions[0].currentPriceBase
          : 0;
        totalEquivalentQuantity += equivalentQuantity;
      });

      // Step 4: Merge quantities
      const mergedQuantity = totalEquivalentQuantity;

      // Step 5: Merge costs and back-calculate average cost
      // Calculate total cost for each position using converted average cost
      let totalCost = 0;

      convertedPositions.forEach(pos => {
        totalCost += pos.quantity * pos.averageCostBase;
      });

      // Calculate merged average cost in base currency
      const mergedAverageCostBase = mergedQuantity > 0 ? totalCost / mergedQuantity : 0;

      // Convert merged average cost to primary currency using correct conversion
      // We need to convert from base currency to primary currency
      const mergedAverageCost = convertFromBaseCurrencyAmount(
        mergedAverageCostBase,
        baseCurrency,
        primary.currency,
        convertToBaseCurrency
      );

      // Step 6: Recalculate merged market value, unrealized P/L, and return
      // Calculate merged market value in base currency, then convert to primary currency
      const mergedMarketValueBase = mergedQuantity * convertedPositions[0].currentPriceBase;

      // Convert merged market value to primary currency using correct conversion
      const mergedMarketValue = convertFromBaseCurrencyAmount(
        mergedMarketValueBase,
        baseCurrency,
        primary.currency,
        convertToBaseCurrency
      );

      // Calculate total unrealized P/L from original positions (no conversion needed)
      const totalUnrealizedPL = group.reduce((sum, pos) => sum + pos.unrealizedPL, 0);

      // Calculate unrealized return using base currency values (for consistency)
      const mergedUnrealizedReturnPercent = totalCost > 0 ? totalUnrealizedPL / totalCost : 0;

      // Step 7: Merge days open using quantity weighting
      // Use equivalent quantities for weighting
      let weightedDaysSum = primary.quantity * primary.daysOpen;
      let totalWeight = primary.quantity;

      secondaryPositions.forEach((secondary, index) => {
        const equivalentQuantity = convertedPositions[0].currentPriceBase > 0
          ? secondary.marketValueBase / convertedPositions[0].currentPriceBase
          : 0;
        weightedDaysSum += equivalentQuantity * group[index + 1].daysOpen;
        totalWeight += equivalentQuantity;
      });

      const mergedDaysOpenWeighted = totalWeight > 0 ? weightedDaysSum / totalWeight : 0;

      // Step 8: Recalculate position percentage
      // Calculate group base currency value
      const groupBaseCurrencyValue = positionsWithBaseCurrencyValue
        .filter(item => group.includes(item.position))
        .reduce((sum, item) => sum + item.baseCurrencyValue, 0);
      const mergedPositionPct = totalBaseCurrencyValue > 0 ? (groupBaseCurrencyValue / totalBaseCurrencyValue) * 100 : 0;

      // Collect unique accounts and sort them alphabetically
      const uniqueAccounts = [...new Set(group.map(pos => pos.accountName))].sort();
      const accounts = uniqueAccounts.join(', ');

      mergedPositions.push({
        symbol,
        assetName,
        quantity: mergedQuantity,
        averageCost: mergedAverageCost,
        currentPrice: convertFromBaseCurrencyAmount(
          convertedPositions[0].currentPriceBase,
          baseCurrency,
          primary.currency,
          convertToBaseCurrency
        ),
        marketValue: mergedMarketValue,
        unrealizedPL: totalUnrealizedPL,
        unrealizedReturnPercent: mergedUnrealizedReturnPercent,
        daysOpenWeighted: mergedDaysOpenWeighted,
        currency: primary.currency, // Keep original currency
        accounts,
        positionPct: mergedPositionPct,
      });
    } else {
      // Symbol mode or single position in asset mode or different asset names - use existing logic
      // No currency conversion needed for non-merged positions
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

      // Calculate position percentage based on base currency value (for consistent sorting)
      const groupBaseCurrencyValue = positionsWithBaseCurrencyValue
        .filter(item => group.includes(item.position))
        .reduce((sum, item) => sum + item.baseCurrencyValue, 0);
      const positionPct = totalBaseCurrencyValue > 0 ? (groupBaseCurrencyValue / totalBaseCurrencyValue) * 100 : 0;

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
        currency: group[0].currency, // Keep original currency
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
  // Sort by position percentage descending, then symbol ascending
