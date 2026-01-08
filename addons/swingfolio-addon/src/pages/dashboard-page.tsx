import type { AddonContext } from '@wealthfolio/addon-sdk';
import { AnimatedToggleGroup, Button, Card, CardContent, CardHeader, CardTitle, GainAmount, GainPercent, Icons, Page, PageContent, PageHeader, Skeleton, Switch, } from '@wealthfolio/ui';
import { useState } from 'react';
import { AdaptiveCalendarView } from '../components/adaptive-calendar-view';
import { DistributionCharts } from '../components/distribution-charts';
import { EquityCurveChart } from '../components/equity-curve-chart';
import { OpenTradesTable } from '../components/open-trades-table';
import { useCurrencyConversion } from '../hooks/use-currency-conversion';
import { useSwingDashboard } from '../hooks/use-swing-dashboard';
import { useSwingPreferences } from '../hooks/use-swing-preferences';
import type { OpenPosition } from '../types';

const periods = [
  { value: '1M' as const, label: '1M' },
  { value: '3M' as const, label: '3M' },
  { value: '6M' as const, label: '6M' },
  { value: 'YTD' as const, label: 'YTD' },
  { value: '1Y' as const, label: '1Y' },
  { value: 'ALL' as const, label: 'ALL' },
];

// Chart period type is now automatically determined based on selected period
const getChartPeriodDisplay = (period: '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL') => {
  switch (period) {
    case '1M':
      return { type: 'Daily', description: 'Daily P/L and cumulative equity performance' };
    case '3M':
      return { type: 'Weekly', description: 'Weekly P/L and cumulative equity performance' };
    default:
      return { type: 'Monthly', description: 'Monthly P/L and cumulative equity performance' };
  }
};

const PeriodSelector: React.FC<{
  selectedPeriod: '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL';
  onPeriodSelect: (period: '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL') => void;
}> = ({ selectedPeriod, onPeriodSelect }) => (
  <AnimatedToggleGroup items={periods} value={selectedPeriod} onValueChange={onPeriodSelect} variant="secondary" size="sm" />
);

interface DashboardPageProps {
  ctx: AddonContext;
}

