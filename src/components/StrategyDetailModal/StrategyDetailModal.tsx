import React from 'react';
import './StrategyDetailModal.css';

interface StrategyDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  strategyCode: string;
  strategyName: string;
}

// 策略详细信息数据
const strategyDetails: Record<string, {
  introduction: string;
  logic: string[];
  advantages: string[];
  disadvantages: string[];
  parameters: string[];
  referenceUrl?: string;
}> = {
  'BollingerBandsStrategy': {
    introduction: '布林带策略是一种基于统计学原理的技术分析策略，通过计算价格的标准差来确定价格的波动范围。',
    logic: [
      '计算中轨：N日移动平均线（通常为20日）',
      '计算上轨：中轨 + K倍标准差（通常K=2）',
      '计算下轨：中轨 - K倍标准差',
      '买入信号：价格触及或跌破下轨时买入',
      '卖出信号：价格触及或突破上轨时卖出'
    ],
    advantages: [
      '能够自适应市场波动性',
      '在震荡市场中表现较好',
      '参数设置简单，易于理解'
    ],
    disadvantages: [
      '在趋势市场中可能产生频繁的假信号',
      '滞后性较强，可能错过最佳入场时机'
    ],
    parameters: [
      '周期（period）：计算移动平均线的天数，默认20',
      '标准差倍数（stdDev）：布林带宽度系数，默认2.0'
    ],
    referenceUrl: 'https://www.fmz.com/bbs-topic/9796'
  },
  'BOLL_STRATEGY': {
    introduction: '布林带策略是一种基于统计学原理的技术分析策略，通过计算价格的标准差来确定价格的波动范围。',
    logic: [
      '计算中轨：N日移动平均线（通常为20日）',
      '计算上轨：中轨 + K倍标准差（通常K=2）',
      '计算下轨：中轨 - K倍标准差',
      '买入信号：价格触及或跌破下轨时买入',
      '卖出信号：价格触及或突破上轨时卖出'
    ],
    advantages: [
      '能够自适应市场波动性',
      '在震荡市场中表现较好',
      '参数设置简单，易于理解'
    ],
    disadvantages: [
      '在趋势市场中可能产生频繁的假信号',
      '滞后性较强，可能错过最佳入场时机'
    ],
    parameters: [
      '周期（period）：计算移动平均线的天数，默认20',
      '标准差倍数（stdDev）：布林带宽度系数，默认2.0'
    ],
    referenceUrl: 'https://www.fmz.com/bbs-topic/9796'
  },
  'RSIStrategy': {
    introduction: 'RSI（相对强弱指标）策略通过计算一段时间内价格涨跌幅度的比率，判断市场的超买超卖状态。',
    logic: [
      '计算N日内的平均涨幅和平均跌幅',
      '计算相对强度RS = 平均涨幅 / 平均跌幅',
      '计算RSI = 100 - (100 / (1 + RS))',
      '买入信号：RSI < 30（超卖）',
      '卖出信号：RSI > 70（超买）'
    ],
    advantages: [
      '能够有效识别超买超卖区域',
      '适用于震荡市场',
      '信号明确，易于执行'
    ],
    disadvantages: [
      '在强趋势市场中可能长期处于超买或超卖状态',
      '可能产生钝化现象'
    ],
    parameters: [
      '周期（period）：计算RSI的天数，默认14',
      '超买线（overbought）：超买阈值，默认70',
      '超卖线（oversold）：超卖阈值，默认30'
    ],
    referenceUrl: 'https://www.fmz.com/bbs-topic/9797'
  },
  'RSI_STRATEGY': {
    introduction: 'RSI（相对强弱指标）策略通过计算一段时间内价格涨跌幅度的比率，判断市场的超买超卖状态。',
    logic: [
      '计算N日内的平均涨幅和平均跌幅',
      '计算相对强度RS = 平均涨幅 / 平均跌幅',
      '计算RSI = 100 - (100 / (1 + RS))',
      '买入信号：RSI < 30（超卖）',
      '卖出信号：RSI > 70（超买）'
    ],
    advantages: [
      '能够有效识别超买超卖区域',
      '适用于震荡市场',
      '信号明确，易于执行'
    ],
    disadvantages: [
      '在强趋势市场中可能长期处于超买或超卖状态',
      '可能产生钝化现象'
    ],
    parameters: [
      '周期（period）：计算RSI的天数，默认14',
      '超买线（overbought）：超买阈值，默认70',
      '超卖线（oversold）：超卖阈值，默认30'
    ],
    referenceUrl: 'https://www.fmz.com/bbs-topic/9797'
  },
  'MACDStrategy': {
    introduction: 'MACD（指数平滑异同移动平均线）策略通过快慢两条移动平均线的差值来判断趋势变化。',
    logic: [
      '计算快线EMA（12日）和慢线EMA（26日）',
      '计算DIF = 快线EMA - 慢线EMA',
      '计算DEA = DIF的9日EMA（信号线）',
      '计算MACD柱 = 2 × (DIF - DEA)',
      '买入信号：DIF上穿DEA（金叉）',
      '卖出信号：DIF下穿DEA（死叉）'
    ],
    advantages: [
      '能够捕捉中长期趋势',
      '信号相对稳定，假信号较少',
      '适合趋势市场'
    ],
    disadvantages: [
      '滞后性较强',
      '在震荡市场中表现不佳'
    ],
    parameters: [
      '快线周期（fastPeriod）：默认12',
      '慢线周期（slowPeriod）：默认26',
      '信号线周期（signalPeriod）：默认9'
    ],
    referenceUrl: 'https://www.fmz.com/bbs-topic/9798'
  },
  'MACD_STRATEGY': {
    introduction: 'MACD（指数平滑异同移动平均线）策略通过快慢两条移动平均线的差值来判断趋势变化。',
    logic: [
      '计算快线EMA（12日）和慢线EMA（26日）',
      '计算DIF = 快线EMA - 慢线EMA',
      '计算DEA = DIF的9日EMA（信号线）',
      '计算MACD柱 = 2 × (DIF - DEA)',
      '买入信号：DIF上穿DEA（金叉）',
      '卖出信号：DIF下穿DEA（死叉）'
    ],
    advantages: [
      '能够捕捉中长期趋势',
      '信号相对稳定，假信号较少',
      '适合趋势市场'
    ],
    disadvantages: [
      '滞后性较强',
      '在震荡市场中表现不佳'
    ],
    parameters: [
      '快线周期（fastPeriod）：默认12',
      '慢线周期（slowPeriod）：默认26',
      '信号线周期（signalPeriod）：默认9'
    ],
    referenceUrl: 'https://www.fmz.com/bbs-topic/9798'
  },
  'MovingAverageCrossStrategy': {
    introduction: '均线交叉策略是最经典的趋势跟踪策略之一，通过短期和长期移动平均线的交叉来判断买卖时机。',
    logic: [
      '计算短期移动平均线（如5日MA）',
      '计算长期移动平均线（如20日MA）',
      '买入信号：短期MA上穿长期MA（金叉）',
      '卖出信号：短期MA下穿长期MA（死叉）'
    ],
    advantages: [
      '逻辑简单，易于理解和执行',
      '能够捕捉中长期趋势',
      '适合趋势明显的市场'
    ],
    disadvantages: [
      '在震荡市场中会产生大量假信号',
      '滞后性较强，入场时机较晚'
    ],
    parameters: [
      '短期周期（shortPeriod）：短期均线天数，默认5',
      '长期周期（longPeriod）：长期均线天数，默认20'
    ],
    referenceUrl: 'https://www.fmz.com/strategy/358'
  },
  'MA_CROSS_STRATEGY': {
    introduction: '均线交叉策略是最经典的趋势跟踪策略之一，通过短期和长期移动平均线的交叉来判断买卖时机。',
    logic: [
      '计算短期移动平均线（如5日MA）',
      '计算长期移动平均线（如20日MA）',
      '买入信号：短期MA上穿长期MA（金叉）',
      '卖出信号：短期MA下穿长期MA（死叉）'
    ],
    advantages: [
      '逻辑简单，易于理解和执行',
      '能够捕捉中长期趋势',
      '适合趋势明显的市场'
    ],
    disadvantages: [
      '在震荡市场中会产生大量假信号',
      '滞后性较强，入场时机较晚'
    ],
    parameters: [
      '短期周期（shortPeriod）：短期均线天数，默认5',
      '长期周期（longPeriod）：长期均线天数，默认20'
    ],
    referenceUrl: 'https://www.fmz.com/strategy/358'
  },
  'KDJStrategy': {
    introduction: 'KDJ指标（随机指标）是一种超买超卖指标，通过计算最高价、最低价和收盘价之间的关系来判断市场状态。',
    logic: [
      '计算RSV = (收盘价 - N日最低价) / (N日最高价 - N日最低价) × 100',
      '计算K值 = 2/3 × 前一日K值 + 1/3 × 当日RSV',
      '计算D值 = 2/3 × 前一日D值 + 1/3 × 当日K值',
      '计算J值 = 3 × K值 - 2 × D值',
      '买入信号：K线上穿D线且J值 < 20',
      '卖出信号：K线下穿D线且J值 > 80'
    ],
    advantages: [
      '反应灵敏，能够提前发现转折点',
      '适合短线交易',
      '在震荡市场中表现较好'
    ],
    disadvantages: [
      '在强趋势市场中容易钝化',
      '假信号较多，需要配合其他指标使用'
    ],
    parameters: [
      '周期（period）：计算RSV的天数，默认9',
      '超买线（overbought）：超买阈值，默认80',
      '超卖线（oversold）：超卖阈值，默认20'
    ],
    referenceUrl: 'https://www.fmz.com/bbs-topic/9799'
  },
  'KDJ_STRATEGY': {
    introduction: 'KDJ指标（随机指标）是一种超买超卖指标，通过计算最高价、最低价和收盘价之间的关系来判断市场状态。',
    logic: [
      '计算RSV = (收盘价 - N日最低价) / (N日最高价 - N日最低价) × 100',
      '计算K值 = 2/3 × 前一日K值 + 1/3 × 当日RSV',
      '计算D值 = 2/3 × 前一日D值 + 1/3 × 当日K值',
      '计算J值 = 3 × K值 - 2 × D值',
      '买入信号：K线上穿D线且J值 < 20',
      '卖出信号：K线下穿D线且J值 > 80'
    ],
    advantages: [
      '反应灵敏，能够提前发现转折点',
      '适合短线交易',
      '在震荡市场中表现较好'
    ],
    disadvantages: [
      '在强趋势市场中容易钝化',
      '假信号较多，需要配合其他指标使用'
    ],
    parameters: [
      '周期（period）：计算RSV的天数，默认9',
      '超买线（overbought）：超买阈值，默认80',
      '超卖线（oversold）：超卖阈值，默认20'
    ],
    referenceUrl: 'https://www.fmz.com/bbs-topic/9799'
  },
  'GridTradingStrategy': {
    introduction: '网格交易策略是一种在特定价格区间内进行高抛低吸的策略，通过设置多个买卖价格网格来获利。',
    logic: [
      '设定价格区间的上限和下限',
      '在区间内均匀分布多个价格网格',
      '在每个网格价格下跌时买入',
      '在每个网格价格上涨时卖出',
      '循环往复，赚取价格波动的差价'
    ],
    advantages: [
      '适合震荡市场，能够持续获利',
      '不需要判断趋势方向',
      '风险相对可控'
    ],
    disadvantages: [
      '在单边趋势市场中可能面临较大亏损',
      '需要较多的初始资金',
      '可能错过大趋势行情'
    ],
    parameters: [
      '网格数量（gridCount）：价格区间内的网格数，默认10',
      '价格上限（upperPrice）：网格交易的最高价',
      '价格下限（lowerPrice）：网格交易的最低价',
      '每格投资额（gridAmount）：每个网格的交易金额'
    ],
    referenceUrl: 'https://www.fmz.com/strategy/137'
  },
  'GRID_STRATEGY': {
    introduction: '网格交易策略是一种在特定价格区间内进行高抛低吸的策略，通过设置多个买卖价格网格来获利。',
    logic: [
      '设定价格区间的上限和下限',
      '在区间内均匀分布多个价格网格',
      '在每个网格价格下跌时买入',
      '在每个网格价格上涨时卖出',
      '循环往复，赚取价格波动的差价'
    ],
    advantages: [
      '适合震荡市场，能够持续获利',
      '不需要判断趋势方向',
      '风险相对可控'
    ],
    disadvantages: [
      '在单边趋势市场中可能面临较大亏损',
      '需要较多的初始资金',
      '可能错过大趋势行情'
    ],
    parameters: [
      '网格数量（gridCount）：价格区间内的网格数，默认10',
      '价格上限（upperPrice）：网格交易的最高价',
      '价格下限（lowerPrice）：网格交易的最低价',
      '每格投资额（gridAmount）：每个网格的交易金额'
    ],
    referenceUrl: 'https://www.fmz.com/strategy/137'
  },
  'TurtleTradingStrategy': {
    introduction: '海龟交易策略是一个经典的趋势跟踪策略，通过突破N日最高价或最低价来判断入场和出场时机。',
    logic: [
      '入场信号：价格突破N日最高价（如20日）',
      '出场信号：价格跌破M日最低价（如10日）',
      '止损：入场价格的2倍ATR',
      '加仓：每上涨0.5倍ATR加仓一次，最多加仓3次'
    ],
    advantages: [
      '能够捕捉大趋势行情',
      '有明确的风险控制规则',
      '经过实战验证的经典策略'
    ],
    disadvantages: [
      '在震荡市场中表现不佳',
      '回撤可能较大',
      '需要较强的执行纪律'
    ],
    parameters: [
      '入场周期（entryPeriod）：突破周期，默认20',
      '出场周期（exitPeriod）：止损周期，默认10',
      'ATR周期（atrPeriod）：计算ATR的周期，默认20'
    ],
    referenceUrl: 'https://www.fmz.com/strategy/1234'
  },
  'TURTLE_STRATEGY': {
    introduction: '海龟交易策略是一个经典的趋势跟踪策略，通过突破N日最高价或最低价来判断入场和出场时机。',
    logic: [
      '入场信号：价格突破N日最高价（如20日）',
      '出场信号：价格跌破M日最低价（如10日）',
      '止损：入场价格的2倍ATR',
      '加仓：每上涨0.5倍ATR加仓一次，最多加仓3次'
    ],
    advantages: [
      '能够捕捉大趋势行情',
      '有明确的风险控制规则',
      '经过实战验证的经典策略'
    ],
    disadvantages: [
      '在震荡市场中表现不佳',
      '回撤可能较大',
      '需要较强的执行纪律'
    ],
    parameters: [
      '入场周期（entryPeriod）：突破周期，默认20',
      '出场周期（exitPeriod）：止损周期，默认10',
      'ATR周期（atrPeriod）：计算ATR的周期，默认20'
    ],
    referenceUrl: 'https://www.fmz.com/strategy/1234'
  }
};

