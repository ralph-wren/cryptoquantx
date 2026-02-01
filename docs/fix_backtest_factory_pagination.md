# 修复策略工厂页面分页显示问题文档

## 问题背景
用户反馈“策略工厂”页面的分页按钮没有显示，而“电报咨询”页面的分页模块显示正常。需要修复策略工厂页面的分页问题，使其与电报咨询页面的分页模块完全一致。

## 问题分析
通过对比 `BacktestFactoryPage` 和 `TelegramNewsPage` 的代码和样式，发现以下几个问题：
1.  **布局差异**：`BacktestFactoryPage` 的容器样式与 `TelegramNewsPage` 不一致，导致在某些屏幕高度下，固定的 9 条每页记录加上头部和过滤器高度超出了视口，而分页容器又被 `overflow: hidden` 隐藏了。
2.  **样式不统一**：分页按钮的颜色、大小和布局逻辑与电报咨询页面存在差异。
3.  **自适应参数不准确**：`useAdaptivePagination` 的 `navbarHeight` 和 `basePadding` 设置不准确，导致计算出的每页条数不能完美填充页面。
4.  **逻辑细节**：`handlePageChange` 中滚动的目标元素类名错误（应该是 `.strategy-body` 而不是 `.strategy-grid`）。

## 解决步骤

### 1. 统一容器样式
修改 `BacktestFactoryPage.css`，将页面容器的样式调整为与电报咨询页面一致，使用 `calc(100vh - 60px)` 并配合 `flex` 布局。

```css
.backtest-factory-page {
  padding: 24px;
  max-width: 98%;
  margin: 0 auto;
  height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
  background-color: #171b26;
}
```

### 2. 统一分页模块样式
更新 `.pagination-container` 及其子元素的样式，包括颜色（使用蓝色背景）、间距和按钮状态。

```css
.pagination-button {
  height: 36px;
  background-color: rgb(41, 98, 255);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}
```

### 3. 优化自适应计算逻辑
在 `BacktestFactoryPage.tsx` 中更新 `useAdaptivePagination` 的参数：
*   `navbarHeight` 设置为 60（导航栏高度）。
*   `basePadding` 设置为 48（上下内边距之和）。
*   更新 `getOtherElementsHeight` 以准确获取当前页面各元素的高度。

### 4. 修复跳转滚动逻辑
将 `handlePageChange` 中的滚动逻辑修正为指向 `.strategy-body`。

```typescript
const handlePageChange = (newPage: number) => {
  if (newPage >= 1 && newPage <= totalPages) {
    setCurrentPage(newPage);
    const listContainer = document.querySelector('.strategy-body');
    if (listContainer) {
      listContainer.scrollTop = 0;
    }
  }
};
```

## 验证结果
*   分页按钮现在正确显示在页面底部居中位置。
*   样式与电报咨询页面完全一致（蓝色按钮、统一的信息展示）。
*   页面不再出现外部滚动条，且每页显示的条数会随窗口大小自动调整。
*   点击分页按钮后，列表会自动滚动回顶部。
