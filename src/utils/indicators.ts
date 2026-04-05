import { CandlestickData } from "../store/types";

/**
 * 技术指标计算工具库
 */

// 检查数据是否有效 (非空且包含有效值)
export const hasValidData = (data: any[]): boolean => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return false;
  }

  // 检查是否至少有一个有效值
  return data.some(value => value !== null && value !== undefined && !isNaN(value));
};

// 填充数组中的null值，使用前后有效值的平均或最近的有效值
export const fillNullValues = (data: any[]): any[] => {
  if (!data || !Array.isArray(data)) {
    return [];
  }

  const result = [...data];

  // 从前向后填充
  let lastValidValue = null;
  for (let i = 0; i < result.length; i++) {
    if (result[i] === null || result[i] === undefined || isNaN(result[i])) {
      if (lastValidValue !== null) {
        result[i] = lastValidValue;
      }
    } else {
      lastValidValue = result[i];
    }
  }

  // 从后向前填充剩余的null值
  lastValidValue = null;
  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i] === null || result[i] === undefined || isNaN(result[i])) {
      if (lastValidValue !== null) {
        result[i] = lastValidValue;
      } else {
        // 如果没有有效值，用0填充
        result[i] = 0;
      }
    } else {
      lastValidValue = result[i];
    }
  }

  return result;
};

// 辅助函数：安全获取数组值
const safeValue = (value: any): number | null => {
  return value === undefined || value === null || isNaN(value) ? null : value;
};

/**
 * 计算简单移动平均线 (SMA)
 */
export const calculateSMA = (data: number[], period: number): number[] => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.warn('calculateSMA: 无效的输入数据');
    return [];
  }

  const result: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN); // 数据不足时填充NaN
      continue;
    }

    let sum = 0;
    let validCount = 0;
    for (let j = 0; j < period; j++) {
      const value = data[i - j];
      if (value !== undefined && !isNaN(value)) {
        sum += value;
        validCount++;
      }
    }

    if (validCount > 0) {
      result.push(sum / validCount);
    } else {
      result.push(NaN);
    }
  }

  return result;
};

/**
 * 计算指数移动平均线 (EMA)
 */
export const calculateEMA = (data: number[], period: number): number[] => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.warn('calculateEMA: 无效的输入数据');
    return [];
  }

  const result: number[] = [];
  const k = 2 / (period + 1);

  // 过滤掉undefined和NaN值
  const cleanData = data.map(x => x !== undefined && !isNaN(x) ? x : null);
  const validData = cleanData.filter(x => x !== null) as number[];

  if (validData.length < period) {
    console.warn('calculateEMA: 有效数据不足');
    return Array(data.length).fill(NaN);
  }

  // 第一个值使用SMA
  let firstSMA = 0;
  let validCount = 0;

  for (let i = 0; i < period && i < data.length; i++) {
    if (cleanData[i] !== null) {
      firstSMA += cleanData[i] as number;
      validCount++;
    }
  }

  if (validCount === 0) {
    console.warn('calculateEMA: 初始周期内无有效数据');
    return Array(data.length).fill(NaN);
  }

  let ema = firstSMA / validCount;

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }

    if (i === period - 1) {
      result.push(ema);
      continue;
    }

    const currentValue = cleanData[i];
    if (currentValue !== null) {
      ema = currentValue * k + ema * (1 - k);
      result.push(ema);
    } else {
      result.push(ema); // 保持上一个EMA值
    }
  }

  return result;
};

/**
 * 计算MACD指标
 */
