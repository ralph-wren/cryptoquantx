import React, { useState, useEffect } from 'react';
import { fetchAccountBalance } from '../../services/api';
import { marketDataService, TickerData } from '../../services/marketDataService';
import './CopyStrategyModal.css';

interface CopyStrategyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (interval: string, symbol: string, tradeAmount: number) => void;
  originalStrategy: {
    id: number;
    strategyName: string;
    interval: string;
    symbol: string;
    tradeAmount: number;
  };
}

interface Ticker {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  volume: number;
}

const CopyStrategyModal: React.FC<CopyStrategyModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  originalStrategy
}) => {
  // 基本表单状态
  const [interval, setInterval] = useState<string>('');
  const [symbol, setSymbol] = useState<string>('');
  const [tradeAmount, setTradeAmount] = useState<string>('');
  
  // 账户余额状态
  const [accountBalance, setAccountBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState<boolean>(false);
  
  // 币种列表状态
  const [allTickers, setAllTickers] = useState<Ticker[]>([]);
  const [filteredTickers, setFilteredTickers] = useState<Ticker[]>([]);
  const [displayedTickers, setDisplayedTickers] = useState<Ticker[]>([]);
  const [loadingTickers, setLoadingTickers] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // 加载更多控制
  const [displayCount, setDisplayCount] = useState<number>(20);
  const [hasMore, setHasMore] = useState<boolean>(true);
  
  // 支持的时间周期
  const supportedIntervals = ['1m', '5m', '15m', '30m', '1H', '2H', '4H', '6H', '12H', '1D', '1W', '1M'];

  // 当模态框打开或原始策略变化时，初始化表单值
  useEffect(() => {
    if (isOpen && originalStrategy) {
      setInterval(originalStrategy.interval);
      setSymbol(originalStrategy.symbol);
      setTradeAmount(originalStrategy.tradeAmount.toString()); // 确保是字符串
      setDisplayCount(20); // 重置显示数量
      
      // 加载账户余额
      loadAccountBalance();
      // 加载所有币种
      loadAllTickers();
    }
  }, [isOpen, originalStrategy]);
  
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
          setAccountBalance(result.data.availableBalance || 0);
        }
      }
    } catch (error) {
      console.error('获取账户余额失败:', error);
    } finally {
      setLoadingBalance(false);
    }
  };
  
  // 加载所有币种
  const loadAllTickers = async () => {
    setLoadingTickers(true);
    try {
      const data = await marketDataService.getMarketData();
      // 格式化数据，保留需要的字段
      const formattedTickers = data.map((ticker: any) => ({
        symbol: ticker.symbol,
        lastPrice: parseFloat(ticker.lastPrice),
        priceChangePercent: parseFloat(ticker.priceChangePercent || '0'),
        volume: parseFloat(ticker.quoteVolume || ticker.volume || '0')
      }));
      
      // 按交易量排序
      formattedTickers.sort((a: Ticker, b: Ticker) => b.volume - a.volume);
      
      setAllTickers(formattedTickers);
      setFilteredTickers(formattedTickers);
    } catch (error) {
      console.error('获取所有币种行情失败:', error);
    } finally {
      setLoadingTickers(false);
    }
  };

  // 过滤币种
  useEffect(() => {
    if (allTickers.length === 0) return;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const filtered = allTickers.filter(ticker => 
        ticker.symbol.toLowerCase().includes(term)
      );
      setFilteredTickers(filtered);
      setDisplayCount(20); // 搜索时重置显示数量
    } else {
      setFilteredTickers(allTickers);
    }
  }, [allTickers, searchTerm]);

  // 更新显示的交易对
  useEffect(() => {
    setDisplayedTickers(filteredTickers.slice(0, displayCount));
    setHasMore(displayCount < filteredTickers.length);
  }, [filteredTickers, displayCount]);

  // 加载更多
  const loadMoreTickers = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDisplayCount(prevCount => prevCount + 20);
  };

  // 点击遮罩层关闭模态框
  const handleOverlayClick = (e: React.MouseEvent) => {
    // 确保点击的是遮罩层本身，而不是其子元素
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // 阻止弹窗内容区域的所有鼠标事件冒泡
  const handleContentMouseEvents = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  };

  // 提交表单
  const handleSubmit = (e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡
    onConfirm(interval, symbol, Number(tradeAmount)); // 确保是数字
  };
  
  // 处理搜索输入变化
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  // 选择币种
  const handleSymbolSelect = (selectedSymbol: string) => {
    setSymbol(selectedSymbol);
    setSearchTerm(''); // 清空搜索框
  };
  
  // 获取价格变化百分比的样式类
  const getPriceChangeClass = (percent: number) => {
    if (percent > 0) return 'positive-change';
    if (percent < 0) return 'negative-change';
    return '';
  };
  
  // 修改useAccountBalance函数，防止事件冒泡
  const handleUseFullBalance = (e?: React.MouseEvent) => {
    // 阻止事件冒泡，防止触发模态框关闭
    e?.stopPropagation();
    if (accountBalance !== null) {
      setTradeAmount(accountBalance.toString()); // 确保是字符串
    }
  };
   
  // 添加处理百分比按钮点击的函数
  const handlePercentageClick = (percentage: number, e: React.MouseEvent) => {
    // 阻止事件冒泡，防止触发模态框关闭
    e.stopPropagation();
    if (accountBalance !== null) {
      setTradeAmount((accountBalance * percentage).toString()); // 确保是字符串
    }
  };

  if (!isOpen) return null;

  return (
    <div className="copy-strategy-modal-overlay" onClick={handleOverlayClick}>
      <div 
        className="copy-strategy-modal-content" 
        onClick={(e) => {
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
        }}
      >
        <div className="copy-strategy-modal-header">
          <h3 className="copy-strategy-modal-title">复制策略: {originalStrategy.strategyName}</h3>
          <button 
            className="copy-strategy-modal-close" 
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="关闭"
          >
            ×
          </button>
        </div>
        
        <div 
          className="copy-strategy-modal-body"
          onMouseDown={handleContentMouseEvents}
          onMouseUp={handleContentMouseEvents}
          onMouseLeave={handleContentMouseEvents}
          onMouseEnter={handleContentMouseEvents}
        >
          {/* 交易金额 */}
          <div className="form-group">
            {/* <label htmlFor="tradeAmount">投资金额(USDT) - 用于执行实盘策略金额</label> */}
            <div className="balance-indicator">
              {loadingBalance ? (
                <span className="loading-balance">加载中...</span>
              ) : (
                <span className="available-balance">可用: {accountBalance !== null ? `${accountBalance.toFixed(2)} USDT` : '未知'}</span>
              )}
            </div>
            <input 
              id="tradeAmount"
              type="number"
              min="1"
              step="1"
              value={tradeAmount}
              onChange={(e) => setTradeAmount(e.target.value)}
              className="copy-strategy-input"
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              onMouseLeave={(e) => e.stopPropagation()}
              onMouseEnter={(e) => e.stopPropagation()}
              onSelect={(e) => e.stopPropagation()}
              onBlur={(e) => e.stopPropagation()}
            />
            {accountBalance !== null && (
              <div className="balance-buttons">
                <button className="percentage-btn" onClick={(e) => handlePercentageClick(0.25, e)}>25%</button>
                <button className="percentage-btn" onClick={(e) => handlePercentageClick(0.5, e)}>50%</button>
                <button className="percentage-btn" onClick={(e) => handlePercentageClick(0.75, e)}>75%</button>
                <button className="percentage-btn" onClick={(e) => handleUseFullBalance(e)}>100%</button>
              </div>
            )}
          </div>
          
          {/* 时间周期 */}
          <div className="form-group">
            <label htmlFor="interval">时间周期:</label>
            <select 
              id="interval"
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
              className="copy-strategy-input"
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <option value={originalStrategy.interval}>{originalStrategy.interval} (当前)</option>
              {supportedIntervals
                .filter(i => i !== originalStrategy.interval)
                .map(i => (
                  <option key={i} value={i}>{i}</option>
                ))
              }
            </select>
          </div>

          {/* 币种选择 */}
          <div className="form-group">
            <label htmlFor="symbol">当前选择: {symbol || originalStrategy.symbol}</label>
            <div className="symbol-selection">
              {/* <div className="selected-symbol current-selection-container">
                <div className="current-selection-text">
                  <span>当前选择: </span>
                  <strong>{symbol || originalStrategy.symbol}</strong>
                </div>
              </div> */}
              <input 
                type="text"
                placeholder="搜索交易对..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="copy-strategy-input symbol-search"
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              />
              <div className="tickers-container">
                {loadingTickers ? (
                  <div className="loading-tickers">加载币种中...</div>
                ) : (
                  <>
                    <div className="tickers-list-header">
                      <span>交易对</span>
                      <span style={{textAlign: 'right'}}>24h涨跌</span>
                    </div>
                    <div className="tickers-list">
                      {/* 始终显示原始策略的币种在顶部 */}
                      <div 
                        className={`ticker-item ${symbol === originalStrategy.symbol ? 'selected' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSymbolSelect(originalStrategy.symbol);
                        }}
                      >
                        <div className="ticker-symbol">{originalStrategy.symbol}</div>
                        <div className="ticker-note">(当前)</div>
                      </div>
                      
                      {/* 显示币种 */}
                      {displayedTickers.map((ticker) => (
                        ticker.symbol !== originalStrategy.symbol && (
                          <div 
                            key={ticker.symbol}
                            className={`ticker-item ${ticker.symbol === symbol ? 'selected' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSymbolSelect(ticker.symbol);
                            }}
                          >
                            <div className="ticker-symbol">{ticker.symbol}</div>
                            <div className={`ticker-change ${getPriceChangeClass(ticker.priceChangePercent)}`}>
                              {ticker.priceChangePercent > 0 ? '+' : ''}
                              {ticker.priceChangePercent.toFixed(2)}%
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                    
                    {/* 加载更多按钮 */}
                    {hasMore && (
                      <div className="load-more-container" onClick={e => e.stopPropagation()}>
                        <button 
                          className="load-more-button"
                          onClick={loadMoreTickers}
                        >
                          加载更多
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="copy-strategy-modal-footer">
          <button 
            className="copy-strategy-modal-btn copy-strategy-modal-btn-cancel"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            取消
          </button>
          <button 
            className="copy-strategy-modal-btn copy-strategy-modal-btn-confirm"
            onClick={handleSubmit}
          >
            确认复制
          </button>
        </div>
      </div>
    </div>
  );
};

export default CopyStrategyModal; 