# 市场类型切换功能测试指南

## 功能说明

在前端左上角添加了加密货币/股票市场切换按钮，允许用户在两种市场类型之间切换。

## 实现的功能

### 1. Redux 状态管理
- 添加了 `marketType` 状态字段（'crypto' | 'stock'）
- 添加了 `SET_MARKET_TYPE` action
- 状态会保存到 localStorage，刷新页面后保持选择

### 2. UI 组件
- 在 GlobalNavbar 左上角 Logo 右侧添加了切换按钮
- 两个按钮：「加密货币」和「股票」
- 当前选中的按钮会高亮显示（绿色背景）

### 3. 数据获取
- 加密货币模式：调用 `/api/market/all_tickers` 获取主流币种行情
- 股票模式：调用 `/api/stock/market/ticker?tsCode=xxx` 获取主流股票行情

### 4. 显示差异
- 加密货币：显示 BTC、ETH、XRP、SOL、DOGE、SUI
- 股票：显示 000001.SZ、600519.SH、000858.SZ、600036.SH、601318.SH、000333.SZ
- 价格符号：加密货币显示 $，股票显示 ¥
- 代码格式：加密货币去掉 -USDT 后缀，股票去掉 .SZ/.SH 后缀

## 测试步骤

### 1. 启动后端服务
```bash
cd okx-trading
./rebuild-and-start.sh
```

### 2. 启动前端服务
```bash
cd cryptoquantx
npm start
```

### 3. 测试功能
1. 打开浏览器访问 http://localhost:3000
2. 查看左上角是否显示市场类型切换按钮
3. 默认应该显示「加密货币」模式（绿色高亮）
4. 右侧应该显示 BTC、ETH 等加密货币行情
5. 点击「股票」按钮
6. 按钮应该切换为绿色高亮
7. 右侧行情应该切换为股票数据
8. 价格符号应该从 $ 变为 ¥
9. 刷新页面，应该保持在股票模式

### 4. API 测试
测试股票 API 是否正常返回数据：

```bash
# 测试单个股票行情
curl "http://localhost:8088/api/stock/market/ticker?tsCode=000001.SZ"

# 测试连接
curl "http://localhost:8088/api/stock/market/test"
```

## 文件修改清单

### 前端文件
1. `cryptoquantx/src/store/types.ts` - 添加 MarketType 类型和 marketType 状态
2. `cryptoquantx/src/store/actions.ts` - 添加 setMarketType action
3. `cryptoquantx/src/store/reducer.ts` - 添加 SET_MARKET_TYPE reducer
4. `cryptoquantx/src/components/GlobalNavbar.tsx` - 添加切换按钮和股票数据获取逻辑
5. `cryptoquantx/src/components/GlobalNavbar.css` - 添加切换按钮样式

### 后端文件
1. `okx-trading/src/main/java/com/okx/trading/service/impl/TushareApiServiceImpl.java` - 修复 getTicker 方法，添加涨跌幅计算

## 注意事项

1. 确保后端 Tushare API 配置正确（token、代理等）
2. 股票数据需要交易日才有更新
3. 如果股票 API 返回空数据，检查：
   - Tushare token 是否有效
   - 代理配置是否正确
   - 是否在交易时间
4. 前端会每30秒自动刷新行情数据

## 样式说明

切换按钮样式：
- 未选中：灰色文字，透明背景
- 悬停：浅灰色背景
- 选中：白色文字，绿色背景
- 按钮圆角：6px
- 按钮间距：4px
