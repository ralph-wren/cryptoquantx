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

/**
 * 获取股票信息列表
 * @param exchange 交易所：SSE-上交所, SZSE-深交所, 不传则返回全部
 * @param listStatus 上市状态：L-上市, D-退市, P-暂停上市
 */
export const fetchStockInfoList = async (
  exchange?: string,
  listStatus: string = 'L'
): Promise<StockInfo[]> => {
  try {
    const params = new URLSearchParams();
    if (exchange) {
      params.append('exchange', exchange);
    }
    params.append('listStatus', listStatus);

    const url = `/api/stock/market/stock/info/list?${params.toString()}`;
    console.log('获取股票列表:', url);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    const apiResponse: ApiResponse<StockInfo[]> = await response.json();
    
    if (apiResponse.code === 200 && apiResponse.data) {
      console.log(`获取股票列表成功: ${apiResponse.data.length} 条`);
      return apiResponse.data;
    } else {
      throw new Error(apiResponse.message || '获取股票列表失败');
    }
  } catch (error) {
    console.error('获取股票列表失败:', error);
    throw error;
  }
};

/**
 * 获取所有股票（不限交易所）
 */
export const fetchAllStocks = async (): Promise<StockInfo[]> => {
  return fetchStockInfoList(undefined, 'L');
};

/**
 * 获取上交所股票
 */
export const fetchSSEStocks = async (): Promise<StockInfo[]> => {
  return fetchStockInfoList('SSE', 'L');
};

/**
 * 获取深交所股票
 */
export const fetchSZSEStocks = async (): Promise<StockInfo[]> => {
  return fetchStockInfoList('SZSE', 'L');
};
