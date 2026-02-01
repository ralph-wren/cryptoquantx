# Telegram News Page 分页与自适应布局更新文档

## 1. 需求背景
用户希望“电报新闻”页面的分页模块与其他页面（如策略工厂）保持一致，要求：
1.  **分页居中**：分页按钮组在页面底部居中显示。
2.  **移除滚动条**：页面不应出现滚动条，内容应刚好填充一页。
3.  **自适应每页数量**：根据当前窗口高度，自动计算每页应显示的消息数量，确保刚好填满页面且不溢出。

## 2. 修改内容

### 2.1 样式调整 (CSS)
文件：`src/pages/TelegramNewsPage.css`

1.  **分页容器居中**：
    *   修改 `.pagination-container` 的 `justify-content` 属性为 `center`，使其水平居中。
    *   保留 `flex-shrink: 0` 防止被压缩。

2.  **移除滚动条与固定行高**：
    *   `.messages-list-view` 设置 `overflow-y: hidden`，强制隐藏垂直滚动条。
    *   `.message-row` 设置固定高度 `height: 110px`（包含 padding），确保每行高度一致，便于计算。
    *   `.message-text` 添加多行文本截断（`-webkit-line-clamp: 2`），限制文本最多显示 2 行，防止内容过多撑开高度。
    *   调整间距 `gap: 12px` 和内边距 `padding: 16px` 以优化空间利用。

### 2.2 逻辑调整 (React/TypeScript)
文件：`src/pages/TelegramNewsPage.tsx`

1.  **自适应页大小计算**：
    *   引入 `useEffect` 监听窗口大小变化（`resize` 事件）和频道列表变化（`channels` 变化可能改变头部高度）。
    *   实现 `calculatePageSize` 函数：
        *   获取页面各部分高度：导航栏 (60px)、头部 (动态获取或估算)、频道列表 (动态获取)、分页栏 (固定 52px)、内边距 (48px)。
        *   计算可用高度：`Available Height = Window Height - Overheads`。
        *   计算每页条数：`Page Size = floor(Available Height / Item Height)`，其中 Item Height 为 122px (110px 行高 + 12px 间距)。
    *   当计算出的 `pageSize` 变化时，更新状态，触发重新加载。

2.  **移除手动分页选择器**：
    *   删除了手动选择“每页 10/20/50 条”的下拉框及相关处理函数 `handlePageSizeChange`，完全交由自适应逻辑控制。

## 3. 效果展示
*   **布局**：页面高度固定为视口高度，无滚动条。
*   **内容**：消息列表根据窗口大小自动调整条数，铺满列表区域。
*   **分页**：分页按钮在底部居中显示，风格与策略工厂一致。

## 4. 依赖项
*   无新增依赖。
