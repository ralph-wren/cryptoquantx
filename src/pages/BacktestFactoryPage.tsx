import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchBacktestStrategies, createBacktest, deleteStrategy, generateStrategy, updateStrategy, fetchStrategyMaxReturns, getDefaultDateRange, getYesterdayDateString, updateIndicatorDistributions } from '../services/api';
import ConfirmModal from '../components/ConfirmModal/ConfirmModal';
import GenerateStrategyModal from '../components/GenerateStrategyModal/GenerateStrategyModal';
import ResultModal from '../components/ResultModal/ResultModal';
import CodeModal from '../components/CodeModal/CodeModal';
import StrategyDetailModal from '../components/StrategyDetailModal/StrategyDetailModal';
import { Strategy, StrategyMap, ParsedParams, StrategyParam } from '../types/strategy';
import { useAdaptivePagination } from '../hooks/useAdaptivePagination';
import './BacktestFactoryPage.css';

const BacktestFactoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [strategies, setStrategies] = useState<StrategyMap>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<string>('');
  const [strategyCategories, setStrategyCategories] = useState<string[]>([]);
  const [formParams, setFormParams] = useState<{[key: string]: any}>({});
  const [creatingBacktest, setCreatingBacktest] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // 回测配置
  const [symbol, setSymbol] = useState<string>('BTC-USDT');
  const [interval, setInterval] = useState<string>('1D');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [initialAmount, setInitialAmount] = useState<number>(10000);

  // 分页状态
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPageState] = useState<number>(9);
  const [totalPages, setTotalPages] = useState<number>(1);

  // 过滤和排序
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortField, setSortField] = useState<string>('updated_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [categories, setCategories] = useState<string[]>([]);
  const [hideUnavailable, setHideUnavailable] = useState<boolean>(false);

  // 缓存处理过的数据
  const [filteredStrategies, setFilteredStrategies] = useState<[string, Strategy][]>([]);

  // 自适应页大小计算
  const { pageSize: adaptivePageSize } = useAdaptivePagination({
    rowHeight: 100,
    minPageSize: 3,
    navbarHeight: 60,
    basePadding: 48,
    getOtherElementsHeight: () => {
      const filters = document.querySelector('.filters');
      const pagination = document.querySelector('.pagination-container');
      const tableHeader = document.querySelector('.strategy-header');
      
      const filtersHeight = filters ? filters.clientHeight : 100;
      const paginationHeight = pagination ? pagination.clientHeight : 60;
      const tableHeaderHeight = tableHeader ? tableHeader.clientHeight : 45; 
      
      const margins = 20;
      return filtersHeight + paginationHeight + tableHeaderHeight + margins;
    },
    dependencies: [loading, Object.keys(strategies).length]
  });

  useEffect(() => {
    if (adaptivePageSize > 0) {
      setItemsPerPageState(adaptivePageSize);
    }
  }, [adaptivePageSize]); 

  // 删除确认模态框状态
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStrategyCode, setDeleteStrategyCode] = useState<string>('');

  // 生成策略相关状态
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [strategyDescription, setStrategyDescription] = useState('');
  const [generatingStrategy, setGeneratingStrategy] = useState(false);

  // 修改策略相关状态
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateStrategyDescription, setUpdateStrategyDescription] = useState('');
  const [updatingStrategy, setUpdatingStrategy] = useState(false);
  const [currentStrategyId, setCurrentStrategyId] = useState<number | null>(null);

  // 结果弹窗状态
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultModalTitle, setResultModalTitle] = useState('');
  const [resultModalMessage, setResultModalMessage] = useState('');
  const [resultModalType, setResultModalType] = useState<'success' | 'error' | 'info'>('info');

  // 编译失败提示弹窗状态
  const [showCompileErrorModal, setShowCompileErrorModal] = useState(false);

  // 代码模态框状态
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [currentStrategyCode, setCurrentStrategyCode] = useState('');
  const [currentStrategySourceCode, setCurrentStrategySourceCode] = useState('');
  const [currentStrategyLoadError, setCurrentStrategyLoadError] = useState('');

  // 策略最高收益率相关状态
  const [strategyMaxReturns, setStrategyMaxReturns] = useState<Record<string, number>>({});
  const [isLoadingReturns, setIsLoadingReturns] = useState<boolean>(false);

  // 添加更新指标分布的状态
  const [updatingIndicators, setUpdatingIndicators] = useState<boolean>(false);

  // 策略详情模态框状态
  const [showStrategyDetailModal, setShowStrategyDetailModal] = useState(false);
  const [selectedStrategyForDetail, setSelectedStrategyForDetail] = useState<string>('');
  const [selectedStrategyNameForDetail, setSelectedStrategyNameForDetail] = useState<string>('');

  // 设置默认日期范围（使用统一的默认时间范围）
  useEffect(() => {
    const defaultRange = getDefaultDateRange();
    // 只取日期部分用于UI显示
    setStartDate(defaultRange.startDate.split(' ')[0]);
    setEndDate(defaultRange.endDate.split(' ')[0]);
  }, []);

  // 加载策略列表
  const loadStrategies = async () => {
    setLoading(true);
    try {
      const response = await fetchBacktestStrategies();
      // API返回格式: { code: 200, data: { STRATEGY_CODE: { ... } }, message: "success" }
      if (response && response.data) {
        setStrategies(response.data);

        // 提取所有策略分类
        const categorySet = new Set<string>();
        Object.values(response.data).forEach((strategy: any) => {
          if (strategy && typeof strategy === 'object' && 'category' in strategy && typeof strategy.category === 'string') {
            categorySet.add(strategy.category);
          }
        });
        setCategories(['全部', ...Array.from(categorySet)]);

        // 如果有策略，默认选择第一个
        const strategyKeys = Object.keys(response.data);
        if (strategyKeys.length > 0) {
          const firstStrategy = strategyKeys[0];
          setSelectedStrategy(firstStrategy);

          // 设置默认参数值
          if (response.data[firstStrategy] && response.data[firstStrategy].default_params) {
            try {
              // 检查default_params是否为undefined或空字符串
              const defaultParamsStr = response.data[firstStrategy].default_params;
              if (!defaultParamsStr) {
                setFormParams({});
              } else {
                const defaultParams = JSON.parse(defaultParamsStr);
                setFormParams(defaultParams);
              }
            } catch (err) {
              console.error('解析默认参数失败:', err);
              setFormParams({});
            }
          }
        }
      } else {
        setError('获取策略数据失败，API返回格式不正确');
      }
    } catch (err) {
      setError('加载回测策略失败，请稍后重试');
      console.error('加载回测策略失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 加载策略最高收益率
  const loadStrategyMaxReturns = async () => {
    setIsLoadingReturns(true);
    try {
      const maxReturns = await fetchStrategyMaxReturns();
      setStrategyMaxReturns(maxReturns);
    } catch (error) {
      console.error('加载策略最高收益率失败:', error);
    } finally {
      setIsLoadingReturns(false);
    }
  };

  useEffect(() => {
    loadStrategies();
    loadStrategyMaxReturns();
  }, []);

  // 当选择的策略变化时，更新表单参数
  useEffect(() => {
    if (selectedStrategy && strategies[selectedStrategy]) {
      try {
        // 检查default_params是否为undefined或null
        const defaultParamsStr = strategies[selectedStrategy].default_params;
        if (!defaultParamsStr) {
          // 如果default_params为undefined或空字符串，使用空对象
          setFormParams({});
          return;
        }
        const defaultParams = JSON.parse(defaultParamsStr);
        setFormParams(defaultParams);
      } catch (err) {
        console.error('解析默认参数失败:', err);
        setFormParams({});
      }
    }
  }, [selectedStrategy, strategies]);

  // 处理过滤和排序，仅在相关依赖变化时执行
  useEffect(() => {
    const getFilteredAndSortedStrategies = () => {
      let result = Object.entries(strategies);

      // 先按分类过滤
      if (selectedCategory) {
        result = result.filter(([_, strategy]) => strategy.category === selectedCategory);
      }

      // 过滤不可用的策略
      if (hideUnavailable) {
        result = result.filter(([_, strategy]) => strategy.available !== false);
      }

      // 再按搜索词过滤
      if (searchTerm) {
        const searchTermLower = searchTerm.toLowerCase();
        result = result.filter(([code, strategy]) =>
          code.toLowerCase().includes(searchTermLower) ||
          strategy.name.toLowerCase().includes(searchTermLower) ||
          strategy.description.toLowerCase().includes(searchTermLower)
        );
      }

      // 按字段排序
      result.sort((a, b) => {
        const strategyA = a[1];
        const strategyB = b[1];

        let valueA: any, valueB: any;

        switch (sortField) {
          case 'code':
            valueA = a[0];
            valueB = b[0];
            break;
          case 'name':
            valueA = strategyA.name;
            valueB = strategyB.name;
            break;
          case 'category':
            valueA = strategyA.category;
            valueB = strategyB.category;
            break;
          case 'max_return':
            // 处理最高收益率排序
            valueA = strategyA.best_return || 0;
            valueB = strategyB.best_return || 0;
            break;
          case 'updated_at':
            // 处理更新时间排序，如果没有更新时间则使用最小值
            valueA = strategyA.update_time ? new Date(strategyA.update_time).getTime() : 0;
            valueB = strategyB.update_time ? new Date(strategyB.update_time).getTime() : 0;
            break;
          default:
            valueA = strategyA.name;
            valueB = strategyB.name;
        }

        if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
        if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });

      // 计算总页数，但不在这里设置状态，避免循环
      const calculatedTotalPages = Math.ceil(result.length / itemsPerPage);

      // 检查当前页是否超出新的总页数
      const newCurrentPage = Math.min(currentPage, Math.max(1, calculatedTotalPages));

      // 返回分页结果
      const startIndex = (newCurrentPage - 1) * itemsPerPage;

      // 保存结果和元数据
      setFilteredStrategies(result.slice(startIndex, startIndex + itemsPerPage));
      setTotalPages(calculatedTotalPages);

      // 如果当前页超出新的总页数，更新当前页
      if (currentPage !== newCurrentPage) {
        setCurrentPage(newCurrentPage);
      }
    };

    getFilteredAndSortedStrategies();
  }, [strategies, searchTerm, sortField, sortDirection, selectedCategory, itemsPerPage, currentPage, hideUnavailable]);

  // 解析JSON字符串为对象
  const parseJsonString = (jsonString: string): any => {
    try {
      // 检查jsonString是否为undefined或null
      if (!jsonString) {
        return {};
      }
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('解析JSON失败:', error);
      return {};
    }
  };

  // 处理表单参数变化
  const handleParamChange = (key: string, value: string) => {
    setFormParams(prev => ({
      ...prev,
      [key]: isNaN(Number(value)) ? value : Number(value)
    }));
  };

  // 处理创建回测
  const handleCreateBacktest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStrategy) {
      setStatusMessage('请选择策略');
      return;
    }

    if (!startDate || !endDate) {
      setStatusMessage('请设置开始和结束日期');
      return;
    }

    setCreatingBacktest(true);
    setStatusMessage('创建回测中...');

    try {
      const result = await createBacktest(
        symbol,
        interval,
        selectedStrategy,
        formParams,
        startDate,
        endDate,
        initialAmount
      );

      if (result.success) {
        setStatusMessage('回测创建成功!');
        // 如果创建成功，跳转到回测汇总页面
        setTimeout(() => {
          navigate('/backtest-summaries');
        }, 1500);
      } else {
        setStatusMessage(`创建失败: ${result.message}`);
      }
    } catch (error) {
      console.error('创建回测出错:', error);
      setStatusMessage('创建回测出错，请稍后重试');
    } finally {
      setCreatingBacktest(false);
    }
  };

  // 渲染策略卡片
  const renderStrategyCard = (strategyCode: string, strategy: Strategy) => {
    const isSelected = selectedStrategy === strategyCode;

    return (
      <div
        key={strategyCode}
        className={`strategy-card ${isSelected ? 'selected' : ''}`}
        onClick={() => setSelectedStrategy(strategyCode)}
      >
        <h3>{strategy.name}</h3>
        <p className="strategy-description">{strategy.description}</p>
        <div className="strategy-code">{strategyCode}</div>
      </div>
    );
  };

  // 渲染策略参数表单
  const renderStrategyParams = () => {
    if (!selectedStrategy || !strategies[selectedStrategy]) {
      return null;
    }

    const strategy = strategies[selectedStrategy];
    const params = parseJsonString(strategy.params);

    return (
      <div className="strategy-params">
        <h3>{strategy.name} - 参数配置</h3>
        <p>{strategy.description}</p>

        <form className="params-form" onSubmit={handleCreateBacktest}>
          <div className="backtest-config-section">
            <h4>回测配置</h4>

            <div className="param-group">
              <label htmlFor="symbol">交易对:</label>
              <select
                id="symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
              >
                <option value="BTC-USDT">BTC-USDT</option>
                <option value="ETH-USDT">ETH-USDT</option>
                <option value="BNB-USDT">BNB-USDT</option>
              </select>
            </div>

            <div className="param-group">
              <label htmlFor="interval">K线周期:</label>
              <select
                id="interval"
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
              >
                <option value="1m">1分钟</option>
                <option value="5m">5分钟</option>
                <option value="15m">15分钟</option>
                <option value="30m">30分钟</option>
                <option value="1h">1小时</option>
                <option value="4h">4小时</option>
                <option value="1D">日线</option>
                <option value="1W">周线</option>
              </select>
            </div>

            <div className="param-group">
              <label htmlFor="startDate">开始日期:</label>
              <input
                type="date"
                id="startDate"
                value={startDate}
                max={getYesterdayDateString()}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="param-group">
              <label htmlFor="endDate">结束日期:</label>
              <input
                type="date"
                id="endDate"
                value={endDate}
                max={getYesterdayDateString()}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="param-group">
              <label htmlFor="initialAmount">初始资金:</label>
              <input
                type="number"
                id="initialAmount"
                value={initialAmount}
                onChange={(e) => setInitialAmount(Number(e.target.value))}
                min="1000"
              />
            </div>
          </div>

          <div className="strategy-params-section">
            <h4>策略参数</h4>
            {Object.entries(params).map(([key, description]) => (
              <div key={key} className="param-group">
                <label htmlFor={key}>{String(description)}:</label>
                <input
                  type="number"
                  id={key}
                  name={key}
                  value={formParams[key] || ''}
                  onChange={(e) => handleParamChange(key, e.target.value)}
                />
              </div>
            ))}
          </div>

          {statusMessage && (
            <div className={`status-message ${creatingBacktest ? 'loading' : ''}`}>
              {statusMessage}
            </div>
          )}

          <button
            type="submit"
            className="create-backtest-btn"
            disabled={creatingBacktest}
          >
            {creatingBacktest ? '创建中...' : '创建回测'}
          </button>
        </form>
      </div>
    );
  };

  // 按分类渲染策略列表
  const renderStrategiesByCategory = () => {
    return strategyCategories.map(category => (
      <div key={category} className="strategy-category-section">
        <h2 className="category-title">{category}</h2>
        <div className="strategy-cards-container">
          {Object.entries(strategies)
            .filter(([_, strategy]) => strategy.category === category)
            .map(([strategyCode, strategy]) => renderStrategyCard(strategyCode, strategy))}
        </div>
      </div>
    ));
  };

  // 跳转到策略详情/创建回测页面
  const handleViewStrategy = (strategyCode: string) => {
    const strategy = strategies[strategyCode];

    // 检查策略是否可用（将字符串转换为布尔值）
    if (strategy && strategy.available === false ) {
      // 如果策略不可用，显示编译失败提示弹窗
      setShowCompileErrorModal(true);
      return;
    }

    // 跳转到首页并在URL中传递策略代码参数
    navigate(`/?strategy=${strategyCode}`);
  };

  // 删除策略
  const handleDeleteStrategy = (strategyCode: string) => {
    setDeleteStrategyCode(strategyCode);
    setShowDeleteModal(true);
  };

  const confirmDeleteStrategy = async () => {
    try {
      const result = await deleteStrategy(deleteStrategyCode);

      if (result.success) {
        setStatusMessage('策略删除成功!');
        // 重新加载策略列表
        loadStrategies();
      } else {
        setStatusMessage(`删除失败: ${result.message}`);
      }
    } catch (error) {
      console.error('删除策略出错:', error);
      setStatusMessage('删除策略出错，请稍后重试');
    } finally {
      setShowDeleteModal(false);
      setDeleteStrategyCode('');
    }
  };

  const cancelDeleteStrategy = () => {
    setShowDeleteModal(false);
    setDeleteStrategyCode('');
  };

  // 处理查看代码
  const handleViewCode = (strategyCode: string) => {
    const strategy = strategies[strategyCode];
    if (strategy && strategy.source_code) {
      setCurrentStrategyCode(strategyCode);
      setCurrentStrategySourceCode(strategy.source_code);
      setCurrentStrategyLoadError(strategy.load_error || '');
      setShowCodeModal(true);
    } else {
      showResult('代码不可用', '该策略暂无可用的源代码', 'error');
    }
  };

  // 关闭代码模态框
  const closeCodeModal = () => {
    setShowCodeModal(false);
    setCurrentStrategyCode('');
    setCurrentStrategySourceCode('');
    setCurrentStrategyLoadError('');
  };

  // 处理生成策略
  const handleGenerateStrategy = async () => {
    if (!strategyDescription.trim()) {
      setStatusMessage('请输入策略描述');
      return;
    }

    setGeneratingStrategy(true);
    setStatusMessage('正在生成策略...');

    try {
      const result = await generateStrategy(strategyDescription);

      if (result.success) {
        // 策略生成成功，先关闭生成策略弹窗
        setShowGenerateModal(false);
        
        // 显示详细的返回信息
        let message = '';
        let resultType: 'success' | 'error' | 'info' = 'success';
        
        // 优先显示服务器返回的message（包含编译失败警告）
        if (result.message && result.message !== 'SUCCESS') {
          message = result.message;
          // 如果消息中包含"编译失败"，使用警告类型
          if (message.includes('编译失败')) {
            resultType = 'error';
          }
        } else {
          message = '策略生成成功!';
        }
        
        if (result.data) {
          try {
            let strategyData;
            
            // 解析数据
            if (typeof result.data === 'string') {
              strategyData = JSON.parse(result.data);
            } else if (Array.isArray(result.data)) {
              strategyData = result.data[0]; // 取第一个策略
            } else if (typeof result.data === 'object') {
              strategyData = result.data;
            }
            
            // 检查是否有加载错误
            if (strategyData && strategyData.loadError) {
              message = `策略已保存但编译失败!\n\n错误信息: ${strategyData.loadError}`;
              resultType = 'error';
            } else if (strategyData) {
              // 格式化显示策略信息，去掉id和sourceCode字段
              const { id, sourceCode, source_code, loadError, load_error, ...displayData } = strategyData;
              message += `\n\n策略信息:\n${JSON.stringify(displayData, null, 2)}`;
            }
          } catch (error) {
            console.error('解析策略数据出错:', error);
            if (typeof result.data === 'string') {
              message += `\n\n生成的策略:\n${result.data}`;
            } else {
              message += `\n\n返回数据:\n${JSON.stringify(result.data, null, 2)}`;
            }
          }
        }

        // 使用ResultModal显示详细信息
        showResult(resultType === 'error' ? '策略生成警告' : '策略生成成功', message, resultType);

        setStatusMessage(resultType === 'error' ? '策略已保存但编译失败' : '策略生成成功!');
        setStrategyDescription('');
        // 重新加载策略列表
        loadStrategies();
      } else {
        const errorMessage = `生成失败: ${result.message || '未知错误'}`;
        setStatusMessage(errorMessage);
        showResult('策略生成失败', errorMessage, 'error');
      }
    } catch (error) {
      console.error('生成策略出错:', error);
      const errorMessage = '生成策略出错，请稍后重试';
      setStatusMessage(errorMessage);
      showResult('策略生成错误', errorMessage, 'error');
    } finally {
      setGeneratingStrategy(false);
    }
  };

  // 取消生成策略
  const cancelGenerateStrategy = () => {
    setShowGenerateModal(false);
    setStrategyDescription('');
  };

  // 处理修改策略
  const handleUpdateStrategy = async () => {
    if (!updateStrategyDescription.trim()) {
      showResult('输入错误', '请输入策略描述', 'error');
      return;
    }

    if (!currentStrategyId) {
      showResult('错误', '未选择策略', 'error');
      return;
    }

    setUpdatingStrategy(true);
    try {
      const result = await updateStrategy(currentStrategyId, updateStrategyDescription);

      if (result.success) {
        setShowUpdateModal(false);
        setUpdateStrategyDescription('');
        setCurrentStrategyId(null);
        
        // 检查是否有编译失败的警告
        let resultType: 'success' | 'error' | 'info' = 'success';
        let title = '策略修改成功';
        let message = '';
        
        // 优先显示服务器返回的message（包含编译失败警告）
        if (result.message && result.message !== 'SUCCESS') {
          message = result.message + '\n\n';
          // 如果消息中包含"编译失败"，使用警告类型
          if (message.includes('编译失败')) {
            resultType = 'error';
            title = '策略修改警告';
          }
        }
        
        // 显示策略详细信息
        const strategyData = result.data;
        message += `策略名称: ${strategyData.strategyName}
分类: ${strategyData.category}
描述: ${strategyData.description}
评论: ${strategyData.comments}
更新时间: ${strategyData.updateTime}`;
        
        showResult(title, message, resultType);
        // 刷新策略列表
        await loadStrategies();
      } else {
        showResult('策略修改失败', result.message || '修改策略失败，请稍后重试', 'error');
      }
    } catch (error) {
      console.error('修改策略出错:', error);
      const errorMessage = '修改策略出错，请稍后重试';
      showResult('策略修改错误', errorMessage, 'error');
    } finally {
      setUpdatingStrategy(false);
    }
  };

  // 取消修改策略
  const cancelUpdateStrategy = () => {
    setShowUpdateModal(false);
    setUpdateStrategyDescription('');
    setCurrentStrategyId(null);
  };

  // 打开修改策略模态框
  const openUpdateModal = (strategyId: number) => {
    setCurrentStrategyId(strategyId);
    setShowUpdateModal(true);
  };

  // 显示结果弹窗
  const showResult = (title: string, message: string, type: 'success' | 'error' | 'info') => {
    setResultModalTitle(title);
    setResultModalMessage(message);
    setResultModalType(type);
    setShowResultModal(true);
  };

  // 关闭结果弹窗
  const closeResultModal = () => {
    setShowResultModal(false);
  };

  // 处理搜索
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  // 处理排序
  const handleSort = (field: string) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  // 处理分类筛选
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category === '全部' ? '' : category);
    setCurrentPage(1);
  };

  // 生成分页控件 - 与历史回测页面保持一致
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      // 滚动到顶部
      const listContainer = document.querySelector('.strategy-body');
      if (listContainer) {
        listContainer.scrollTop = 0;
      }
    }
  };

  const renderPagination = () => {
    // 重新计算总数以确保准确性
    const totalRecords = Object.entries(strategies).filter(([code, strategy]) => {
      let matches = true;
      if (selectedCategory) {
        matches = matches && strategy.category === selectedCategory;
      }
      if (searchTerm) {
        const searchTermLower = searchTerm.toLowerCase();
        matches = matches && (
          code.toLowerCase().includes(searchTermLower) ||
          strategy.name.toLowerCase().includes(searchTermLower) ||
          strategy.description.toLowerCase().includes(searchTermLower)
        );
      }
      return matches;
    }).length;

    if (totalRecords === 0) return null;

    return (
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
            {currentPage} / {totalPages} 页 (共 {totalRecords} 条记录)
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
    );
  };

  // 渲染表格头部
  const renderTableHeader = () => {
    return (
      <div className="strategy-header">
        <div
          className="strategy-cell name"
          onClick={() => handleSort('name')}
        >
          策略名称
          {sortField === 'name' && (
            <span className="sort-indicator">
              {sortDirection === 'asc' ? '↑' : '↓'}
            </span>
          )}
        </div>
        <div
          className="strategy-cell comments"
          onClick={() => handleSort('comments')}
        >
          评价
          {sortField === 'comments' && (
            <span className="sort-indicator">
              {sortDirection === 'asc' ? '↑' : '↓'}
            </span>
          )}
        </div>
        <div
          className="strategy-cell category"
          onClick={() => handleSort('category')}
        >
          分类
          {sortField === 'category' && (
            <span className="sort-indicator">
              {sortDirection === 'asc' ? '↑' : '↓'}
            </span>
          )}
        </div>
        <div className="strategy-cell description">描述</div>
        <div className="strategy-cell default-params">默认参数</div>
        <div
          className="strategy-cell updated-at"
          onClick={() => handleSort('updated_at')}
        >
          更新时间
          {sortField === 'updated_at' && (
            <span className="sort-indicator">
              {sortDirection === 'asc' ? '↑' : '↓'}
            </span>
          )}
        </div>
        <div className="strategy-cell action">操作</div>
      </div>
    );
  };

  // 渲染策略行
  const renderStrategyRow = (strategyCode: string, strategy: Strategy) => {
    // 解析并格式化默认参数
    let formattedParams = "";
    try {
      if (strategy.default_params && strategy.params) {
        const defaultParams = JSON.parse(strategy.default_params);
        const paramNames = JSON.parse(strategy.params);

        formattedParams = Object.entries(defaultParams)
          .map(([key, value]) => {
            // 使用params中的中文名称，如果不存在则使用原键名
            const displayName = paramNames[key] || key;
            return `${displayName}: ${value}`;
          })
          .join(', ');
      }
    } catch (err) {
      console.error('解析参数失败:', err);
      formattedParams = "参数解析失败";
    }

    // 处理策略名称点击事件
    const handleStrategyNameClick = () => {
      setSelectedStrategyForDetail(strategyCode);
      setSelectedStrategyNameForDetail(strategy.name);
      setShowStrategyDetailModal(true);
    };

    // 判断是否为预置策略（source_code为空或null表示预置策略）
    const isPresetStrategy = !strategy.source_code || strategy.source_code.trim() === '';

    return (
      <div key={strategyCode} className="strategy-row">
        <div className="strategy-cell name">
          {strategy.name}
          {isPresetStrategy && <span className="preset-badge" title="预置策略">📌</span>}
        </div>
        <div className="strategy-cell comments">{strategy.comments || '暂无评价'}</div>
        <div className="strategy-cell category">{strategy.category}</div>
        <div className="strategy-cell description">{strategy.description}</div>
        <div className="strategy-cell default-params">{formattedParams}</div>
        <div className="strategy-cell updated-at">
          {strategy.update_time ? new Date(strategy.update_time).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          }) : '未知'}
        </div>
        <div className="strategy-cell action">
          <button
            className="code-btn"
            onClick={() => handleViewCode(strategyCode)}
          >
            代码
          </button>
          <button
            className={`view-btn ${strategy.available === false ? 'disabled' : ''}`}
            onClick={() => handleViewStrategy(strategyCode)}
            disabled={strategy.available === false}
          >
            执行
          </button>
          <button
            className={`update-btn ${isPresetStrategy ? 'disabled' : ''}`}
            onClick={() => !isPresetStrategy && openUpdateModal(strategy.id || 0)}
            disabled={isPresetStrategy}
            title={isPresetStrategy ? '预置策略不允许更新' : '更新策略'}
          >
            更新
          </button>
          <button
            className="delete-btn"
            onClick={() => handleDeleteStrategy(strategyCode)}
          >
            删除
          </button>
        </div>
      </div>
    );
  };

  // 添加更新指标分布的处理函数
  const handleUpdateIndicatorDistributions = async () => {
    setUpdatingIndicators(true);
    try {
      const result = await updateIndicatorDistributions();
      if (result.success) {
        showResult('更新成功', result.message || '指标分布已成功更新', 'success');
      } else {
        showResult('更新失败', result.message || '指标分布更新失败', 'error');
      }
    } catch (error) {
      console.error('更新指标分布时发生错误:', error);
      showResult('更新失败', '更新指标分布时发生错误', 'error');
    } finally {
      setUpdatingIndicators(false);
    }
  };

  // 修改 renderFilters 函数，添加更新指标分布按钮
  const renderFilters = () => {
    return (
      <div className="filters">
        <div className="search-and-actions">
          <div className="search-box">
            <input
              type="text"
              placeholder="搜索策略名称或描述"
              value={searchTerm}
              onChange={handleSearch}
            />
          </div>

          <div className="action-buttons">
            <button
              className={`filter-btn ${hideUnavailable ? 'active' : ''}`}
              onClick={() => {
                // 切换状态并强制重新计算过滤结果
                setHideUnavailable(prev => !prev);
                // 重置到第一页，确保状态变化后能看到结果
                setCurrentPage(1);
              }}
            >
              {hideUnavailable ? '显示全部策略' : '隐藏不可用策略'}
            </button>
            
            <button
              className="filter-btn"
              onClick={handleUpdateIndicatorDistributions}
              disabled={updatingIndicators}
            >
              {updatingIndicators ? '更新中...' : '更新指标分布'}
            </button>
            
            <button
              className="generate-strategy-btn"
              onClick={() => setShowGenerateModal(true)}
              disabled={generatingStrategy}
            >
              {generatingStrategy ? '生成中...' : '🤖 AI生成策略'}
            </button>
          </div>
        </div>

        <div className="category-filter">
          <span>分类筛选:</span>
          <div className="category-buttons">
            {categories.map(category => (
              <button
                key={category}
                className={`category-btn ${selectedCategory === (category === '全部' ? '' : category) ? 'active' : ''}`}
                onClick={() => handleCategoryChange(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="loading-container">加载策略中...</div>;
  }

  if (error) {
    return <div className="error-container">{error}</div>;
  }

  return (
    <div className="backtest-factory-page">
      <div className="page-header">
      </div>

      {renderFilters()}

      <div className="strategy-table">
        {renderTableHeader()}

        <div className="strategy-body">
          {filteredStrategies.length > 0 ? (
            filteredStrategies.map(([code, strategy]) =>
              renderStrategyRow(code, strategy)
            )
          ) : (
            <div className="no-results">没有找到匹配的策略</div>
          )}
        </div>
      </div>

      {renderPagination()}

      {/* 确认删除模态框 */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title="确认删除策略"
        message={`确定要删除策略 "${deleteStrategyCode}" 吗？此操作不可撤销，删除后将无法恢复。`}
        confirmText="删除"
        cancelText="取消"
        type="danger"
        onConfirm={confirmDeleteStrategy}
        onCancel={cancelDeleteStrategy}
      />

      {/* 生成策略模态框 */}
      <GenerateStrategyModal
        isOpen={showGenerateModal}
        onClose={cancelGenerateStrategy}
        onConfirm={handleGenerateStrategy}
        description={strategyDescription}
        onDescriptionChange={setStrategyDescription}
        isGenerating={generatingStrategy}
      />

      {/* 修改策略模态框 */}
      <GenerateStrategyModal
        isOpen={showUpdateModal}
        onClose={cancelUpdateStrategy}
        onConfirm={handleUpdateStrategy}
        description={updateStrategyDescription}
        onDescriptionChange={setUpdateStrategyDescription}
        isGenerating={updatingStrategy}
        title="修改策略"
        confirmText="修改策略"
        loadingText="正在修改策略..."
      />

      {/* 结果显示模态框 */}
      <ResultModal
        isOpen={showResultModal}
        onClose={closeResultModal}
        title={resultModalTitle}
        message={resultModalMessage}
        type={resultModalType}
      />

      {/* 代码展示模态框 */}
      <CodeModal
        isOpen={showCodeModal}
        onClose={closeCodeModal}
        title={`策略代码 - ${strategies[currentStrategyCode]?.name || currentStrategyCode}`}
        code={currentStrategySourceCode}
        language="java"
        loadError={currentStrategyLoadError}
      />

      {/* 编译失败提示模态框 */}
      <ConfirmModal
        isOpen={showCompileErrorModal}
        onCancel={() => setShowCompileErrorModal(false)}
        onConfirm={() => setShowCompileErrorModal(false)}
        title="策略不可执行"
        message="代码编译失败，策略当前不可执行，请检查策略代码后重试。"
        confirmText="确定"
        cancelText="取消"
      />

      {/* 策略详情模态框 */}
      <StrategyDetailModal
        isOpen={showStrategyDetailModal}
        onClose={() => setShowStrategyDetailModal(false)}
        strategyCode={selectedStrategyForDetail}
        strategyName={selectedStrategyNameForDetail}
      />
    </div>
  );
};

export default BacktestFactoryPage;