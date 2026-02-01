# 刷新按钮样式优化文档

## 1. 需求分析
用户反馈原有的刷新按钮“看着没什么用”，原因是原按钮仅为一个圆形图标，语义不够明显。用户希望将其改为明确的“刷新按钮”。

## 2. 修改方案
*   **文案增强**：在刷新图标旁增加“刷新”文字，明确按钮功能。
*   **样式调整**：
    *   将按钮形状从圆形改为圆角矩形（Pill/Rounded Rect）。
    *   增加背景色和边框，使其在深色背景下更显眼。
    *   采用蓝色主色调，与页面其他交互元素保持一致。

## 3. 修改内容

### 3.1 结构修改 (`TelegramNewsPage.tsx`)
在 `<button>` 标签内添加了“刷新”文本，并稍微缩小了图标尺寸（20px -> 16px）以适配文字排版。

```tsx
<button 
    className={`refresh-btn ${isRefreshing ? 'spinning' : ''}`} 
    onClick={handleManualRefresh}
    title="手动刷新"
>
    <svg viewBox="0 0 24 24" width="16" height="16" ...>...</svg>
    刷新
</button>
```

### 3.2 样式修改 (`TelegramNewsPage.css`)
重写了 `.refresh-btn` 及其悬停状态的样式：

```css
.refresh-btn {
    background: rgba(41, 121, 255, 0.1); /* 蓝色背景 */
    border: 1px solid rgba(41, 121, 255, 0.3); /* 蓝色边框 */
    color: #2979ff; /* 蓝色文字 */
    padding: 8px 16px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px; /* 图标与文字间距 */
    /* ... */
}

.refresh-btn:hover {
    background: rgba(41, 121, 255, 0.2);
    border-color: rgba(41, 121, 255, 0.5);
}
```

## 4. 验证结果
按钮现在是一个明显的蓝色矩形按钮，包含“刷新”文字和旋转图标，用户能一眼识别其功能，且点击反馈（旋转动画）依然保留。
