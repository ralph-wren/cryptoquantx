# 修复策略工厂和实盘策略按钮丢失问题

## 问题描述
用户反馈在 `策略工厂` (BacktestFactoryPage) 和 `实盘策略` (RealTimeStrategyPage) 页面中，操作栏的按钮丢失或不可见。即使用了初步的 CSS 宽度调整后，问题依然存在。

## 深入原因分析
1. **BacktestFactoryPage**:
   - `.strategy-table` 和 `.strategy-body` 原本设置了 `overflow: hidden`，目的是为了隐藏滚动条。
   - Flex 布局中，如果子元素总宽度超过容器，且容器禁止溢出，超出的部分（通常是右侧的操作栏）会被直接切掉。
   - 仅仅增加列宽反而加剧了溢出，导致按钮更容易被切掉。
   - 表头和表体是分离的 Flex 容器，如果只让表体滚动，表头会对不齐。

2. **RealTimeStrategyPage**:
   - 表格宽度可能超过了视口宽度，虽然有 `overflow-x: auto`，但用户可能没注意到水平滚动条，或者希望按钮始终可见。

## 解决方案

### 1. 策略工厂 (BacktestFactoryPage)
修改 `src/pages/BacktestFactoryPage.css`，实施 **Sticky（粘性）布局** + **水平滚动** 方案：

- **容器调整**:
  - `.strategy-table`: 添加 `overflow-x: auto`，使其成为水平滚动容器。
  - `.strategy-body`: 改为 `overflow: visible`，允许内容撑开宽度。
  - `.strategy-header` & `.strategy-body`: 设置 `width: max-content` 和 `min-width: 100%`，确保表头和表体宽度一致且不会被压缩。

- **操作栏悬浮 (Sticky)**:
  - `.strategy-cell.action`: 设置 `position: sticky; right: 0`。
  - 添加 `z-index` 和 `box-shadow`，使操作栏悬浮在内容之上。
  - 分别设置表头和表体的背景色 (`#16213e` 和 `#1a1a2e`)，防止内容重叠时透视。

- **行高固定**:
  - `.strategy-row`: 强制 `height: 100px`，确保与自适应分页计算的高度一致，防止垂直溢出。

### 2. 实盘策略 (RealTimeStrategyPage)
修改 `src/pages/RealTimeStrategyPage.css`：

- **操作栏悬浮 (Sticky)**:
  - `td:last-child`, `th:last-child`: 设置 `position: sticky; right: 0`。
  - 设置背景色 (`#252936` 和 `#2e3241`) 和 `z-index`，确保按钮始终可见，不随表格水平滚动而消失。

## 效果
- **按钮始终可见**：无论屏幕多窄，操作栏都会固定在右侧，不会被切掉。
- **内容自适应**：其他列保持原有宽度或自适应，如果内容过宽，可以通过水平滚动查看，但操作栏永远在手边。
- **无缝体验**：表头和表体对齐，背景色无缝衔接。

## 验证结论
代码审查确认 CSS 选择器正确，Sticky 属性兼容现代浏览器，布局逻辑（Flex + Sticky）能够解决溢出隐藏问题。
