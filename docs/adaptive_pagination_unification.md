# 自适应分页统一改造文档

## 背景
为了统一各个页面的分页体验，要求所有列表页面（历史回测、策略工厂、批量回测、实盘策略、指标分布）的分页控件位置一致（底部居中），页面无垂直滚动条，且每页显示的数据条数根据窗口高度自适应计算。

## 解决方案

### 1. 核心 Hook: `useAdaptivePagination`
创建了通用的 Hook `src/hooks/useAdaptivePagination.ts`，用于封装自适应分页逻辑。

```typescript
// 核心参数
interface AdaptivePaginationOptions {
  rowHeight: number;           // 表格行高 (px)
  minPageSize?: number;        // 最小每页条数
  navbarHeight?: number;       // 顶部导航栏高度 (如有)
  basePadding?: number;        // 页面基础内边距
  getOtherElementsHeight?: () => number; // 计算页面其他固定元素高度的回调
  dependencies?: any[];        // 触发重新计算的依赖项
}
```

### 2. 改造页面详情
对以下页面进行了改造，均已接入 `useAdaptivePagination`：

1.  **历史回测 (BacktestSummaryPage)**
    *   **状态管理**: 使用 `adaptivePageSize` 接收 Hook 返回值，通过 `useEffect` 更新组件状态 `pageSize`，避免与本地状态变量命名冲突。
    *   **CSS**: 统一 `.backtest-summary-page` 为 flex 布局，分页居中。

2.  **策略工厂 (BacktestFactoryPage)**
    *   **状态管理**: 将 Hook 返回的 `pageSize` 映射到组件状态 `itemsPerPage`。
    *   **行高**: 固定为 100px。

3.  **批量回测 (BatchBacktestPage)**
    *   **状态管理**: 正常接入，行高 50px。

4.  **实盘策略 (RealTimeStrategyPage)**
    *   **状态管理**: 正常接入，行高预估 60px。
    *   **CSS**: 确保表格容器 `flex: 1` 且无滚动条。

5.  **指标分布 (IndicatorDistributionPage)**
    *   **状态管理**: 移除 `INDICATORS_PER_PAGE` 常量，完全依赖自适应计算。
    *   **行高**: 固定为 50px。

### 3. CSS 统一规范
所有改造页面的 CSS 遵循以下规范：

*   **页面容器**:
    ```css
    height: 100vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 20px 20px 0 20px; /* 统一样式 */
    ```
*   **表格容器**:
    ```css
    flex-grow: 1;
    overflow-y: hidden; /* 隐藏垂直滚动条 */
    ```
*   **分页容器**:
    ```css
    margin-top: auto;
    flex-shrink: 0;
    display: flex;
    justify-content: center;
    border-top: 1px solid #2a2a3a;
    padding-top: 15px;
    padding-bottom: 20px;
    ```

## 验证
*   所有页面在窗口大小改变时，每页条数会自动调整。
*   分页控件统一位于页面底部居中。
*   页面无垂直滚动条。

## 常见问题与修复
*   **变量名冲突**: 在接入 Hook 时，如果组件内已有 `pageSize` 状态，建议解构时重命名，例如 `const { pageSize: adaptivePageSize } = useAdaptivePagination(...)`，然后通过 `useEffect` 同步状态。
*   **初始闪烁**: Hook 内部已有防抖和初始计算逻辑，但首次加载时可能从默认值跳变到计算值，属正常现象。

## 后续维护
新增列表页面时，请直接使用 `useAdaptivePagination` Hook，并参考上述 CSS 规范进行布局。
