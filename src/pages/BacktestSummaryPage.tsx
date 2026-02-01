
import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AppState, BacktestSummary } from '../store/types';
import { setBacktestSummaries } from '../store/actions';
import { fetchBacktestSummaries, fetchBatchBacktestSummariesBatch } from '../services/api';
import { formatPercentage } from '../utils/helpers';
import { useAdaptivePagination } from '../hooks/useAdaptivePagination';
import './BacktestSummaryPage.css';

// 指标说明
const INDICATOR_DESCRIPTIONS = {
  annualizedReturn: `年化收益率：将投资期间的收益率转换为年化形式，便于比较不同时间长度的投资表现\n• **判断标准**：数值越高越好，正值表示盈利，负值表示亏损\n• **主要作用**：评估策略的整体盈利能力和与其他投资产品的比较`,
  maxDrawdown: `最大回撤：投资组合从最高点到最低点的最大跌幅，衡量投资风险\n• **判断标准**：数值越小越好（接近0%最佳）\n• **风险提示**：超过20%需要谨慎，超过50%风险极高\n• **主要作用**：评估策略的风险承受能力和风险控制水平`,
  sharpeRatio: `夏普比率：衡量每单位风险所获得的超额回报\n• **计算公式**：(收益率-无风险利率)/收益率标准差\n• **判断标准**：数值越高越好，>1为良好，>2为优秀，>3为卓越\n• **主要作用**：评估风险调整后的收益表现`,
  calmarRatio: `卡玛比率：年化收益率与最大回撤的比值\n• **判断标准**：数值越高越好，>1为良好，>2为优秀\n• **主要作用**：评估策略在控制回撤风险下的盈利效率`,
  sortinoRatio: `索提诺比率：类似夏普比率，但只考虑下行风险\n• **判断标准**：数值越高越好，>1为良好，>2为优秀\n• **适用场景**：更适合评估不对称收益分布的策略\n• **主要作用**：关注负收益的波动性评估`,
  averageProfit: `平均收益：每笔交易的平均盈利金额\n• **判断标准**：数值越高越好，正值表示平均盈利，负值表示平均亏损\n• **主要作用**：评估策略的交易质量和资金使用效率`,
  winRate: `胜率：盈利交易占总交易次数的比例\n• **判断标准**：数值越高越好，通常60%以上为良好\n• **主要作用**：评估策略的稳定性和准确性`,
  maximumLoss: `最大损失：单笔交易的最大亏损金额\n• **判断标准**：绝对值越小越好\n• **风险意义**：反映策略的风险控制和止损能力\n• **主要作用**：评估策略的极端风险暴露`,
  maxDrawdownPeriod: `价格最大回撤：每笔交易期间收盘价从峰值到谷值的最大跌幅\n• **判断标准**：数值越小越好\n• **风险意义**：反映单笔交易的价格风险暴露\n• **主要作用**：评估交易期间的价格波动风险`,
  maximumLossPeriod: `价格最大损失：每笔交易期间收盘价与入场价的最大损失比例\n• **判断标准**：数值越小越好\n• **风险意义**：反映相对入场价的最大潜在亏损\n• **主要作用**：评估交易止损点设置的有效性`,
  alpha: `Alpha系数：衡量投资组合相对于基准的超额收益能力\n• **判断标准**：数值越高越好\n• **数值含义**：正值表示跑赢基准，负值表示跑输基准\n• **主要作用**：评估策略相对市场的增值能力`,
  beta: `Beta系数：衡量投资组合相对于市场的系统性风险\n• **数值含义**：1表示与市场同步，>1表示波动更大，<1表示波动较小，0表示无相关性\n• **主要作用**：评估策略的市场敏感度和系统性风险暴露`,
  omega: `Omega比率：收益概率加权平均与损失概率加权平均的比值\n• **判断标准**：数值越高越好，>1表示盈利概率大于亏损概率\n• **优势特点**：综合考虑收益分布的所有信息\n• **主要作用**：全面评估策略的风险收益特征`,
  profitFactor: `盈利因子：总盈利与总亏损的比值\n• **判断标准**：数值越高越好\n• **评级标准**：>1表示盈利，>1.5为良好，>2为优秀\n• **主要作用**：评估策略的基本盈利逻辑和可持续性`,
  skewness: `偏度：衡量收益分布的不对称性\n• **数值含义**：正值表示右偏（大涨概率高），负值表示左偏（大跌概率高），0表示对称分布\n• **判断标准**：绝对值越小分布越对称\n• **主要作用**：评估策略的收益分布特征和极端收益倾向`,
  treynorRatio: `特雷诺比率：每单位系统性风险（Beta）的超额收益\n• **判断标准**：数值越高越好\n• **适用条件**：适用于充分分散化的投资组合\n• **主要作用**：评估承担系统性风险的补偿是否充分`,
  ulcerIndex: `溃疡指数：衡量回撤的深度和持续时间的风险指标\n• **判断标准**：数值越小越好\n• **综合考量**：同时考虑回撤的严重程度和持续时间\n• **主要作用**：评估投资者心理承受能力和策略的平稳性`,
  burkeRatio: `伯克比率：考虑回撤严重性的风险调整收益比率\n• **判断标准**：数值越高越好\n• **特点**：重点关注回撤的平方根，更敏感于极端回撤\n• **主要作用**：评估策略在极端风险下的收益表现`,
  comprehensiveScore: `综合评分：基于多个风险收益指标的综合评估分数\n• **判断标准**：分数越高越好\n• **评分体系**：综合考虑收益、风险、稳定性等多个维度\n• **主要作用**：提供策略整体表现的量化评估`,
  cvar: `条件风险价值(CVaR)：超过VaR阈值的预期损失\n• **判断标准**：数值越小越好\n• **风险意义**：比VaR更保守，考虑极端损失的期望值\n• **主要作用**：评估极端市场条件下的潜在损失`,
  downsideDeviation: `下行偏差：只考虑负收益的波动性指标\n• **判断标准**：数值越小越好\n• **计算特点**：仅统计低于目标收益率的波动\n• **主要作用**：专注评估不利情况下的风险`,
  downtrendCapture: `下跌捕获比率：策略在市场下跌时的相对表现\n• **判断标准**：数值越小越好，<1表示下跌时损失较小\n• **数值含义**：0.8表示市场下跌10%时策略下跌8%\n• **主要作用**：评估策略的下行保护能力`,
  informationRatio: `信息比率：超额收益与跟踪误差的比值\n• **判断标准**：数值越高越好\n• **适用场景**：主要用于评估主动管理策略\n• **主要作用**：衡量主动管理产生超额收益的效率`,
  kurtosis: `峰度：衡量收益分布尾部厚度的统计指标\n• **数值含义**：>3表示厚尾分布，<3表示薄尾分布\n• **风险意义**：高峰度表示极端收益出现概率较高\n• **主要作用**：评估极端事件的发生可能性`,
  maxDrawdownDuration: `最大回撤持续时间：最长的资产净值低于前期高点的时间\n• **判断标准**：时间越短越好\n• **单位**：通常以天数或交易周期计算\n• **主要作用**：评估策略恢复能力和投资者耐心要求`,
  modifiedSharpeRatio: `修正夏普比率：考虑收益分布偏度和峰度的夏普比率\n• **判断标准**：数值越高越好\n• **改进点**：修正了传统夏普比率假设正态分布的局限\n• **主要作用**：更准确评估非正态分布策略的风险调整收益`,
  painIndex: `痛苦指数：衡量投资者承受回撤痛苦程度的指标\n• **判断标准**：数值越小越好\n• **计算方式**：回撤深度与持续时间的加权平均\n• **主要作用**：从投资者心理角度评估策略的可接受性`,
  riskAdjustedReturn: `风险调整收益：考虑风险因素后的实际收益\n• **判断标准**：数值越高越好\n• **计算方法**：通常为收益率除以某种风险指标\n• **主要作用**：公平比较不同风险水平策略的表现`,
  sterlingRatio: `斯特林比率：年化收益率与平均最大回撤的比值\n• **判断标准**：数值越高越好\n• **特点**：使用平均回撤而非单次最大回撤\n• **主要作用**：评估策略的长期稳定盈利能力`,
  trackingError: `跟踪误差：策略收益率与基准收益率差异的标准差\n• **判断标准**：数值大小取决于策略目标\n• **应用场景**：主要用于指数化投资和主动管理评估\n• **主要作用**：衡量策略偏离基准的程度`,
  uptrendCapture: `上涨捕获比率：策略在市场上涨时的相对表现\n• **判断标准**：数值越大越好，>1表示上涨时收益超过市场\n• **数值含义**：1.2表示市场上涨10%时策略上涨12%\n• **主要作用**：评估策略的上涨参与能力`,
  var95: `95%风险价值(VaR)：95%置信度下的最大预期损失\n• **判断标准**：绝对值越小越好\n• **统计含义**：有5%的概率损失会超过此值\n• **主要作用**：量化正常市场条件下的风险暴露`,
  var99: `99%风险价值(VaR)：99%置信度下的最大预期损失\n• **判断标准**：绝对值越小越好\n• **统计含义**：有1%的概率损失会超过此值\n• **主要作用**：量化极端市场条件下的风险暴露`,
  volatility: `波动率：收益率的标准差，衡量价格变动的剧烈程度\n• **判断标准**：根据策略类型而定，通常适中为好\n• **计算方式**：收益率序列的标准差\n• **主要作用**：评估策略的稳定性和风险水平`
};