export default function DashboardPage({ ctx }: DashboardPageProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL'>(
    'YTD',
  );
  const [selectedYear, setSelectedYear] = useState(new Date());
  const [mergePositionsEnabled, setMergePositionsEnabled] = useState(true);
  const { data: dashboardData, isLoading, error, refetch } = useSwingDashboard(ctx, selectedPeriod);
  const { preferences } = useSwingPreferences(ctx);
  const { baseCurrency, convertToBaseCurrency } = useCurrencyConversion({ ctx });

  // Export to CSV function
  const exportToCSV = (openPositions: OpenPosition[]) => {
    // 直接处理空数据（不提示，按钮已 disabled）
    if (openPositions.length === 0) {
      return;
    }

    // Check if we should export merged positions
    const positionsToExport = mergePositionsEnabled ? mergePositions(openPositions) : openPositions;

// Headers for merged positions
if (mergePositionsEnabled) {
  const headers = [
    'Symbol',
    'Asset Name',
    'Quantity',
    'Average Cost',
    'Current Price',
    'Market Value',
    'Base Currency Market Value',
    'Unrealized P/L',
    'Unrealized Return %',
    'Days Open (weighted avg)',
    'Currency',
    'Accounts',
    'Position %',
  ];
  const rows = positionsToExport.map(pos => [
    pos.symbol,
    pos.assetName || '',
    pos.quantity.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 }),
    pos.averageCost.toFixed(4),
    pos.currentPrice.toFixed(2),
    pos.marketValue.toFixed(2),
    // For merged positions, use the pre-calculated marketValueBaseCurrency
    pos.marketValueBaseCurrency !== undefined ? pos.marketValueBaseCurrency.toFixed(2) :
    (baseCurrency && convertToBaseCurrency ? convertToBaseCurrency(pos.marketValue, pos.currency).toFixed(2) : 'N/A'),
    pos.unrealizedPL.toFixed(2),
    (pos.unrealizedReturnPercent * 100).toFixed(2) + '%',
    pos.daysOpenWeighted.toFixed(1),
    pos.currency,
    pos.accounts,
    pos.positionPct.toFixed(2) + '%',
  ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `merged-open-positions-${new Date().toISOString().slice(0,10)}.csv`;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log('CSV exported:', positionsToExport.length, 'merged positions');
      return;
    }

// Original headers for unmerged positions
const headers = [
  'Symbol',
  'Asset Name',
  'Quantity',
  'Average Cost',
  'Current Price',
  'Market Value',
  'Base Currency Market Value',
  'Unrealized P/L',
  'Unrealized Return %',
  'Days Open',
  'Currency',
  'Account',
];
const rows = openPositions.map(pos => [
  pos.symbol,
  pos.assetName || '',
  pos.quantity.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 }),
  pos.averageCost.toFixed(2),
  pos.currentPrice.toFixed(2),
  pos.marketValue.toFixed(2),
  baseCurrency && convertToBaseCurrency ? convertToBaseCurrency(pos.marketValue, pos.currency).toFixed(2) : 'N/A',
  pos.unrealizedPL.toFixed(2),
  (pos.unrealizedReturnPercent * 100).toFixed(2) + '%',
  pos.daysOpen,
  pos.currency,
  pos.accountName,
]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `open-positions-${new Date().toISOString().slice(0,10)}.csv`;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 可选：用 console 确认（开发时看）
    console.log('CSV exported:', openPositions.length, 'positions');
  };
  // Export to CSV function END

  const handleNavigateToActivities = () => {
    ctx.api.navigation.navigate('/addons/swingfolio/activities');
  };

  const handleNavigateToSettings = () => {
    ctx.api.navigation.navigate('/addons/swingfolio/settings');
  };

  // Hardcoded exchange rates for USD conversion (as of 2026-01-07)
  const HARDCODED_EXCHANGE_RATES: Record<string, number> = {
    'USD': 1,
    'HKD': 0.1284,
    'CNY': 0.1430,
  };

  // Convert currency amount to USD equivalent using exchange rates
  const convertToUSD = (amount: number, currency: string): number => {
    // Fallback to hardcoded rates
    const rate = HARDCODED_EXCHANGE_RATES[currency] || 1;
    return amount * rate;
  };

  // Merge open positions by symbol and currency
  const mergePositions = (positions: OpenPosition[]): any[] => {
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
    const mergedPositions: any[] = [];

    // Calculate total USD value for position percentage calculation
    let totalUsdValue = 0;
    const positionsWithUsdValue: Array<{ position: OpenPosition; usdValue: number }> = [];

    groupedPositions.forEach(group => {
      // Calculate USD value for each position in the group
      group.forEach(position => {
        const usdValue = convertToUSD(position.marketValue, position.currency);
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

      // Calculate base currency market value if currency conversion is available
      let marketValueBaseCurrency: number | undefined;
      if (baseCurrency && convertToBaseCurrency) {
        marketValueBaseCurrency = convertToBaseCurrency(marketValue, currency);
      }

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
        marketValueBaseCurrency,
      });
    });

    // Sort by position percentage descending, then symbol ascending
    return mergedPositions.sort((a, b) => {
      if (b.positionPct !== a.positionPct) {
        return b.positionPct - a.positionPct;
      }
      return a.symbol.localeCompare(b.symbol);
    });
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error || !dashboardData) {
    return (
      <Page>
        <PageHeader heading="Trading Dashboard" />
        <PageContent>
          <div className="flex h-[calc(100vh-200px)] items-center justify-center">
            <div className="px-4 text-center">
              <Icons.AlertCircle className="text-muted-foreground mx-auto mb-4 h-10 w-10 sm:h-12 sm:w-12" />
              <h3 className="mb-2 text-base font-semibold sm:text-lg">Failed to load dashboard</h3>
              <p className="text-muted-foreground mb-4 text-sm sm:text-base">
                {error?.message || 'Unable to load swing trading data'}
              </p>
              <Button onClick={() => refetch()}>Try Again</Button>
            </div>
          </div>
        </PageContent>
      </Page>
    );
  }

  const { metrics, openPositions = [], periodPL = [], distribution, calendar = [] } = dashboardData;
  const hasSelectedActivities = preferences.selectedActivityIds.length > 0 || preferences.includeSwingTag;

  if (!hasSelectedActivities) {
    return (
      <Page>
        <PageHeader heading="Trading Dashboard" />
        <PageContent>
          <div className="flex h-[calc(100vh-200px)] items-center justify-center">
            <div className="px-4 text-center">
              <Icons.BarChart className="text-muted-foreground mx-auto mb-4 h-10 w-10 sm:h-12 sm:w-12" />
              <h3 className="mb-2 text-base font-semibold sm:text-lg">
                No Swing Trading Activities Selected
              </h3>
              <p className="text-muted-foreground mb-4 text-sm sm:text-base">
                Select BUY and SELL activities to start tracking your swing trading performance
              </p>
              <Button onClick={handleNavigateToActivities} className="mx-auto">
                <Icons.Plus className="mr-2 h-4 w-4" />
                Select Activities
              </Button>
            </div>
          </div>
        </PageContent>
      </Page>
    );
  }

  // Transform PeriodPL data to EquityPoint format for the chart
  const chartEquityData = periodPL.map((period, index) => {
    // Calculate cumulative P/L up to this period
    const cumulativeRealizedPL = periodPL
      .slice(0, index + 1)
      .reduce((sum, p) => sum + p.realizedPL, 0);

    return {
      date: period.date,
      cumulativeRealizedPL,
      cumulativeTotalPL: cumulativeRealizedPL, // For now, same as realized
      currency: period.currency,
    };
  });

  const headerActions = (
    <>
      <PeriodSelector selectedPeriod={selectedPeriod} onPeriodSelect={setSelectedPeriod} />
      <Button variant="outline" className="hidden rounded-full sm:inline-flex" onClick={handleNavigateToActivities}>
        <Icons.ListChecks className="mr-2 h-4 w-4" />
        <span>Select Activities</span>
      </Button>
      <Button variant="outline" size="icon" onClick={handleNavigateToActivities} className="sm:hidden" aria-label="Select activities">
        <Icons.ListChecks className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" onClick={handleNavigateToSettings} className="rounded-full">
        <Icons.Settings className="size-4" />
      </Button>
    </>
  );

  return (
    <Page>
      <PageHeader heading="Trading Dashboard" actions={headerActions} />
      <PageContent>
        <div className="space-y-4 sm:space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-3">
            {/* Widget 1: Overall P/L Summary - Clean Design */}
            <Card className={`${metrics.totalPL >= 0 ? 'border-success/10 bg-success/10' : 'border-destructive/10 bg-destructive/10'}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pt-4 pb-3">
                <CardTitle className="text-sm font-medium">P/L</CardTitle>
                <GainAmount className="text-xl font-bold sm:text-2xl" value={metrics.totalPL} currency={metrics.currency} />
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Details Below - Labels Left, Amounts Right */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground text-xs">
                      Realized ({metrics.totalTrades} trades)
                    </span>
                    <div className="flex items-center gap-2">
                      <GainAmount value={metrics.totalRealizedPL} currency={metrics.currency} className="font-medium" displayDecimal={false} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground text-xs">
                      Unrealized ({metrics.openPositions} open)
                    </span>
                    <div className="flex items-center gap-2">
                      <GainAmount value={metrics.totalUnrealizedPL} currency={metrics.currency} className="font-medium" displayDecimal={false} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Widget 2: Core Performance */}
            <Card className="border-blue-500/10 bg-blue-500/10">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Core Performance</CardTitle>
                <Icons.CheckCircle className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Win Rate</span>
                    <GainPercent value={metrics.winRate} className="text-sm font-semibold" showSign={false} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Avg Win</span>
                    <GainAmount value={metrics.averageWin} currency={metrics.currency} className="text-sm font-semibold" displayDecimal={false} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Avg Loss</span>
                    <GainAmount value={-metrics.averageLoss} currency={metrics.currency} className="text-sm font-semibold" displayDecimal={false} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Total Trades</span>
                    <span className="text-sm font-semibold">{metrics.totalTrades}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Widget 3: Analytics & Ratios */}
            <Card className="border-purple-500/10 bg-purple-500/10">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Analytics & Ratios</CardTitle>
                <Icons.BarChart className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Expectancy</span>
                    <GainAmount value={metrics.expectancy} currency={metrics.currency} className="text-sm font-semibold" displayDecimal={false} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Profit Factor</span>
                    <span className="text-sm font-semibold">
                      {metrics.profitFactor === Number.POSITIVE_INFINITY ? '∞' : metrics.profitFactor.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Avg Hold Time</span>
                    <span className="text-sm font-semibold">
                      {metrics.averageHoldingDays.toFixed(1)} days
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row - Equity Curve and Calendar */}
          <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
            {/* Equity Curve */}
            <Card className="flex flex-col">
              <CardHeader className="shrink-0 pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base sm:text-lg">
                      {getChartPeriodDisplay(selectedPeriod).type} Equity Curve
                    </CardTitle>
                    <p className="text-muted-foreground text-xs sm:text-sm">
                      {getChartPeriodDisplay(selectedPeriod).description}
                    </p>
                  </div>
                  <div className="bg-secondary text-muted-foreground self-start rounded-full px-2 py-1 text-xs whitespace-nowrap sm:self-auto">
                    {selectedPeriod} → {getChartPeriodDisplay(selectedPeriod).type}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col py-4 sm:py-6">
                <EquityCurveChart data={chartEquityData} currency={metrics.currency} periodType={
                  selectedPeriod === '1M' ? 'daily' :
                  selectedPeriod === '3M' ? 'weekly' : 'monthly'
                } />
              </CardContent>
            </Card>

            <Card className="flex flex-col pt-0">
              <CardContent className="flex min-h-0 flex-1 flex-col py-4 sm:py-6">
                <AdaptiveCalendarView calendar={calendar} selectedPeriod={selectedPeriod} selectedYear={selectedYear} onYearChange={setSelectedYear} currency={metrics.currency} />
              </CardContent>
            </Card>
          </div>

          {/* Open Positions - Full Width on Mobile */}
          <Card>
            {/* <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base sm:text-lg">Open Positions</CardTitle>
              <span className="text-muted-foreground text-sm">
                {openPositions.length} {openPositions.length === 1 ? 'position' : 'positions'}
              </span>
            </CardHeader> */}

            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center space-x-4">
                <CardTitle>Open Positions</CardTitle>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">Merge</span>
                  <Switch checked={mergePositionsEnabled} onCheckedChange={setMergePositionsEnabled} />
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => exportToCSV(openPositions)} disabled={isLoading || openPositions.length === 0}>
                <Icons.Download className="mr-2 h-4 w-4" />
                Export to CSV
              </Button>
            </CardHeader>

            <CardContent className="px-2 sm:px-6">
              <OpenTradesTable
                positions={mergePositionsEnabled ? mergePositions(openPositions) : openPositions}
                baseCurrency={baseCurrency}
                convertToBaseCurrency={convertToBaseCurrency}
              />
            </CardContent>
          </Card>

          {/* Distribution Charts */}
          <DistributionCharts distribution={distribution} currency={metrics.currency} />
        </div>
      </PageContent>
    </Page>
  );
}

function DashboardSkeleton() {
  return (
    <Page>
      <PageHeader heading="Trading Dashboard" text="Track your trading performance and analytics" actions={
        <>
          <Skeleton className="h-9 w-[280px]" />
          <Skeleton className="h-9 w-[100px] sm:w-[140px]" />
          <Skeleton className="h-9 w-9" />
        </>
      } />
      <PageContent>
        <div className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, index) => (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-[100px] sm:w-[120px]" />
                  <Skeleton className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-6 w-[120px] sm:h-8 sm:w-[150px]" />
                  <Skeleton className="mt-2 h-3 w-[80px] sm:h-4 sm:w-[100px]" />
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-[120px] sm:h-6 sm:w-[150px]" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[250px] w-full sm:h-[300px]" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-[150px] sm:h-6 sm:w-[180px]" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3 sm:space-y-4">
                  {[...Array(5)].map((_, index) => (
                    <div key={index} className="flex justify-between">
                      <Skeleton className="h-3 w-[80px] sm:h-4 sm:w-[100px]" />
                      <Skeleton className="h-3 w-[60px] sm:h-4 sm:w-[80px]" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
