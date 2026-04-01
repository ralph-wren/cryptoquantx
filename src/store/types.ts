// 蜡烛图数据类型
export interface CandlestickData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime?: string | number; // 收盘时间，可选字段
  openTime?: string | number; // 开盘时间，可选字段
}

// 回测汇总数据类型
export interface BacktestSummary {
  averageProfit: number;
  backtestId: string;
  batch_backtest_id?: string; // 批量回测ID
  createTime: string;
  endTime: string;
  finalAmount: number;
  id: number;
  initialAmount: number;
  intervalVal: string;
  maxDrawdown: number;
  maxDrawdownPeriod?: number; // 价格最大回撤
  maximumLossPeriod?: number; // 价格最大损失
  numberOfTrades: number;
  profitableTrades: number;
  sharpeRatio: number;
  startTime: string;
  strategyName: string;
  strategyCode: string;
  strategyParams: string;
  symbol: string;
  totalProfit: number;
  totalReturn: number;
  annualizedReturn?: number; // 年化收益率
  unprofitableTrades: number;
  winRate: number;
  totalFee: number;
  success?: boolean; // 策略是否成功执行
  calmarRatio?: number; // 卡玛比率
  sortinoRatio?: number; // 索提诺比率
  maximumLoss?: number; // 最大损失
  // 新增字段
  alpha?: number; // Alpha系数
  beta?: number; // Beta系数
  omega?: number; // Omega比率
  profitFactor?: number; // 盈利因子
  skewness?: number; // 偏度
  treynorRatio?: number; // 特雷诺比率
  ulcerIndex?: number; // 溃疡指数
  burkeRatio?: number; // 伯克比率
  comprehensiveScore?: number; // 综合评分
  cvar?: number; // 条件风险价值
  downsideDeviation?: number; // 下行偏差
  downtrendCapture?: number; // 下跌捕获比率
  informationRatio?: number; // 信息比率
  kurtosis?: number; // 峰度
  maxDrawdownDuration?: number; // 最大回撤持续时间
  modifiedSharpeRatio?: number; // 修正夏普比率
  painIndex?: number; // 痛苦指数
  riskAdjustedReturn?: number; // 风险调整收益
  sterlingRatio?: number; // 斯特林比率
  trackingError?: number; // 跟踪误差
  uptrendCapture?: number; // 上涨捕获比率
  var95?: number; // 95%风险价值
  var99?: number; // 99%风险价值
  volatility?: number; // 波动率
  periods?: number; // 周期数
  profitPercentagePerPeriod?: number; // 每周期收益率
}

// 订单簿数据类型
export interface OrderBookEntry {
  price: number;
  amount: number;
}

export interface OrderBookData {
  asks: OrderBookEntry[];
  bids: OrderBookEntry[];
}

// 交易历史数据类型
export interface TradeHistoryEntry {
  id: string;
  time: number;
  price: number;
  amount: number;
  side: 'buy' | 'sell';
}

// 加密货币对类型
export interface CryptoPair {
  symbol: string;
  name: string;
  price: number;
  change: number;
}

// 回测交易类型
export interface BacktestTrade {
  id: string;
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  side: 'buy' | 'sell';
  amount: number;
  profit: number;
  profitPercentage: number;
}

// 回测结果类型
export interface BacktestResults {
  initialCapital: number;
  finalCapital: number;
  profit: number;
  profitPercentage: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  maximumLoss?: number; // 最大损失
  annualizedReturn?: number; // 年化收益率
  trades: BacktestTrade[];
  backtestId?: string;
}

// 用户订单类型
export interface UserOrder {
  id: string;
  symbol: string;
  type: 'market' | 'limit';
  side: 'buy' | 'sell';
  price: number;
  amount: number;
  total: number;
  status: 'pending' | 'filled' | 'canceled';
  createdAt: number;
  updatedAt: number;
}

// 日期范围类型
export interface DateRange {
  startDate: string;
  endDate: string;
}

// 市场类型
export type MarketType = 'crypto' | 'stock';

// 应用状态类型
export interface AppState {
  marketType: MarketType; // 市场类型：加密货币或股票
  selectedPair: string;
  timeframe: '1m' | '5m' | '15m' | '30m' | '1H' | '2H' | '4H' | '6H' | '12H' | '1D' | '1W' | '1M';
  dateRange: DateRange;
  candlestickData: CandlestickData[];
  orderBookData: OrderBookData;
  tradeHistoryData: TradeHistoryEntry[];
  cryptoPairs: CryptoPair[];
  userOrders: UserOrder[];
  backtestResults: BacktestResults | null;
  backtestSummaries: BacktestSummary[];
  isBacktesting: boolean;
  balance: {
    USDT: number;
    BTC: number;
    ETH: number;
  };
}

// 回测交易详情类型
export interface BacktestTradeDetail {
  backtestId: string;
  closed: boolean;
  createTime: string;
  entryAmount: number;
  entryPositionPercentage: number | null;
  entryPrice: number;
  entryTime: string;
  exitAmount: number;
  exitPrice: number;
  exitTime: string;
  fee: number | null;
  id: number;
  index: number;
  maxDrawdown: number;
  maxLoss?: number; // 最大损失
  maxDrawdownPeriod?: number; // 价格最大回撤
  maxLossPeriod?: number; // 价格最大损失
  profit: number;
  profitPercentage: number;
  remark: string | null;
  strategyName: string;
  strategyParams: string;
  symbol: string;
  totalAssets: number;
  type: string;
  volume: number | null;
  periods?: number; // 周期数
  profitPercentagePerPeriod?: number; // 每周期收益率
}
