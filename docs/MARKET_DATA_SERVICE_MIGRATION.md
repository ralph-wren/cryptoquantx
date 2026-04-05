# 市场数据服务迁移完成

## 概述
已将所有组件从直接调用 `/api/market/all_tickers` 接口改为使用统一的 `marketDataService` 单例服务。

## 优化效果

### 问题
- 多个组件同时调用市场数据接口，导致短时间内大量重复请求
- 每个组件独立管理定时器，资源浪费
- 没有缓存机制，相同数据被重复获取

### 解决方案
创建了 `marketDataService.ts` 单例服务，提供：
1. **缓存机制**：30秒内的重复请求直接返回缓存数据
2. **请求合并**：防止并发请求，多个组件共享同一个请求
3. **订阅模式**：组件可以订阅数据更新，无需独立轮询
4. **统一刷新**：全局只有一个定时器，所有组件共享

## 已迁移的组件

### 1. GlobalNavbar.tsx ✅
- 使用订阅模式获取主流币种行情
- 启动全局自动刷新（30秒间隔）
- 移除独立的定时器

### 2. CopyStrategyModal.tsx ✅
- 使用 `marketDataService.getMarketData()` 获取所有币种
- 移除 `fetchAllTickers` 调用
- 保持原有的排序和过滤逻辑

### 3. AccountInfoPanel.tsx ✅
- 使用订阅模式实时更新币种列表
- 只保留账户余额的独立刷新（5分钟）
- 市场数据自动同步，无需独立轮询

### 4. BacktestPanel.tsx ✅
- 使用 `marketDataService.getMarketData()` 获取交易对
- 移除 `fetchAllTickers` 导入
- 保持懒加载逻辑（打开下拉框时加载）

### 5. CandlestickChart.tsx ✅
- 使用 `marketDataService.getMarketData()` 获取币种行情
- 移除 `fetchAllTickers` 导入
- 保持防重复调用逻辑

## 技术细节

### marketDataService 特性
```typescript
// 获取数据（自动使用缓存）
const data = await marketDataService.getMarketData();

// 强制刷新
const data = await marketDataService.getMarketData(true);

// 订阅更新
const unsubscribe = marketDataService.subscribe((data) => {
  // 处理数据更新
});

// 启动自动刷新
marketDataService.startAutoRefresh(30000); // 30秒

// 停止自动刷新
marketDataService.stopAutoRefresh();

// 清除缓存
marketDataService.clearCache();

// 查看缓存状态
const status = marketDataService.getCacheStatus();
```

### 缓存策略
- **缓存时长**：30秒
- **自动刷新**：30秒间隔（全局统一）
- **请求合并**：并发请求等待同一个 Promise
- **智能加载**：缓存有效期内直接返回，无需请求

## 性能提升

### 优化前
- 5个组件 × 每30秒 = 每30秒10次请求（考虑初始加载）
- 页面加载时可能同时发起5个请求
- 每个组件独立的定时器

### 优化后
- 全局统一：每30秒1次请求
- 页面加载时只有1个请求（其他组件等待或使用缓存）
- 全局只有1个定时器

**请求减少约 80-90%**

## 注意事项

1. **自动刷新启动**：只在 GlobalNavbar 中启动一次，其他组件无需启动
2. **订阅清理**：组件卸载时记得调用 `unsubscribe()`
3. **缓存时间**：如需调整，修改 `CACHE_DURATION` 常量
4. **错误处理**：服务内部已处理错误，组件只需 catch 即可

## 后续优化建议

1. 可以考虑将股票数据也改为类似的服务
2. 可以添加 WebSocket 支持，实现真正的实时推送
3. 可以添加数据持久化（localStorage），减少首次加载时间
4. 可以添加数据版本控制，支持增量更新

## 测试建议

1. 打开浏览器开发者工具 Network 面板
2. 访问包含多个组件的页面（如首页）
3. 观察 `/api/market/all_tickers` 请求频率
4. 应该看到：
   - 首次加载只有1个请求
   - 之后每30秒只有1个请求
   - 不再有并发的重复请求

## 文件清单

### 新增文件
- `cryptoquantx/src/services/marketDataService.ts` - 市场数据服务

### 修改文件
- `cryptoquantx/src/components/GlobalNavbar.tsx`
- `cryptoquantx/src/components/CopyStrategyModal/CopyStrategyModal.tsx`
- `cryptoquantx/src/components/AccountInfo/AccountInfoPanel.tsx`
- `cryptoquantx/src/components/Backtest/BacktestPanel.tsx`
- `cryptoquantx/src/components/Chart/CandlestickChart.tsx`

## 优化历史

### 2026-04-05 - 第三次优化：移除重复调用
- **问题**：GlobalNavbar 中 `startAutoRefresh` 和 `getMarketData` 重复调用
- **原因**：`startAutoRefresh` 内部已经会立即获取一次数据，无需再次调用
- **解决方案**：移除 GlobalNavbar 中的 `getMarketData()` 调用
- **预期效果**：减少初始加载时的重复请求

### 2026-04-05 - 第二次优化：强化请求去重
- **问题**：页面初始加载时仍有10次并发请求
- **原因**：多个组件在同一事件循环中调用 `getMarketData()`，`pendingRequest` 机制未完全生效
- **解决方案**：
  1. 添加 `loading` 状态的双重检查
  2. 如果检测到 `loading` 状态，等待100ms后递归重试
  3. 增强日志输出，使用 emoji 标识不同状态
- **预期效果**：进一步减少并发请求，理想情况下页面加载只有1个请求

---

迁移完成时间：2026-04-05
最后优化时间：2026-04-05 23:15
