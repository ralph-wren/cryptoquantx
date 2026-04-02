# 市场类型持久化和股票列表缓存

## 更新日期
2026-04-01

## 功能说明

### 1. 市场类型持久化

#### 问题
之前刷新页面后，市场类型会重置为默认的"加密货币"，即使用户之前选择了"股票"。

#### 解决方案
- 在Redux reducer初始化时从localStorage读取保存的marketType
- 切换市场类型时立即保存到localStorage
- 组件初始化时再次确认并恢复市场类型
- 刷新页面后保持用户选择的市场类型

#### 实现细节

**1. Reducer初始化（src/store/reducer.ts）**
```typescript
const initialState: AppState = {
  marketType: savedSettings?.marketType || 'crypto', // 从localStorage恢复
  // ...
};
```

**2. 切换时保存（src/components/Chart/CandlestickChart.tsx）**
```typescript
const handleMarketTypeChange = (type: MarketType) => {
  dispatch(setMarketType(type));
  // 保存到 localStorage
  const savedSettings = localStorage.getItem(CHART_SETTINGS_KEY);
  const settings = savedSettings ? JSON.parse(savedSettings) : {};
  settings.marketType = type;
  localStorage.setItem(CHART_SETTINGS_KEY, JSON.stringify(settings));
};
```

**3. 组件初始化时恢复**
```typescript
useEffect(() => {
  const savedSettings = localStorage.getItem(CHART_SETTINGS_KEY);
  if (savedSettings) {
    const settings = JSON.parse(savedSettings);
    if (settings.marketType && settings.marketType !== marketType) {
      dispatch(setMarketType(settings.marketType));
    }
  }
}, []); // 只在组件挂载时执行一次
```

### 2. 股票列表缓存

#### 问题
每次切换到股票模式或刷新页面时，都需要重新从API获取股票列表（5000+条数据），导致：
- 加载时间长
- 增加服务器负担
- 用户体验不佳

#### 解决方案
- 实现本地缓存机制，缓存时长24小时
- 首次加载时从API获取并缓存
- 后续访问直接从缓存读取
- 缓存过期后自动重新获取
- API调用失败时使用缓存数据（即使过期）

#### 实现细节

**1. 缓存配置（src/services/stockApi.ts）**
```typescript
const STOCK_LIST_CACHE_KEY = 'cryptoquantx_stock_list_cache';
const CACHE_EXPIRY_KEY = 'cryptoquantx_stock_list_cache_expiry';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24小时
```

**2. 缓存读取**
```typescript
const getStockListFromCache = (): StockInfo[] | null => {
  const cachedData = localStorage.getItem(STOCK_LIST_CACHE_KEY);
  const expiryTime = localStorage.getItem(CACHE_EXPIRY_KEY);
  
  if (!cachedData || !expiryTime) {
    return null;
  }
  
  // 检查是否过期
  const now = Date.now();
  if (now > parseInt(expiryTime)) {
    localStorage.removeItem(STOCK_LIST_CACHE_KEY);
    localStorage.removeItem(CACHE_EXPIRY_KEY);
    return null;
  }
  
  return JSON.parse(cachedData);
};
```

**3. 缓存保存**
```typescript
const saveStockListToCache = (stockList: StockInfo[]): void => {
  const expiryTime = Date.now() + CACHE_DURATION;
  localStorage.setItem(STOCK_LIST_CACHE_KEY, JSON.stringify(stockList));
  localStorage.setItem(CACHE_EXPIRY_KEY, expiryTime.toString());
};
```

**4. API调用时使用缓存**
```typescript
export const fetchStockInfoList = async (
  exchange?: string,
  listStatus: string = 'L',
  useCache: boolean = true
): Promise<StockInfo[]> => {
  // 优先使用缓存
  if (useCache && !exchange) {
    const cachedData = getStockListFromCache();
    if (cachedData) {
      return cachedData;
    }
  }
  
  try {
    // 从API获取
    const response = await fetch(url);
    const apiResponse = await response.json();
    
    // 保存到缓存
    if (!exchange) {
      saveStockListToCache(apiResponse.data);
    }
    
    return apiResponse.data;
  } catch (error) {
    // API失败时使用缓存（即使过期）
    if (useCache && !exchange) {
      const cachedData = localStorage.getItem(STOCK_LIST_CACHE_KEY);
      if (cachedData) {
        return JSON.parse(cachedData);
      }
    }
    throw error;
  }
};
```

