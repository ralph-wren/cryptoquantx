/**
 * 市场数据服务 - 单例模式
 * 用于管理市场数据的获取和缓存，避免重复请求
 */

interface TickerData {
  symbol: string;
  lastPrice: string;
  priceChange: string;
  priceChangePercent: string;
  quoteVolume: string;
  [key: string]: any;
}

interface MarketDataCache {
  data: TickerData[] | null;
  timestamp: number;
  loading: boolean;
}

class MarketDataService {
  private static instance: MarketDataService;
  private cache: MarketDataCache = {
    data: null,
    timestamp: 0,
    loading: false
  };
  private listeners: Set<(data: TickerData[]) => void> = new Set();
  private refreshInterval: NodeJS.Timeout | null = null;
  private readonly CACHE_DURATION = 30000; // 30秒缓存
  private pendingRequest: Promise<TickerData[]> | null = null;

  private constructor() {
    // 私有构造函数，确保单例
  }

  public static getInstance(): MarketDataService {
    if (!MarketDataService.instance) {
      MarketDataService.instance = new MarketDataService();
    }
    return MarketDataService.instance;
  }

  /**
   * 获取市场数据
   * @param forceRefresh 是否强制刷新
   */
  public async getMarketData(forceRefresh: boolean = false): Promise<TickerData[]> {
    const now = Date.now();
    
    // 如果有缓存且未过期，直接返回
    if (!forceRefresh && this.cache.data && (now - this.cache.timestamp) < this.CACHE_DURATION) {
      console.log('✅ 使用缓存的市场数据，缓存年龄:', Math.floor((now - this.cache.timestamp) / 1000), '秒');
      return this.cache.data;
    }

    // 如果正在请求中，等待当前请求完成（强化去重）
    if (this.pendingRequest) {
      console.log('⏳ 等待正在进行的市场数据请求（请求去重）');
      return this.pendingRequest;
    }

    // 如果正在加载中（双重检查），等待
    if (this.cache.loading) {
      console.log('⏳ 检测到加载状态，等待100ms后重试');
      await new Promise(resolve => setTimeout(resolve, 100));
      // 递归调用，此时应该能获取到 pendingRequest
      return this.getMarketData(forceRefresh);
    }

    // 发起新请求
    console.log('🚀 发起新的市场数据请求');
    this.cache.loading = true;
    
    this.pendingRequest = this.fetchData()
      .then(data => {
        this.cache.data = data;
        this.cache.timestamp = Date.now();
        this.cache.loading = false;
        this.pendingRequest = null;
        
        console.log('✅ 市场数据请求成功，数据条数:', data.length);
        
        // 通知所有监听器
        this.notifyListeners(data);
        
        return data;
      })
      .catch(error => {
        console.error('❌ 获取市场数据失败:', error);
        this.cache.loading = false;
        this.pendingRequest = null;
        throw error;
      });

    return this.pendingRequest;
  }

  /**
   * 实际的数据获取方法
   */
  private async fetchData(): Promise<TickerData[]> {
    const response = await fetch('/api/market/all_tickers?filter=all&limit=2000');
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.code === 200 && result.data) {
      return result.data;
    }
    
    throw new Error('获取市场数据失败');
  }

  /**
   * 订阅市场数据更新
   */
  public subscribe(callback: (data: TickerData[]) => void): () => void {
    this.listeners.add(callback);
    
    // 如果有缓存数据，立即通知
    if (this.cache.data) {
      callback(this.cache.data);
    }
    
    // 返回取消订阅函数
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(data: TickerData[]): void {
    this.listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('监听器回调执行失败:', error);
      }
    });
  }

  /**
   * 启动自动刷新
   */
  public startAutoRefresh(interval: number = 30000): void {
    if (this.refreshInterval) {
      console.log('⚠️ 自动刷新已经在运行中，忽略重复调用');
      return; // 已经在刷新中
    }

    console.log('🔄 启动市场数据自动刷新，间隔:', interval, 'ms');
    
    // 立即获取一次数据
    this.getMarketData(true);
    
    // 设置定时刷新
    this.refreshInterval = setInterval(() => {
      console.log('⏰ 定时刷新市场数据');
      this.getMarketData(true);
    }, interval);
  }

  /**
   * 停止自动刷新
   */
  public stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      console.log('停止市场数据自动刷新');
    }
  }

  /**
   * 清除缓存
   */
  public clearCache(): void {
    this.cache = {
      data: null,
      timestamp: 0,
      loading: false
    };
    this.pendingRequest = null;
  }

  /**
   * 获取缓存状态
   */
  public getCacheStatus(): { hasCache: boolean; age: number; loading: boolean } {
    return {
      hasCache: this.cache.data !== null,
      age: this.cache.data ? Date.now() - this.cache.timestamp : 0,
      loading: this.cache.loading
    };
  }
}

// 导出单例实例
export const marketDataService = MarketDataService.getInstance();
export type { TickerData };
