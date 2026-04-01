# 股票选择器实现方案

## 需求
当切换到股票模式时：
1. 交易对下拉菜单显示股票列表而不是加密货币
2. 支持按板块筛选：全部、主板、创业板、科创板、北交所
3. 支持搜索股票代码和名称

## 实现步骤

### 1. 已完成
- ✅ 创建了 `src/constants/stocks.ts` 定义股票常量和工具函数
- ✅ 定义了板块类型和常用股票列表

### 2. 需要修改的文件

#### `src/components/Chart/CandlestickChart.tsx`

需要添加的状态：
```typescript
// 股票板块筛选
const [selectedStockMarket, setSelectedStockMarket] = useState<StockMarket>('all');

// 股票列表（从常量或API获取）
const [stockList, setStockList] = useState<Array<{
  code: string;
  name: string;
  market: StockMarket;
}>>([]);
```

需要修改的逻辑：
1. 在交易对下拉菜单中添加板块筛选器（仅股票模式显示）
2. 根据 `marketType` 显示不同的列表：
   - `crypto`: 显示加密货币列表
   - `stock`: 显示股票列表
3. 搜索逻辑需要支持股票代码和名称搜索
4. 筛选逻辑需要支持按板块筛选

#### 修改交易对下拉菜单结构

```tsx
{dropdownOpen && (
  <div className="pair-dropdown">
    {/* 股票模式：显示板块筛选器 */}
    {marketType === 'stock' && (
      <div className="stock-market-filter">
        {STOCK_MARKETS.map(market => (
          <button
            key={market.value}
            className={`market-filter-btn ${selectedStockMarket === market.value ? 'active' : ''}`}
            onClick={() => setSelectedStockMarket(market.value as StockMarket)}
          >
            {market.label}
          </button>
        ))}
      </div>
    )}
    
    {/* 搜索框 */}
    <input
      type="text"
      placeholder={marketType === 'crypto' ? '搜索币种...' : '搜索股票代码或名称...'}
      value={searchPair}
      onChange={(e) => setSearchPair(e.target.value)}
      className="pair-search-input"
    />
    
    {/* 列表 */}
    <div className="pair-list">
      {displayedItems.map(item => (
        <div
          key={item.symbol}
          className={`pair-item ${item.symbol === selectedPair ? 'selected' : ''}`}
          onClick={() => selectPair(item.symbol)}
        >
          {/* 根据市场类型显示不同内容 */}
        </div>
      ))}
    </div>
  </div>
)}
```

#### 筛选逻辑

```typescript
// 根据市场类型和筛选条件过滤列表
const filteredItems = useMemo(() => {
  if (marketType === 'crypto') {
    // 加密货币筛选逻辑（原有逻辑）
    return allTickers.filter(ticker => 
      ticker.symbol.toLowerCase().includes(searchPair.toLowerCase())
    );
  } else {
    // 股票筛选逻辑
    let filtered = COMMON_STOCKS;
    
    // 按板块筛选
    if (selectedStockMarket !== 'all') {
      filtered = filtered.filter(stock => stock.market === selectedStockMarket);
    }
    
    // 按搜索词筛选
    if (searchPair) {
      const search = searchPair.toLowerCase();
      filtered = filtered.filter(stock => 
        stock.code.toLowerCase().includes(search) ||
        stock.name.toLowerCase().includes(search)
      );
    }
    
    return filtered;
  }
}, [marketType, searchPair, selectedStockMarket, allTickers]);
```

### 3. CSS 样式

需要在 `CandlestickChart.css` 中添加：

```css
/* 股票板块筛选器 */
.stock-market-filter {
  display: flex;
  gap: 8px;
  padding: 10px;
  border-bottom: 1px solid #2e3241;
  flex-wrap: wrap;
}

.market-filter-btn {
  padding: 6px 12px;
  font-size: 13px;
  color: #a0a0a0;
  background-color: transparent;
  border: 1px solid #2e3241;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.market-filter-btn:hover {
  color: #e6e6e6;
  border-color: #4CAF50;
}

.market-filter-btn.active {
  color: #ffffff;
  background-color: #4CAF50;
  border-color: #4CAF50;
}
```

### 4. 数据流程

#### 加密货币模式
```
用户打开下拉菜单
  ↓
调用 /api/market/all_tickers 获取币种列表
  ↓
显示加密货币列表
  ↓
用户搜索/选择
```

#### 股票模式
```
用户打开下拉菜单
  ↓
显示常用股票列表（COMMON_STOCKS）
  ↓
用户选择板块筛选（全部/主板/创业板/科创板/北交所）
  ↓
根据板块过滤股票列表
  ↓
用户搜索股票代码或名称
  ↓
用户选择股票
```

### 5. 未来优化

1. **从后端获取完整股票列表**
   - 调用 `/api/stock/market/stock/list` 获取所有股票
   - 需要后端返回股票名称和板块信息

2. **缓存股票列表**
   - 将股票列表缓存到 localStorage
   - 定期更新（每天一次）

3. **显示更多信息**
   - 股票当前价格
   - 涨跌幅
   - 成交量

4. **收藏功能**
   - 允许用户收藏常用股票
   - 在列表顶部显示收藏的股票

## 实现优先级

### P0 - 必须实现
- ✅ 创建股票常量文件
- ⏳ 修改交易对选择器，支持股票模式
- ⏳ 添加板块筛选器
- ⏳ 支持搜索股票代码和名称

### P1 - 重要但不紧急
- 从后端API获取完整股票列表
- 显示股票实时价格和涨跌幅
- 缓存股票列表

### P2 - 可选功能
- 收藏功能
- 按涨跌幅排序
- 按成交量排序

## 测试要点

1. 切换到股票模式，下拉菜单应显示股票列表
2. 板块筛选器应正常工作
3. 搜索功能应支持代码和名称
4. 选择股票后应正确更新 selectedPair
5. 切换回加密货币模式，应恢复显示币种列表
