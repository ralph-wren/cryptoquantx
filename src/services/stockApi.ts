// 股票相关API接口

export interface StockInfo {
  code: string;      // 股票代码，如 000001.SZ
  name: string;      // 股票名称
  market: string;    // 所属板块：main-主板, chinext-创业板, star-科创板, bse-北交所
  exchange: string;  // 交易所：SSE-上交所, SZSE-深交所
  industry: string;  // 所属行业
  listDate: string;  // 上市日期
}

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// 缓存配置
const STOCK_LIST_CACHE_KEY = 'cryptoquantx_stock_list_cache';
const CACHE_EXPIRY_KEY = 'cryptoquantx_stock_list_cache_expiry';
const CACHE_DURATION = 30* 24 * 60 * 60 * 1000; // 24小时缓存

/**
 * 从缓存获取股票列表
 */
const getStockListFromCache = (): StockInfo[] | null => {
  try {
    const cachedData = localStorage.getItem(STOCK_LIST_CACHE_KEY);
    const expiryTime = localStorage.getItem(CACHE_EXPIRY_KEY);
    
    if (!cachedData || !expiryTime) {
      return null;
    }
    
    // 检查缓存是否过期
    const now = Date.now();
    if (now > parseInt(expiryTime)) {
      console.log('股票列表缓存已过期');
      localStorage.removeItem(STOCK_LIST_CACHE_KEY);
      localStorage.removeItem(CACHE_EXPIRY_KEY);
      return null;
    }
    
    const stockList = JSON.parse(cachedData);
    
    // 如果缓存的是空数组，清除缓存并返回null
    if (!Array.isArray(stockList) || stockList.length === 0) {
      console.log('缓存的股票列表为空，清除缓存');
      localStorage.removeItem(STOCK_LIST_CACHE_KEY);
      localStorage.removeItem(CACHE_EXPIRY_KEY);
      return null;
    }
    
    console.log(`从缓存获取股票列表: ${stockList.length} 条`);
    return stockList;
  } catch (error) {
    console.error('读取股票列表缓存失败:', error);
    return null;
  }
};

/**
 * 保存股票列表到缓存
 */
const saveStockListToCache = (stockList: StockInfo[]): void => {
  try {
    // 只缓存非空数组
    if (!Array.isArray(stockList) || stockList.length === 0) {
      console.log('股票列表为空，不缓存');
      return;
    }
    
    const expiryTime = Date.now() + CACHE_DURATION;
    localStorage.setItem(STOCK_LIST_CACHE_KEY, JSON.stringify(stockList));
    localStorage.setItem(CACHE_EXPIRY_KEY, expiryTime.toString());
    console.log(`股票列表已缓存: ${stockList.length} 条，有效期至 ${new Date(expiryTime).toLocaleString()}`);
  } catch (error) {
    console.error('保存股票列表缓存失败:', error);
  }
};

/**
 * 获取股票信息列表
 * @param exchange 交易所：SSE-上交所, SZSE-深交所, 不传则返回全部
 * @param listStatus 上市状态：L-上市, D-退市, P-暂停上市
 * @param useCache 是否使用缓存，默认true
 */
export const fetchStockInfoList = async (
  exchange?: string,
  listStatus: string = 'L',
  useCache: boolean = true
): Promise<StockInfo[]> => {
  // 如果使用缓存且缓存存在，直接返回缓存数据
  if (useCache && !exchange) { // 只有获取全部股票时才使用缓存
    const cachedData = getStockListFromCache();
    if (cachedData) {
      return cachedData;
    }
  }
  
  try {
    const params = new URLSearchParams();
    if (exchange) {
      params.append('exchange', exchange);
    }
    params.append('listStatus', listStatus);

    const url = `/api/stock/market/stock/info/list?${params.toString()}`;
    console.log('获取股票列表:', url);

    const response = await fetch(url);
    console.log('API响应状态:', response.status, response.statusText);
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    const apiResponse: ApiResponse<StockInfo[]> = await response.json();
    console.log('API响应数据:', apiResponse);
    console.log('API响应 code:', apiResponse.code);
    console.log('API响应 data 类型:', typeof apiResponse.data);
    console.log('API响应 data 是否为数组:', Array.isArray(apiResponse.data));
    console.log('API响应 data 长度:', apiResponse.data?.length);
    
    if (apiResponse.code === 200 && apiResponse.data) {
      console.log(`获取股票列表成功: ${apiResponse.data.length} 条`);
      console.log('前3条数据:', apiResponse.data.slice(0, 3));
      
      // 只有获取全部股票时才缓存
      if (!exchange) {
        saveStockListToCache(apiResponse.data);
      }
      
      return apiResponse.data;
    } else {
      console.error('API返回错误:', apiResponse);
      throw new Error(apiResponse.message || '获取股票列表失败');
    }
  } catch (error) {
    console.error('获取股票列表失败:', error);
    console.error('错误详情:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      url: `/api/stock/market/stock/info/list?listStatus=${listStatus}${exchange ? `&exchange=${exchange}` : ''}`
    });
    
    // 如果API调用失败，尝试返回缓存数据（即使可能过期）
    if (useCache && !exchange) {
      const cachedData = localStorage.getItem(STOCK_LIST_CACHE_KEY);
      if (cachedData) {
        console.log('API调用失败，使用缓存数据（可能已过期）');
        return JSON.parse(cachedData);
      }
    }
    
    throw error;
  }
};

/**
 * 清除股票列表缓存
 */
export const clearStockListCache = (): void => {
  localStorage.removeItem(STOCK_LIST_CACHE_KEY);
  localStorage.removeItem(CACHE_EXPIRY_KEY);
  console.log('股票列表缓存已清除');
};

/**
 * 获取所有股票（不限交易所）
 */
export const fetchAllStocks = async (useCache: boolean = true): Promise<StockInfo[]> => {
  return fetchStockInfoList(undefined, 'L', useCache);
};

/**
 * 获取上交所股票
 */
export const fetchSSEStocks = async (): Promise<StockInfo[]> => {
  return fetchStockInfoList('SSE', 'L', false); // 交易所筛选不使用缓存
};

/**
 * 获取深交所股票
 */
export const fetchSZSEStocks = async (): Promise<StockInfo[]> => {
  return fetchStockInfoList('SZSE', 'L', false); // 交易所筛选不使用缓存
};
