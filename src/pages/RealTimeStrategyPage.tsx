import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { startRealTimeStrategy, stopRealTimeStrategy, deleteRealTimeStrategy, copyRealTimeStrategy, fetchHoldingPositionsProfits, buyFullPosition, sellFullPosition } from '../services/api';
import ConfirmModal from '../components/ConfirmModal/ConfirmModal';
import CopyStrategyModal from '../components/CopyStrategyModal/CopyStrategyModal';
import { useAdaptivePagination } from '../hooks/useAdaptivePagination';
import './RealTimeStrategyPage.css';

// 定义排序字段和排序方向类型
type SortField = 'id' | 'strategyName' | 'symbol' | 'interval' | 'tradeAmount' | 'totalProfit' |
  'totalProfitRate' | 'totalFees' | 'totalTrades' | 'estimatedProfit' |
  'profitPercentage' | 'holdingDuration' | 'createTime' | 'updateTime' | 'status' | 'entryTime' |
  'estimatedBalance';
type SortDirection = 'asc' | 'desc';

interface RealTimeStrategy {
  id: number;
  strategyCode: string;
  strategyName: string;
  symbol: string;
  interval: string;
  tradeAmount: number;
  status: string;
  createTime: string;
  updateTime: string;
  totalProfit?: number;
  totalFees?: number;
  totalTrades?: number;
  totalProfitRate?: number;
  message?: string;  // 错误信息字段，用于显示具体错误详情
  // 持仓预估收益相关字段
  currentPrice?: number | string;
  quantity?: number | string;
  currentValue?: number | string;
  estimatedProfit?: number | string;
  profitPercentage?: string;
  holdingDuration?: string;
  entryPrice?: number;
  entryTime?: string;
  isHolding?: boolean; // 标记是否持有仓位
}

// 添加统计信息接口
interface StrategyStatistics {
  totalEstimatedProfit: number;
  totalRealizedProfit: number;
  totalInvestmentAmount: number;
  totalProfit: number;
  totalProfitRate: string;
  holdingStrategiesCount: number;
  runningStrategiesCount: number;
  totalHlodingInvestmentAmount: number;
  todayProfit: number;
  todaysingalCount: number;
}

