import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { AppState, BacktestResults } from '../../store/types';
import { startBacktest, finishBacktest, setSelectedPair, setTimeframe, setDateRange, clearBacktestResults, setMarketType } from '../../store/actions';
import { formatDate, formatPrice, formatPercentage } from '../../utils/helpers';
import { mockBacktestResults } from '../../data/mockData';
import './BacktestPanel.css';
import { Link, useLocation } from 'react-router-dom';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import FailedStrategiesModal, { FailedStrategy } from '../FailedStrategiesModal/FailedStrategiesModal';

// 导入与CandlestickChart相同的常量
import { COMMON_PAIRS, TIMEFRAMES } from '../../constants/trading';
import { 
  runAllBacktests, 
  fetchFailedStrategies, 
  getYesterdayDateString, 
  createRealTimeStrategy, 
  fetchAccountBalance, 
  fetchBacktestParameters, 
  updateStopLossPercent, 
  updateTrailingProfitPercent,
  fetchAllTickers,  // 添加fetchAllTickers API导入
  fetchHistoryWithIntegrityCheck  // 添加数据查询函数
} from '../../services/api';
import { fetchAllStocks, StockInfo } from '../../services/stockApi';
import { formatStockDisplay } from '../../constants/stocks';
import QuickTimeSelector from '../Chart/QuickTimeSelector';

// 策略接口定义
interface Strategy {
  name: string;
  description: string;  // 保留description字段
  params: string;
  available?: boolean;  // 表示策略是否可用
}

interface StrategiesResponse {
  code: number;
  data: {
    [key: string]: Strategy;
  };
  message: string;
}

// 每页显示的交易记录数量
const TRADES_PER_PAGE = 13;

// 添加格式化交易量的函数
const formatVolume = (volume: number | undefined | null): string => {
  if (volume === undefined || volume === null) return '0.00';
  if (volume >= 1000000) {
    return (volume / 1000000).toFixed(2) + 'M';
  } else if (volume >= 1000) {
    return (volume / 1000).toFixed(2) + 'K';
  }
  return volume.toFixed(2);
};