export const calculateMACD = (
  closePrices: number[]
): {
  macd: number[],
  signal: number[],
  histogram: number[]
} => {
  if (!hasValidData(closePrices)) {
    console.warn('calculateMACD: 无效的输入数据');
    return {
      macd: Array(closePrices.length).fill(NaN),
      signal: Array(closePrices.length).fill(NaN),
      histogram: Array(closePrices.length).fill(NaN)
    };
  }

  try {
    // 检查数据是否足够
    if (closePrices.length < 26) {
      console.warn('calculateMACD: 数据点不足，至少需要26个点');
      return {
        macd: Array(closePrices.length).fill(NaN),
        signal: Array(closePrices.length).fill(NaN),
        histogram: Array(closePrices.length).fill(NaN)
      };
    }

    // 清理数据，替换无效值
    const cleanPrices = closePrices.map(price =>
      price === undefined || isNaN(price) ? null : price
    );

    // 填充null值
    const filledPrices = fillNullValues(cleanPrices);
    const validPrices = filledPrices.filter(x => x !== null) as number[];

    if (validPrices.length < 26) {
      console.warn('calculateMACD: 有效数据点不足');
      return {
        macd: Array(closePrices.length).fill(NaN),
        signal: Array(closePrices.length).fill(NaN),
        histogram: Array(closePrices.length).fill(NaN)
      };
    }

    // 计算EMA
    const ema12 = calculateEMA(closePrices, 12);
    const ema26 = calculateEMA(closePrices, 26);

    if (!hasValidData(ema12) || !hasValidData(ema26)) {
      console.warn('calculateMACD: EMA计算结果无效');
      return {
        macd: Array(closePrices.length).fill(NaN),
        signal: Array(closePrices.length).fill(NaN),
        histogram: Array(closePrices.length).fill(NaN)
      };
    }

    const macdLine: number[] = [];

    for (let i = 0; i < closePrices.length; i++) {
      if (i < 25) {
        // 前26个点没有完整的EMA26值，填充NaN而不是0
        macdLine.push(NaN);
        continue;
      }

      if (isNaN(ema12[i]) || isNaN(ema26[i])) {
        // 若任一EMA值无效，填充NaN
        macdLine.push(NaN);
      } else {
        macdLine.push(ema12[i] - ema26[i]);
      }
    }

    // 保留NaN值，不要转换为0
    const safeMACD = macdLine;

    // 计算信号线 (9日EMA of MACD)
    // 只对有效的MACD值计算信号线
    const signalData: number[] = [];
    
    // 前25个点（对应MACD的无效部分）填充NaN，后续由signalEMA补充（signalEMA前8个也是NaN）
    for (let i = 0; i < 25; i++) {
      signalData.push(NaN);
    }
    
    // 从第35个点开始计算信号线
    if (macdLine.length > 34) {
      // 提取有效的MACD值用于计算信号线
      const validMACDValues = macdLine.slice(25); // 从第26个点开始的MACD值
      const signalEMA = calculateEMA(validMACDValues, 9);
      
      // 将计算出的信号线值添加到结果中
      for (let i = 0; i < signalEMA.length; i++) {
        signalData.push(signalEMA[i]);
      }
    }
    
    const safeSignal = signalData;

    // 计算柱状图
    const histogram = safeMACD.map((value, i) => {
      if (i >= safeSignal.length || isNaN(value) || isNaN(safeSignal[i])) return NaN;
      return value - safeSignal[i];
    });

    return {
      macd: safeMACD,
      signal: safeSignal,
      histogram
    };
  } catch (error) {
    console.error('calculateMACD错误:', error);
    return {
      macd: Array(closePrices.length).fill(NaN),
      signal: Array(closePrices.length).fill(NaN),
      histogram: Array(closePrices.length).fill(NaN)
    };
  }
};

/**
 * 计算RSI指标
 */
export const calculateRSI = (closePrices: number[], period: number = 14): number[] => {
  if (!hasValidData(closePrices)) {
    console.warn('calculateRSI: 无效的输入数据');
    return Array(closePrices.length).fill(NaN);
  }

  try {
    if (closePrices.length <= period) {
      console.warn('calculateRSI: 数据点不足');
      return Array(closePrices.length).fill(NaN);
    }

    // 清理数据，替换无效值
    const cleanPrices = closePrices.map(price =>
      price === undefined || isNaN(price) ? null : price
    );

    // 填充null值
    const filledPrices = fillNullValues(cleanPrices);
    const validPrices = filledPrices.filter(x => x !== null) as number[];

    if (validPrices.length <= period) {
      console.warn('calculateRSI: 有效数据点不足');
      return Array(closePrices.length).fill(NaN);
    }

    const rsi: number[] = [];

    // 先填充前period个点为NaN
    for (let i = 0; i < period; i++) {
      rsi.push(NaN);
    }

    // 计算首个period周期的平均涨跌
    let gainSum = 0;
    let lossSum = 0;
    let validChanges = 0;

    for (let i = 1; i <= period; i++) {
      const current = filledPrices[i];
      const previous = filledPrices[i-1];

      if (current === null || previous === null) {
        continue;
      }

      const change = current - previous;
      if (change >= 0) {
        gainSum += change;
      } else {
        lossSum += Math.abs(change);
      }
      validChanges++;
    }

    if (validChanges === 0) {
      console.warn('calculateRSI: 首个周期内无有效变化');
      return Array(closePrices.length).fill(NaN);
    }

    let avgGain = gainSum / validChanges;
    let avgLoss = lossSum / validChanges;

    // 计算首个RSI值
    const firstRSI = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));
    rsi.push(firstRSI);

    // 使用平滑RSI计算后续值
    for (let i = period + 1; i < closePrices.length; i++) {
      const current = filledPrices[i];
      const previous = filledPrices[i-1];

      if (current === null || previous === null) {
        // 如果当前点或前一个点无效，使用前一个RSI值
        rsi.push(rsi[i-period-1]);
        continue;
      }

      const change = current - previous;
      const currentGain = change >= 0 ? change : 0;
      const currentLoss = change < 0 ? Math.abs(change) : 0;

      // 使用平滑RSI算法
      avgGain = ((avgGain * (period - 1)) + currentGain) / period;
      avgLoss = ((avgLoss * (period - 1)) + currentLoss) / period;

      if (avgLoss === 0) {
        rsi.push(100);
      } else {
        const rs = avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
      }
    }

    return rsi;
  } catch (error) {
    console.error('calculateRSI错误:', error);
    return Array(closePrices.length).fill(NaN);
  }
};