const StrategyDetailModal: React.FC<StrategyDetailModalProps> = ({
  isOpen,
  onClose,
  strategyCode,
  strategyName
}) => {
  if (!isOpen) return null;

  const detail = strategyDetails[strategyCode];

  // 如果没有找到具体策略详情，提供通用介绍
  if (!detail) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="strategy-detail-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>{strategyName}</h2>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">
            <section className="detail-section">
              <h3>策略简介</h3>
              <p>这是一个量化交易策略，通过技术指标分析市场走势，自动生成买卖信号。</p>
            </section>

            <section className="detail-section">
              <h3>使用说明</h3>
              <ul>
                <li>在策略工厂页面选择该策略</li>
                <li>根据市场情况调整策略参数</li>
                <li>设置回测时间范围和初始资金</li>
                <li>点击"执行"按钮进行回测或实盘交易</li>
              </ul>
            </section>

            <section className="detail-section">
              <h3>风险提示</h3>
              <ul>
                <li>量化交易存在风险，历史回测结果不代表未来收益</li>
                <li>建议先进行充分的回测验证</li>
                <li>实盘交易前请做好风险控制和资金管理</li>
                <li>不同市场环境下策略表现可能差异较大</li>
              </ul>
            </section>

            <section className="detail-section">
              <h3>参考资料</h3>
              <p>更多策略详情和使用技巧，请参考：</p>
              <a 
                href="https://www.fmz.com/square" 
                target="_blank" 
                rel="noopener noreferrer"
                className="reference-link"
              >
                FMZ量化交易平台 →
              </a>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="strategy-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{strategyName}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <section className="detail-section">
            <h3>策略简介</h3>
            <p>{detail.introduction}</p>
          </section>

          <section className="detail-section">
            <h3>交易逻辑</h3>
            <ol>
              {detail.logic.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ol>
          </section>

          <section className="detail-section">
            <h3>策略优势</h3>
            <ul>
              {detail.advantages.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="detail-section">
            <h3>策略劣势</h3>
            <ul>
              {detail.disadvantages.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="detail-section">
            <h3>参数说明</h3>
            <ul>
              {detail.parameters.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>

          {detail.referenceUrl && (
            <section className="detail-section">
              <h3>参考资料</h3>
              <a 
                href={detail.referenceUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="reference-link"
              >
                查看详细文档 →
              </a>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default StrategyDetailModal;
