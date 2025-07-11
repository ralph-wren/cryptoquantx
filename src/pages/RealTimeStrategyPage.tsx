import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { startRealTimeStrategy, stopRealTimeStrategy, deleteRealTimeStrategy, copyRealTimeStrategy } from '../services/api';
import ConfirmModal from '../components/ConfirmModal/ConfirmModal';
import './RealTimeStrategyPage.css';

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
}

const RealTimeStrategyPage: React.FC = () => {
  const [strategies, setStrategies] = useState<RealTimeStrategy[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [errorModalOpen, setErrorModalOpen] = useState<boolean>(false);
  const [operationInProgress, setOperationInProgress] = useState<{[key: string]: boolean}>({});
  const navigate = useNavigate();

  // 添加分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(26);

  // 添加确认对话框状态
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    strategyId: -1,
    strategyName: '',
  });

  // 获取实盘策略列表
  const fetchRealTimeStrategies = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/real-time-strategy/list');

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      console.log('实盘策略API返回数据:', data);

      if (data.code === 200) {
        setStrategies(data.data || []);
      } else {
        setError(data.message || '获取实盘策略失败');
        setErrorModalOpen(true);
      }
    } catch (error) {
      console.error('获取实盘策略失败:', error);
      setError(error instanceof Error ? error.message : '获取实盘策略失败');
      setErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  // 页面加载时获取数据
  useEffect(() => {
    fetchRealTimeStrategies();
  }, []);

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

  // 刷新数据
  const handleRefresh = () => {
    fetchRealTimeStrategies();
  };

  // 启动策略
  const handleStartStrategy = async (strategyId: number) => {
    setOperationInProgress({...operationInProgress, [strategyId]: true});
    try {
      const result = await startRealTimeStrategy(strategyId);
      if (result.success) {
        // 刷新策略列表
        fetchRealTimeStrategies();
      } else {
        setError(result.message || '启动策略失败');
        setErrorModalOpen(true);
      }
    } catch (error) {
      console.error('启动策略失败:', error);
      setError(error instanceof Error ? error.message : '启动策略失败');
      setErrorModalOpen(true);
    } finally {
      setOperationInProgress({...operationInProgress, [strategyId]: false});
    }
  };

  // 停止策略
  const handleStopStrategy = async (strategyId: number) => {
    setOperationInProgress({...operationInProgress, [strategyId]: true});
    try {
      const result = await stopRealTimeStrategy(strategyId);
      if (result.success) {
        // 刷新策略列表
        fetchRealTimeStrategies();
      } else {
        setError(result.message || '停止策略失败');
        setErrorModalOpen(true);
      }
    } catch (error) {
      console.error('停止策略失败:', error);
      setError(error instanceof Error ? error.message : '停止策略失败');
      setErrorModalOpen(true);
    } finally {
      setOperationInProgress({...operationInProgress, [strategyId]: false});
    }
  };

  // 删除策略
  const handleDeleteStrategy = async (strategyId: number) => {
    setOperationInProgress({...operationInProgress, [strategyId]: true});
    try {
      const result = await deleteRealTimeStrategy(strategyId);
      if (result.success) {
        // 刷新策略列表
        fetchRealTimeStrategies();
      } else {
        setError(result.message || '删除策略失败');
        setErrorModalOpen(true);
      }
    } catch (error) {
      console.error('删除策略失败:', error);
      setError(error instanceof Error ? error.message : '删除策略失败');
      setErrorModalOpen(true);
    } finally {
      setOperationInProgress({...operationInProgress, [strategyId]: false});
    }
  };

  // 复制策略
  const handleCopyStrategy = async (strategyId: number) => {
    setOperationInProgress({...operationInProgress, [strategyId]: true});
    try {
      const result = await copyRealTimeStrategy(strategyId);
      if (result.success) {
        // 刷新策略列表
        fetchRealTimeStrategies();
      } else {
        setError(result.message || '复制策略失败');
        setErrorModalOpen(true);
      }
    } catch (error) {
      console.error('复制策略失败:', error);
      setError(error instanceof Error ? error.message : '复制策略失败');
      setErrorModalOpen(true);
    } finally {
      setOperationInProgress({...operationInProgress, [strategyId]: false});
    }
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

  // 分页相关计算
  const totalPages = Math.ceil(strategies.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentPageData = strategies.slice(startIndex, endIndex);

  // 处理页码变化
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // 处理每页显示数量变化
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // 重置到第一页
  };

  return (
    <div className="real-time-strategy-page">
      {/* 错误信息现在通过弹窗展示，不再使用内嵌的错误提示 */}
      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>正在加载实盘策略数据...</p>
        </div>
      ) : (
        <div className="strategies-container">
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
                    <th>ID</th>
                    <th>策略名称</th>

                    <th>交易对</th>
                    <th>时间周期</th>
                    <th>投资金额</th>

                    <th>总收益</th>
                    <th>利润率</th>
                    <th>总佣金</th>
                    <th>交易次数</th>
                    <th>创建时间</th>
                    <th>更新时间</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {currentPageData.map((strategy) => (
                    <tr key={strategy.id}>
                      <td>{strategy.id}</td>
                      <td>{strategy.strategyName || '-'}</td>

                      <td>{strategy.symbol}</td>
                      <td>{strategy.interval}</td>
                      <td>{formatAmount(strategy.tradeAmount)} </td>

                      <td className={strategy.totalProfit && strategy.totalProfit >= 0 ? 'positive' : 'negative'}>
                        {formatAmount(strategy.totalProfit)}
                      </td>
                      <td className={strategy.totalProfitRate && strategy.totalProfitRate >= 0 ? 'positive' : 'negative'}>
                        {strategy.totalProfitRate ? `${(strategy.totalProfitRate * 100).toFixed(2)}%` : '0.00%'}
                      </td>
                      <td>
                        {formatAmount(strategy.totalFees)}
                      </td>
                      <td>{strategy.totalTrades || 0}</td>
                      <td>{formatDateTime(strategy.createTime)}</td>
                      <td>{formatDateTime(strategy.updateTime)}</td>
                      <td>
                      <span 
                          className={`status-badge ${getStatusClass(strategy.status)}`}
                          title={strategy.status === 'ERROR' ? strategy.message || '未知错误' : ''}
                        >
                          {strategy.status || 'UNKNOWN'}
                        </span>
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
              <div className="page-size-selector">
                每页
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                条
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
