# 股票选择器实现文档

## 概述
在前端首页的回测面板中添加了市场类型切换功能，支持在加密货币和股票之间切换，并实现了股票列表的显示和选择。

## 实现的功能

### 1. 市场类型切换器
- 添加了"加密货币"和"股票"两个切换按钮
- 切换市场类型时会自动加载对应的数据列表
- 市场类型状态保存在 Redux store 中

### 2. 股票选择器
- 点击股票选择器时自动从后端API获取股票列表
- 优先使用7天缓存（localStorage），缓存不存在时调用后端接口
- 支持按股票代码或名称搜索
- 显示股票代码、名称、板块、交易所等信息

### 3. 数据加载策略
- **加密货币**: 点击选择器时从 `/api/market/all_tickers` 获取实时数据
- **股票**: 点击选择器时从 `/api/stock/market/stock/info/list` 获取数据，优先使用本地缓存

## 修改的文件

### 1. `BacktestPanel.tsx`
- 添加了 `marketType` 状态管理
- 添加了股票列表相关状态变量：`allStocks`, `filteredStocks`, `isLoadingStocks`
- 实现了股票列表加载逻辑
- 添加了市场类型切换UI
- 实现了股票选择器UI，支持搜索和选择

### 2. `BacktestPanel.css`
- 添加了市场类型切换器样式 `.market-type-switcher`
- 添加了股票列表样式 `.stock-list`, `.stock-item`
- 添加了加载状态样式 `.loading-stocks`

### 3. `stockApi.ts`
- 已有完整的股票API接口实现
- 包含缓存逻辑（7天有效期）
- 提供 `fetchAllStocks()` 方法获取所有股票

### 4. Redux Store
- `types.ts`: 已定义 `MarketType` 类型和 `marketType` 状态
- `actions.ts`: 已定义 `setMarketType` action
- `reducer.ts`: 已实现 `SET_MARKET_TYPE` reducer

## 使用流程

1. 用户打开首页回测面板
2. 点击"股票"按钮切换到股票模式
3. 点击股票选择器下拉框
4. 系统自动加载股票列表（优先使用缓存）
5. 用户可以搜索或直接选择股票
6. 选择后股票代码显示在选择器中

## 缓存机制

### 前端缓存（localStorage）
- 缓存键: `cryptoquantx_stock_list_cache`
- 过期时间键: `cryptoquantx_stock_list_cache_expiry`
- 缓存时长: 30天
- 缓存内容: 完整的股票列表JSON数据

### 后端缓存（Redis Hash）
- 缓存键: `market:stock:hash`
- 缓存时长: 7天
- 数据结构: Hash (key: 股票代码, value: JSON字符串)

## API接口

### 获取股票列表
```
GET /api/stock/market/stock/info/list
Query参数:
  - exchange: 交易所（可选，SSE/SZSE）
  - listStatus: 上市状态（默认L-上市）

返回格式:
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "code": "000001.SZ",
      "name": "平安银行",
      "market": "main",
      "exchange": "SZSE",
      "industry": "银行",
      "listDate": "1991-04-03"
    }
  ]
}
```

### 获取单个股票信息
```
GET /api/stock/market/stock/info/{code}
返回格式: 同上，data为单个对象
```

## 注意事项

1. 股票列表数据量较大（约5000条），使用了缓存机制减少API调用
2. 前端缓存30天，后端缓存7天，确保数据及时更新
3. 搜索功能支持股票代码和名称模糊匹配
4. 切换市场类型时会自动设置默认选中项
5. 股票代码显示时会去掉 `.SZ` 和 `.SH` 后缀，提升可读性

## 后续优化建议

1. 添加股票板块筛选（主板、创业板、科创板、北交所）
2. 添加股票行业筛选
3. 支持按上市日期排序
4. 添加股票收藏功能
5. 显示股票实时价格和涨跌幅（需要对接行情数据源）