const RealTimeStrategyPage: React.FC = () => {
  const [strategies, setStrategies] = useState<RealTimeStrategy[]>([]);
  // 分离初始加载状态和数据刷新状态
  const [initialLoading, setInitialLoading] = useState<boolean>(true); // 初始加载状态
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false); // 刷新状态
  const [error, setError] = useState<string>('');
  const [errorModalOpen, setErrorModalOpen] = useState<boolean>(false);
  const [operationInProgress, setOperationInProgress] = useState<{ [key: string]: boolean }>({});
  const navigate = useNavigate();

  // 添加统计数据状态
  const [statistics, setStatistics] = useState<StrategyStatistics | null>(null);

  // 使用ref来存储最后一次成功获取的数据，用于在刷新失败时保持原有数据
  const lastSuccessfulStrategiesRef = useRef<RealTimeStrategy[]>([]);
  const lastSuccessfulStatisticsRef = useRef<StrategyStatistics | null>(null);
  
  // 添加API调用状态跟踪，防止重复调用
  const holdingPositionsApiCallInProgress = useRef<boolean>(false);
  const strategiesListApiCallInProgress = useRef<boolean>(false);

  // 添加分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // 自适应页大小计算
  const { pageSize: adaptivePageSize } = useAdaptivePagination({
    rowHeight: 60, 
    minPageSize: 5,
    navbarHeight: 0,
    basePadding: 40, 
    getOtherElementsHeight: () => {
      const headerRow = document.querySelector('.header-row');
      const pagination = document.querySelector('.pagination-container');
      const tableHeader = document.querySelector('.strategies-table thead');
      
      const headerHeight = headerRow ? headerRow.clientHeight : 150;
      const paginationHeight = pagination ? pagination.clientHeight : 60;
      const tableHeaderHeight = tableHeader ? tableHeader.clientHeight : 50;
      
      const margins = 40;
      return headerHeight + paginationHeight + tableHeaderHeight + margins;
    },
    dependencies: [strategies.length, initialLoading]
  });

  useEffect(() => {
    if (adaptivePageSize > 0) {
      setPageSize(adaptivePageSize);
    }
  }, [adaptivePageSize]);

  // 添加排序状态
  const [sortField, setSortField] = useState<SortField>('updateTime'); // 默认按更新时间排序
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc'); // 默认倒序排列

  // 添加确认对话框状态
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    strategyId: -1,
    strategyName: '',
  });

  // 添加复制策略模态框状态
  const [copyModal, setCopyModal] = useState({
    isOpen: false,
    strategy: null as RealTimeStrategy | null,
  });

  // 获取实盘策略列表
  const fetchRealTimeStrategies = useCallback(async () => {
    try {
      const response = await fetch('/api/real-time-strategy/list');

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      console.log('实盘策略API返回数据:', data);

      if (data.code === 200) {
        const strategies = data.data || [];
        console.log('解析后的策略数据:', strategies, '数量:', strategies.length);
        // 更新成功数据的缓存
        lastSuccessfulStrategiesRef.current = strategies;
        return strategies;
      } else {
        setError(data.message || '获取实盘策略失败');
        setErrorModalOpen(true);
        return [];
      }
    } catch (error) {
      console.error('获取实盘策略失败:', error);
      setError(error instanceof Error ? error.message : '获取实盘策略失败');
      setErrorModalOpen(true);
      return [];
    }
  }, []);

  // 获取持仓策略预估收益信息
  const fetchHoldingPositionsData = useCallback(async (currentStrategies: RealTimeStrategy[]) => {
    // 防止重复调用
    if (holdingPositionsApiCallInProgress.current) {
      console.log('持仓数据API调用正在进行中，跳过重复调用');
      return currentStrategies;
    }

    holdingPositionsApiCallInProgress.current = true;
    
    try {
      const result = await fetchHoldingPositionsProfits();
      if (result.success && result.data) {
        // 保存统计信息
        if (result.data.statistics) {
          setStatistics(result.data.statistics);
          lastSuccessfulStatisticsRef.current = result.data.statistics;
        }

        // 将持仓信息与策略列表整合
        if (currentStrategies.length > 0 && result.data.strategies) {
          const updatedStrategies = currentStrategies.map(strategy => {
            // 查找对应的持仓信息
            const holdingInfo = result.data?.strategies.find(holding => holding.strategyId === strategy.id);

            if (holdingInfo) {
              // 如果找到持仓信息，将其整合到策略对象中
              return {
                ...strategy,
                currentPrice: holdingInfo.currentPrice,
                quantity: holdingInfo.quantity,
                currentValue: holdingInfo.currentValue,
                estimatedProfit: holdingInfo.estimatedProfit,
                profitPercentage: holdingInfo.profitPercentage,
                holdingDuration: holdingInfo.holdingDuration,
                entryPrice: holdingInfo.entryPrice,
                entryTime: holdingInfo.entryTime,
                isHolding: true
              };
            }

            return { ...strategy, isHolding: false };
          });

          return updatedStrategies;
        }
      } else {
        console.error('获取持仓策略预估收益失败:', result.message);
      }
      return currentStrategies;
    } catch (error) {
      console.error('获取持仓策略预估收益异常:', error);
      return currentStrategies;
    } finally {
      holdingPositionsApiCallInProgress.current = false;
    }
  }, []);

  // 初始加载数据
  const initialLoadData = useCallback(async () => {
    console.log('开始初始加载数据...');
    setInitialLoading(true);
    try {
      // 先获取策略列表
      console.log('调用fetchRealTimeStrategies...');
      const strategiesList = await fetchRealTimeStrategies();
      console.log('获取到的策略列表:', strategiesList, '类型:', typeof strategiesList, '长度:', strategiesList?.length);

      // 处理获取到的策略列表数据
      if (strategiesList && strategiesList.length >= 0) {
        console.log('开始获取持仓信息...');
        // 然后获取持仓信息并整合
        const updatedStrategies = await fetchHoldingPositionsData(strategiesList);
        console.log('整合后的策略数据:', updatedStrategies, '长度:', updatedStrategies?.length);

        // 更新状态和引用
        console.log('更新strategies状态...');
        setStrategies(updatedStrategies);
        lastSuccessfulStrategiesRef.current = updatedStrategies;
        console.log('状态更新完成');
      } else {
        console.log('策略列表为空或无效:', strategiesList);
      }
    } catch (error) {
      console.error('初始加载数据失败:', error);
    } finally {
      console.log('初始加载完成，设置loading为false');
      setInitialLoading(false);
    }
  }, [fetchRealTimeStrategies, fetchHoldingPositionsData]);

  // 刷新数据 - 只更新数据，不影响页面状态
  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // 先获取策略列表
      const strategiesList = await fetchRealTimeStrategies();

      // 只有当获取到有效数据时才继续处理
      if (strategiesList !== null) {
        // 然后获取持仓信息并整合
        const updatedStrategies = await fetchHoldingPositionsData(strategiesList);

        // 更新状态和引用
        setStrategies(updatedStrategies);
        lastSuccessfulStrategiesRef.current = updatedStrategies;

        // 显示成功提示
        const refreshSuccessMessage = document.getElementById('refresh-success-message');
        if (refreshSuccessMessage) {
          refreshSuccessMessage.style.opacity = '1';
          setTimeout(() => {
            refreshSuccessMessage.style.opacity = '0';
          }, 2000);
        }
      }
      // 如果返回null，说明是重复调用被跳过，不更新状态
    } catch (error) {
      console.error('刷新数据失败:', error);
      // 如果刷新失败，保持使用最后一次成功获取的数据
      setStrategies(lastSuccessfulStrategiesRef.current);
      setStatistics(lastSuccessfulStatisticsRef.current);
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchRealTimeStrategies, fetchHoldingPositionsData]);

  // 页面加载时获取数据
  useEffect(() => {
    initialLoadData();

    // 设置定时刷新 - 每60秒刷新一次数据
    const intervalId = setInterval(() => {
      refreshData();
    }, 60000);

    // 清理函数
    return () => clearInterval(intervalId);
  }, [initialLoadData, refreshData]);

  // 刷新按钮点击处理
  const handleRefresh = () => {
    refreshData();
  };

  // 处理排序
  const handleSort = (field: SortField) => {
    // 如果点击的是当前排序字段，则切换排序方向
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // 否则设置新的排序字段，默认倒序
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // 获取排序图标
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '⇅';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  // 将持仓时长字符串转换为分钟数，用于排序
  const parseDurationToMinutes = (duration: string): number => {
    if (!duration || duration === '-') return 0;

    let totalMinutes = 0;

    // 匹配天数
    const dayMatch = duration.match(/(\d+)天/);
    if (dayMatch) {
      totalMinutes += parseInt(dayMatch[1]) * 24 * 60;
    }

    // 匹配小时数
    const hourMatch = duration.match(/(\d+)小时/);
    if (hourMatch) {
      totalMinutes += parseInt(hourMatch[1]) * 60;
    }

    // 匹配分钟数
    const minuteMatch = duration.match(/(\d+)分钟/);
    if (minuteMatch) {
      totalMinutes += parseInt(minuteMatch[1]);
    }

    // 匹配秒数（转换为分钟的小数部分）
    const secondMatch = duration.match(/(\d+)秒/);
    if (secondMatch) {
      totalMinutes += parseInt(secondMatch[1]) / 60;
    }

    return totalMinutes;
  };

  // 对数据进行排序
  const getSortedStrategies = (data: RealTimeStrategy[]) => {
    return [...data].sort((a, b) => {
      // 特殊处理预估余额字段，因为它是计算得出的
      if (sortField === 'estimatedBalance') {
        const aValue = calculateEstimatedBalance(a);
        const bValue = calculateEstimatedBalance(b);

        // 处理空值，确保空值始终排在最后
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      let aValue: any = a[sortField as keyof RealTimeStrategy];
      let bValue: any = b[sortField as keyof RealTimeStrategy];

      // 无论升序还是降序，null/undefined值都排在最后
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      // 特殊处理持仓时长排序
      if (sortField === 'holdingDuration') {
        const durationA = parseDurationToMinutes(aValue);
        const durationB = parseDurationToMinutes(bValue);
        return sortDirection === 'asc' ? durationA - durationB : durationB - durationA;
      }

      // 处理百分比字符串（需要在普通字符串处理之前）
      if (sortField === 'profitPercentage' && typeof aValue === 'string' && typeof bValue === 'string') {
        const numA = parseFloat(aValue.replace('%', ''));
        const numB = parseFloat(bValue.replace('%', ''));
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }

      // 处理字符串类型的排序
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        // 日期字符串特殊处理
        if (sortField === 'createTime' || sortField === 'updateTime' || sortField === 'entryTime') {
          const dateA = aValue ? new Date(aValue).getTime() : 0;
          const dateB = bValue ? new Date(bValue).getTime() : 0;
          return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
        }

        // 普通字符串
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      // 普通数值比较
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });
  };

  // 格式化时间
  const formatDateTime = (dateTimeStr: string): string => {
    if (!dateTimeStr) return '-';
    try {
      const date = new Date(dateTimeStr);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (error) {
      return dateTimeStr;
    }
  };

  // 格式化金额
  const formatAmount = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return '0';
    return amount.toLocaleString('zh-CN', { minimumFractionDigits: 8, maximumFractionDigits: 8 });
  };

  // 格式化投资金额，去掉末尾的零
  const formatInvestmentAmount = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return '0';

    // 转换为字符串，保留足够的小数位
    const str = amount.toFixed(8);

    // 去掉末尾的零和小数点
    const trimmed = str.replace(/\.?0+$/, '');

    // 如果结果为空或只有小数点，返回'0'
    if (trimmed === '' || trimmed === '.') return '0';

    // 添加千位分隔符
    const parts = trimmed.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    return parts.join('.');
  };

  // 获取状态样式
  const getStatusClass = (status: string): string => {
    switch (status?.toLowerCase()) {
      case 'running':
        return 'status-running';
      case 'stopped':
        return 'status-stopped';
      case 'error':
        return 'status-error';
      default:
        return 'status-unknown';
    }
  };

  // 启动策略
  const handleStartStrategy = async (strategyId: number) => {
    setOperationInProgress({ ...operationInProgress, [strategyId]: true });
    try {
      const result = await startRealTimeStrategy(strategyId);
      if (result.success) {
        // 刷新策略列表
        refreshData();
      } else {
        setError(result.message || '启动策略失败');
        setErrorModalOpen(true);
      }
    } catch (error) {
      console.error('启动策略失败:', error);
      setError(error instanceof Error ? error.message : '启动策略失败');
      setErrorModalOpen(true);
    } finally {
      setOperationInProgress({ ...operationInProgress, [strategyId]: false });
    }
  };

  // 停止策略
  const handleStopStrategy = async (strategyId: number) => {
    setOperationInProgress({ ...operationInProgress, [strategyId]: true });
    try {
      const result = await stopRealTimeStrategy(strategyId);
      if (result.success) {
        // 刷新策略列表
        refreshData();
      } else {
        setError(result.message || '停止策略失败');
        setErrorModalOpen(true);
      }
    } catch (error) {
      console.error('停止策略失败:', error);
      setError(error instanceof Error ? error.message : '停止策略失败');
      setErrorModalOpen(true);
    } finally {
      setOperationInProgress({ ...operationInProgress, [strategyId]: false });
    }
  };

  // 删除策略
  const handleDeleteStrategy = async (strategyId: number) => {
    setOperationInProgress({ ...operationInProgress, [strategyId]: true });
    try {
      const result = await deleteRealTimeStrategy(strategyId);
      if (result.success) {
        // 刷新策略列表
        refreshData();
      } else {
        setError(result.message || '删除策略失败');
        setErrorModalOpen(true);
      }
    } catch (error) {
      console.error('删除策略失败:', error);
      setError(error instanceof Error ? error.message : '删除策略失败');
      setErrorModalOpen(true);
    } finally {
      setOperationInProgress({ ...operationInProgress, [strategyId]: false });
    }
  };

  // 复制策略
  const handleCopyStrategy = async (strategyId: number) => {
    // 获取策略详情并打开复制模态框
    const strategy = strategies.find(s => s.id === strategyId);
    if (strategy) {
      setCopyModal({
        isOpen: true,
        strategy: strategy
      });
    }
  };

  // 确认复制
  const handleConfirmCopy = async (interval: string, symbol: string, tradeAmount: number) => {
    if (!copyModal.strategy) return;

    const strategyId = copyModal.strategy.id;
    setOperationInProgress({ ...operationInProgress, [strategyId]: true });

    try {
      // 调用复制API，传入可选参数
      const result = await copyRealTimeStrategy(strategyId, {
        interval,
        symbol,
        tradeAmount
      });

      if (result.success) {
        // 刷新策略列表
        refreshData();
      } else {
        setError(result.message || '复制策略失败');
        setErrorModalOpen(true);
      }
    } catch (error) {
      console.error('复制策略失败:', error);
      setError(error instanceof Error ? error.message : '复制策略失败');
      setErrorModalOpen(true);
    } finally {
      setOperationInProgress({ ...operationInProgress, [strategyId]: false });
      // 关闭复制模态框
      setCopyModal({ isOpen: false, strategy: null });
    }
  };

  // 关闭复制模态框
  const closeCopyModal = () => {
    setCopyModal({ isOpen: false, strategy: null });
  };

  // 打开确认对话框
  const openConfirmModal = (strategy: RealTimeStrategy) => {
    setConfirmModal({
      isOpen: true,
      strategyId: strategy.id,
      strategyName: strategy.strategyName || strategy.strategyCode,
    });
  };

  // 关闭确认对话框
  const closeConfirmModal = () => {
    setConfirmModal({
      isOpen: false,
      strategyId: -1,
      strategyName: '',
    });
  };

  // 确认删除
  const confirmDelete = () => {
    handleDeleteStrategy(confirmModal.strategyId);
    closeConfirmModal();
  };

  // 全仓买入（开仓）
  const handleBuyFullPosition = async (strategyId: number) => {
    setOperationInProgress({ ...operationInProgress, [strategyId]: true });
    try {
      const result = await buyFullPosition(strategyId);
      if (result.success) {
        // 刷新策略列表
        refreshData();
      } else {
        setError(result.message || '全仓买入失败');
        setErrorModalOpen(true);
      }
    } catch (error) {
      console.error('全仓买入失败:', error);
      setError(error instanceof Error ? error.message : '全仓买入失败');
      setErrorModalOpen(true);
    } finally {
      setOperationInProgress({ ...operationInProgress, [strategyId]: false });
    }
  };

  // 全仓卖出（平仓）
  const handleSellFullPosition = async (strategyId: number) => {
    setOperationInProgress({ ...operationInProgress, [strategyId]: true });
    try {
      const result = await sellFullPosition(strategyId);
      if (result.success) {
        // 刷新策略列表
        refreshData();
      } else {
        setError(result.message || '全仓卖出失败');
        setErrorModalOpen(true);
      }
    } catch (error) {
      console.error('全仓卖出失败:', error);
      setError(error instanceof Error ? error.message : '全仓卖出失败');
      setErrorModalOpen(true);
    } finally {
      setOperationInProgress({ ...operationInProgress, [strategyId]: false });
    }
  };

  // 计算预估余额
  const calculateEstimatedBalance = (strategy: RealTimeStrategy): number => {
    // 初始投资金额
    const tradeAmount = strategy.tradeAmount || 0;
    // 总收益
    const totalProfit = strategy.totalProfit || 0;
    // 预估收益（如果持仓中）
    const estimatedProfit = strategy.isHolding && typeof strategy.estimatedProfit === 'number'
      ? strategy.estimatedProfit
      : 0;

    // 预估收益 =  总收益 + 预估收益
    return totalProfit + estimatedProfit;
  };

  // 先对数据进行排序
  const sortedStrategies = getSortedStrategies(strategies);

  // 分页相关计算
  const totalPages = Math.ceil(sortedStrategies.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentPageData = sortedStrategies.slice(startIndex, endIndex);

  // 处理页码变化
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };


  return (
    <div className="real-time-strategy-page">
      {/* 原有的实盘策略列表 */}
      {initialLoading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>正在加载实盘策略数据...</p>
        </div>
      ) : (
        <div className="strategies-container">
          {/* 标题和刷新按钮+统计指标放在同一行 */}
          <div className="header-row statistics-header-row" style={{ justifyContent: 'center', gap: 24 }}>
            {/* 统计信息面板 - 始终渲染容器，避免布局跳跃 */}
            <div className="strategy-statistics-panel" style={{ marginBottom: 0, flex: 1 }}>
              {statistics ? (
                <>
                  <div className="stat-item">
                    <span className="stat-label">今日信号数</span>
                    <span className="stat-value">{statistics.todaysingalCount}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">持仓策略数</span>
                    <span className="stat-value">{statistics.holdingStrategiesCount}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">运行策略数</span>
                    <span className="stat-value">{statistics.runningStrategiesCount}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">今日收益</span>
                    <span className={`stat-value ${statistics.todayProfit >= 0 ? 'positive' : 'negative'}`}>{formatAmount(statistics.todayProfit)}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">预估持仓收益</span>
                    <span className={`stat-value ${statistics.totalEstimatedProfit >= 0 ? 'positive' : 'negative'}`}>{formatAmount(statistics.totalEstimatedProfit)}</span>
                  </div>

                  <div className="stat-item">
                    <span className="stat-label">总已实现收益</span>
                    <span className={`stat-value ${statistics.totalRealizedProfit >= 0 ? 'positive' : 'negative'}`}>{formatAmount(statistics.totalRealizedProfit)}</span>
                  </div>

                  <div className="stat-item">
                    <span className="stat-label">总收益</span>
                    <span className={`stat-value ${statistics.totalProfit >= 0 ? 'positive' : 'negative'}`}>{formatAmount(statistics.totalProfit)}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">总收益率</span>
                    <span className={`stat-value ${!statistics.totalProfitRate.includes('-') ? 'positive' : 'negative'}`}>{statistics.totalProfitRate}</span>
                  </div>

                  <div className="stat-item">
                    <span className="stat-label">持仓投资金额</span>
                    <span className="stat-value">{formatInvestmentAmount(statistics.totalHlodingInvestmentAmount)}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">总投资金额</span>
                    <span className="stat-value">{formatInvestmentAmount(statistics.totalInvestmentAmount)}</span>
                  </div>
                </>
              ) : (
                /* 数据加载中的占位内容，保持布局稳定 */
                <div className="statistics-loading">
                  <span>统计数据加载中...</span>
                </div>
              )}
            </div>
            
            {/* 刷新按钮 - 始终显示在固定位置 */}
            <div className="refresh-container" style={{ marginLeft: 24 }}>
              <button
                className="refresh-button"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? '刷新中...' : '刷新数据'}
              </button>
            </div>
          </div>

          {strategies.length === 0 ? (
            <div className="empty-state">
              <p>暂无实盘策略数据</p>
              <p>您可以在首页创建实盘策略</p>
            </div>
          ) : (
            <div className="strategies-table-container">
              <table className="strategies-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('id')} className="sortable-header">
                      ID {getSortIcon('id')}
                    </th>
                    <th onClick={() => handleSort('strategyName')} className="sortable-header">
                      策略名称 {getSortIcon('strategyName')}
                    </th>
                    <th onClick={() => handleSort('symbol')} className="sortable-header">
                      交易对 {getSortIcon('symbol')}
                    </th>
                    <th onClick={() => handleSort('interval')} className="sortable-header">
                      时间周期 {getSortIcon('interval')}
                    </th>
                    <th onClick={() => handleSort('tradeAmount')} className="sortable-header">
                      投资金额 {getSortIcon('tradeAmount')}
                    </th>
                    <th onClick={() => handleSort('estimatedBalance')} className="sortable-header">
                      全部预估收益 {getSortIcon('estimatedBalance')}
                    </th>
                    <th onClick={() => handleSort('totalProfit')} className="sortable-header">
                      已完成收益 {getSortIcon('totalProfit')}
                    </th>
                    <th onClick={() => handleSort('totalProfitRate')} className="sortable-header">
                      利润率 {getSortIcon('totalProfitRate')}
                    </th>
                    <th onClick={() => handleSort('totalFees')} className="sortable-header">
                      总佣金 {getSortIcon('totalFees')}
                    </th>
                    <th onClick={() => handleSort('totalTrades')} className="sortable-header">
                      交易次数 {getSortIcon('totalTrades')}
                    </th>
                    {/* 持仓信息相关列 */}
                    <th className="sortable-header">
                      持仓状态
                    </th>
                    <th onClick={() => handleSort('estimatedProfit')} className="sortable-header">
                      预估收益 {getSortIcon('estimatedProfit')}
                    </th>
                    <th onClick={() => handleSort('profitPercentage')} className="sortable-header">
                      预估收益率 {getSortIcon('profitPercentage')}
                    </th>
                    <th onClick={() => handleSort('holdingDuration')} className="sortable-header">
                      持仓时长 {getSortIcon('holdingDuration')}
                    </th>
                    <th onClick={() => handleSort('createTime')} className="sortable-header">
                      创建时间 {getSortIcon('createTime')}
                    </th>
                    <th onClick={() => handleSort('updateTime')} className="sortable-header">
                      更新时间 {getSortIcon('updateTime')}
                    </th>
                    <th onClick={() => handleSort('status')} className="sortable-header">
                      状态 {getSortIcon('status')}
                    </th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {currentPageData.map((strategy) => (
                    <tr key={strategy.id} className={strategy.isHolding ? 'holding-strategy-row' : ''}>
                      <td>{strategy.id}</td>
                      <td>{strategy.strategyName || '-'}</td>
                      <td>{strategy.symbol}</td>
                      <td>{strategy.interval}</td>
                      <td>{formatAmount(strategy.tradeAmount)} </td>
                      <td className={calculateEstimatedBalance(strategy) >= 0 ? 'positive' : 'negative'}>
                        {formatAmount(calculateEstimatedBalance(strategy))}
                      </td>
                      <td className={strategy.totalProfit && strategy.totalProfit >= 0 ? 'positive' : 'negative'}>
                        {formatAmount(strategy.totalProfit)}
                      </td>
                      <td className={strategy.totalProfitRate && strategy.totalProfitRate >= 0 ? 'positive' : 'negative'}>
                        {strategy.totalProfitRate ? `${(strategy.totalProfitRate * 100).toFixed(4)}%` : '0.00%'}
                      </td>
                      <td>
                        {formatAmount(strategy.totalFees)}
                      </td>
                      <td>{strategy.totalTrades || 0}</td>
                      {/* 持仓信息相关列 */}
                      <td>
                        {strategy.isHolding ? (
                          <span className="holding-badge">持仓中</span>
                        ) : (
                          <span className="no-position-badge">未持仓</span>
                        )}
                      </td>
                      <td className={typeof strategy.estimatedProfit === 'number' && strategy.estimatedProfit >= 0 ? 'positive' : 'negative'}>
                        {strategy.isHolding ? strategy.estimatedProfit : '-'}
                      </td>
                      <td className={strategy.profitPercentage?.includes('-') ? 'negative' : 'positive'}>
                        {strategy.isHolding ? strategy.profitPercentage : '-'}
                      </td>
                      <td>{strategy.isHolding ? strategy.holdingDuration : '-'}</td>
                      <td>{formatDateTime(strategy.createTime)}</td>
                      <td>{formatDateTime(strategy.updateTime)}</td>
                      <td>
                        <div
                          className="status-container"
                          onMouseEnter={(e) => {
                            if (strategy.status === 'ERROR' && strategy.message) {
                              const tooltip = e.currentTarget.querySelector('.error-tooltip') as HTMLElement;
                              if (tooltip) {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const viewportHeight = window.innerHeight;
                                const viewportWidth = window.innerWidth;

                                // 计算提示框的位置
                                let left = rect.left + rect.width / 2;
                                let top = rect.top - 10;

                                // 确保提示框不会超出视口边界
                                if (left + 200 > viewportWidth) {
                                  left = viewportWidth - 220;
                                }
                                if (left < 20) {
                                  left = 20;
                                }
                                if (top < 20) {
                                  top = rect.bottom + 10;
                                }

                                tooltip.style.left = `${left}px`;
                                tooltip.style.top = `${top}px`;
                                tooltip.style.transform = top > rect.bottom ? 'translateX(-50%)' : 'translateX(-50%) translateY(-100%)';
                              }
                            }
                          }}
                        >
                          <span
                            className={`status-badge ${getStatusClass(strategy.status)}`}
                          >
                            {strategy.status || 'UNKNOWN'}
                          </span>
                          {strategy.status === 'ERROR' && strategy.message && (
                            <div className="error-tooltip">
                              <div className="error-title">错误详情</div>
                              <div className="error-message">{strategy.message}</div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <button
                          className="strategy-detail-btn"
                          onClick={() => navigate(`/real-time-strategy-detail/${strategy.id}`)}
                        >
                          详情
                        </button>
                        {strategy.status === 'RUNNING' ? (
                          <button
                            className="strategy-stop-btn"
                            onClick={() => handleStopStrategy(strategy.id)}
                            disabled={operationInProgress[strategy.id]}
                          >
                            {operationInProgress[strategy.id] ? '处理中...' : '停止'}
                          </button>
                        ) : (
                          <button
                            className="strategy-start-btn"
                            onClick={() => handleStartStrategy(strategy.id)}
                            disabled={operationInProgress[strategy.id]}
                          >
                            {operationInProgress[strategy.id] ? '处理中...' : '启动'}
                          </button>
                        )}
                        <button
                          className="strategy-delete-btn"
                          onClick={() => openConfirmModal(strategy)}
                          disabled={operationInProgress[strategy.id]}
                        >
                          删除
                        </button>
                        <button
                          className="strategy-copy-btn"
                          onClick={() => handleCopyStrategy(strategy.id)}
                          disabled={operationInProgress[strategy.id]}
                        >
                          复制
                        </button>
                        {strategy.isHolding ? (
                          <button
                            className="strategy-sell-btn"
                            onClick={() => handleSellFullPosition(strategy.id)}
                            disabled={operationInProgress[strategy.id]}
                          >
                            {operationInProgress[strategy.id] ? '处理中...' : '平仓'}
                          </button>
                        ) : (
                          <button
                            className="strategy-buy-btn"
                            onClick={() => handleBuyFullPosition(strategy.id)}
                            disabled={operationInProgress[strategy.id]}
                          >
                            {operationInProgress[strategy.id] ? '处理中...' : '开仓'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 分页控制 */}
          {strategies.length > 0 && (
            <div className="pagination-container">
              <div className="pagination-buttons">
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                  className="pagination-button"
                >
                  首页
                </button>
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="pagination-button"
                >
                  上一页
                </button>
                <div className="pagination-info">
                  {currentPage} / {totalPages} 页 (共 {strategies.length} 条记录)
                </div>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="pagination-button"
                >
                  下一页
                </button>
                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  className="pagination-button"
                >
                  末页
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 添加确认对话框 */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="删除策略确认"
        message={`确定要删除策略 <strong>${confirmModal.strategyName}</strong> 吗？<br/>此操作不可撤销，策略的所有关联数据将被清除。`}
        confirmText="删除"
        cancelText="取消"
        onConfirm={confirmDelete}
        onCancel={closeConfirmModal}
        type="danger"
      />

      {/* 添加复制策略模态框 */}
      {copyModal.strategy && (
        <CopyStrategyModal
          isOpen={copyModal.isOpen}
          onClose={closeCopyModal}
          onConfirm={handleConfirmCopy}
          originalStrategy={copyModal.strategy}
        />
      )}

      {/* 添加错误信息对话框 */}
      <ConfirmModal
        isOpen={errorModalOpen}
        title="操作失败"
        message={`错误: ${error}`}
        confirmText="确定"
        onConfirm={() => setErrorModalOpen(false)}
        onCancel={() => setErrorModalOpen(false)}
        type="danger"
      />
    </div>
  );
};

export default RealTimeStrategyPage;
