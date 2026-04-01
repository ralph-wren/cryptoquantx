# 市场类型切换功能 - 完整实现文档

## 功能概述

在前端左上角添加了加密货币/股票市场切换功能，用户可以在两种市场类型之间自由切换，查看不同市场的实时行情数据。

## 功能特性

### 1. 市场类型切换
- 支持「加密货币」和「股票」两种市场类型
- 切换按钮位于左上角 Logo 右侧
- 当前选中的市场类型会高亮显示（绿色背景）
- 切换状态会保存到 localStorage，刷新页面后保持

### 2. 实时行情显示
- 加密货币模式：显示 BTC、ETH、XRP、SOL、DOGE、SUI 等主流币种
- 股票模式：显示 000001.SZ（平安银行）、600519.SH（贵州茅台）等主流股票
- 每30秒自动刷新行情数据
- 显示最新价格和涨跌幅

### 3. 差异化显示
- 价格符号：加密货币使用 $，股票使用 ¥
- 代码格式：加密货币去掉 -USDT 后缀，股票去掉 .SZ/.SH 后缀
- 涨跌幅颜色：上涨显示绿色，下跌显示红色

## 技术实现

### 前端实现

#### 1. Redux 状态管理
**文件：** `src/store/types.ts`
```typescript
// 新增市场类型
export type MarketType = 'crypto' | 'stock';

// AppState 中新增字段
export interface AppState {
  marketType: MarketType; // 市场类型
  // ... 其他字段
}
```

**文件：** `src/store/actions.ts`
```typescript
// 新增 action 类型
export enum ActionType {
  SET_MARKET_TYPE = 'SET_MARKET_TYPE',
  // ... 其他 actions
}

// 新增 action creator
export const setMarketType = (marketType: MarketType) => ({
  type: ActionType.SET_MARKET_TYPE,
  payload: marketType
});
```

**文件：** `src/store/reducer.ts`
```typescript
// 初始状态包含 marketType
const initialState: AppState = {
  marketType: savedSettings?.marketType || 'crypto',
  // ... 其他字段
};

// reducer 处理 SET_MARKET_TYPE
case ActionType.SET_MARKET_TYPE:
  return {
    ...state,
    marketType: action.payload
  };
```

#### 2. UI 组件
**文件：** `src/components/GlobalNavbar.tsx`

主要功能：
- 使用 `useSelector` 获取当前市场类型
- 使用 `useDispatch` 更新市场类型
- 根据市场类型调用不同的 API
- 格式化显示不同市场的数据

关键代码片段：
```typescript
// 获取市场类型
const marketType = useSelector((state: AppState) => state.marketType);

// 切换市场类型
const handleMarketTypeChange = (type: MarketType) => {
  dispatch(setMarketType(type));
  // 保存到 localStorage
  localStorage.setItem('cryptoquantx_chart_settings', JSON.stringify({
    ...settings,
    marketType: type
  }));
};

// 根据市场类型获取数据
if (marketType === 'crypto') {
  // 调用加密货币 API
  fetch('/api/market/all_tickers?filter=all&limit=2000')
} else {
  // 调用股票 API
  fetch(`/api/stock/market/ticker?tsCode=${stockCode}`)
}
```

**文件：** `src/components/GlobalNavbar.css`

新增样式：
```css
.market-type-toggle {
  display: flex;
  align-items: center;
  margin-left: 20px;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 4px;
}

.market-type-btn {
  padding: 6px 16px;
  font-size: 14px;
  color: #a0a0a0;
  background-color: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.market-type-btn.active {
  color: #ffffff;
  background-color: #4CAF50;
  font-weight: 600;
}
```

### 后端实现

#### 1. 股票行情接口
**文件：** `src/main/java/com/okx/trading/controller/StockMarketController.java`

已有接口：
- `GET /api/stock/market/ticker?tsCode={code}` - 获取单个股票行情
- `GET /api/stock/market/test` - 测试 Tushare 连接
- `GET /api/stock/market/kline/daily` - 获取日线数据
- `GET /api/stock/market/stock/list` - 获取股票列表

#### 2. Tushare 服务实现
**文件：** `src/main/java/com/okx/trading/service/impl/TushareApiServiceImpl.java`

关键改进：
- `getTicker` 方法现在会获取最近2天的数据来计算涨跌幅
- 返回的 Ticker 对象包含 `priceChange` 和 `priceChangePercent` 字段

```java
@Override
public Ticker getTicker(String tsCode) {
    // 获取最近2天的日线数据来计算涨跌幅
    List<Candlestick> klines = getDailyKlineData(tsCode, null, null, 2);
    
    if (klines.size() >= 2) {
        Candlestick latestKline = klines.get(klines.size() - 1);
        Candlestick previousKline = klines.get(klines.size() - 2);
        
        // 计算涨跌幅
        BigDecimal priceChange = latestKline.getClose().subtract(previousKline.getClose());
        BigDecimal priceChangePercent = priceChange
                .divide(previousKline.getClose(), 4, BigDecimal.ROUND_HALF_UP)
                .multiply(new BigDecimal("100"));
        
        ticker.setPriceChange(priceChange);
        ticker.setPriceChangePercent(priceChangePercent);
    }
    
    return ticker;
}
```

## 数据流程

### 加密货币模式
```
用户点击「加密货币」按钮
  ↓
dispatch(setMarketType('crypto'))
  ↓
Redux 更新 marketType 状态
  ↓
useEffect 监听到变化，触发 fetchMarketData()
  ↓
调用 /api/market/all_tickers
  ↓
筛选主流币种 (BTC, ETH, XRP, SOL, DOGE, SUI)
  ↓
更新 tickers 状态
  ↓
UI 显示加密货币行情（$ 符号）
```

