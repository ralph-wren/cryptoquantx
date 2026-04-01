# CryptoQuantX

CryptoQuantX是一个专注于加密货币量化交易的专业平台，提供高级K线图表展示、策略回测和实盘交易功能。

## 📁 项目结构

```
cryptoquantx/
├── docs/              # 📚 项目文档
│   ├── README.md      # 文档目录说明
│   ├── MARKET_TOGGLE_FEATURE.md
│   ├── STOCK_SELECTOR_IMPLEMENTATION.md
│   └── ...
├── src/               # 源代码
│   ├── components/    # React组件
│   ├── services/      # API服务
│   ├── store/         # Redux状态管理
│   ├── utils/         # 工具函数
│   └── test/          # 测试代码
├── public/            # 静态资源
├── README.md          # 项目主文档
└── ...
```

## 功能特点

- 专业K线图表展示，支持多种技术指标和自定义指标
- 实时市场数据查询和历史数据加载
- 交易对和时间周期自由切换
- 支持加密货币和A股市场切换
- AI辅助量化交易策略生成与开发
- 完整的回测系统和批量回测功能
- 实盘交易接口集成
- 策略性能分析与评估
- 指标分布分析工具

![img_1.png](images/img_1.png)

## 回测系统

CryptoQuantX提供了功能强大的回测系统，支持多种量化交易策略的历史表现回测：

![img.png](images/img.png)

### 支持的策略

- **SMA (简单移动平均线)** - 基于短期和长期移动平均线的交叉信号产生买卖信号
- **MACD (异同移动平均线)** - 基于MACD线与信号线的交叉以及柱状图的变化产生买卖信号
- **RSI (相对强弱指标)** - 基于RSI指标的超买超卖区域产生买卖信号
- **Bollinger Bands (布林带)** - 基于价格突破布林带上下轨或回归中轨产生买卖信号
- **ATR (真实波幅)** - 基于价格波动幅度的动态止损和进场信号
- **自定义策略** - 通过AI辅助生成或手动编写的自定义交易策略

![img_2.png](images/img_2.png)

### 回测功能

- **参数化设置** - 自定义初始资金、交易对、时间周期、手续费率等关键参数
- **回测结果分析** - 计算并展示总收益、收益率、胜率、最大回撤、夏普比率等关键指标
- **回测汇总页面** - 查看和管理所有回测记录，支持多维度排序和筛选功能
- **回测详情** - 查看每笔交易的详情信息，包括入场时间、价格、盈亏等
- **图形化展示** - 结合K线图直观展示交易时点和结果
- **批量回测** - 支持多策略、多周期、多交易对的批量回测功能
- **回测数据导出** - 支持回测结果数据导出和共享

![img_3.png](images/img_3.png)

![img_4.png](images/img_4.png)

### AI策略生成

CryptoQuantX集成了先进的AI模型，支持通过自然语言描述生成交易策略：

- **自然语言描述** - 使用普通语言描述您的交易思路
- **代码生成** - AI自动将描述转化为可执行的策略代码
- **即时回测** - 生成策略后可立即进行回测验证
- **策略优化** - 根据回测结果调整和优化生成的策略

### 指标分布分析

- **指标值分布** - 分析技术指标在不同市场环境下的分布情况
- **盈亏相关性** - 评估指标值与交易盈亏的相关性
- **优化参数选择** - 帮助优化策略参数设置

### 使用方法

1. **K线图表查看**
   - 选择交易对和时间周期
   - 添加技术指标
   - 使用绘图工具进行技术分析

2. **策略回测**
   - 选择策略类型或使用AI生成策略
   - 设置回测参数（初始资金、时间范围、交易对、时间周期、手续费率等）
   - 点击"运行回测"按钮开始回测过程
   - 查看回测结果，包括总体指标和交易详情列表
   - 通过"回测明细"按钮查看更详细的分析

3. **批量回测**
   - 在批量回测页面设置多个策略参数组合
   - 设置公共参数（时间范围、初始资金等）
   - 运行批量回测并查看汇总结果

4. **实盘交易**
   - 配置API密钥
   - 选择交易策略
   - 设置风险参数
   - 启动实盘交易系统

## 技术栈

- React 18 + TypeScript
- Redux 状态管理
- Lightweight Charts 图表库
- RESTful API 集成
- WebSocket实时数据

## 快速开始

### 安装依赖

```bash
# 使用npm
npm install

# 或使用pnpm
pnpm install
```

### 环境变量配置

复制环境变量示例文件并根据需要修改：

```bash
cp .env.example .env
```

主要配置项：

- `REACT_APP_API_URL` - 后端API地址
- `REACT_APP_ENABLE_STAGEWISE` - 控制Stagewise工具栏的显示（true/false，默认为false）
- `REACT_APP_ENV` - 环境标识（development/production）

**注意：** Stagewise工具栏仅在开发环境下可用。

### 启动开发服务器

```bash
npm start
```

应用将在 http://localhost:3000 运行

### 构建生产版本

```bash
npm run build
```

## API 接口

系统集成了以下API接口：

- **市场数据**
  - `/api/market/fetch_history_with_integrity_check` - 查询并检查历史K线数据完整性
  - `/api/market/klines` - 获取K线数据

- **回测接口**
  - `/api/backtest/ta4j/strategies` - 获取可用的回测策略列表
  - `/api/backtest/ta4j/run` - 运行回测并返回结果
  - `/api/backtest/ta4j/run-all` - 运行批量回测
  - `/api/backtest/summaries` - 获取回测汇总数据
  - `/api/backtest/detail/{id}` - 获取特定回测的详细交易记录

- **AI策略生成**
  - `/api/backtest/ta4j/generate-strategy` - 通过AI生成交易策略

- **指标分析**
  - `/api/indicator-distribution/data` - 获取指标分布数据

## 项目结构

```
src/
  ├── components/      # UI组件
  │   ├── Chart/       # 图表相关组件
  │   ├── Backtest/    # 回测相关组件
  │   ├── DataLoadModal/ # 数据加载弹窗
  │   ├── GenerateStrategyModal/ # AI策略生成组件
  │   ├── OrderBook/   # 订单簿组件
  │   └── ...
  ├── pages/           # 页面组件
  │   ├── BacktestSummaryPage/ # 回测汇总页面
  │   ├── BacktestDetailPage/  # 回测详情页面
  │   ├── BatchBacktestPage/   # 批量回测页面
  │   ├── IndicatorDistributionPage/ # 指标分布分析页面
  │   ├── RealTimeStrategyPage/ # 实盘策略页面
  │   └── ...
  ├── services/        # API服务
  ├── store/           # Redux状态管理
  ├── utils/           # 工具函数
  ├── constants/       # 常量定义
  ├── types/           # TypeScript类型定义
  └── ...
```

## 部署指南

### Docker部署

项目提供了Docker配置，可以使用以下命令进行构建和部署：

```bash
# 构建Docker镜像
docker build -t cryptoquantx-frontend .

# 运行Docker容器
docker run -p 80:80 cryptoquantx-frontend
```

### Nginx配置

生产环境推荐使用Nginx作为Web服务器，基本配置如下：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /path/to/cryptoquantx/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend-server:8088;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 贡献指南

欢迎提交问题和功能请求。对于重大更改，请先打开一个issue讨论您想要更改的内容。

## 许可证

[MIT](https://choosealicense.com/licenses/mit/)
