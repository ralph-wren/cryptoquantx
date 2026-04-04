// A股市场常量定义

// 股票板块类型
export type StockMarket = 'all' | 'main' | 'chinext' | 'star' | 'bse';

// 板块配置
export const STOCK_MARKETS = [
  { value: 'all', label: '全部' },
  { value: 'main', label: '主板' },
  { value: 'chinext', label: '创业板' },
  { value: 'star', label: '科创板' },
  { value: 'bse', label: '北交所' }
];

// 股票信息接口（与后端StockInfo对应）
export interface StockInfo {
  code: string;      // 股票代码，如 000001.SZ
  name: string;      // 股票名称
  market: string;    // 所属板块：main-主板, chinext-创业板, star-科创板, bse-北交所
  exchange: string;  // 交易所：SSE-上交所, SZSE-深交所
  industry: string;  // 所属行业
  listDate: string;  // 上市日期
}

// 根据股票代码判断所属板块
export function getStockMarket(code: string): StockMarket {
  if (!code) return 'main';
  
  // 科创板：688开头
  if (code.startsWith('688')) {
    return 'star';
  }
  
  // 创业板：300开头
  if (code.startsWith('300')) {
    return 'chinext';
  }
  
  // 北交所：8开头（3位数）
  if (code.match(/^8\d{5}\./)) {
    return 'bse';
  }
  
  // 其他都是主板
  return 'main';
}

// 格式化股票代码显示（去掉后缀）
export function formatStockCode(code: string): string {
  return code.replace('.SZ', '').replace('.SH', '');
}

// 格式化股票显示名称
export function formatStockDisplay(code: string, name?: string): string {
  const formattedCode = formatStockCode(code);
  return name ? `${name} ${formattedCode}` : formattedCode;
}