### 股票模式
```
用户点击「股票」按钮
  ↓
dispatch(setMarketType('stock'))
  ↓
Redux 更新 marketType 状态
  ↓
useEffect 监听到变化，触发 fetchMarketData()
  ↓
循环调用 /api/stock/market/ticker?tsCode=xxx
  ↓
获取主流股票 (000001.SZ, 600519.SH, 等)
  ↓
更新 tickers 状态
  ↓
UI 显示股票行情（¥ 符号）
```

## 测试步骤

### 1. 启动后端服务
```bash
cd okx-trading
./rebuild-and-start.sh
```

### 2. 测试股票 API
```bash
cd okx-trading
./test-stock-ticker-api.sh
```

预期输出：
```
测试 Tushare 连接...
{
  "code": 200,
  "msg": "Tushare API连接成功",
  "data": true
}

获取 000001.SZ 行情...
  ✓ 000001.SZ: ¥12.34 (+1.23%)
```

### 3. 启动前端服务
```bash
cd cryptoquantx
npm install  # 首次运行需要安装依赖
npm start
```

### 4. 浏览器测试
1. 打开 http://localhost:3000
2. 查看左上角是否显示切换按钮
3. 默认应该是「加密货币」模式（绿色高亮）
4. 右侧显示 BTC、ETH 等币种行情
5. 点击「股票」按钮
6. 按钮切换为绿色高亮
7. 右侧行情切换为股票数据
8. 价格符号从 $ 变为 ¥
9. 刷新页面，应该保持在股票模式

## 主流股票列表

当前显示的主流股票：
- 000001.SZ - 平安银行
- 600519.SH - 贵州茅台
- 000858.SZ - 五粮液
- 600036.SH - 招商银行
- 601318.SH - 中国平安
- 000333.SZ - 美的集团

可以在 `GlobalNavbar.tsx` 中修改 `mainStocks` 数组来自定义显示的股票。

## 主流加密货币列表

当前显示的主流币种：
- BTC-USDT - 比特币
- ETH-USDT - 以太坊
- XRP-USDT - 瑞波币
- SOL-USDT - Solana
- DOGE-USDT - 狗狗币
- SUI-USDT - Sui

可以在 `GlobalNavbar.tsx` 中修改 `mainCoins` 数组来自定义显示的币种。

## 注意事项

### 1. 后端配置
确保 `application.properties` 中配置了正确的 Tushare token：
```properties
tushare.token=your_tushare_token_here
tushare.proxy.enabled=true
tushare.proxy.host=127.0.0.1
tushare.proxy.port=7890
```

### 2. 股票数据限制
- 股票数据只在交易日更新
- 非交易时间可能返回前一交易日的数据
- Tushare API 有调用频率限制

### 3. 代理配置
如果 Tushare API 访问失败，检查：
- Clash 代理是否正常运行
- 代理端口是否正确（默认 7890）
- 防火墙是否允许连接

### 4. 前端缓存
市场类型选择会保存到 localStorage：
- 键名：`cryptoquantx_chart_settings`
- 包含字段：`marketType`, `selectedPair`, `timeframe`, `dateRange`

## 文件清单

### 前端修改文件
1. `cryptoquantx/src/store/types.ts` - 添加 MarketType 类型
2. `cryptoquantx/src/store/actions.ts` - 添加 setMarketType action
3. `cryptoquantx/src/store/reducer.ts` - 添加 marketType 状态处理
4. `cryptoquantx/src/components/GlobalNavbar.tsx` - 添加切换按钮和逻辑
5. `cryptoquantx/src/components/GlobalNavbar.css` - 添加按钮样式

### 后端修改文件
1. `okx-trading/src/main/java/com/okx/trading/service/impl/TushareApiServiceImpl.java` - 修复 getTicker 方法

### 新增文件
1. `cryptoquantx/test-market-toggle.md` - 测试指南
2. `cryptoquantx/MARKET_TOGGLE_FEATURE.md` - 功能文档（本文件）
3. `okx-trading/test-stock-ticker-api.sh` - API 测试脚本

## 未来改进建议

1. 添加更多股票市场（港股、美股）
2. 支持自定义股票/币种列表
3. 添加搜索功能，快速查找股票/币种
4. 显示更多行情信息（成交量、市值等）
5. 添加收藏功能，保存常用股票/币种
6. 支持多个市场同时显示
7. 添加行情提醒功能

## 故障排查

### 问题1：切换按钮不显示
- 检查 Redux store 是否正确配置
- 检查浏览器控制台是否有错误
- 清除浏览器缓存重试

### 问题2：股票数据不显示
- 运行 `./test-stock-ticker-api.sh` 测试后端 API
- 检查 Tushare token 是否有效
- 检查代理配置是否正确
- 查看后端日志：`tail -f logs/app.log`

### 问题3：切换后数据不更新
- 检查浏览器控制台网络请求
- 确认 useEffect 依赖项包含 marketType
- 检查 fetchMarketData 函数是否正确执行

### 问题4：刷新后状态丢失
- 检查 localStorage 是否正常工作
- 查看浏览器开发工具 → Application → Local Storage
- 确认 `cryptoquantx_chart_settings` 键存在

## 联系支持

如有问题，请查看：
- 后端日志：`okx-trading/logs/app.log`
- 前端控制台：浏览器开发者工具 Console
- API 文档：http://localhost:8088/swagger-ui/index.html
