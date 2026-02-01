# 消息列表展示与交互优化文档

## 1. 需求分析
用户希望在订阅频道后：
1.  **列表展示**：以列表形式展示最新消息。
2.  **自动刷新**：页面内容自动更新，保持最新。
3.  **点击跳转**：点击消息行可以直接跳转到原文链接（Telegram 或 OKX 公告）。

## 2. 修改内容

### 2.1 前端交互优化 (`TelegramNewsPage.tsx`)
*   **点击跳转逻辑**：
    *   为每条消息行 (`message-row`) 添加了点击事件。
    *   **普通 Telegram 频道**：根据 `chatTitle` (频道 Handle) 和 `messageId` 拼接 URL：`https://t.me/{handle}/{messageId}`。
    *   **OKX 公告**：识别 `OKX公告` 标题，从消息原始内容 (HTML) 中解析出 `href` 链接并跳转。
*   **自动刷新优化**：
    *   将自动刷新间隔从 60 秒缩短为 30 秒，提升实时性。
    *   使用 `setInterval` 定时调用 `fetchMessages`。

### 2.2 样式优化 (`TelegramNewsPage.css`)
*   **交互反馈**：
    *   为 `.message-row` 添加 `cursor: pointer`，提示用户该区域可点击。

## 3. 关键代码片段

```typescript
// 跳转逻辑
const handleMessageClick = (msg: TelegramMessage) => {
    if (msg.chatTitle === 'OKX公告' || msg.chatTitle === 'OKX Announcements') {
        // 从 HTML 中提取链接
        const match = msg.text.match(/href="([^"]*)"/);
        if (match && match[1]) {
            window.open(match[1], '_blank');
        }
    } else {
        // Telegram 链接拼接
        window.open(`https://t.me/${msg.chatTitle}/${msg.messageId}`, '_blank');
    }
};

// 自动刷新 (30s)
useEffect(() => {
    const timer = setInterval(() => {
        fetchMessages(page);
    }, 30000);
    return () => clearInterval(timer);
}, [fetchMessages, page]);
```

## 4. 验证
*   点击消息列表中的任意一行，应能在新标签页打开对应的 Telegram 消息或 OKX 公告页面。
*   页面每 30 秒会自动重新加载消息列表。
