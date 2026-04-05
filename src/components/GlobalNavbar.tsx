import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Logo from './Logo';
import './GlobalNavbar.css';
import { marketDataService, TickerData } from '../services/marketDataService';

const GlobalNavbar: React.FC = () => {
  const location = useLocation();

  // 行情数据状态
  const [tickers, setTickers] = useState<TickerData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // 主流币种列表（加密货币）
  const mainCoins = ['BTC-USDT', 'ETH-USDT', 'XRP-USDT', 'SOL-USDT', 'DOGE-USDT', 'SUI-USDT'];

  // 组件挂载时订阅市场数据
  useEffect(() => {
    // 订阅市场数据更新
    const unsubscribe = marketDataService.subscribe((data) => {
      // 按指定顺序筛选主流币种
      const mainCoinTickers: TickerData[] = mainCoins.map(coinSymbol => {
        const ticker = data.find((t: any) => t.symbol === coinSymbol);
        return ticker || null;
      }).filter((ticker): ticker is TickerData => ticker !== null);

      setTickers(mainCoinTickers);
      setLoading(false);
    });

    // 手动获取一次数据（不启动自动刷新）
    marketDataService.getMarketData(false).catch(err => {
      console.error('获取市场数据失败:', err);
      setLoading(false);
    });

    // 清理函数
    return () => {
      unsubscribe();
    };
  }, []); // 空依赖数组，只在挂载时执行一次

  // 格式化价格显示
  const formatPrice = (price: string): string => {
    const num = parseFloat(price);
    if (num >= 1000) {
      return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else if (num >= 1) {
      return num.toFixed(4);
    } else {
      return num.toFixed(6);
    }
  };

  // 格式化涨跌幅
  const formatChangePercent = (percent: string): string => {
    const num = parseFloat(percent);
    return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
  };

  return (
    <div className="global-navbar">
      <div className="navbar-left">
        <Logo />
        
        <Link to="/backtest-summaries" className="nav-link backtest-nav-link">
          历史回测
        </Link>
        <Link to="/backtest-factory" className="nav-link backtest-nav-link">
          策略工厂
        </Link>
        <Link to="/batch-backtest" className="nav-link backtest-nav-link batch-backtest-link">
          批量回测
        </Link>
        <Link to="/real-time-strategy" className="nav-link backtest-nav-link real-time-strategy-link">
          实盘策略
        </Link>
        <Link to="/fund-center" className="nav-link backtest-nav-link fund-center-link">
          资金中心
        </Link>
        <Link to="/telegram-news" className="nav-link backtest-nav-link telegram-news-link">
          电报资讯
        </Link>
        <Link to="/indicator-distribution" className="nav-link backtest-nav-link indicator-distribution-link">
          指标分布
        </Link>
      </div>
      <div className="navbar-right">
        <div className="market-ticker">
          {loading ? (
            <div className="ticker-loading">加载行情中...</div>
          ) : (
            <div className="ticker-list">
              {tickers.map((ticker) => (
                <div key={ticker.symbol} className="ticker-item">
                  <span className="ticker-symbol">
                    {ticker.symbol.replace('-USDT', '')}
                  </span>
                  <span className="ticker-price">
                    ${formatPrice(ticker.lastPrice)}
                  </span>
                  <span className={`ticker-change ${parseFloat(ticker.priceChangePercent) >= 0 ? 'positive' : 'negative'}`}>
                    {formatChangePercent(ticker.priceChangePercent)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalNavbar;