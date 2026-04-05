import React, { useState, useEffect, useRef } from 'react';
import { fetchAccountBalance } from '../../services/api';
import { marketDataService, TickerData } from '../../services/marketDataService';
import './AccountInfoPanel.css';

interface Ticker {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  volume: number;
}

const AccountInfoPanel: React.FC = () => {
  // 账户余额相关状态
  const [accountBalance, setAccountBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState<boolean>(true);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  
  // 币种行情相关状态
  const [allTickers, setAllTickers] = useState<Ticker[]>([]);
  const [filteredTickers, setFilteredTickers] = useState<Ticker[]>([]);
  const [isLoadingTickers, setIsLoadingTickers] = useState<boolean>(true);
  const [tickersError, setTickersError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('volume');
  const [sortDirection, setSortDirection] = useState<string>('desc');
  const [displayCount, setDisplayCount] = useState<number>(50);
  
  // 用于无限滚动的引用
  const tickersContainerRef = useRef<HTMLDivElement>(null);

  // 加载账户余额
  const loadAccountBalance = async () => {
    setLoadingBalance(true);
    setBalanceError(null);
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
      } else {
        setBalanceError(result.message || '获取账户余额失败');
      }
    } catch (error) {
      console.error('获取账户余额时发生错误:', error);
      setBalanceError(error instanceof Error ? error.message : '获取账户余额时发生错误');
    } finally {
      setLoadingBalance(false);
    }
  };

  // 加载所有币种行情
  const loadAllTickers = async () => {
    setIsLoadingTickers(true);
    setTickersError(null);
    try {
      const data = await marketDataService.getMarketData();
      // 格式化数据，保留需要的字段包括交易量
      const formattedTickers = data.map((ticker: any) => ({
        symbol: ticker.symbol,
        lastPrice: parseFloat(ticker.lastPrice),
        priceChangePercent: parseFloat(ticker.priceChangePercent || '0'),
        volume: parseFloat(ticker.quoteVolume || ticker.volume || '0') // 优先使用quoteVolume
      }));
      setAllTickers(formattedTickers);
      console.log('获取所有币种行情成功:', formattedTickers.length);
    } catch (error) {
      console.error('获取所有币种行情时发生错误:', error);
      setTickersError(error instanceof Error ? error.message : '获取所有币种行情时发生错误');
    } finally {
      setIsLoadingTickers(false);
    }
  };

  // 组件加载时获取数据
  useEffect(() => {
    loadAccountBalance();
    loadAllTickers();
    
    // 订阅市场数据更新
    const unsubscribe = marketDataService.subscribe((data) => {
      const formattedTickers = data.map((ticker: any) => ({
        symbol: ticker.symbol,
        lastPrice: parseFloat(ticker.lastPrice),
        priceChangePercent: parseFloat(ticker.priceChangePercent || '0'),
        volume: parseFloat(ticker.quoteVolume || ticker.volume || '0')
      }));
      setAllTickers(formattedTickers);
    });
    
    // 每5分钟刷新一次账户余额
    const intervalId = setInterval(() => {
      loadAccountBalance();
    }, 5 * 60 * 1000);
    
    return () => {
      clearInterval(intervalId);
      unsubscribe();
    };
  }, []);

  // 当搜索词、排序条件或币种数据变化时，重新过滤和排序数据
  useEffect(() => {
    if (allTickers.length === 0) return;
    
    // 先过滤
    let filtered = [...allTickers];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(ticker => 
        ticker.symbol.toLowerCase().includes(term)
      );
    }
    
    // 再排序
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'symbol':
          comparison = a.symbol.localeCompare(b.symbol);
          break;
        case 'price':
          comparison = a.lastPrice - b.lastPrice;
          break;
        case 'change':
          comparison = a.priceChangePercent - b.priceChangePercent;
          break;
        case 'volume':
        default:
          comparison = a.volume - b.volume;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    setFilteredTickers(filtered);
  }, [allTickers, searchTerm, sortBy, sortDirection]);

  // 处理搜索输入变化
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setDisplayCount(50); // 重置显示数量
  };

  // 处理排序方式变化
  const handleSortChange = (newSortBy: string) => {
    if (sortBy === newSortBy) {
      // 如果点击的是当前排序字段，切换排序方向
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // 如果点击的是新排序字段，设置为该字段降序排列
      setSortBy(newSortBy);
      setSortDirection('desc');
    }
    setDisplayCount(50); // 重置显示数量
  };

  // 处理滚动加载更多
  const handleScroll = () => {
    if (tickersContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = tickersContainerRef.current;
      if (scrollTop + clientHeight >= scrollHeight - 100 && displayCount < filteredTickers.length) {
        // 滚动到接近底部，加载更多
        setDisplayCount(prev => Math.min(prev + 50, filteredTickers.length));
      }
    }
  };

  // 获取价格变化百分比的样式类
  const getPriceChangeClass = (percent: number) => {
    if (percent > 0) return 'positive-change';
    if (percent < 0) return 'negative-change';
    return '';
  };

  // 格式化价格显示
  const formatPrice = (price: number): string => {
    if (price >= 1000) return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (price >= 1) return price.toLocaleString(undefined, { maximumFractionDigits: 4 });
    return price.toLocaleString(undefined, { maximumFractionDigits: 8 });
  };

  // 格式化交易量显示
  const formatVolume = (volume: number): string => {
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(2)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(2)}K`;
    return volume.toFixed(2);
  };

  // 获取排序图标
  const getSortIcon = (field: string) => {
    if (sortBy !== field) return '⇅';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  // 刷新数据
  const handleRefresh = () => {
    loadAccountBalance();
    loadAllTickers();
  };

  // 显示表格中可见的行
  const visibleTickers = filteredTickers.slice(0, displayCount);

  return (
    <div className="account-info-panel">
      <div className="account-info-header">
        <h2>账户信息</h2>
        <button className="refresh-button" onClick={handleRefresh}>
          刷新数据
        </button>
      </div>

      {/* 账户余额区域 */}
      <div className="balance-section">
        <h3>账户余额</h3>
        {loadingBalance ? (
          <div className="loading">加载中...</div>
        ) : balanceError ? (
          <div className="error">{balanceError}</div>
        ) : (
          <div className="balance-amount">
            {accountBalance !== null ? `${accountBalance.toFixed(2)} USDT` : '无可用余额'}
          </div>
        )}
      </div>

      {/* 币种行情区域 */}
      <div className="tickers-section">
        <h3>币种行情</h3>
        <div className="tickers-controls">
          <input
            type="text"
            placeholder="搜索币种..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="search-input"
          />
        </div>
        
        {isLoadingTickers ? (
          <div className="loading">加载中...</div>
        ) : tickersError ? (
          <div className="error">{tickersError}</div>
        ) : (
          <div className="tickers-table-container" ref={tickersContainerRef} onScroll={handleScroll}>
            <table className="tickers-table">
              <thead>
                <tr>
                  <th onClick={() => handleSortChange('symbol')}>
                    币种 {getSortIcon('symbol')}
                  </th>
                  <th onClick={() => handleSortChange('price')}>
                    价格 {getSortIcon('price')}
                  </th>
                  <th onClick={() => handleSortChange('change')}>
                    24h涨跌 {getSortIcon('change')}
                  </th>
                  <th onClick={() => handleSortChange('volume')}>
                    成交量 {getSortIcon('volume')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleTickers.length > 0 ? (
                  visibleTickers.map((ticker) => (
                    <tr key={ticker.symbol}>
                      <td>{ticker.symbol}</td>
                      <td>{formatPrice(ticker.lastPrice)}</td>
                      <td className={getPriceChangeClass(ticker.priceChangePercent)}>
                        {ticker.priceChangePercent > 0 ? '+' : ''}
                        {ticker.priceChangePercent.toFixed(2)}%
                      </td>
                      <td>{formatVolume(ticker.volume)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>无匹配币种</td>
                  </tr>
                )}
              </tbody>
            </table>
            {displayCount < filteredTickers.length && (
              <div className="load-more">
                <button onClick={() => setDisplayCount(prev => prev + 50)}>
                  加载更多
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountInfoPanel; 