const BacktestPanel: React.FC = () => {
  const dispatch = useDispatch();
  const marketType = useSelector((state: AppState) => state.marketType);
  const selectedPair = useSelector((state: AppState) => state.selectedPair);
  const timeframe = useSelector((state: AppState) => state.timeframe);
  const isBacktesting = useSelector((state: AppState) => state.isBacktesting);
  const backtestResults = useSelector((state: AppState) => state.backtestResults);
  const dateRange = useSelector((state: AppState) => state.dateRange);

  const [initialCapital, setInitialCapital] = useState<string>('10000');
  const [feeRatio, setFeeRatio] = useState<string>('0.001'); // 默认手续费率0.1%
  const [strategy, setStrategy] = useState<string>('');
  const [strategies, setStrategies] = useState<{[key: string]: Strategy}>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [strategyDropdownOpen, setStrategyDropdownOpen] = useState<boolean>(false);
  const [searchStrategy, setSearchStrategy] = useState<string>('');
  const [filteredStrategies, setFilteredStrategies] = useState<[string, Strategy][]>([]);
  const strategyDropdownRef = React.useRef<HTMLDivElement>(null);

  // 添加分页状态
  const [currentPage, setCurrentPage] = useState(1);

  // 使用useRef来保持最新的状态值，避免闭包问题
  const runningBatchBacktestRef = React.useRef(false);
  const [runningBatchBacktest, setRunningBatchBacktest] = useState<boolean>(false);

  // 添加账户余额状态
  const [accountBalance, setAccountBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState<boolean>(false);

  // 添加交易对选择器所需的状态变量
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [searchPair, setSearchPair] = useState<string>('');
  const [allTickers, setAllTickers] = useState<any[]>([]);
  const [displayedPairs, setDisplayedPairs] = useState<any[]>([]);
  const [sortedPairs, setSortedPairs] = useState<any[]>([]);
  const [filteredPairs, setFilteredPairs] = useState<any[]>([]);
  const [isLoadingTickers, setIsLoadingTickers] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>('volume');
  const [sortDirection, setSortDirection] = useState<string>('desc');
  const [displayLimit, setDisplayLimit] = useState<number>(20);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // 股票选择器状态
  const [allStocks, setAllStocks] = useState<StockInfo[]>([]);
  const [filteredStocks, setFilteredStocks] = useState<StockInfo[]>([]);
  const [isLoadingStocks, setIsLoadingStocks] = useState<boolean>(false);
  const [stockDisplayLimit, setStockDisplayLimit] = useState<number>(50); // 股票列表显示数量限制
  
  // K线数据加载状态
  const [isLoadingChartData, setIsLoadingChartData] = useState<boolean>(false);

  // 当状态变化时更新ref
  useEffect(() => {
    runningBatchBacktestRef.current = runningBatchBacktest;
    // console.log('runningBatchBacktest状态更新:', runningBatchBacktest);
  }, [runningBatchBacktest]);
  const [batchStatusMessage, setBatchStatusMessage] = useState<string>('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [modalTitle, setModalTitle] = useState<string>('');
  const [modalMessage, setModalMessage] = useState<string>('');
  const [modalType, setModalType] = useState<'danger' | 'warning' | 'info'>('info');
  // 失败策略弹窗相关状态
  const [showFailedStrategiesModal, setShowFailedStrategiesModal] = useState(false);
  const [failedStrategies, setFailedStrategies] = useState<FailedStrategy[]>([]);
  const [loadingFailedStrategies, setLoadingFailedStrategies] = useState(false);

  // 实时策略状态
  const [creatingRealTimeStrategy, setCreatingRealTimeStrategy] = useState(false);
  const [tradeAmount, setTradeAmount] = useState<string>('10'); // 默认交易金额

  // 保存批量回测的完整结果数据
  const [batchBacktestResults, setBatchBacktestResults] = useState<any[]>([]);

  // 添加一个标记来跟踪是否通过事件设置了策略
  const [strategySetByEvent, setStrategySetByEvent] = useState(false);

  // 添加止损和移动止盈状态
  const [stopLossPercent, setStopLossPercent] = useState<string>('0.05');
  const [trailingProfitPercent, setTrailingProfitPercent] = useState<string>('0.05');
  const [loadingParameters, setLoadingParameters] = useState<boolean>(false);
  const [updatingStopLoss, setUpdatingStopLoss] = useState<boolean>(false);
  const [updatingTrailingProfit, setUpdatingTrailingProfit] = useState<boolean>(false);

  // 加载账户余额
  const loadAccountBalance = async () => {
    setLoadingBalance(true);
    try {
      const result = await fetchAccountBalance();
      if (result.success && result.data) {
        // 查找USDT资产并使用其available值
        const usdtAsset = result.data.assetBalances?.find((asset: { asset: string; available: number }) => asset.asset === 'USDT');
        if (usdtAsset) {
          setAccountBalance(usdtAsset.available);
        } else {
          // 如果没有找到USDT资产，回退到使用availableBalance
          setAccountBalance(result.data.availableBalance);
        }
      } else {
        console.error('获取账户余额失败:', result.message);
      }
    } catch (error) {
      console.error('获取账户余额时发生错误:', error);
    } finally {
      setLoadingBalance(false);
    }
  };

  // 获取可用策略列表和账户余额，以及回测参数
  useEffect(() => {
    const fetchStrategies = async () => {
      setLoading(true);
      setError(null);
      try {
        // 使用相对路径，通过React开发服务器的代理转发请求
        const response = await fetch('/api/backtest/ta4j/strategies');
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data: StrategiesResponse = await response.json();
        if (data.code === 200 && data.data) {
          setStrategies(data.data);
          // console.log('策略加载成功:', Object.keys(data.data));

          // 只有在策略没有通过事件设置时才从URL读取
          if (!strategySetByEvent) {
            // 检查当前URL是否包含策略代码
            const urlParams = new URLSearchParams(window.location.search);
            const strategyFromUrl = urlParams.get('strategy');

            // 如果URL中有策略代码且该策略存在，则使用它
            if (strategyFromUrl && data.data[strategyFromUrl]) {
              console.log('使用URL中的策略:', strategyFromUrl);
              setStrategy(strategyFromUrl);
              // 清除可能存在的回测结果
              dispatch(clearBacktestResults());
            }
            // 否则使用排序后的第一个策略作为默认值
            else if (Object.keys(data.data).length > 0) {
              // 按名称排序策略并选择第一个
              const sortedStrategies = Object.entries(data.data)
                .sort((a, b) => a[1].name.localeCompare(b[1].name, 'zh-CN'));
              const firstStrategy = sortedStrategies[0][0];
              // console.log('使用排序后的第一个策略作为默认值:', firstStrategy);
              setStrategy(firstStrategy);
            }
          }
        } else {
          throw new Error(data.message || '获取策略列表失败');
        }
      } catch (err) {
        console.error('获取策略列表失败:', err);
        const errorMessage = err instanceof Error ? err.message : '获取策略列表失败';
        setError(errorMessage);
        showErrorDialog('获取策略列表失败', errorMessage);

        // 添加模拟数据，以防API不可用
        const mockStrategies: {[key: string]: Strategy} = {
          "SMA": {
            "name": "简单移动平均线策略",
            "description": "基于短期和长期移动平均线的交叉信号产生买卖信号",
            "params": "短期均线周期,长期均线周期 (例如：5,20)"
          },
          "MACD": {
            "name": "MACD策略",
            "description": "基于MACD线与信号线的交叉以及柱状图的变化产生买卖信号",
            "params": "短周期,长周期,信号周期 (例如：12,26,9)"
          },
          "RSI": {
            "name": "RSI相对强弱指标策略",
            "description": "基于RSI指标的超买超卖区域产生买卖信号",
            "params": "RSI周期,超卖阈值,超买阈值 (例如：14,30,70)"
          },
          "BOLLINGER": {
            "name": "布林带策略",
            "description": "基于价格突破布林带上下轨或回归中轨产生买卖信号",
            "params": "周期,标准差倍数 (例如：20,2.0)"
          }
        };
        setStrategies(mockStrategies);

        // 只有在策略没有通过事件设置时才从URL读取
        if (!strategySetByEvent) {
          // 同样检查URL参数
          const urlParams = new URLSearchParams(window.location.search);
          const strategyFromUrl = urlParams.get('strategy');

          if (strategyFromUrl && mockStrategies[strategyFromUrl]) {
            setStrategy(strategyFromUrl);
            dispatch(clearBacktestResults());
          } else {
            // 按名称排序策略并选择第一个
            const sortedStrategies = Object.entries(mockStrategies)
              .sort((a, b) => a[1].name.localeCompare(b[1].name, 'zh-CN'));
            const firstStrategy = sortedStrategies[0][0];
            setStrategy(firstStrategy);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    const fetchParameters = async () => {
      setLoadingParameters(true);
      try {
        const result = await fetchBacktestParameters();
        if (result.success && result.data) {
          setStopLossPercent(result.data.stopLossPercent.toString());
          setTrailingProfitPercent(result.data.trailingProfitPercent.toString());
        } else {
          console.error('获取回测参数失败:', result.message);
        }
      } catch (error) {
        console.error('获取回测参数时出错:', error);
      } finally {
        setLoadingParameters(false);
      }
    };

    fetchStrategies();
    loadAccountBalance(); // 加载账户余额
    fetchParameters(); // 加载回测参数
  }, [dispatch, strategySetByEvent]); // 添加strategySetByEvent依赖

  // 监听setStrategy事件，接收从URL传递的策略代码、交易对和时间周期
  useEffect(() => {
    const handleSetStrategy = (event: CustomEvent<{strategyCode?: string, symbol?: string, interval?: string}>) => {
      const { strategyCode, symbol, interval } = event.detail;
      console.log('收到策略切换事件:', { strategyCode, symbol, interval }, '当前可用策略:', Object.keys(strategies));

      if (strategyCode) {
        // 即使当前strategies中没有该策略，也先设置，后面strategies加载完成后会再次检查
        setStrategy(strategyCode);
        setStrategySetByEvent(true); // 标记策略是通过事件设置的
        // 无论之前是否有回测结果，都清除它们以显示配置面板
        dispatch(clearBacktestResults());
      }

      if (symbol) {
        console.log('设置交易对:', symbol);
        dispatch(setSelectedPair(symbol));
      }

      if (interval) {
        console.log('设置时间周期:', interval);
        // 验证interval是否为有效的时间周期
        const validTimeframes = ['1m', '5m', '15m', '30m', '1H', '2H', '4H', '6H', '12H', '1D', '1W', '1M'];
        if (validTimeframes.includes(interval)) {
          console.log('时间周期有效，正在设置:', interval);
          dispatch(setTimeframe(interval as '1m' | '5m' | '15m' | '30m' | '1H' | '2H' | '4H' | '6H' | '12H' | '1D' | '1W' | '1M'));
        } else {
          console.log('时间周期无效:', interval, '有效值:', validTimeframes);
        }
      }
    };

    window.addEventListener('setStrategy', handleSetStrategy as EventListener);

    return () => {
      window.removeEventListener('setStrategy', handleSetStrategy as EventListener);
    };
  }, [dispatch]); // 移除strategies依赖，防止事件处理器频繁重建

  // 策略搜索过滤逻辑
  useEffect(() => {
    if (Object.keys(strategies).length === 0) return;
    
    // 如果搜索内容为空，则显示所有策略
    if (!searchStrategy.trim()) {
      const allStrategies = Object.entries(strategies)
        .sort((a, b) => a[1].name.localeCompare(b[1].name, 'zh-CN'));
      setFilteredStrategies(allStrategies);
      return;
    }
    
    // 根据搜索内容过滤策略
    const filtered = Object.entries(strategies)
      .filter(([key, strategyData]) => 
        strategyData.name.toLowerCase().includes(searchStrategy.toLowerCase()) || 
        key.toLowerCase().includes(searchStrategy.toLowerCase())
      )
      .sort((a, b) => a[1].name.localeCompare(b[1].name, 'zh-CN'));
    
    setFilteredStrategies(filtered);
  }, [strategies, searchStrategy]);

  // 点击外部关闭策略下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (strategyDropdownRef.current && !strategyDropdownRef.current.contains(event.target as Node)) {
        setStrategyDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [strategyDropdownRef]);

  // 运行回测
  const runBacktest = async () => {
    dispatch(startBacktest());

    try {
      // 确保日期格式包含时间部分
      const ensureDateTime = (dateStr: string): string => {
        if (!dateStr) return dateStr;
        // 如果已经包含时间部分，直接返回
        if (dateStr.includes(':')) return dateStr;
        // 如果只有日期部分，添加时间
        return `${dateStr} 00:00:00`;
      };

      const formattedStartTime = ensureDateTime(dateRange.startDate);
      const formattedEndTime = ensureDateTime(dateRange.endDate);

      // 构建API URL，添加手续费参数
      const url = `/api/backtest/ta4j/run?startTime=${encodeURIComponent(formattedStartTime)}&endTime=${encodeURIComponent(formattedEndTime)}&initialAmount=${initialCapital}&strategyType=${strategy}&symbol=${selectedPair}&interval=${timeframe}&saveResult=True&feeRatio=${feeRatio}`;

      console.log('发送回测请求:', url);
      console.log('日期参数:', { 
        原始开始: dateRange.startDate, 
        格式化开始: formattedStartTime,
        原始结束: dateRange.endDate,
        格式化结束: formattedEndTime
      });

      // 发送请求
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      console.log('回测API返回数据:', data);

      if (data.code === 200 && data.data && data.data.success) {
        // 确保API返回的backtestId字段存在且被正确保存
        const backtestId = data.data.backtestId || Date.now().toString();
        console.log('获取到回测ID:', backtestId);

        // 转换API返回的数据为应用所需的格式
        const results: BacktestResults = {
          initialCapital: data.data.initialAmount,
          finalCapital: data.data.finalAmount,
          profit: data.data.totalProfit,
          profitPercentage: data.data.totalReturn,
          totalTrades: data.data.numberOfTrades,
          winningTrades: data.data.profitableTrades,
          losingTrades: data.data.unprofitableTrades,
          winRate: data.data.winRate * 100, // 转换为百分比
          maxDrawdown: data.data.maxDrawdown * 100, // 转换为百分比
          sharpeRatio: data.data.sharpeRatio,
          maximumLoss: data.data.maximumLoss, // 添加最大损失字段
          annualizedReturn: data.data.annualizedReturn, // 添加年化收益率字段
          backtestId: backtestId, // 明确使用获取的backtestId
          trades: (data.data.trades || []).map((trade: any) => ({
            id: String(trade.index || Math.random()),
            entryTime: new Date(trade.entryTime).getTime() / 1000,
            entryPrice: trade.entryPrice,
            exitTime: trade.exitTime ? new Date(trade.exitTime).getTime() / 1000 : 0,
            exitPrice: trade.exitPrice || 0,
            side: trade.type === 'BUY' ? 'buy' : 'sell',
            amount: trade.entryAmount || 0,
            profit: trade.profit || 0,
            profitPercentage: trade.profitPercentage * 100 || 0 // 转换为百分比
          }))
        };

        dispatch(finishBacktest(results));
        
        // 回测成功后，自动更新K线图的时间范围为回测使用的时间范围
        console.log('回测成功，更新K线图时间范围:', { 
          startDate: formattedStartTime, 
          endDate: formattedEndTime 
        });
        
        // 更新Redux中的日期范围
        dispatch(setDateRange(formattedStartTime, formattedEndTime));
        
        // 重新加载K线数据
        try {
          const klineResult = await fetchHistoryWithIntegrityCheck(
            selectedPair,
            timeframe,
            formattedStartTime,
            formattedEndTime
          );
          
          if (klineResult.data && klineResult.data.length > 0) {
            console.log('K线数据重新加载成功，条数:', klineResult.data.length);
            const event = new CustomEvent('chartDataLoaded', {
              detail: { data: klineResult.data }
            });
            window.dispatchEvent(event);
          } else {
            console.warn('K线数据重新加载返回空数据');
          }
        } catch (klineError) {
          console.error('重新加载K线数据失败:', klineError);
          // 不影响回测结果的显示，只是K线图可能不会更新
        }
      } else {
        throw new Error(data.data?.errorMessage || data.message || '回测失败');
      }
    } catch (error) {
      console.error('回测失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      showErrorDialog('回测失败', `回测失败: ${errorMessage}`);
      dispatch(finishBacktest(null as any)); // 重置回测状态
    }
  };

  // 运行批量回测
  const runBatchBacktest = async () => {
    console.log('开始批量回测，当前状态:', { runningBatchBacktest, isBacktesting, loading, strategy });
    setRunningBatchBacktest(true);
    setBatchStatusMessage('批量回测运行中...'); // 添加初始状态消息

    try {
      // 使用与单个回测相同的参数
      const result = await runAllBacktests(
        selectedPair,
        timeframe,
        dateRange.startDate,
        dateRange.endDate,
        Number(initialCapital),
        Number(feeRatio)
      );

      if (result.success) {
        // 批量回测完成后设置状态消息
        if (result.data && result.data.batch_backtest_id) {
          // 保存批次ID供后续使用
          (runAllBacktests as any).lastBatchId = result.data.batch_backtest_id;

          // 获取策略执行结果和统计数据
          const strategyResults = result.data.results || [];

          // 保存完整的结果数据供失败策略查看使用
          setBatchBacktestResults(strategyResults);

          const totalStrategies = result.data.total_strategies || strategyResults.length || 0;
          const successfulBacktests = result.data.successful_backtests || 0;
          const failedBacktests = result.data.failed_backtests || (totalStrategies - successfulBacktests);
          const maxReturnStrategy = result.data.max_return_strategy || '-';
          const maxReturn = result.data.max_return || 0;

          // 统计零交易策略数量（number_of_trades = 0 的成功策略）
          const zeroTradesStrategies = strategyResults.filter((strategy: any) =>
            strategy.success === true && strategy.number_of_trades === 0
          ).length;

          // 构建成功消息
          const successMessage = `
<table class="batch-result-table">
  <tr><td>总结果</td><td>${totalStrategies}</td></tr>
  <tr><td>成功</td><td>${successfulBacktests}</td></tr>
  <tr><td>失败</td><td>${failedBacktests}</td></tr>
  <tr><td>零交易策略</td><td style="color: #ffa500;">${zeroTradesStrategies}</td></tr>
  <tr><td>平均收益率</td><td>${result.data.avg_return ? formatPercentage(result.data.avg_return * 100) : '0.00%'}</td></tr>
  <tr><td>最高收益率</td><td>${formatPercentage(maxReturn * 100)}</td></tr>
  <tr><td>最佳策略</td><td>${maxReturnStrategy}</td></tr>
</table>`;

            setBatchStatusMessage(successMessage);
            showStatusDialog('批量回测完成', successMessage, 'info', result.data.batch_backtest_id);
        } else {
          const successMessage = '批量回测完成';
          setBatchStatusMessage(successMessage);
          showStatusDialog('批量回测完成', successMessage, 'info');
        }
      } else {
        const errorMessage = `批量回测失败: ${result.message}`;
        setBatchStatusMessage(errorMessage);
        showErrorDialog('批量回测失败', errorMessage);
      }
    } catch (error) {
      console.error('批量回测出错:', error);
      const errorMessage = '批量回测出错，请稍后重试';
      setBatchStatusMessage(errorMessage);
      showErrorDialog('批量回测错误', errorMessage);
    } finally {
      console.log('批量回测完成，重置状态');
      // 直接重置状态，不使用setTimeout
      setRunningBatchBacktest(false);
      console.log('状态已重置，当前ref值:', runningBatchBacktestRef.current);
    }
  };

  // 创建实时策略
  const createRealTimeStrategyHandler = async () => {
    setCreatingRealTimeStrategy(true);

    try {
      const result = await createRealTimeStrategy(
        strategy,
        selectedPair,
        timeframe,
        Number(tradeAmount)
      );

      if (result.success) {
        const tableContent = `
<table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
  <tr style="border-bottom: 1px solid #444;">
    <td style="padding: 8px; color: #8d8d8d;">策略名称:</td>
    <td style="padding: 8px; color: #d9d9d9;">${result.data?.strategyName || strategy}</td>
  </tr>
  <tr style="border-bottom: 1px solid #444;">
    <td style="padding: 8px; color: #8d8d8d;">交易对:</td>
    <td style="padding: 8px; color: #d9d9d9;">${selectedPair}</td>
  </tr>
  <tr style="border-bottom: 1px solid #444;">
    <td style="padding: 8px; color: #8d8d8d;">时间周期:</td>
    <td style="padding: 8px; color: #d9d9d9;">${timeframe}</td>
  </tr>
  <tr style="border-bottom: 1px solid #444;">
    <td style="padding: 8px; color: #8d8d8d;">交易金额:</td>
    <td style="padding: 8px; color: #d9d9d9;">${tradeAmount} USDT</td>
  </tr>
  <tr style="border-bottom: 1px solid #444;">
    <td style="padding: 8px; color: #8d8d8d;">开始时间:</td>
    <td style="padding: 8px; color: #d9d9d9;">${result.data?.startTime || new Date().toLocaleString()}</td>
  </tr>
  <tr style="border-bottom: 1px solid #444;">
    <td style="padding: 8px; color: #8d8d8d;">状态:</td>
    <td style="padding: 8px; color: #4caf50; font-weight: 600;">${result.data?.status || 'RUNNING'}</td>
  </tr>
  <tr>
    <td style="padding: 8px; color: #8d8d8d;">消息:</td>
    <td style="padding: 8px; color: #d9d9d9;">${result.message || '实时策略创建成功'}</td>
  </tr>
</table>`;
        showStatusDialog(
          '实时策略创建成功',
          tableContent,
          'info'
        );
      } else {
        showErrorDialog('创建实时策略失败', result.message || '未知错误');
      }
    } catch (error) {
      console.error('创建实时策略出错:', error);
      showErrorDialog('创建实时策略错误', '创建实时策略时发生错误，请稍后重试');
    } finally {
      setCreatingRealTimeStrategy(false);
    }
  };

  // 处理时间周期变更
  const handleTimeframeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTimeframe = e.target.value as '1m' | '5m' | '15m' | '30m' | '1H' | '2H' | '4H' | '6H' | '12H' | '1D' | '1W' | '1M';

    // 更新Redux中的时间周期
    dispatch(setTimeframe(newTimeframe));

    // 触发自定义事件，通知K线图组件更新数据
    const event = new CustomEvent('timeframeChanged', {
      detail: { timeframe: newTimeframe }
    });
    window.dispatchEvent(event);
  };

  // 处理日期变更
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDatePart = e.target.value;
    // 手动选择日期时，使用00:00:00作为开始时间
    const newStartDate = `${newDatePart} 00:00:00`;
    dispatch(setDateRange(newStartDate, dateRange.endDate));
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDatePart = e.target.value;

    // 获取当前时间
    const now = new Date();
    const today = now.getFullYear() + '-' +
                 String(now.getMonth() + 1).padStart(2, '0') + '-' +
                 String(now.getDate()).padStart(2, '0');

    let newEndDate;
    if (newDatePart === today) {
      // 如果选择的是今天，使用当前精确时间
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      newEndDate = `${newDatePart} ${hours}:${minutes}:${seconds}`;
    } else {
      // 如果选择的是其他日期，使用23:59:59
      newEndDate = `${newDatePart} 23:59:59`;
    }

    dispatch(setDateRange(dateRange.startDate, newEndDate));
  };

  // 处理快捷时间选择
  const handleQuickTimeSelect = (startDate: string, endDate: string) => {
    dispatch(setDateRange(startDate, endDate));
  };

  // 计算总页数
  const getTotalPages = () => {
    if (!backtestResults || !backtestResults.trades) return 1;
    return Math.ceil(backtestResults.trades.length / TRADES_PER_PAGE);
  };

  // 获取当前页的交易记录
  const getCurrentPageTrades = () => {
    if (!backtestResults || !backtestResults.trades) return [];

    const startIndex = (currentPage - 1) * TRADES_PER_PAGE;
    const endIndex = startIndex + TRADES_PER_PAGE;

    return backtestResults.trades.slice(startIndex, endIndex);
  };

  // 处理页面变更
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  // 清除回测结果时重置页码
  const handleClearResults = () => {
    setCurrentPage(1);
    dispatch(clearBacktestResults());
  };

  // 显示错误弹窗
  const showErrorDialog = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalType('danger');
    setShowErrorModal(true);
  };

  // 显示状态弹窗
  const showStatusDialog = (title: string, message: string, type: 'danger' | 'warning' | 'info' = 'info', batchId?: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalType(type);
    setShowStatusModal(true);

    // 如果有批次ID，保存到状态中
    if (batchId) {
      setBatchStatusMessage(prevMessage => prevMessage + `\n\n批次ID: ${batchId}`);
    }
  };

  // 显示失败策略列表
  const showFailedStrategiesList = () => {
    setLoadingFailedStrategies(true);
    setShowFailedStrategiesModal(true);

    try {
             // 直接从保存的批量回测结果中筛选失败策略
       const failedStrategies = batchBacktestResults.filter((strategy: any) =>
         strategy.success === false
       ).map((strategy: any) => ({
         strategy_code: strategy.strategy_code || 'UNKNOWN',
         strategy_name: strategy.strategy_name || strategy.strategy_code || '未知策略',
         error: strategy.error || '未知错误'
       }));

      console.log('从批量回测结果中筛选出的失败策略:', failedStrategies);
      setFailedStrategies(failedStrategies);
    } catch (error) {
      console.error('筛选失败策略出错:', error);
      setFailedStrategies([]);
    } finally {
      setLoadingFailedStrategies(false);
    }
  };

  // 添加交易对选择器所需的函数
  // 设置价格颜色样式
  const getPriceChangeClass = (percent: number) => {
    if (percent > 0) return 'price-up';
    if (percent < 0) return 'price-down';
    return '';
  };

  // 添加滚动加载更多的处理函数
  const handlePairsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // 当滚动到底部附近时（距离底部20px以内），加载更多数据
    if (scrollHeight - scrollTop - clientHeight < 20) {
      if (marketType === 'crypto' && !isLoadingTickers && displayedPairs.length < sortedPairs.length) {
        setDisplayLimit(prevLimit => prevLimit + 20);
      } else if (marketType === 'stock' && !isLoadingStocks && stockDisplayLimit < filteredStocks.length) {
        setStockDisplayLimit(prevLimit => prevLimit + 50);
      }
    }
  };

  // 处理排序方式变更
  const handleSortChange = (newSortBy: string) => {
    if (sortBy === newSortBy) {
      // 如果点击的是当前排序字段，则切换排序方向
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // 如果点击的是新字段，则设置为该字段的默认排序方向
      setSortBy(newSortBy);
      setSortDirection(newSortBy === 'volume' ? 'desc' : 'desc');
    }
  };

  // 交易所代码转中文
  const getExchangeName = (exchange: string): string => {
    const exchangeMap: { [key: string]: string } = {
      'SSE': '上交所',
      'SZSE': '深交所'
    };
    return exchangeMap[exchange] || exchange;
  };

  // 选择交易对或股票
  const selectPair = (symbol: string) => {
    dispatch(setSelectedPair(symbol));
    setDropdownOpen(false); // 选择后关闭下拉框
  };

  // 打开下拉框时加载数据
  const handleDropdownToggle = () => {
    console.log('=== handleDropdownToggle 被调用 ===');
    const newState = !dropdownOpen;
    console.log('当前 dropdownOpen:', dropdownOpen, '-> 新状态:', newState);
    console.log('当前 marketType:', marketType);
    
    setDropdownOpen(newState);
    
    if (newState) {
      console.log('下拉框打开，准备加载数据...');
      // 打开下拉框时加载数据
      if (marketType === 'crypto') {
        console.log('调用 loadAllTickers');
        loadAllTickers();
      } else if (marketType === 'stock') {
        console.log('调用 loadAllStocks');
        loadAllStocks();
      } else {
        console.log('未知的 marketType:', marketType);
      }
    } else {
      console.log('下拉框关闭');
    }
    console.log('=== handleDropdownToggle 执行完成 ===');
  };

  // 加载加密货币交易对数据（仅在打开下拉框时加载）
  const loadAllTickers = async () => {
    if (allTickers.length > 0) return; // 已加载过，不重复加载
    
    setIsLoadingTickers(true);
    try {
      const result = await fetchAllTickers();
      if (result.success && result.data) {
        const formattedTickers = result.data.map((ticker: any) => ({
          symbol: ticker.symbol,
          lastPrice: parseFloat(ticker.lastPrice || 0),
          priceChangePercent: parseFloat(ticker.priceChangePercent || 0),
          volume: parseFloat(ticker.quoteVolume || ticker.volume || 0)
        }));
        
        setAllTickers(formattedTickers);
        
        // 默认按交易量排序
        const sorted = [...formattedTickers].sort((a, b) => {
          const volumeA = a.volume || 0;
          const volumeB = b.volume || 0;
          return volumeB - volumeA;
        });
        
        setSortedPairs(sorted);
        setFilteredPairs(sorted);
        setDisplayedPairs(sorted.slice(0, displayLimit));
        console.log(`加载加密货币交易对成功: ${formattedTickers.length} 条`);
      } else {
        console.error('加载交易对数据失败:', result.message);
      }
    } catch (error) {
      console.error('加载交易对数据失败:', error);
    } finally {
      setIsLoadingTickers(false);
    }
  };

  // 加载股票列表（仅在打开下拉框时加载）
  const loadAllStocks = async () => {
    console.log('=== loadAllStocks 开始执行 ===');
    console.log('当前 allStocks.length:', allStocks.length);
    console.log('当前 marketType:', marketType);
    
    if (allStocks.length > 0) {
      console.log('股票列表已存在，跳过加载');
      return; // 已加载过，不重复加载
    }
    
    setIsLoadingStocks(true);
    console.log('开始调用 fetchAllStocks API...');
    try {
      const stocks = await fetchAllStocks(true); // 使用缓存
      console.log('fetchAllStocks 返回数据:', stocks.length, '条');
      console.log('前3条股票数据:', stocks.slice(0, 3));
      setAllStocks(stocks);
      setFilteredStocks(stocks);
      console.log(`加载股票列表成功: ${stocks.length} 条`);
    } catch (error) {
      console.error('加载股票列表失败:', error);
    } finally {
      setIsLoadingStocks(false);
      console.log('=== loadAllStocks 执行完成 ===');
    }
  };

  // 处理搜索和排序
  useEffect(() => {
    console.log('搜索过滤 useEffect 触发, marketType:', marketType, 'allStocks.length:', allStocks.length, 'searchPair:', searchPair);
    
    if (marketType === 'crypto') {
      if (allTickers.length === 0) return;
      
      const filtered = allTickers.filter(ticker => 
        ticker.symbol.toLowerCase().includes(searchPair.toLowerCase())
      );
      
      // 应用排序
      const sorted = [...filtered].sort((a, b) => {
        if (sortBy === 'volume') {
          const volumeA = parseFloat(a.volume) || 0;
          const volumeB = parseFloat(b.volume) || 0;
          return sortDirection === 'desc' ? volumeB - volumeA : volumeA - volumeB;
        } else if (sortBy === 'change') {
          const changeA = parseFloat(a.priceChangePercent) || 0;
          const changeB = parseFloat(a.priceChangePercent) || 0;
          return sortDirection === 'desc' ? changeB - changeA : changeA - changeB;
        } else if (sortBy === 'price') {
          const priceA = parseFloat(a.lastPrice) || 0;
          const priceB = parseFloat(b.lastPrice) || 0;
          return sortDirection === 'desc' ? priceB - priceA : priceA - priceB;
        } else if (sortBy === 'name') {
          return sortDirection === 'desc' 
            ? b.symbol.localeCompare(a.symbol)
            : a.symbol.localeCompare(b.symbol);
        }
        return 0;
      });
      
      setFilteredPairs(sorted);
      // 搜索或排序时重置显示数量
      setDisplayLimit(20);
    } else if (marketType === 'stock') {
      if (allStocks.length === 0) {
        console.log('股票列表为空，跳过过滤');
        return;
      }
      
      const filtered = allStocks.filter(stock => 
        stock.code.toLowerCase().includes(searchPair.toLowerCase()) ||
        stock.name.toLowerCase().includes(searchPair.toLowerCase())
      );
      
      console.log('股票过滤结果:', filtered.length, '条');
      setFilteredStocks(filtered);
      // 搜索时重置显示数量
      setStockDisplayLimit(50);
    }
  }, [searchPair, allTickers, allStocks, sortBy, sortDirection, marketType]);

  // 切换市场类型时清空搜索和关闭下拉框
  useEffect(() => {
    setSearchPair('');
    setDropdownOpen(false);
    setStockDisplayLimit(50); // 重置股票显示数量
    setDisplayLimit(20); // 重置加密货币显示数量
  }, [marketType]);

  // 初始化时如果是股票市场，自动加载股票列表
  useEffect(() => {
    if (marketType === 'stock' && allStocks.length === 0) {
      console.log('初始化：检测到股票市场，自动加载股票列表');
      const loadStocks = async () => {
        setIsLoadingStocks(true);
        try {
          const stocks = await fetchAllStocks(true);
          console.log('初始化加载股票列表成功:', stocks.length, '条');
          setAllStocks(stocks);
          setFilteredStocks(stocks);
        } catch (error) {
          console.error('初始化加载股票列表失败:', error);
        } finally {
          setIsLoadingStocks(false);
        }
      };
      loadStocks();
    }
  }, [marketType]); // 当marketType变化时触发

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownRef]);

  // 更新止损百分比
  const handleUpdateStopLoss = async () => {
    setUpdatingStopLoss(true);
    try {
      const percent = parseFloat(stopLossPercent);
      if (isNaN(percent) || percent < 0) {
        showErrorDialog('更新失败', '止损百分比必须是大于等于0的数字');
        return;
      }
      
      const result = await updateStopLossPercent(percent);
      if (result.success) {
        showStatusDialog('更新成功', '止损百分比已更新', 'info');
      } else {
        showErrorDialog('更新失败', result.message || '更新止损百分比失败');
      }
    } catch (error) {
      showErrorDialog('更新失败', error instanceof Error ? error.message : '更新止损百分比时出错');
    } finally {
      setUpdatingStopLoss(false);
    }
  };

  // 更新移动止盈百分比
  const handleUpdateTrailingProfit = async () => {
    setUpdatingTrailingProfit(true);
    try {
      const percent = parseFloat(trailingProfitPercent);
      if (isNaN(percent) || percent < 0) {
        showErrorDialog('更新失败', '移动止盈百分比必须是大于等于0的数字');
        return;
      }
      
      const result = await updateTrailingProfitPercent(percent);
      if (result.success) {
        showStatusDialog('更新成功', '移动止盈百分比已更新', 'info');
      } else {
        showErrorDialog('更新失败', result.message || '更新移动止盈百分比失败');
      }
    } catch (error) {
      showErrorDialog('更新失败', error instanceof Error ? error.message : '更新移动止盈百分比时出错');
    } finally {
      setUpdatingTrailingProfit(false);
    }
  };

  return (
    <div className="backtest-panel">
      <div className="backtest-panel-header">
        <h3>
          {marketType === 'crypto' 
            ? selectedPair 
            : (() => {
                const stock = allStocks.find(s => s.code === selectedPair);
                return stock ? `${stock.name} ${stock.code.replace('.SZ', '').replace('.SH', '')}` : selectedPair;
              })()
          }
        </h3>
        <div className="backtest-info">
           <div className="info-row">
             <span className="info-item">
               <span className="info-label">策略:</span>
               <span className="info-value">{strategies[strategy]?.name || strategy || '未选择'}</span>
             </span>
             <span className="info-item">
               <span className="info-label">周期:</span>
               <span className="info-value">{timeframe}</span>
             </span>
           </div>
           <div className="info-row">
             <span className="info-item">
               <span className="info-label">时间:</span>
               <span className="info-value">{dateRange.startDate} ~ {dateRange.endDate}</span>
             </span>
           </div>
         </div>
      </div>

      <div className="backtest-panel-content">
        {!backtestResults ? (
          <div className="backtest-form">
            {/* ========== 数据查询区 ========== */}
            <div className="form-section">
              <h4 className="section-title">数据查询</h4>
              
              <div className="input-group">
                <label>市场类型</label>
                <div className="market-type-switcher">
                  <button
                    className={`market-type-button ${marketType === 'crypto' ? 'active' : ''}`}
                    onClick={() => {
                      dispatch(setMarketType('crypto'));
                      dispatch(setSelectedPair('BTC-USDT'));
                    }}
                  >
                    加密货币
                  </button>
                  <button
                    className={`market-type-button ${marketType === 'stock' ? 'active' : ''}`}
                    onClick={() => {
                      dispatch(setMarketType('stock'));
                      if (allStocks.length > 0) {
                        dispatch(setSelectedPair(allStocks[0].code));
                      }
                    }}
                  >
                    股票
                  </button>
                </div>
              </div>

              <div className="input-group">
                <label>{marketType === 'crypto' ? '交易对' : '股票代码'}</label>
                <div className="pair-selector-wrapper" ref={dropdownRef}>
                  <div className="selected-pair-display" onClick={handleDropdownToggle}>
                    <span>
                      {marketType === 'crypto' 
                        ? selectedPair 
                        : formatStockDisplay(selectedPair, allStocks.find(s => s.code === selectedPair)?.name)
                      }
                    </span>
                    <span className="dropdown-arrow">{dropdownOpen ? '▲' : '▼'}</span>
                  </div>

                  {dropdownOpen && marketType === 'crypto' && (
                    <div className="pairs-dropdown">
                      <input
                        type="text"
                        placeholder="搜索币种..."
                        value={searchPair}
                        onChange={(e) => setSearchPair(e.target.value)}
                        className="pair-search-input"
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />

                      <div className="pair-list-header">
                        <div className="pair-list-header-left">
                          <div 
                            className={`header-item header-item-symbol ${sortBy === 'name' ? 'active' : ''}`}
                            onClick={() => handleSortChange('name')}
                          >
                            币种 {sortBy === 'name' && (sortDirection === 'desc' ? '↓' : '↑')}
                          </div>
                        </div>
                        <div className="pair-list-header-right">
                          <div 
                            className={`header-item header-item-price ${sortBy === 'price' ? 'active' : ''}`}
                            onClick={() => handleSortChange('price')}
                          >
                            价格 {sortBy === 'price' && (sortDirection === 'desc' ? '↓' : '↑')}
                          </div>
                          <div 
                            className={`header-item header-item-change ${sortBy === 'change' ? 'active' : ''}`}
                            onClick={() => handleSortChange('change')}
                          >
                            涨跌幅 {sortBy === 'change' && (sortDirection === 'desc' ? '↓' : '↑')}
                          </div>
                          <div 
                            className={`header-item header-item-volume ${sortBy === 'volume' ? 'active' : ''}`}
                            onClick={() => handleSortChange('volume')}
                          >
                            交易量 {sortBy === 'volume' && (sortDirection === 'desc' ? '↓' : '↑')}
                          </div>
                        </div>
                      </div>

                      <div className="pair-list-container" onScroll={handlePairsScroll}>
                        {isLoadingTickers ? (
                          <div className="loading-stocks">加载交易对列表中...</div>
                        ) : filteredPairs.length > 0 ? (
                          <div className="pair-list">
                            {filteredPairs.slice(0, displayLimit).map(ticker => (
                              <div
                                key={ticker.symbol}
                                className={`pair-item ${ticker.symbol === selectedPair ? 'selected' : ''}`}
                                onClick={() => selectPair(ticker.symbol)}
                              >
                                <div className="pair-item-left">
                                  <span className="pair-item-symbol">{ticker.symbol}</span>
                                </div>
                                <div className="pair-item-right">
                                  <span className="pair-item-price">{ticker.lastPrice > 0 ? ticker.lastPrice.toFixed(2) : '--'}</span>
                                  <span className={`pair-item-change ${getPriceChangeClass(ticker.priceChangePercent)}`}>
                                    {ticker.priceChangePercent > 0 ? '+' : ''}{ticker.priceChangePercent.toFixed(2)}%
                                  </span>
                                  <span className="pair-item-volume">
                                    {formatVolume(ticker.volume)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="no-results">无匹配结果</div>
                        )}
                      </div>
                    </div>
                  )}

                  {dropdownOpen && marketType === 'stock' && (
                    <div className="pairs-dropdown">
                      <input
                        type="text"
                        placeholder="搜索股票代码或名称..."
                        value={searchPair}
                        onChange={(e) => setSearchPair(e.target.value)}
                        className="pair-search-input"
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />

                      <div className="stock-list-header">
                        <span className="header-code">代码</span>
                        <span className="header-name">名称</span>
                        <span className="header-industry">行业</span>
                        <span className="header-exchange">交易所</span>
                      </div>

                      <div className="pair-list-container" onScroll={handlePairsScroll}>
                        {isLoadingStocks ? (
                          <div className="loading-stocks">加载股票列表中...</div>
                        ) : filteredStocks.length > 0 ? (
                          <div className="pair-list stock-list">
                            {filteredStocks.slice(0, stockDisplayLimit).map(stock => (
                              <div
                                key={stock.code}
                                className={`pair-item stock-item ${stock.code === selectedPair ? 'selected' : ''}`}
                                onClick={() => selectPair(stock.code)}
                              >
                                <div className="stock-item-info">
                                  <span className="stock-item-code">{stock.code.replace('.SZ', '').replace('.SH', '')}</span>
                                  <span className="stock-item-name">{stock.name}</span>
                                  <span className="stock-item-industry">{stock.industry || '-'}</span>
                                  <span className="stock-item-exchange">{getExchangeName(stock.exchange)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="no-results">无匹配结果</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <QuickTimeSelector 
                onTimeRangeSelect={handleQuickTimeSelect}
                currentStartDate={dateRange.startDate}
                currentEndDate={dateRange.endDate}
              />

              <div className="input-row">
                <div className="input-group half-width">
                  <label>开始日期</label>
                  <input
                    type="date"
                    value={dateRange.startDate.split(' ')[0]}
                    max={getYesterdayDateString()}
                    onChange={handleStartDateChange}
                  />
                </div>

                <div className="input-group half-width">
                  <label>结束日期</label>
                  <input
                    type="date"
                    value={dateRange.endDate.split(' ')[0]}
                    max={getYesterdayDateString()}
                    onChange={handleEndDateChange}
                  />
                </div>
              </div>

              <div className="input-group">
                <label>时间周期</label>
                <div className="timeframe-controls">
                  <select value={timeframe} onChange={handleTimeframeChange}>
                    {TIMEFRAMES
                      .filter(tf => {
                        // 股票模式下只显示Tushare支持的周期
                        if (marketType === 'stock') {
                          const supportedStockIntervals = ['1m', '5m', '15m', '30m', '1H', '1D'];
                          return supportedStockIntervals.includes(tf.value);
                        }
                        // 加密货币模式显示所有周期
                        return true;
                      })
                      .map((tf) => (
                        <option key={tf.value} value={tf.value}>{tf.label}</option>
                      ))
                    }
                  </select>
                  <button 
                    className="query-data-button"
                    onClick={async () => {
                      try {
                        console.log('开始查询数据...', { selectedPair, timeframe, dateRange });
                        setIsLoadingChartData(true); // 开始加载
                        
                        // 触发K线图的加载状态
                        const loadingEvent = new CustomEvent('chartDataLoading', { detail: { loading: true } });
                        window.dispatchEvent(loadingEvent);
                        
                        const result = await fetchHistoryWithIntegrityCheck(
                          selectedPair,
                          timeframe,
                          dateRange.startDate,
                          dateRange.endDate
                        );
                        
                        if (result.data && result.data.length > 0) {
                          console.log('数据查询成功，条数:', result.data.length);
                          const event = new CustomEvent('chartDataLoaded', {
                            detail: { data: result.data }
                          });
                          window.dispatchEvent(event);
                        } else {
                          console.warn('查询返回空数据');
                          alert('未查询到数据，请检查交易对和时间范围');
                          // 结束加载状态
                          const loadingEndEvent = new CustomEvent('chartDataLoading', { detail: { loading: false } });
                          window.dispatchEvent(loadingEndEvent);
                        }
                      } catch (error) {
                        console.error('查询数据失败:', error);
                        alert('查询数据失败: ' + (error instanceof Error ? error.message : '未知错误'));
                        // 结束加载状态
                        const loadingEndEvent = new CustomEvent('chartDataLoading', { detail: { loading: false } });
                        window.dispatchEvent(loadingEndEvent);
                      } finally {
                        setIsLoadingChartData(false); // 结束加载
                      }
                    }}
                    type="button"
                    disabled={isLoadingChartData}
                  >
                    {isLoadingChartData ? '加载中...' : '查询数据'}
                  </button>
                  <select 
                    className="main-indicator-selector"
                    onChange={(e) => {
                      const event = new CustomEvent('mainIndicatorChange', {
                        detail: { indicator: e.target.value }
                      });
                      window.dispatchEvent(event);
                    }}
                    defaultValue="boll"
                  >
                    <option value="none">无指标</option>
                    <option value="boll">布林带(BOLL)</option>
                    <option value="sar">抛物线(SAR)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ========== 回测配置区 ========== */}
            <div className="form-section">
              <h4 className="section-title">回测配置</h4>

              <div className="input-group">
                <label>交易策略</label>
                {loading ? (
                  <div className="loading-strategies">加载策略中...</div>
                ) : error ? (
                  <div className="error-message">策略加载失败，请刷新重试</div>
                ) : (
                  <div className="strategy-selector-wrapper" ref={strategyDropdownRef}>
                    <div className="selected-strategy-display" onClick={() => setStrategyDropdownOpen(!strategyDropdownOpen)}>
                      <span>{strategies[strategy]?.name || '选择策略'}</span>
                      <span className="dropdown-arrow">{strategyDropdownOpen ? '▲' : '▼'}</span>
                    </div>

                    {strategyDropdownOpen && (
                      <div className="strategy-dropdown">
                        <input
                          type="text"
                          placeholder="搜索策略..."
                          value={searchStrategy}
                          onChange={(e) => setSearchStrategy(e.target.value)}
                          className="strategy-search-input"
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                        
                        <div className="strategy-list-container">
                          {filteredStrategies.length > 0 ? (
                            <div className="strategy-list">
                              {filteredStrategies.map(([key, strategyData]) => (
                                <div
                                  key={key}
                                  className={`strategy-item ${key === strategy ? 'selected' : ''}`}
                                  onClick={() => {
                                    setStrategy(key);
                                    setStrategyDropdownOpen(false);
                                  }}
                                >
                                  <span className="strategy-item-name">{strategyData.name}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="no-results">无匹配结果</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="input-row">
                <div className="input-group half-width">
                  <label>初始资金 (USDT)</label>
                  <input
                    type="number"
                    value={initialCapital}
                    onChange={(e) => setInitialCapital(e.target.value)}
                    min="100"
                    step="100"
                  />
                </div>

                <div className="input-group half-width">
                  <label>手续费率</label>
                  <input
                    type="number"
                    value={feeRatio}
                    onChange={(e) => setFeeRatio(e.target.value)}
                    min="0"
                    max="0.01"
                    step="0.0001"
                    placeholder="0.001"
                  />
                </div>
              </div>

              <div className="input-row">
                <div className="input-group half-width">
                  <label>止损百分比</label>
                  <div className="input-with-button">
                    <input
                      type="number"
                      value={stopLossPercent}
                      onChange={(e) => setStopLossPercent(e.target.value)}
                      min="0"
                      step="0.01"
                      disabled={loadingParameters}
                    />
                    <button 
                      onClick={handleUpdateStopLoss} 
                      disabled={updatingStopLoss || loadingParameters}
                      className="update-button"
                    >
                      {updatingStopLoss ? '更新中...' : '更新'}
                    </button>
                  </div>
                </div>

                <div className="input-group half-width">
                  <label>移动止盈百分比</label>
                  <div className="input-with-button">
                    <input
                      type="number"
                      value={trailingProfitPercent}
                      onChange={(e) => setTrailingProfitPercent(e.target.value)}
                      min="0"
                      step="0.01"
                      disabled={loadingParameters}
                    />
                    <button 
                      onClick={handleUpdateTrailingProfit}
                      disabled={updatingTrailingProfit || loadingParameters}
                      className="update-button"
                    >
                      {updatingTrailingProfit ? '更新中...' : '更新'}
                    </button>
                  </div>
                </div>
              </div>

              <button
                className="run-backtest-button"
                onClick={runBacktest}
                disabled={isBacktesting || !strategy}
              >
                {isBacktesting ? '回测中...' : '运行回测'}
              </button>

              <button
                className="run-batch-backtest-button"
                onClick={runBatchBacktest}
                disabled={runningBatchBacktest || isBacktesting}
              >
                {runningBatchBacktest ? '批量回测中...' : '运行批量回测'}
              </button>
            </div>

            {/* ========== 实盘配置区 ========== */}
            <div className="form-section">
              <h4 className="section-title">实盘配置</h4>

              <div className="input-group">
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>交易金额 (USDT)</span>
                  <span style={{ fontSize: '12px', color: '#4caf50', marginLeft: '8px' }}>
                    {loadingBalance ? '加载中...' : accountBalance !== null ? `可用: ${accountBalance.toFixed(2)} USDT` : ''}
                  </span>
                </label>
                <input
                  type="number"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(e.target.value)}
                  min="1"
                  step="1"
                  placeholder="用于实时策略的单次交易金额"
                />
              </div>

              <button
                className="create-realtime-strategy-button"
                onClick={createRealTimeStrategyHandler}
                disabled={creatingRealTimeStrategy || !strategy}
              >
                {creatingRealTimeStrategy ? '创建中...' : '创建实时策略'}
              </button>
            </div>
          </div>
        ) : (
          <div className="backtest-results">
            <div className="results-summary">
              <div className="summary-item">
                <span className="label">最终资金</span>
                <span className="value">{(backtestResults.finalCapital / 1000.0).toFixed(2)}K </span>
              </div>
              <div className="summary-item">
                <span className="label">净利润</span>
                <span className={`value ${backtestResults.profit >= 0 ? 'positive' : 'negative'}`}>
                  {backtestResults.profit >= 0 ? '+' : ''}{(backtestResults.profit/ 1000.0).toFixed(2)}K
                </span>
              </div>
              <div className="summary-item">
                <span className="label">收益率</span>
                <span className={`value ${backtestResults.profitPercentage >= 0 ? 'positive' : 'negative'}`}>
                  {formatPercentage(backtestResults.profitPercentage *100)}
                </span>
              </div>
              <div className="summary-item">
                <span className="label">年化收益率</span>
                <span className={`value ${backtestResults.annualizedReturn && backtestResults.annualizedReturn >= 0 ? 'positive' : 'negative'}`}>
                  {backtestResults.annualizedReturn ? (backtestResults.annualizedReturn * 100).toFixed(2) + '%' : '-'}
                </span>
              </div>
              <div className="summary-item">
                <span className="label">总交易次数</span>
                <span className="value">{backtestResults.totalTrades}</span>
              </div>
              <div className="summary-item">
                <span className="label">胜率</span>
                <span className="value">{backtestResults.winRate.toFixed(2)}%</span>
              </div>
              <div className="summary-item">
                <span className="label">最大回撤</span>
                <span className="value">{formatPercentage(backtestResults.maxDrawdown)}</span>
              </div>
              <div className="summary-item">
                <span className="label">最大损失</span>
                <span className="value">{backtestResults.maximumLoss ? (backtestResults.maximumLoss * 100).toFixed(2) + '%' : '-'}</span>
              </div>
            </div>

            <div className="trades-table">
              <div className="trades-table-header">
                <h4>交易记录</h4>
              </div>

              <div className="trades-table-container">
                <table>
                  <thead>
                    <tr>
                      <th>时间</th>
                      <th>类型</th>
                      <th>价格</th>
                      <th>金额</th>
                      <th>盈亏</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getCurrentPageTrades().map((trade) => (
                      <tr key={trade.id}>
                        <td>{formatDate(trade.entryTime)}</td>
                        <td className={trade.side}>{trade.side === 'buy' ? '买入' : '卖出'}</td>
                        <td>{formatPrice(trade.entryPrice)}</td>
                        <td>{trade.amount?.toFixed(2) || '0.0000'}</td>
                        <td className={trade.profit >= 0 ? 'positive' : 'negative'}>
                          {trade.profit >= 0 ? '+' : ''}{trade.profit?.toFixed(2) || '0.00'}
                          <span className="percentage">
                            ({formatPercentage(trade.profitPercentage || 0)})
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {backtestResults.trades.length > TRADES_PER_PAGE && (
                <div className="pagination bottom">
                  <button
                    className="pagination-button"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    上一页
                  </button>
                  <span className="pagination-info">
                    {currentPage} / {getTotalPages()}
                  </span>
                  <button
                    className="pagination-button"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === getTotalPages()}
                  >
                    下一页
                  </button>

                  {backtestResults.backtestId && (
                    <Link
                      to={`/backtest-detail/${backtestResults.backtestId}`}
                      className="detail-button"
                      style={{ marginLeft: '15px' }}
                    >
                      回测明细
                    </Link>
                  )}

                  <button
                    className="reset-backtest-button"
                    onClick={handleClearResults}
                  >
                    重新设置
                  </button>
                </div>
              )}

              {backtestResults.trades.length <= TRADES_PER_PAGE && (
                <div className="pagination bottom">
                  {backtestResults.backtestId && (
                    <Link
                      to={`/backtest-detail/${backtestResults.backtestId}`}
                      className="detail-button"
                      style={{ marginRight: '15px' }}
                    >
                      回测明细
                    </Link>
                  )}
                  <button
                    className="reset-backtest-button"
                    onClick={handleClearResults}
                  >
                    重新设置
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 错误信息弹窗 */}
      <ConfirmModal
        isOpen={showErrorModal}
        onCancel={() => setShowErrorModal(false)}
        onConfirm={() => setShowErrorModal(false)}
        title={modalTitle}
        message={modalMessage}
        confirmText="确定"
        cancelText="取消"
        type={modalType}
      />

      {/* 状态信息弹窗 */}
      <ConfirmModal
        isOpen={showStatusModal}
        onCancel={() => setShowStatusModal(false)}
        onConfirm={() => {
          setShowStatusModal(false);
          // 如果是批量回测完成且包含批次ID，跳转到历史回测页面
          if (modalTitle.includes('批量回测完成')) {
            // 提取批次ID
            const batchIdMatch = modalMessage.match(/批次ID:\s*([^\s]+)/);
            if (batchIdMatch && batchIdMatch[1]) {
              const batchId = batchIdMatch[1];
              // 跳转到历史回测页面并传递batchId参数
              window.location.href = `/backtest-summaries?batch_backtest_id=${batchId}`;
            } else {
              // 从API返回中提取批次ID
              const batchIdFromAPI = (runAllBacktests as any).lastBatchId;
              if (batchIdFromAPI) {
                window.location.href = `/backtest-summaries?batch_backtest_id=${batchIdFromAPI}`;
              }
            }
          }
        }}
        title={modalTitle}
        message={modalMessage}
        confirmText={modalTitle.includes('批量回测完成') ? '确定' : '确定'}
        cancelText="关闭"
        type={modalType}
        // 添加查看明细按钮
        showDetailButton={modalTitle.includes('批量回测完成')}
        onViewDetail={() => {
          setShowStatusModal(false);
          // 提取批次ID
          const batchIdMatch = modalMessage.match(/批次ID:\s*([^\s]+)/);
          if (batchIdMatch && batchIdMatch[1]) {
            const batchId = batchIdMatch[1];
            // 跳转到历史回测页面并传递batchId参数
            window.location.href = `/backtest-summaries?batch_backtest_id=${batchId}`;
          } else {
            // 从API返回中提取批次ID
            const batchIdFromAPI = (runAllBacktests as any).lastBatchId;
            if (batchIdFromAPI) {
              window.location.href = `/backtest-summaries?batch_backtest_id=${batchIdFromAPI}`;
            }
          }
        }}
        detailButtonText="查看明细"
        // 添加失败策略按钮
        showFailedStrategiesButton={modalTitle.includes('批量回测完成')}
        onViewFailedStrategies={showFailedStrategiesList}
      />

      {/* 失败策略弹窗 */}
      <FailedStrategiesModal
        isOpen={showFailedStrategiesModal}
        onClose={() => setShowFailedStrategiesModal(false)}
        failedStrategies={failedStrategies}
        loading={loadingFailedStrategies}
      />
    </div>
  );
};

export default BacktestPanel;