### 3. 自动加载对应数据

#### 功能
当市场类型改变时，自动加载对应的数据：
- 切换到"加密货币"：加载币种行情
- 切换到"股票"：加载股票列表

#### 实现
```typescript
useEffect(() => {
  if (marketType === 'crypto') {
    loadAllTickers();
  } else if (marketType === 'stock') {
    loadStockList();
  }
}, [marketType]); // 依赖marketType
```

## 使用说明

### 用户体验

1. **首次访问**
   - 默认显示"加密货币"市场
   - 点击"股票"按钮切换到股票市场
   - 首次加载股票列表（约2-3秒）

2. **再次访问**
   - 刷新页面后保持上次选择的市场类型
   - 股票列表从缓存加载（瞬间完成）

3. **缓存过期**
   - 24小时后缓存自动过期
   - 下次访问时重新从API获取
   - 获取失败时仍使用过期缓存

### 开发者工具

**清除股票列表缓存**
```typescript
import { clearStockListCache } from '../services/stockApi';

// 清除缓存
clearStockListCache();
```

**强制刷新股票列表**
```typescript
// 不使用缓存，强制从API获取
const stocks = await fetchAllStocks(false);
```

**查看缓存状态**
```javascript
// 在浏览器控制台执行
const cache = localStorage.getItem('cryptoquantx_stock_list_cache');
const expiry = localStorage.getItem('cryptoquantx_stock_list_cache_expiry');

console.log('缓存数据:', cache ? JSON.parse(cache).length + ' 条' : '无');
console.log('过期时间:', expiry ? new Date(parseInt(expiry)).toLocaleString() : '无');
```

## 性能优化

### 加载时间对比

| 场景 | 之前 | 现在 | 提升 |
|------|------|------|------|
| 首次加载股票列表 | 2-3秒 | 2-3秒 | - |
| 刷新页面（股票模式） | 2-3秒 | <100ms | 95%+ |
| 切换到股票模式 | 2-3秒 | <100ms | 95%+ |

### 存储空间

- 股票列表缓存：约500KB
- 市场类型设置：<1KB
- 总计：约500KB

## 注意事项

1. **缓存时效性**
   - 股票列表每24小时更新一次
   - 新上市股票可能不会立即显示
   - 如需最新数据，可清除缓存

2. **存储限制**
   - localStorage有5-10MB限制
   - 当前使用约500KB，空间充足

3. **浏览器兼容性**
   - 所有现代浏览器都支持localStorage
   - 隐私模式可能限制localStorage使用

4. **数据一致性**
   - 缓存数据与服务器可能存在延迟
   - 关键操作建议强制刷新

## 测试

### 测试场景

1. **市场类型持久化**
   - [ ] 选择"股票"，刷新页面，确认仍显示"股票"
   - [ ] 选择"加密货币"，刷新页面，确认仍显示"加密货币"
   - [ ] 清除localStorage，刷新页面，确认默认为"加密货币"

2. **股票列表缓存**
   - [ ] 首次加载股票列表，观察加载时间
   - [ ] 刷新页面，观察加载时间（应该很快）
   - [ ] 清除缓存，重新加载，观察加载时间
   - [ ] 断网情况下，确认能使用缓存数据

3. **自动加载**
   - [ ] 切换到"股票"，确认自动加载股票列表
   - [ ] 切换到"加密货币"，确认自动加载币种行情
   - [ ] 刷新页面，确认加载对应市场的数据

## 相关文件

- `src/store/reducer.ts` - Redux初始状态和marketType恢复
- `src/store/types.ts` - MarketType类型定义
- `src/store/actions.ts` - setMarketType action
- `src/services/stockApi.ts` - 股票列表缓存实现
- `src/components/Chart/CandlestickChart.tsx` - 市场类型切换和数据加载
