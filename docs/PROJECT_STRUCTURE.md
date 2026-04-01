# 前端项目结构整理说明

## 整理日期
2026-04-01

## 整理内容

为了更好地组织前端项目文件，我们对项目结构进行了重新整理：

### 1. 文档文件 (*.md)
- **位置**: `docs/` 目录
- **数量**: 23个文档文件
- **说明**: 所有Markdown文档（除README.md外）都移动到docs目录
- **包含**: 功能实现文档、UI改进说明、测试文档等

## 目录结构

```
cryptoquantx/
├── README.md                           # 项目主文档（保留在根目录）
├── docs/                               # 📚 所有文档文件
│   ├── README.md                      # 文档目录说明
│   ├── MARKET_TOGGLE_FEATURE.md       # 市场切换功能
│   ├── STOCK_SELECTOR_IMPLEMENTATION.md # 股票选择器实现
│   ├── IMPLEMENTATION_SUMMARY.md       # 实现总结
│   └── ...（共23个文档）
├── src/                                # 源代码
│   ├── components/                    # React组件
│   │   ├── Chart/                    # 图表组件
│   │   ├── Backtest/                 # 回测组件
│   │   └── ...
│   ├── services/                      # API服务
│   │   ├── api.ts                    # 主API服务
│   │   └── stockApi.ts               # 股票API服务
│   ├── store/                         # Redux状态管理
│   │   ├── types.ts
│   │   ├── actions.ts
│   │   └── reducer.ts
│   ├── constants/                     # 常量定义
│   │   ├── trading.ts                # 交易常量
│   │   └── stocks.ts                 # 股票常量
│   ├── utils/                         # 工具函数
│   │   └── indicators.ts             # 指标计算
│   └── test/                          # 测试代码
├── public/                             # 静态资源
├── package.json
└── ...
```

## 文档分类

### 功能实现文档
- 市场类型切换功能
- 股票选择器实现
- 功能完成说明

### UI/UX改进文档
- Telegram风格UI重设计
- 图表对齐修复
- 按钮可见性修复
- 搜索下拉框位置修复

### 分页功能文档
- 自适应分页统一
- 动态频道分页
- 回测工厂分页修复

### Telegram集成文档
- Telegram集成说明
- 新闻自适应分页
- 频道交互功能

## 使用说明

### 查看文档
```bash
# 查看所有文档
ls docs/

# 查看特定文档
cat docs/MARKET_TOGGLE_FEATURE.md
```

### 开发
```bash
# 安装依赖
npm install

# 启动开发服务器
npm start

# 构建生产版本
npm run build
```

## 优势

1. **清晰的结构**: 文档集中管理，易于查找和维护
2. **便于协作**: 团队成员可以快速找到相关文档
3. **标准化**: 符合React项目的标准目录结构
4. **可扩展**: 为未来添加更多文档预留了空间

## 最新功能

### 股票市场支持
- 支持加密货币和A股市场切换
- 动态加载股票列表（从Tushare API）
- 按板块筛选（主板、创业板、科创板、北交所）
- 股票代码和名称搜索

### 技术栈
- React 18
- TypeScript
- Redux (状态管理)
- Lightweight Charts (图表库)
- Ant Design (UI组件库)
