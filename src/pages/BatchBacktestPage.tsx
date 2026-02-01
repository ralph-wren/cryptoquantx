import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchBatchBacktestStatistics, fetchBacktestStrategies } from '../services/api';
import { formatPercentage } from '../utils/helpers';
import { useAdaptivePagination } from '../hooks/useAdaptivePagination';
import './BatchBacktestPage.css';

interface BatchBacktestStatistics {
  symbol: string;
  start_time: string;
  end_time: string;
  batch_backtest_id: string;
  strategy_name: string;
  backtest_count: number;
  create_time: string;
  max_return: number;
  avg_return: number;
  avg_annual_return: number;
  avg_trade_num: number;
  interval_val: string;
  backtest_ids: string[];
}

interface Strategy {
  name: string;
  description: string;
  params: string;
  category?: string;
  default_params?: string;
  strategy_code?: string;
}

const BatchBacktestPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchBacktests, setBatchBacktests] = useState<BatchBacktestStatistics[]>([]);
  const [strategyMap, setStrategyMap] = useState<{[key: string]: Strategy}>({});
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(10);

  // 自适应页大小计算
  const { pageSize: adaptivePageSize } = useAdaptivePagination({
    rowHeight: 50,
    minPageSize: 5,
    navbarHeight: 60,
    basePadding: 48,
    getOtherElementsHeight: () => {
      const pagination = document.querySelector('.pagination-container');
      const tableHeaderHeight = 50;
      const paginationHeight = pagination ? pagination.clientHeight : 60;
      const margins = 40; // margin top/bottom for container
      return paginationHeight + tableHeaderHeight + margins;
    },
    dependencies: [loading, batchBacktests.length]
  });

  useEffect(() => {
    if (adaptivePageSize > 0) {
      setPageSizeState(adaptivePageSize);
    }
  }, [adaptivePageSize]);

  useEffect(() => {
    const loadBatchBacktests = async () => {
      setLoading(true);
      try {
        // 获取策略信息，用于显示中文名称
        const strategiesResponse = await fetchBacktestStrategies();
        if (strategiesResponse && strategiesResponse.data) {
          setStrategyMap(strategiesResponse.data);
        }
        
        const statistics = await fetchBatchBacktestStatistics();
        setBatchBacktests(statistics);
      } catch (err) {
        setError('获取批量回测数据失败，请稍后重试');
        console.error('获取批量回测数据失败:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadBatchBacktests();
  }, []);

  // 获取策略的中文显示名称
  const getStrategyDisplayName = (strategyCode: string): string => {
    if (strategyMap[strategyCode]) {
      return strategyMap[strategyCode].name;
    }
    return strategyCode;
  };

  // 跳转到批量回测详情页面
  const handleViewBatchDetails = (batchBacktestId: string, backtestIds: string[]) => {
    // 将回测ID列表存储到sessionStorage
    sessionStorage.setItem('backtestIds', JSON.stringify(backtestIds));
    console.log('存储批量回测IDs:', backtestIds);
    
    // 跳转到历史回测页面，并传递批次ID参数
    navigate(`/backtest-summaries?batchId=${batchBacktestId}`);
  };

  const formatPercentValue = (value: number): string => {
    return formatPercentage(value * 100);
  };

  // 格式化日期时间，只保留日期部分
  const formatDateTime = (dateTimeStr: string): string => {
    if (!dateTimeStr) return '';
    return dateTimeStr.split(' ')[0];
  };

  // 分页相关计算
  const totalPages = Math.ceil(batchBacktests.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentPageData = batchBacktests.slice(startIndex, endIndex);

  // 处理页码变化
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };


  return (
    <div className="batch-backtest-page">
      <div className="page-header">
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading-indicator">加载中...</div>
      ) : batchBacktests.length === 0 ? (
        <div className="no-data-message">暂无批量回测数据</div>
      ) : (
        <div className="batch-table-container">
          <table className="batch-table">
            <thead>
              <tr>
                <th>批次ID</th>
                <th>交易对</th>
                <th>策略名称</th>
                <th>K线周期</th>
                <th>开始时间</th>
                <th>结束时间</th>
                <th>创建时间</th>
                <th>回测数量</th>
                <th>最佳收益率</th>
                <th>平均收益率</th>
                <th>平均年化收益</th>
                <th>平均交易次数</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {currentPageData.map((batch) => (
                <tr key={batch.batch_backtest_id}>
                  <td>{batch.batch_backtest_id.substring(0, 8)}...</td>
                  <td>{batch.symbol}</td>
                  <td>{getStrategyDisplayName(batch.strategy_name)}</td>
                  <td>{batch.interval_val}</td>
                  <td>{formatDateTime(batch.start_time)}</td>
                  <td>{formatDateTime(batch.end_time)}</td>
                  <td>{formatDateTime(batch.create_time)}</td>
                  <td>{batch.backtest_count}</td>
                  <td className={batch.max_return >= 0 ? 'positive' : 'negative'}>
                    {formatPercentValue(batch.max_return)}
                  </td>
                  <td className={batch.avg_return >= 0 ? 'positive' : 'negative'}>
                    {formatPercentValue(batch.avg_return)}
                  </td>
                  <td className={batch.avg_annual_return >= 0 ? 'positive' : 'negative'}>
                    {formatPercentValue(batch.avg_annual_return)}
                  </td>
                  <td>{batch.avg_trade_num}</td>
                  <td>
                    <button 
                      className="view-details-btn"
                      onClick={() => handleViewBatchDetails(batch.batch_backtest_id, batch.backtest_ids)}
                    >
                      查看详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 分页控制 */}
      {batchBacktests.length > 0 && (
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
              {currentPage} / {totalPages} 页 (共 {batchBacktests.length} 条记录)
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
  );
};

export default BatchBacktestPage;