/**
 * 计算KDJ指标
 */
export const calculateKDJ = (
  highPrices: number[],
  lowPrices: number[],
  closePrices: number[],
  period: number = 9
): { k: number[], d: number[], j: number[] } => {
  if (!hasValidData(highPrices) || !hasValidData(lowPrices) || !hasValidData(closePrices)) {
    console.warn('calculateKDJ: 无效的输入数据');
    const length = Math.max(
      highPrices ? highPrices.length : 0,
      lowPrices ? lowPrices.length : 0,
      closePrices ? closePrices.length : 0
    );
    return {
      k: Array(length).fill(NaN),
      d: Array(length).fill(NaN),
      j: Array(length).fill(NaN)
    };
  }

  try {
    // 确保所有数组长度一致
    const length = Math.min(highPrices.length, lowPrices.length, closePrices.length);
    if (length <= period) {
      console.warn('calculateKDJ: 数据点不足');
      return {
        k: Array(length).fill(NaN),
        d: Array(length).fill(NaN),
        j: Array(length).fill(NaN)
      };
    }

    // 清理数据，替换无效值
    const cleanHighs = highPrices.slice(0, length).map(price =>
      price === undefined || isNaN(price) ? null : price
    );

    const cleanLows = lowPrices.slice(0, length).map(price =>
      price === undefined || isNaN(price) ? null : price
    );

    const cleanCloses = closePrices.slice(0, length).map(price =>
      price === undefined || isNaN(price) ? null : price
    );

    // 填充null值
    const filledHighs = fillNullValues(cleanHighs);
    const filledLows = fillNullValues(cleanLows);
    const filledCloses = fillNullValues(cleanCloses);

    // 验证有足够的有效数据
    const validDataPoints = filledHighs.filter((v, i) =>
      v !== null && filledLows[i] !== null && filledCloses[i] !== null
    ).length;

    if (validDataPoints <= period) {
      console.warn('calculateKDJ: 有效数据点不足');
      return {
        k: Array(length).fill(NaN),
        d: Array(length).fill(NaN),
        j: Array(length).fill(NaN)
      };
    }

    const k: number[] = [];
    const d: number[] = [];
    const j: number[] = [];

    // 先填充前period-1个点为NaN
    for (let i = 0; i < period - 1; i++) {
      k.push(NaN);
      d.push(NaN);
      j.push(NaN);
    }

    let lastK = 50; // 初始K值为50
    let lastD = 50; // 初始D值为50

    for (let i = period - 1; i < length; i++) {
      // 查找当前周期内的最高价和最低价
      let highestHigh = -Infinity;
      let lowestLow = Infinity;
      let validCount = 0;

      for (let j = i - period + 1; j <= i; j++) {
        if (j < 0) continue;

        const high = filledHighs[j];
        const low = filledLows[j];

        if (high !== null && low !== null) {
          highestHigh = Math.max(highestHigh, high);
          lowestLow = Math.min(lowestLow, low);
          validCount++;
        }
      }

      // 如果没有足够的有效数据，或者最高价等于最低价，使用前一个值
      const current = filledCloses[i];

      if (validCount === 0 || highestHigh === -Infinity || lowestLow === Infinity ||
          Math.abs(highestHigh - lowestLow) < 0.000001 || current === null) {
        k.push(lastK);
        d.push(lastD);
        j.push(3 * lastK - 2 * lastD);
        continue;
      }

      // 计算RSV
      const rsv = ((current - lowestLow) / (highestHigh - lowestLow)) * 100;

      // 计算K值
      const currentK = (2 / 3) * lastK + (1 / 3) * rsv;
      k.push(currentK);
      lastK = currentK;

      // 计算D值
      const currentD = (2 / 3) * lastD + (1 / 3) * currentK;
      d.push(currentD);
      lastD = currentD;

      // 计算J值
      const currentJ = 3 * currentK - 2 * currentD;
      j.push(currentJ);
    }

    return { k, d, j };
  } catch (error) {
    console.error('calculateKDJ错误:', error);
    const length = Math.min(highPrices.length, lowPrices.length, closePrices.length);
    return {
      k: Array(length).fill(NaN),
      d: Array(length).fill(NaN),
      j: Array(length).fill(NaN)
    };
  }
};

