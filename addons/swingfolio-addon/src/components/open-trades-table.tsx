import { Badge, EmptyPlaceholder, GainAmount, GainPercent, Icons, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from '@wealthfolio/ui';
import type { OpenPosition } from '../types';
import { TickerAvatar } from './ticker-avatar';

interface MergedPosition {
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
  marketValueBaseCurrency?: number; // Added for base currency market value
}

interface OpenTradesTableProps {
  positions: OpenPosition[] | MergedPosition[];
  baseCurrency?: string;
  convertToBaseCurrency?: (amount: number, fromCurrency: string) => number;
}

export function OpenTradesTable({ positions, baseCurrency, convertToBaseCurrency }: OpenTradesTableProps) {
  if (positions.length === 0) {
    return (
      <div className="flex h-[300px] w-full items-center justify-center">
        <EmptyPlaceholder
          className="mx-auto flex max-w-[400px] items-center justify-center"
          icon={<Icons.TrendingUp className="h-10 w-10" />}
          title="No Open Positions"
          description="You don't have any open swing trading positions at the moment. Closed trades will appear in your performance metrics."
        />
      </div>
    );
  }

  // Check if positions are merged (by checking for positionPct property)
  const isMergedView = positions.length > 0 && 'positionPct' in positions[0];

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
<TableHeader>
  <TableRow>
    <TableHead className="w-[60px]"></TableHead>
    <TableHead>Symbol</TableHead>
    <TableHead className="text-right">Quantity</TableHead>
    <TableHead className="text-right">Avg Cost</TableHead>
    <TableHead className="text-right">Current</TableHead>
<TableHead className="text-right">Market Value</TableHead>
{baseCurrency && <TableHead className="text-right">Base Currency Market Value</TableHead>}
    <TableHead className="text-right">P/L</TableHead>
    <TableHead className="text-right">Return %</TableHead>
    <TableHead className="text-center">Days</TableHead>
    {isMergedView && <TableHead className="text-right">Position %</TableHead>}
  </TableRow>
</TableHeader>
          <TableBody>
            {positions.map((position, index) => (
              <TableRow key={index}>
                <TableCell>
                  <TickerAvatar symbol={position.symbol} className="h-8 w-8" />
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{position.symbol}</div>
                    {position.assetName && (
                      <div className="text-muted-foreground max-w-[120px] truncate text-xs" title={position.assetName}>
                        {position.assetName}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {position.quantity.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 4
                  })}
                </TableCell>
                <TableCell className="text-right">
                  {position.averageCost.toLocaleString('en-US', { style: 'currency', currency: position.currency })}
                </TableCell>
                <TableCell className="text-right">
                  {position.currentPrice.toLocaleString('en-US', { style: 'currency', currency: position.currency })}
                </TableCell>
<TableCell className="text-right">
  {position.marketValue.toLocaleString('en-US', { style: 'currency', currency: position.currency })}
</TableCell>
{baseCurrency && (
  <TableCell className="text-right">
    {/* For merged positions, use the pre-calculated marketValueBaseCurrency */}
    {isMergedView && 'marketValueBaseCurrency' in position && position.marketValueBaseCurrency !== undefined ? (
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: baseCurrency,
      }).format(position.marketValueBaseCurrency)
    ) : convertToBaseCurrency ? (
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: baseCurrency,
      }).format(
        convertToBaseCurrency(position.marketValue, position.currency)
      )
    ) : (
      <span className="text-muted-foreground">N/A</span>
    )}
  </TableCell>
)}
<TableCell className="text-right">
  <GainAmount value={position.unrealizedPL} currency={position.currency} />
</TableCell>
                <TableCell className="text-right">
                  <GainPercent value={position.unrealizedReturnPercent} />
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className="text-xs">
                    {'daysOpen' in position ? position.daysOpen : position.daysOpenWeighted.toFixed(1)}
                  </Badge>
                </TableCell>
                {isMergedView && (
                  <TableCell className="text-right">
                    <Badge variant="outline" className="text-xs">
                      {(position as MergedPosition).positionPct.toFixed(2)}%
                    </Badge>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