// 排序方向类型
type SortDirection = 'asc' | 'desc';

// 排序字段类型
type SortField =
  | 'id'
  | 'createTime'
  | 'symbol'
  | 'intervalVal'
  | 'strategyName'
  | 'startTime'
  | 'endTime'
  | 'initialAmount'
  | 'finalAmount'
  | 'totalProfit'
  | 'totalReturn'
  | 'totalFee'
  | 'feeRate'
  | 'numberOfTrades'
  | 'winRate'
  | 'maxDrawdown'
  | 'sharpeRatio'
  | 'annualizedReturn'
  | 'calmarRatio'
  | 'sortinoRatio'
  | 'averageProfit'
  | 'profitableTrades'
  | 'unprofitableTrades'
  | 'maximumLoss'
  | 'maxDrawdownPeriod'
  | 'maximumLossPeriod'
  | 'alpha'
  | 'beta'
  | 'omega'
  | 'profitFactor'
  | 'skewness'
  | 'treynorRatio'
  | 'ulcerIndex'
  | 'burkeRatio'
  | 'comprehensiveScore'
  | 'cvar'
  | 'downsideDeviation'
  | 'downtrendCapture'
  | 'informationRatio'
  | 'kurtosis'
  | 'maxDrawdownDuration'
  | 'modifiedSharpeRatio'
  | 'painIndex'
  | 'riskAdjustedReturn'
  | 'sterlingRatio'
  | 'trackingError'
  | 'uptrendCapture'
  | 'var95'
  | 'var99'
  | 'volatility';

// 过滤条件类型
interface Filters {
  symbol: string;
  intervalVal: string;
  strategyName: string;
}

// 聚合维度类型
type AggregationDimension = '' | 'symbol' | 'intervalVal' | 'strategyName';

// 策略类型
interface Strategy {
  name: string;
  description: string;
  params: string;
  category?: string;
  default_params?: string;
  strategy_code?: string;
}

