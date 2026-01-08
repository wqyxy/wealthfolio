import type { OpenPosition } from '../types';
import { mergePositions } from './merge-positions';

// Mock conversion function that simulates Wealthfolio's HKD to USD conversion
const mockConvertToBaseCurrency = (amount: number, fromCurrency: string): number => {
  const rates: Record<string, number> = {
    'USD': 1,
    'HKD': 0.1283, // Correct HKD to USD rate
  };
  return amount * rates[fromCurrency];
};

// Test data based on the user's example
const testPositions: OpenPosition[] = [
  {
    id: 'pos1',
    symbol: 'BABA',
    assetName: 'Alibaba Group Holding Limited',
    quantity: 225,
    averageCost: 122.7259,
    currentPrice: 146.75,
    marketValue: 33018.75,
    unrealizedPL: 5405.43,
    unrealizedReturnPercent: 0.1958,
    totalDividends: 0,
    daysOpen: 272.8,
    openDate: new Date('2025-01-01'),
    accountId: 'acc1',
    accountName: 'Schwab',
    currency: 'USD',
    activityIds: ['act1'],
  },
  {
    id: 'pos2',
    symbol: '9988.HK',
    assetName: 'Alibaba Group Holding Limited',
    quantity: 800,
    averageCost: 124.0588,
    currentPrice: 143.5,
    marketValue: 114800, // This is in HKD
    unrealizedPL: 15552.95,
    unrealizedReturnPercent: 0.1567,
    totalDividends: 0,
    daysOpen: 130.6,
    openDate: new Date('2025-01-15'),
    accountId: 'acc2',
    accountName: 'Guotou_HK, Longbridge',
    currency: 'HKD',
    activityIds: ['act2'],
  },
];

function runTests() {
  console.log('=== Testing Final mergePositions Function ===\n');

  console.log('Test Data:');
  console.log('BABA (USD): 225 shares @ $122.73, Current: $146.75, Market Value: $33,018.75');
  console.log('9988.HK (HKD): 800 shares @ $124.06, Current: $143.5, Market Value: HKD 114,800');
  console.log('HKD/USD Rate: 0.1283\n');

  console.log('Expected Results:');
  console.log('Total Market Value (USD): $33,018.75 + HKD 114,800 * 0.1283 = $47,747.59');
  console.log('Total Quantity: $47,747.59 / $146.75 = 325.37 shares');
  console.log('Total Cost: (800 * $124.06 * 0.1283) + (225 * $122.73) = $39,313.50');
  console.log('Average Cost: $39,313.50 / 325.37 = $124.00');
  console.log('Current Price: $146.75 (BABA price)\n');

  try {
    const result = mergePositions(
      testPositions,
      'asset',
      [],
      'USD',
      mockConvertToBaseCurrency
    );

    console.log('✓ Asset mode test passed');
    console.log('Actual Results:');
    console.log(JSON.stringify(result, null, 2));

    if (result.length === 1) {
      const merged = result[0];
      console.log('\nValidation:');
      console.log(`Quantity: ${merged.quantity} (Expected: ~325.37)`);
      console.log(`Average Cost: $${merged.averageCost.toFixed(2)} (Expected: ~$124.00)`);
      console.log(`Current Price: $${merged.currentPrice.toFixed(2)} (Expected: $146.75)`);
      console.log(`Market Value: $${merged.marketValue.toFixed(2)} (Expected: ~$47,747.59)`);
      console.log(`Currency: ${merged.currency} (Expected: USD)`);

      // Check if results are close to expected
      const quantityClose = Math.abs(merged.quantity - 325.37) < 0.1;
      const costClose = Math.abs(merged.averageCost - 124.00) < 1.0;
      const priceClose = Math.abs(merged.currentPrice - 146.75) < 0.1;
      const valueClose = Math.abs(merged.marketValue - 47747.59) < 100;

      if (quantityClose && costClose && priceClose && valueClose && merged.currency === 'USD') {
        console.log('\n✅ All results are correct!');
      } else {
        console.log('\n❌ Some results are incorrect');
        console.log('Detailed comparison:');
        console.log(`  Quantity difference: ${merged.quantity - 325.37}`);
        console.log(`  Cost difference: ${merged.averageCost - 124.00}`);
        console.log(`  Price difference: ${merged.currentPrice - 146.75}`);
        console.log(`  Value difference: ${merged.marketValue - 47747.59}`);
      }
    }
  } catch (error) {
    console.error('✗ Asset mode test failed:', error);
  }

  console.log('\n=== Tests Complete ===');
}

// Run the tests
runTests();