/**
 * 计算布林带指标
 */
export const calculateBollingerBands = (
  closePrices: number[],
  period: number = 20,
  multiplier: number = 2
): { upper: number[], middle: number[], lower: number[] } => {
  if (!closePrices || !Array.isArray(closePrices) || closePrices.length === 0) {
    console.warn('calculateBollingerBands: 无效的输入数据');
    return { upper: [], middle: [], lower: [] };
  }

  try {
    if (closePrices.length < period) {
      console.warn('calculateBollingerBands: 数据点不足');
      return {
        upper: Array(closePrices.length).fill(NaN),
        middle: Array(closePrices.length).fill(NaN),
        lower: Array(closePrices.length).fill(NaN)
      };
    }

    const middle: number[] = calculateSMA(closePrices, period);
    const upper: number[] = [];
    const lower: number[] = [];

    for (let i = 0; i < closePrices.length; i++) {
      if (i < period - 1 || isNaN(middle[i])) {
        upper.push(NaN);
        lower.push(NaN);
        continue;
      }

      let sum = 0;
      let validCount = 0;
      for (let j = i - period + 1; j <= i; j++) {
        if (closePrices[j] !== undefined && !isNaN(closePrices[j]) && !isNaN(middle[i])) {
          sum += Math.pow(closePrices[j] - middle[i], 2);
          validCount++;
        }
      }

      if (validCount === 0) {
        upper.push(NaN);
        lower.push(NaN);
        continue;
      }

      // 使用样本标准差（除以 period，而不是 validCount）
      // 这与大多数金融平台的计算方式一致
      const stdDev = Math.sqrt(sum / period);
      upper.push(middle[i] + multiplier * stdDev);
      lower.push(middle[i] - multiplier * stdDev);
    }

    return { upper, middle, lower };
  } catch (error) {
    console.error('calculateBollingerBands错误:', error);
    return {
      upper: Array(closePrices.length).fill(NaN),
      middle: Array(closePrices.length).fill(NaN),
      lower: Array(closePrices.length).fill(NaN)
    };
  }
};

/**
 * 从K线数据提取收盘价
 */
export const extractClosePrices = (data: CandlestickData[]): number[] => {
  return data.map(item => item.close);
};

/**
 * 从K线数据提取最高价
 */
export const extractHighPrices = (data: CandlestickData[]): number[] => {
  return data.map(item => item.high);
};

/**
 * 从K线数据提取最低价
 */
export const extractLowPrices = (data: CandlestickData[]): number[] => {
  return data.map(item => item.low);
};

/**
 * 计算库存相对强弱指标 (StockRSI)
 */