const BacktestSummaryPage: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const backtestSummaries = useSelector((state: AppState) => state.backtestSummaries);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(15);
  const [sortField, setSortField] = useState<SortField>('createTime');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filteredData, setFilteredData] = useState<BacktestSummary[]>([]);
  const [filters, setFilters] = useState<Filters>({ symbol: '', intervalVal: '', strategyName: '' });
  // 添加关键词搜索状态
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  // 聚合维度
  const [aggregationDimension, setAggregationDimension] = useState<AggregationDimension>('');
  // 聚合后的数据
  const [aggregatedData, setAggregatedData] = useState<BacktestSummary[]>([]);
  // 存储策略名称映射
  const [strategyMap, setStrategyMap] = useState<{[key: string]: Strategy}>({});
  // 获取URL参数
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const batchId = queryParams.get('batchId');
  const batchBacktestId = queryParams.get('batch_backtest_id'); // 新增
  // 存储批次相关的回测ID列表
  const [batchBacktestIds, setBatchBacktestIds] = useState<string[]>([]);
  // 悬浮窗状态
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    content: string;
    x: number;
    y: number;
  }>({
    visible: false,
    content: '',
    x: 0,
    y: 0
  });

  // 使用自定义 Hook 进行自适应分页计算
  const { pageSize: adaptivePageSize } = useAdaptivePagination({
    rowHeight: 50, // CSS 中定义的行高
    minPageSize: 5,
    navbarHeight: 60,
    basePadding: 48, // 页面内边距 (24px top + 24px bottom)
    getOtherElementsHeight: () => {
      const filters = document.querySelector('.filters-container');
      const pagination = document.querySelector('.pagination-container');
      // 表头高度固定为 50px
      const tableHeaderHeight = 50; 
      
      const filtersHeight = filters ? filters.clientHeight : 60; // 默认估计值
      const paginationHeight = pagination ? pagination.clientHeight : 53; // 默认估计值
      
      // 加上一些 margin
      // filters margin-bottom: 10px
      // table margin-top: 10px
      const margins = 20;
      
      return filtersHeight + paginationHeight + tableHeaderHeight + margins;
    },
    dependencies: [loading, filteredData.length, aggregationDimension]
  });

  // 更新 pageSize 状态
  useEffect(() => {
    if (adaptivePageSize > 0) {
      setPageSizeState(adaptivePageSize);
    }
  }, [adaptivePageSize]);

  // 重命名原始的 pageSize 状态 setter 以避免冲突
  const setPageSize = setPageSizeState;

  useEffect(() => {
    if (batchBacktestId) {
      // 新增：如果有 batch_backtest_id，直接请求批量回测汇总接口
      setLoading(true);
      setError(null);
      fetchBatchBacktestSummariesBatch(batchBacktestId)
        .then((summaries) => {
          dispatch(setBacktestSummaries(summaries));
        })
        .catch((err) => {
          setError('获取批量回测汇总数据失败，请稍后重试');
          console.error('获取批量回测汇总数据失败:', err);
        })
        .finally(() => setLoading(false));
      return;
    }
    loadBacktestSummaries();
    // 加载策略列表
    fetchStrategies();
    if (batchId) {
      try {
        const storedIds = sessionStorage.getItem('backtestIds');
        if (storedIds) {
          const backtestIds = JSON.parse(storedIds);
          setBatchBacktestIds(backtestIds);
          // 如果是从批量回测页面跳转过来的，设置默认排序为收益率降序
          setSortField('totalReturn');
          setSortDirection('desc');
        }
      } catch (err) {
        console.error('解析sessionStorage中的回测ID列表失败:', err);
      }
    }
  }, [batchId, batchBacktestId]);

  // 当原始数据、过滤条件或批次回测ID列表变化时，更新过滤后的数据
  useEffect(() => {
    filterAndSortData();
  }, [backtestSummaries, sortField, sortDirection, filters, batchBacktestIds, aggregationDimension, searchKeyword]);

  const loadBacktestSummaries = async () => {
    setLoading(true);
    setError(null);
    try {
      const summaries = await fetchBacktestSummaries();
      dispatch(setBacktestSummaries(summaries));
    } catch (err) {
      setError('获取回测汇总数据失败，请稍后重试');
      console.error('获取回测汇总数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 获取策略列表
  const fetchStrategies = async () => {
    try {
      const response = await fetch('/api/backtest/ta4j/strategies');
      if (!response.ok) {
        throw new Error('获取策略列表失败');
      }
      const data = await response.json();
      if (data.code === 200 && data.data) {
        setStrategyMap(data.data);
      }
    } catch (error) {
      console.error('获取策略列表失败:', error);
    }
  };

  // 获取策略的中文名称
  const getStrategyDisplayName = (strategyCode: string): string => {
    if (strategyMap[strategyCode]) {
      return strategyMap[strategyCode].name;
    }
    return strategyCode;
  };

  // 将策略参数格式化为只显示值，用逗号拼接
  const formatStrategyParams = (strategyCode: string, paramsStr: string): string => {
    try {
      // 如果策略参数为空或无效，直接返回原始值
      if (!paramsStr) {
        return paramsStr;
      }

      // 解析参数字符串为对象
      const params = JSON.parse(paramsStr);

      // 只展示参数值，不展示名称，用逗号拼接
      return Object.values(params).join(', ');
    } catch (err) {
      console.error('解析策略参数失败:', err);
      return paramsStr; // 解析失败时返回原始字符串
    }
  };

  const formatAmount = (amount: number): string => {
    // 处理负数
    const isNegative = amount < 0;
    const absAmount = Math.abs(amount);

    let formattedValue: string;
    if (absAmount >= 1000000000) {
      formattedValue = `${(absAmount / 1000000000).toFixed(2)}B`;
    } else if (absAmount >= 1000000) {
      formattedValue = `${(absAmount / 1000000).toFixed(2)}M`;
    } else if (absAmount >= 1000) {
      formattedValue = `${(absAmount / 1000).toFixed(2)}K`;
    } else {
      formattedValue = absAmount.toFixed(2);
    }

    return isNegative ? `-${formattedValue}` : formattedValue;
  };

  // 获取数值颜色类名（红涨绿跌）
  const getValueColorClass = (value: number | null | undefined): string => {
    if (value === null || value === undefined || value === 0) {
      return '';
    }
    return value > 0 ? 'positive-value' : 'negative-value';
  };

  // 处理排序
  const handleSort = (field: SortField) => {
    if (field === sortField) {
      // 如果点击的是当前排序字段，则切换排序方向
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // 否则，更改排序字段，并设置为降序（大多数情况下用户希望看到最大值）
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // 处理过滤条件变化
  const handleFilterChange = (field: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setCurrentPage(1); // 重置到第一页
  };

  // 处理上线按钮点击
  const handleGoLive = (summary: BacktestSummary) => {
    // 构建跳转到首页的URL，包含策略参数
    const params = new URLSearchParams({
      strategy: summary.strategyCode,
      symbol: summary.symbol,
      interval: summary.intervalVal
    });

    // 跳转到首页并传递参数
    navigate(`/?${params.toString()}`);
  };

  // 过滤和排序数据
  const filterAndSortData = () => {
    // 先过滤
    let result = [...backtestSummaries];

    // 如果有批次ID和回测ID列表，只显示这些回测的摘要信息
    if (batchId && batchBacktestIds.length > 0) {
      result = result.filter(item => batchBacktestIds.includes(item.backtestId));
    }

    if (filters.symbol) {
      result = result.filter(item =>
        item.symbol.toLowerCase().includes(filters.symbol.toLowerCase())
      );
    }

    if (filters.intervalVal) {
      result = result.filter(item =>
        item.intervalVal.toLowerCase().includes(filters.intervalVal.toLowerCase())
      );
    }

    if (filters.strategyName) {
      result = result.filter(item =>
        item.strategyName.toLowerCase().includes(filters.strategyName.toLowerCase())
      );
    }

    // 关键词搜索过滤
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase();
      result = result.filter(item => {
        // 在多个字段中搜索关键词
        return (
          item.symbol.toLowerCase().includes(keyword) ||
          item.intervalVal.toLowerCase().includes(keyword) ||
          item.strategyName.toLowerCase().includes(keyword) ||
          (strategyMap[item.strategyName] && strategyMap[item.strategyName].name.toLowerCase().includes(keyword))
        );
      });
    }

    // 如果选择了聚合维度，进行数据聚合
    if (aggregationDimension) {
      result = aggregateData(result, aggregationDimension);
    }

    // 再排序
    result.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      // 根据排序字段获取对应的值
      switch (sortField) {
        case 'id':
          valueA = a.id;
          valueB = b.id;
          break;
        case 'createTime':
          valueA = new Date(a.createTime).getTime();
          valueB = new Date(b.createTime).getTime();
          break;
        case 'symbol':
          valueA = a.symbol;
          valueB = b.symbol;
          break;
        case 'intervalVal':
          valueA = a.intervalVal;
          valueB = b.intervalVal;
          break;
        case 'strategyName':
          valueA = a.strategyName;
          valueB = b.strategyName;
          break;
        case 'startTime':
          valueA = new Date(a.startTime).getTime();
          valueB = new Date(b.startTime).getTime();
          break;
        case 'endTime':
          valueA = new Date(a.endTime).getTime();
          valueB = new Date(b.endTime).getTime();
          break;
        case 'initialAmount':
          valueA = a.initialAmount;
          valueB = b.initialAmount;
          break;
        case 'finalAmount':
          valueA = a.finalAmount;
          valueB = b.finalAmount;
          break;
        case 'totalProfit':
          valueA = a.totalProfit;
          valueB = b.totalProfit;
          break;
        case 'totalReturn':
          valueA = a.totalReturn;
          valueB = b.totalReturn;
          break;
        case 'totalFee':
          valueA = a.totalFee;
          valueB = b.totalFee;
          break;
        case 'feeRate':
          valueA = a.totalFee / a.initialAmount;
          valueB = b.totalFee / b.initialAmount;
          break;
        case 'numberOfTrades':
          valueA = a.numberOfTrades;
          valueB = b.numberOfTrades;
          break;
        case 'winRate':
          valueA = a.winRate;
          valueB = b.winRate;
          break;
        case 'maxDrawdown':
          valueA = a.maxDrawdown;
          valueB = b.maxDrawdown;
          break;
        case 'sharpeRatio':
          valueA = a.sharpeRatio;
          valueB = b.sharpeRatio;
          break;
        case 'annualizedReturn':
          valueA = a.annualizedReturn;
          valueB = b.annualizedReturn;
          break;
        case 'calmarRatio':
          valueA = a.calmarRatio || 0;
          valueB = b.calmarRatio || 0;
          break;
        case 'sortinoRatio':
          valueA = a.sortinoRatio || 0;
          valueB = b.sortinoRatio || 0;
          break;
        case 'averageProfit':
          valueA = a.averageProfit;
          valueB = b.averageProfit;
          break;

        case 'profitableTrades':
          valueA = a.profitableTrades;
          valueB = b.profitableTrades;
          break;
        case 'unprofitableTrades':
          valueA = a.unprofitableTrades;
          valueB = b.unprofitableTrades;
          break;
        case 'maximumLoss':
          valueA = a.maximumLoss || 0;
          valueB = b.maximumLoss || 0;
          break;
        case 'maxDrawdownPeriod':
          valueA = a.maxDrawdownPeriod || 0;
          valueB = b.maxDrawdownPeriod || 0;
          break;
        case 'maximumLossPeriod':
          valueA = a.maximumLossPeriod || 0;
          valueB = b.maximumLossPeriod || 0;
          break;
        case 'alpha':
          valueA = a.alpha || 0;
          valueB = b.alpha || 0;
          break;
        case 'beta':
          valueA = a.beta || 0;
          valueB = b.beta || 0;
          break;
        case 'omega':
          valueA = a.omega || 0;
          valueB = b.omega || 0;
          break;
        case 'profitFactor':
          valueA = a.profitFactor || 0;
          valueB = b.profitFactor || 0;
          break;
        case 'skewness':
          valueA = a.skewness || 0;
          valueB = b.skewness || 0;
          break;
        case 'treynorRatio':
          valueA = a.treynorRatio || 0;
          valueB = b.treynorRatio || 0;
          break;
        case 'ulcerIndex':
          valueA = a.ulcerIndex || 0;
          valueB = b.ulcerIndex || 0;
          break;
        case 'burkeRatio':
          valueA = a.burkeRatio || 0;
          valueB = b.burkeRatio || 0;
          break;
        case 'comprehensiveScore':
          valueA = a.comprehensiveScore || 0;
          valueB = b.comprehensiveScore || 0;
          break;
        case 'cvar':
          valueA = a.cvar || 0;
          valueB = b.cvar || 0;
          break;
        case 'downsideDeviation':
          valueA = a.downsideDeviation || 0;
          valueB = b.downsideDeviation || 0;
          break;
        case 'downtrendCapture':
          valueA = a.downtrendCapture || 0;
          valueB = b.downtrendCapture || 0;
          break;
        case 'informationRatio':
          valueA = a.informationRatio || 0;
          valueB = b.informationRatio || 0;
          break;
        case 'kurtosis':
          valueA = a.kurtosis || 0;
          valueB = b.kurtosis || 0;
          break;
        case 'maxDrawdownDuration':
          valueA = a.maxDrawdownDuration || 0;
          valueB = b.maxDrawdownDuration || 0;
          break;
        case 'modifiedSharpeRatio':
          valueA = a.modifiedSharpeRatio || 0;
          valueB = b.modifiedSharpeRatio || 0;
          break;
        case 'painIndex':
          valueA = a.painIndex || 0;
          valueB = b.painIndex || 0;
          break;
        case 'riskAdjustedReturn':
          valueA = a.riskAdjustedReturn || 0;
          valueB = b.riskAdjustedReturn || 0;
          break;
        case 'sterlingRatio':
          valueA = a.sterlingRatio || 0;
          valueB = b.sterlingRatio || 0;
          break;
        case 'trackingError':
          valueA = a.trackingError || 0;
          valueB = b.trackingError || 0;
          break;
        case 'uptrendCapture':
          valueA = a.uptrendCapture || 0;
          valueB = b.uptrendCapture || 0;
          break;
        case 'var95':
          valueA = a.var95 || 0;
          valueB = b.var95 || 0;
          break;
        case 'var99':
          valueA = a.var99 || 0;
          valueB = b.var99 || 0;
          break;
        case 'volatility':
          valueA = a.volatility || 0;
          valueB = b.volatility || 0;
          break;
        default:
          valueA = a.id;
          valueB = b.id;
      }

      // 字符串比较
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return sortDirection === 'asc'
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      }

      // 数值比较
      return sortDirection === 'asc'
        ? valueA - valueB
        : valueB - valueA;
    });

    // 在设置filtered数据时重置到第一页
    setCurrentPage(1);
    setFilteredData(result);
  };

  // 显示指标说明悬浮窗
  const showTooltip = (field: keyof typeof INDICATOR_DESCRIPTIONS, event: React.MouseEvent) => {
    const description = INDICATOR_DESCRIPTIONS[field];
    if (description) {
      const rect = event.currentTarget.getBoundingClientRect();
      setTooltip({
        visible: true,
        content: description,
        x: rect.right + 10,
        y: rect.top
      });
    }
  };

  // 隐藏悬浮窗
  const hideTooltip = () => {
    setTooltip(prev => ({ ...prev, visible: false }));
  };

  // 渲染排序图标
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <span className="sort-icon">⇅</span>;
    }
    return sortDirection === 'asc'
      ? <span className="sort-icon active">↑</span>
      : <span className="sort-icon active">↓</span>;
  };

  // 数据聚合函数
  const aggregateData = (data: BacktestSummary[], dimension: AggregationDimension): BacktestSummary[] => {
    if (!dimension) return data;

    // 按维度分组
    const groups: { [key: string]: BacktestSummary[] } = {};
    data.forEach(item => {
      // 获取分组键
      let key = item[dimension] as string;

      // 确保键存在
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    });

    // 计算每组的平均值
    return Object.entries(groups).map(([key, items]) => {
      const count = items.length;

      // 创建聚合结果
      const aggregated: BacktestSummary = {
        ...items[0], // 保留第一个项目的基本信息
        id: 0, // 使用0表示这是聚合数据
        backtestId: `aggregated_${key}`,
        numberOfTrades: Math.round(items.reduce((sum, item) => sum + item.numberOfTrades, 0) / count),
        initialAmount: items.reduce((sum, item) => sum + item.initialAmount, 0) / count,
        finalAmount: items.reduce((sum, item) => sum + item.finalAmount, 0) / count,
        totalProfit: items.reduce((sum, item) => sum + item.totalProfit, 0) / count,
        totalReturn: items.reduce((sum, item) => sum + item.totalReturn, 0) / count,
        totalFee: items.reduce((sum, item) => sum + item.totalFee, 0) / count,
        winRate: items.reduce((sum, item) => sum + item.winRate, 0) / count,
        maxDrawdown: items.reduce((sum, item) => sum + item.maxDrawdown, 0) / count,
        sharpeRatio: items.reduce((sum, item) => sum + item.sharpeRatio, 0) / count,
        annualizedReturn: items.reduce((sum, item) => sum + (item.annualizedReturn || 0), 0) / count,
        // 新增字段的聚合计算
        calmarRatio: items.reduce((sum, item) => sum + (item.calmarRatio || 0), 0) / count,
        sortinoRatio: items.reduce((sum, item) => sum + (item.sortinoRatio || 0), 0) / count,
        averageProfit: items.reduce((sum, item) => sum + item.averageProfit, 0) / count,

        profitableTrades: Math.round(items.reduce((sum, item) => sum + item.profitableTrades, 0) / count),
        unprofitableTrades: Math.round(items.reduce((sum, item) => sum + item.unprofitableTrades, 0) / count),
        maximumLoss: items.reduce((sum, item) => sum + (item.maximumLoss || 0), 0) / count,
        maxDrawdownPeriod: items.reduce((sum, item) => sum + (item.maxDrawdownPeriod || 0), 0) / count,
        maximumLossPeriod: items.reduce((sum, item) => sum + (item.maximumLossPeriod || 0), 0) / count,
      };

      // 根据聚合维度设置显示名称
      switch (dimension) {
        case 'symbol':
          aggregated.strategyName = `${key}的平均值 (${count}个回测)`;
          break;
        case 'intervalVal':
          aggregated.strategyName = `${key}周期的平均值 (${count}个回测)`;
          break;
        case 'strategyName':
          // 策略聚合时，保留原始策略代码，但在显示时使用策略名称
          aggregated.strategyName = key; // 保留原始策略代码
          aggregated.strategyParams = JSON.stringify({
            aggregated: `${getStrategyDisplayName(key)}的平均值 (${count}个回测)`
          });
          break;
      }

      return aggregated;
    });
  };

  // 获取唯一的筛选选项
  const getUniqueValues = (field: keyof BacktestSummary) => {
    const values = new Set<string>();
    backtestSummaries.forEach(item => {
      if (typeof item[field] === 'string') {
        values.add(item[field] as string);
      }
    });
    // 自然排序
    return Array.from(values).sort((a, b) => {
      // 如果是策略代码，尝试提取数字部分进行排序
      if (field === 'strategyName') {
        const numA = a.match(/\d+/);
        const numB = b.match(/\d+/);
        if (numA && numB) {
          return parseInt(numA[0]) - parseInt(numB[0]);
        }
      }
      return a.localeCompare(b, 'zh-CN');
    });
  };

  // 页面处理函数
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // 计算总页数
  const totalPages = Math.ceil(filteredData.length / pageSize);

  // 获取当前页的数据
  const currentPageData = filteredData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="backtest-summary-page">
      {error && <div className="error-message">{error}</div>}

      {/* 过滤器 */}
      <div className="filters-container">
        {/* 关键词搜索框 */}
        <div className="filter-item search-item">
          <label>关键词搜索:</label>
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="输入关键词搜索..."
            className="search-input"
          />
        </div>
        <div className="filter-item">
          <label>交易对:</label>
          <select
            value={filters.symbol}
            onChange={(e) => handleFilterChange('symbol', e.target.value)}
          >
            <option value="">全部交易对</option>
            {getUniqueValues('symbol').map(value => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </div>
        <div className="filter-item">
          <label>时间周期:</label>
          <select
            value={filters.intervalVal}
            onChange={(e) => handleFilterChange('intervalVal', e.target.value)}
          >
            <option value="">全部时间周期</option>
            {getUniqueValues('intervalVal').map(value => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </div>
        <div className="filter-item">
          <label>策略:</label>
          <select
            value={filters.strategyName}
            onChange={(e) => handleFilterChange('strategyName', e.target.value)}
          >
            <option value="">全部策略</option>
            {getUniqueValues('strategyName').map(value => (
              <option key={value} value={value}>{getStrategyDisplayName(value)}</option>
            ))}
          </select>
        </div>
        <div className="filter-item">
          <label>聚合维度:</label>
          <select
            value={aggregationDimension}
            onChange={(e) => setAggregationDimension(e.target.value as AggregationDimension)}
          >
            <option value="">不聚合</option>
            <option value="strategyName">按策略聚合</option>
            <option value="symbol">按交易对聚合</option>
            <option value="intervalVal">按时间周期聚合</option>

          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-indicator">加载中...</div>
      ) : filteredData.length === 0 ? (
        <div className="no-data-message">暂无回测数据</div>
      ) : (
        <div className="summary-table-container">
          <table className="summary-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('id')} className="sortable-header">
                  ID {renderSortIcon('id')}
                </th>
                <th onClick={() => handleSort('symbol')} className="sortable-header">
                  交易对 {renderSortIcon('symbol')}
                </th>
                <th onClick={() => handleSort('intervalVal')} className="sortable-header">
                  时间周期 {renderSortIcon('intervalVal')}
                </th>
                <th onClick={() => handleSort('strategyName')} className="sortable-header">
                  策略 {renderSortIcon('strategyName')}
                </th>
                <th onClick={() => handleSort('startTime')} className="sortable-header">
                  开始时间 {renderSortIcon('startTime')}
                </th>
                <th onClick={() => handleSort('endTime')} className="sortable-header">
                  结束时间 {renderSortIcon('endTime')}
                </th>
                <th onClick={() => handleSort('initialAmount')} className="sortable-header">
                  初始资金 {renderSortIcon('initialAmount')}
                </th>
                <th onClick={() => handleSort('finalAmount')} className="sortable-header">
                  最终资金 {renderSortIcon('finalAmount')}
                </th>
                <th onClick={() => handleSort('totalProfit')} className="sortable-header">
                  总收益 {renderSortIcon('totalProfit')}
                </th>
                <th onClick={() => handleSort('totalReturn')} className="sortable-header">
                  收益率 {renderSortIcon('totalReturn')}
                </th>
                <th onClick={() => handleSort('annualizedReturn')} className="sortable-header">
                  年化收益率 {renderSortIcon('annualizedReturn')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('annualizedReturn', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>
                <th onClick={() => handleSort('comprehensiveScore')} className="sortable-header">
                  综合评分 {renderSortIcon('comprehensiveScore')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('comprehensiveScore', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>
                <th onClick={() => handleSort('totalFee')} className="sortable-header">
                  手续费 {renderSortIcon('totalFee')}
                </th>
                <th onClick={() => handleSort('feeRate')} className="sortable-header">
                  手续费率 {renderSortIcon('feeRate')}
                </th>
                <th onClick={() => handleSort('numberOfTrades')} className="sortable-header">
                  交易次数 {renderSortIcon('numberOfTrades')}
                </th>
                <th onClick={() => handleSort('averageProfit')} className="sortable-header">
                  平均收益 {renderSortIcon('averageProfit')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('averageProfit', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>
                <th onClick={() => handleSort('winRate')} className="sortable-header">
                  胜率 {renderSortIcon('winRate')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('winRate', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>
                <th onClick={() => handleSort('maxDrawdownPeriod')} className="sortable-header">
                  价格最大回撤 {renderSortIcon('maxDrawdownPeriod')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('maxDrawdown', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>
                <th onClick={() => handleSort('maximumLossPeriod')} className="sortable-header">
                  价格最大损失 {renderSortIcon('maximumLossPeriod')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('maximumLoss', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>
                <th onClick={() => handleSort('maxDrawdown')} className="sortable-header">
                  资金最大回撤 {renderSortIcon('maxDrawdown')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('maxDrawdown', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>
                <th onClick={() => handleSort('maximumLoss')} className="sortable-header">
                  资金最大损失 {renderSortIcon('maximumLoss')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('maximumLoss', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>

                <th onClick={() => handleSort('sharpeRatio')} className="sortable-header">
                  夏普比率 {renderSortIcon('sharpeRatio')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('sharpeRatio', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>
                <th onClick={() => handleSort('calmarRatio')} className="sortable-header">
                  卡玛比率 {renderSortIcon('calmarRatio')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('calmarRatio', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>
                <th onClick={() => handleSort('sortinoRatio')} className="sortable-header">
                  索提诺比率 {renderSortIcon('sortinoRatio')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('sortinoRatio', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>

                <th onClick={() => handleSort('treynorRatio')} className="sortable-header">
                  特雷诺比率 {renderSortIcon('treynorRatio')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('treynorRatio', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>

                <th onClick={() => handleSort('omega')} className="sortable-header">
                  Omega比率 {renderSortIcon('omega')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('omega', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>
                <th onClick={() => handleSort('profitFactor')} className="sortable-header">
                  盈利因子 {renderSortIcon('profitFactor')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('profitFactor', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>
                <th onClick={() => handleSort('skewness')} className="sortable-header">
                  偏度 {renderSortIcon('skewness')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('skewness', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>
                <th onClick={() => handleSort('ulcerIndex')} className="sortable-header">
                  溃疡指数 {renderSortIcon('ulcerIndex')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('ulcerIndex', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>
                <th onClick={() => handleSort('painIndex')} className="sortable-header">
                  痛苦指数 {renderSortIcon('painIndex')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('painIndex', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>
                <th onClick={() => handleSort('burkeRatio')} className="sortable-header">
                  伯克比率 {renderSortIcon('burkeRatio')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('burkeRatio', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>

                <th onClick={() => handleSort('cvar')} className="sortable-header">
                  CVaR {renderSortIcon('cvar')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('cvar', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>
                <th onClick={() => handleSort('downsideDeviation')} className="sortable-header">
                  下行偏差 {renderSortIcon('downsideDeviation')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('downsideDeviation', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>
                <th onClick={() => handleSort('downtrendCapture')} className="sortable-header">
                  下跌捕获比率 {renderSortIcon('downtrendCapture')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('downtrendCapture', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>
                <th onClick={() => handleSort('uptrendCapture')} className="sortable-header">
                  上涨捕获比率 {renderSortIcon('uptrendCapture')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('uptrendCapture', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>
                <th onClick={() => handleSort('informationRatio')} className="sortable-header">
                  信息比率 {renderSortIcon('informationRatio')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('informationRatio', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>
                <th onClick={() => handleSort('kurtosis')} className="sortable-header">
                  峰度 {renderSortIcon('kurtosis')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('kurtosis', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>
                <th onClick={() => handleSort('maxDrawdownDuration')} className="sortable-header">
                  最大回撤持续天数 {renderSortIcon('maxDrawdownDuration')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('maxDrawdownDuration', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>
                <th onClick={() => handleSort('modifiedSharpeRatio')} className="sortable-header">
                  修正夏普比率 {renderSortIcon('modifiedSharpeRatio')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('modifiedSharpeRatio', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>

                <th onClick={() => handleSort('riskAdjustedReturn')} className="sortable-header">
                  风险调整收益 {renderSortIcon('riskAdjustedReturn')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('riskAdjustedReturn', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>
                <th onClick={() => handleSort('sterlingRatio')} className="sortable-header">
                  斯特林比率 {renderSortIcon('sterlingRatio')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('sterlingRatio', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>
                <th onClick={() => handleSort('trackingError')} className="sortable-header">
                  跟踪误差 {renderSortIcon('trackingError')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('trackingError', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>

                <th onClick={() => handleSort('var95')} className="sortable-header">
                  VaR95% {renderSortIcon('var95')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('var95', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>
                <th onClick={() => handleSort('var99')} className="sortable-header">
                  VaR99% {renderSortIcon('var99')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('var99', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>
                <th onClick={() => handleSort('alpha')} className="sortable-header">
                  Alpha系数 {renderSortIcon('alpha')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('alpha', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>
                <th onClick={() => handleSort('beta')} className="sortable-header">
                  Beta系数 {renderSortIcon('beta')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('beta', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th>
                {/* <th onClick={() => handleSort('volatility')} className="sortable-header">
                  波动率 {renderSortIcon('volatility')}
                  <span
                    className="info-icon"
                    onClick={(e) => { e.stopPropagation(); showTooltip('volatility', e); }}
                    onMouseLeave={hideTooltip}
                  >
                    ⓘ
                  </span>
                </th> */}
                <th onClick={() => handleSort('createTime')} className="sortable-header">
                  创建时间 {renderSortIcon('createTime')}
                </th>
                <th className="actions-column">操作</th>
              </tr>
            </thead>
            <tbody>
              {currentPageData.map((summary) => (
                <tr key={summary.id || summary.backtestId} className={summary.id === 0 ? 'aggregated-row' : ''}>
                  <td>{summary.id || '聚合'}</td>
                  <td>{summary.symbol}</td>
                  <td>{summary.intervalVal}</td>
                  <td>{summary.id === 0 && summary.strategyParams && JSON.parse(summary.strategyParams).aggregated ?
                      JSON.parse(summary.strategyParams).aggregated :
                      getStrategyDisplayName(summary.strategyName)}</td>
                  <td>{summary.id === 0 ? '-' : summary.startTime.substring(0, 10)}</td>
                  <td>{summary.id === 0 ? '-' : summary.endTime.substring(0, 10)}</td>
                  <td>{formatAmount(summary.initialAmount)}</td>
                  <td>{formatAmount(summary.finalAmount)}</td>
                  <td>{formatAmount(summary.totalProfit)}</td>
                  <td>
                    {formatPercentage(summary.totalReturn * 100)}
                  </td>
                  <td className={getValueColorClass(summary.annualizedReturn)}>{summary.annualizedReturn !== null && summary.annualizedReturn !== undefined ? formatPercentage(summary.annualizedReturn * 100) : ''}</td>
                  <td>{summary.comprehensiveScore ? summary.comprehensiveScore.toFixed(2) : '-'}</td>
                  <td>{formatAmount(summary.totalFee)}</td>
                  <td>{((summary.totalFee / summary.initialAmount) * 100).toFixed(2)}%</td>
                  <td>{summary.numberOfTrades}</td>
                  <td>{(summary.averageProfit * 100).toFixed(2)}%</td>
                  <td>{summary.winRate ? formatPercentage(summary.winRate * 100) : '-'} </td>
                  <td>{summary.maxDrawdownPeriod ? formatPercentage(Number(summary.maxDrawdownPeriod) * 100) : '-'}</td>
                  <td>{summary.maximumLossPeriod ? formatPercentage(Number(summary.maximumLossPeriod) * 100) : '-'}</td>
                  <td>{summary.maxDrawdown ? formatPercentage(summary.maxDrawdown * 100) : '-'}</td>
                  <td>{summary.maximumLoss ? (summary.maximumLoss * 100).toFixed(2) + '%' : '-'}</td>
                  <td>{summary.sharpeRatio.toFixed(2)}</td>
                  <td>{summary.calmarRatio ? summary.calmarRatio.toFixed(2) : '-'}</td>
                  <td>{summary.sortinoRatio ? summary.sortinoRatio.toFixed(2) : '-'}</td>

                  <td>{summary.treynorRatio ? summary.treynorRatio.toFixed(4) : '-'}</td>

                  <td>{summary.omega ? summary.omega.toFixed(4) : '-'}</td>
                  <td>{summary.profitFactor ? summary.profitFactor.toFixed(4) : '-'}</td>
                  <td>{summary.skewness ? summary.skewness.toFixed(4) : '-'}</td>
                  <td>{summary.ulcerIndex ? summary.ulcerIndex.toFixed(2) : '-'}</td>
                  <td>{summary.painIndex ? summary.painIndex.toFixed(4) : '-'}</td>
                  <td>{summary.burkeRatio ? summary.burkeRatio.toFixed(4) : '-'}</td>

                  <td>{summary.cvar ? summary.cvar.toFixed(4) : '-'}</td>
                  <td>{summary.downsideDeviation ? summary.downsideDeviation.toFixed(4) : '-'}</td>
                  <td>{summary.downtrendCapture ? summary.downtrendCapture.toFixed(4) : '-'}</td>
                  <td>{summary.uptrendCapture ? summary.uptrendCapture.toFixed(4) : '-'}</td>
                  <td>{summary.informationRatio ? summary.informationRatio.toFixed(4) : '-'}</td>
                  <td>{summary.kurtosis ? summary.kurtosis.toFixed(4) : '-'}</td>
                  <td>{summary.maxDrawdownDuration ? summary.maxDrawdownDuration : '-'}</td>
                  <td>{summary.modifiedSharpeRatio ? summary.modifiedSharpeRatio.toFixed(4) : '-'}</td>

                  <td>{summary.riskAdjustedReturn ? summary.riskAdjustedReturn.toFixed(4) : '-'}</td>
                  <td>{summary.sterlingRatio ? summary.sterlingRatio.toFixed(4) : '-'}</td>
                  <td>{summary.trackingError ? summary.trackingError.toFixed(4) : '-'}</td>

                  <td>{summary.var95 ? summary.var95.toFixed(4) : '-'}</td>
                  <td>{summary.var99 ? summary.var99.toFixed(4) : '-'}</td>
                  <td>{summary.alpha ? summary.alpha.toFixed(4) : '-'}</td>
                  <td>{summary.beta ? summary.beta.toFixed(4) : '-'}</td>
                  {/* <td>{summary.volatility ? summary.volatility.toFixed(4) : '-'}</td> */}
                  <td>{summary.id === 0 ? '-' : summary.createTime.substring(0, 10)}</td>
                  <td className="actions-cell">
                    {summary.id !== 0 && (
                      <>
                        <Link
                          to={`/backtest-detail/${summary.backtestId}`}
                          className="detail-button"
                        >
                          详情
                        </Link>
                        <button
                          onClick={() => handleGoLive(summary)}
                          className="live-button"
                          title="使用此回测参数创建实时策略"
                        >
                          上线
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 分页控制 */}
      {filteredData.length > 0 && (
        <div className="pagination-container">
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
            {currentPage} / {totalPages} 页 (共 {filteredData.length} 条记录)
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
      )}

      {/* 指标说明悬浮窗 */}
      {tooltip.visible && (
        <div
          className="tooltip"
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            zIndex: 1000,
            backgroundColor: '#333',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            maxWidth: '300px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            pointerEvents: 'none',
            whiteSpace: 'pre-line',
            lineHeight: '1.4'
          }}
          dangerouslySetInnerHTML={{
            __html: tooltip.content
              .replace(/\n/g, '<br/>')
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          }}
        >
        </div>
      )}
    </div>
  );
};

export default BacktestSummaryPage;