export const calculateStockRSI = (closePrices: number[], period: number = 14, stochPeriod: number = 14): number[] => {
  if (!hasValidData(closePrices)) {
    console.warn('calculateStockRSI: 无效的输入数据');
    return Array(closePrices.length).fill(NaN);
  }

  try {
    // 首先计算RSI
    const rsi = calculateRSI(closePrices, period);

    // 如果RSI计算失败，返回NaN数组
    if (!hasValidData(rsi)) {
      console.warn('calculateStockRSI: RSI计算失败');
      return Array(closePrices.length).fill(NaN);
    }

    const stockRSI: number[] = [];

    // 前 period + stochPeriod - 1 个点没有足够数据，填充NaN
    for (let i = 0; i < period + stochPeriod - 1; i++) {
      stockRSI.push(NaN);
    }

    // 计算StockRSI
    for (let i = period + stochPeriod - 1; i < closePrices.length; i++) {
      // 找出stochPeriod周期内的最高和最低RSI
      let highest = -Infinity;
      let lowest = Infinity;
      let validCount = 0;

      for (let j = i - stochPeriod + 1; j <= i; j++) {
        if (!isNaN(rsi[j])) {
          highest = Math.max(highest, rsi[j]);
          lowest = Math.min(lowest, rsi[j]);
          validCount++;
        }
      }

      if (validCount === 0 || highest === -Infinity || lowest === Infinity || Math.abs(highest - lowest) < 0.000001) {
        // 如果没有有效数据或最高值等于最低值，使用前一个值或填充0
        stockRSI.push(stockRSI.length > 0 ? stockRSI[stockRSI.length - 1] : 0);
      } else {
        // 计算当前RSI在区间内的位置 (0-100%)
        const currentRSI = rsi[i];
        const value = ((currentRSI - lowest) / (highest - lowest)) * 100;
        stockRSI.push(value);
      }
    }

    return stockRSI;
  } catch (error) {
    console.error('calculateStockRSI错误:', error);
    return Array(closePrices.length).fill(NaN);
  }
};

/**
 * 计算抛物线转向指标 (SAR)
 */
export const calculateSAR = (
  highPrices: number[],
  lowPrices: number[],
  closePrices: number[],
  initialAF: number = 0.02,
  maxAF: number = 0.2,
  afStep: number = 0.02
): number[] => {
  if (!hasValidData(highPrices) || !hasValidData(lowPrices)) {
    console.warn('calculateSAR: 无效的输入数据');
    return Array(Math.max(highPrices.length, lowPrices.length)).fill(NaN);
  }

  try {
    // 确保所有数组长度一致
    const length = Math.min(highPrices.length, lowPrices.length, closePrices.length);
    if (length < 2) {
      console.warn('calculateSAR: 数据点不足');
      return Array(length).fill(NaN);
    }

    // 清理数据，替换无效值
    const cleanHighs = highPrices.slice(0, length).map(price =>
      price === undefined || isNaN(price) ? null : price
    );

    const cleanLows = lowPrices.slice(0, length).map(price =>
      price === undefined || isNaN(price) ? null : price
    );

    const cleanCloses = closePrices.slice(0, length).map(price =>
      price === undefined || isNaN(price) ? null : price
    );

    // 填充null值
    const filledHighs = fillNullValues(cleanHighs);
    const filledLows = fillNullValues(cleanLows);
    const filledCloses = fillNullValues(cleanCloses);

    const sar: number[] = [];

    // 初始SAR值使用第一个收盘价
    sar.push(filledCloses[0]);

    let isUptrend = filledCloses[1] > filledCloses[0]; // 初始趋势
    let extremePoint = isUptrend ? filledHighs[0] : filledLows[0]; // 初始极值点
    let af = initialAF; // 加速因子

    for (let i = 1; i < length; i++) {
      // 计算当前SAR值
      let currentSAR = sar[i - 1] + af * (extremePoint - sar[i - 1]);

      // 限制SAR值不能超出前两个周期的价格范围
      if (i >= 2) {
        if (isUptrend) {
          // 上升趋势，SAR不能高于前两个周期的最低点
          currentSAR = Math.min(currentSAR, Math.min(filledLows[i - 1], filledLows[i - 2]));
        } else {
          // 下降趋势，SAR不能低于前两个周期的最高点
          currentSAR = Math.max(currentSAR, Math.max(filledHighs[i - 1], filledHighs[i - 2]));
        }
      }

      // 检查是否转向
      const high = filledHighs[i];
      const low = filledLows[i];

      if ((isUptrend && low < currentSAR) || (!isUptrend && high > currentSAR)) {
        // 趋势反转
        isUptrend = !isUptrend;
        currentSAR = extremePoint; // 反转时，SAR值为前一个极值点
        extremePoint = isUptrend ? high : low; // 重置极值点
        af = initialAF; // 重置加速因子
      } else {
        // 趋势继续
        if (isUptrend && high > extremePoint) {
          // 上升趋势创新高
          extremePoint = high;
          af = Math.min(af + afStep, maxAF); // 增加加速因子
        } else if (!isUptrend && low < extremePoint) {
          // 下降趋势创新低
          extremePoint = low;
          af = Math.min(af + afStep, maxAF); // 增加加速因子
        }
      }

      sar.push(currentSAR);
    }

    return sar;
  } catch (error) {
    console.error('calculateSAR错误:', error);
    return Array(Math.max(highPrices.length, lowPrices.length)).fill(NaN);
  }
};
