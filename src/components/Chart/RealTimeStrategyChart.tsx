import React, { useRef, useEffect, useState, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { createChart, CrosshairMode, Time, ISeriesApi, IChartApi, SeriesMarkerPosition, SeriesMarkerShape, HistogramData, LineData } from 'lightweight-charts';
import { CandlestickData } from '../../store/types';
import { formatPrice } from '../../utils/helpers';
import { fetchHistoryWithIntegrityCheckV2 } from '../../services/api';
import './BacktestDetailChart.css';

// 扩展Window接口，添加klineDataCache属性
declare global {
  interface Window {
    klineDataCache: Map<string, {
      data: CandlestickData[],
      timestamp: number
    }>;
  }
}

// 添加缓存对象，用于存储已加载的K线数据
if (!window.klineDataCache) {
  window.klineDataCache = new Map();
}
const klineDataCache = window.klineDataCache;

// 缓存有效期（毫秒）
const CACHE_TTL = 5 * 60 * 1000; // 5分钟，实时数据缓存时间较短

interface RealTimeOrder {
  id: number;
  strategyCode: string;
  symbol: string;
  side: string;
  price: number;
  amount: number;
  status: string;
  createTime: string;
  updateTime: string;
  profit?: number;
  profitRate?: number;
  executedAmount?: number;
  executedQty?: number;
  signalPrice?: number;
  fee?: number;
  feeCurrency?: string;
}

interface RealTimeStrategyChartProps {
  symbol: string;
  interval: string;
  startTime: string;
  endTime?: string;
  orders: RealTimeOrder[];
  selectedOrder?: RealTimeOrder | null;
}

// 使用forwardRef包装组件，以支持ref传递
const RealTimeStrategyChart = forwardRef<{
  highlightTimeRange: (startTime: string, endTime: string) => void
}, RealTimeStrategyChartProps>((props, ref) => {
  const {
    symbol,
    interval,
    startTime,
    endTime,
    orders,
    selectedOrder
  } = props;

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const candleSeries = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeries = useRef<ISeriesApi<'Histogram'> | null>(null);
  const bollUpperSeries = useRef<ISeriesApi<'Line'> | null>(null);
  const bollMiddleSeries = useRef<ISeriesApi<'Line'> | null>(null);
  const bollLowerSeries = useRef<ISeriesApi<'Line'> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef<boolean>(true);
  const dataLoadedRef = useRef<boolean>(false);
  const apiCallInProgressRef = useRef<boolean>(false);
  const highlightedAreaRef = useRef<any>(null);

  const [hoveredData, setHoveredData] = useState<{
    time: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
    change: string;
    changePercent: string;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [originalData, setOriginalData] = useState<any[]>([]);
  const [dataLoaded, setDataLoaded] = useState<boolean>(false);

  // 生成缓存键
  const cacheKey = useMemo(() => {
    if (!symbol || !startTime) return '';

    const startDate = startTime.split(' ')[0];
    const currentEndTime = endTime || new Date().toISOString();
    const endDate = currentEndTime.split('T')[0];

    // 为了确保有足够的上下文，我们获取稍微扩展的时间范围
    const extendedStartDate = new Date(startDate);
    extendedStartDate.setDate(extendedStartDate.getDate() - 30);
    const requestStartDate = extendedStartDate.toISOString().split('T')[0];

    const extendedEndDate = new Date(endDate);
    extendedEndDate.setDate(extendedEndDate.getDate() + 15);
    const requestEndDate = extendedEndDate.toISOString().split('T')[0];

    return `${symbol}_${interval}_${requestStartDate}_${requestEndDate}`;
  }, [symbol, interval, startTime, endTime]);

  // 检查缓存是否有效
  const isCacheValid = (cacheEntry: { data: CandlestickData[], timestamp: number } | undefined): boolean => {
    if (!cacheEntry) return false;
    const now = Date.now();
    return (now - cacheEntry.timestamp) < CACHE_TTL;
  };

  // 格式化日期为显示格式
  const formatDate = (timestamp: number | string): string => {
    let date;

    if (typeof timestamp === 'number') {
      if (timestamp < 10000000000) {
        date = new Date(timestamp * 1000);
      } else {
        date = new Date(timestamp);
      }
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      return '无效日期';
    }

    if (isNaN(date.getTime())) {
      return '无效日期';
    }

    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).replace(/\//g, '-');
  };

  // 格式化成交量
  const formatVolume = (volume: number): string => {
    if (volume >= 1000000) {
      return (volume / 1000000).toFixed(2) + 'M';
    } else if (volume >= 1000) {
      return (volume / 1000).toFixed(2) + 'K';
    }
    return volume.toFixed(2);
  };

  // 创建图表
  const createCharts = useCallback(() => {
    if (!chartContainerRef.current) return;

    if (chart.current) return;

    try {
      chart.current = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 450,
        layout: {
          background: { color: '#1e222d' },
          textColor: '#d9d9d9',
        },
        grid: {
          vertLines: { color: '#2e3241' },
          horzLines: { color: '#2e3241' },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            color: '#555',
            style: 1,
            visible: true,
            labelVisible: false,
          },
          horzLine: {
            color: '#555',
            style: 1,
            visible: true,
            labelVisible: true,
          },
        },
        rightPriceScale: {
          borderColor: '#2e3241',
        },
        timeScale: {
          borderColor: '#2e3241',
          timeVisible: true,
          secondsVisible: false,
        },
      });

      // 创建蜡烛图系列 - 红涨绿跌风格
      candleSeries.current = chart.current.addCandlestickSeries({
        upColor: '#ff5555',
        downColor: '#32a852',
        borderUpColor: '#ff5555',
        borderDownColor: '#32a852',
        wickUpColor: '#ff5555',
        wickDownColor: '#32a852',
      });

      // 添加成交量系列
      volumeSeries.current = chart.current.addHistogramSeries({
        color: '#26a69a',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume',
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });

      // 添加布林带系列（与首页风格一致）
      bollUpperSeries.current = chart.current.addLineSeries({
        color: '#f48fb1',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });

      bollMiddleSeries.current = chart.current.addLineSeries({
        color: '#90caf9',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });

      bollLowerSeries.current = chart.current.addLineSeries({
        color: '#80deea',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });

      // 设置十字线移动事件处理
      setupCrosshairMoveHandler();

      // 设置图表大小
      const handleResize = () => {
        if (chartContainerRef.current && chart.current) {
          const width = chartContainerRef.current.clientWidth;
          chart.current.resize(width, 450);
          chart.current.timeScale().fitContent();
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    } catch (error) {
      console.error('图表初始化错误:', error);
      setError('图表初始化失败');
      if (chart.current) {
        chart.current.remove();
        chart.current = null;
      }
      candleSeries.current = null;
      volumeSeries.current = null;
    }
  }, []);

  // 设置十字线移动事件处理
  const setupCrosshairMoveHandler = () => {
    if (!chart.current || !candleSeries.current) return;

    chart.current.subscribeCrosshairMove((param: any) => {
      if (
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.y < 0
      ) {
        setHoveredData(null);
        return;
      }

      if (!candleSeries.current || !volumeSeries.current) {
        setHoveredData(null);
        return;
      }

      const candleData = param.seriesPrices.get(candleSeries.current);
      const volumeData = param.seriesPrices.get(volumeSeries.current);

      if (candleData && volumeData && candleData.open != null && candleData.high != null && candleData.low != null && candleData.close != null && volumeData != null) {
        let time;

        // 尝试从原始数据中找到对应的K线，以获取准确的时间
        if (originalData && originalData.length > 0) {
          let matchedCandle = null;

          if (typeof param.time === 'object' && param.time.year && param.time.month && param.time.day) {
            const { year, month, day, hour = 0, minute = 0, second = 0 } = param.time;
            const paramDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            const fullTimeStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour || 0).padStart(2, '0')}:${String(minute || 0).padStart(2, '0')}:${String(second || 0).padStart(2, '0')}`;

            matchedCandle = originalData.find(item =>
              item && item.openTime && item.openTime === fullTimeStr
            );

            if (!matchedCandle) {
              matchedCandle = originalData.find(item => {
                if (!item || !item.openTime) return false;
                return item.openTime.includes(paramDateStr);
              });
            }
          } else if (typeof param.time === 'number') {
            const dateFromTimestamp = new Date(param.time < 10000000000 ? param.time * 1000 : param.time);
            const year = dateFromTimestamp.getFullYear();
            const month = String(dateFromTimestamp.getMonth() + 1).padStart(2, '0');
            const day = String(dateFromTimestamp.getDate()).padStart(2, '0');
            const hour = String(dateFromTimestamp.getHours()).padStart(2, '0');
            const minute = String(dateFromTimestamp.getMinutes()).padStart(2, '0');
            const second = String(dateFromTimestamp.getSeconds()).padStart(2, '0');

            const fullTimeStr = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
            const paramDateStr = `${year}-${month}-${day}`;

            matchedCandle = originalData.find(item =>
              item && item.openTime && item.openTime === fullTimeStr
            );

            if (!matchedCandle) {
              matchedCandle = originalData.find(item => {
                if (!item || !item.openTime) return false;
                return item.openTime.includes(paramDateStr);
              });
            }
          }

          if (matchedCandle) {
            time = matchedCandle.closeTime;
          } else {
            if (typeof param.time === 'object' && param.time !== null) {
              const { year, month, day, hour, minute, second } = param.time;
              const dateObj = new Date(year, month, day, hour, minute, second);
              time = formatDate(dateObj.getTime());
            } else if (typeof param.time === 'number') {
              time = formatDate(param.time);
            } else {
              time = String(param.time);
            }
          }
        } else {
          if (typeof param.time === 'object' && param.time !== null) {
            const { year, month, day, hour = 0, minute = 0, second = 0 } = param.time;
            const dateObj = new Date(year, month - 1, day, hour || 0, minute || 0, second || 0);
            time = formatDate(dateObj.getTime());
          } else if (typeof param.time === 'number') {
            time = formatDate(param.time);
          } else {
            time = String(param.time);
          }
        }

        const open = typeof candleData.open === 'number' ? candleData.open.toString() : candleData.open;
        const high = typeof candleData.high === 'number' ? candleData.high.toString() : candleData.high;
        const low = typeof candleData.low === 'number' ? candleData.low.toString() : candleData.low;
        const close = typeof candleData.close === 'number' ? candleData.close.toString() : candleData.close;
        const volume = typeof volumeData === 'number' ? formatVolume(volumeData) : volumeData;

        let change = '0.00';
        let changePercent = '0.00';

        if (typeof candleData.close === 'number' && typeof candleData.open === 'number') {
          change = (candleData.close - candleData.open).toFixed(2);
          changePercent = ((candleData.close - candleData.open) / candleData.open * 100).toFixed(2);
        }

        setHoveredData({
          time,
          open,
          high,
          low,
          close,
          volume,
          change,
          changePercent
        });

        // 设置浮层位置跟随鼠标
        if (tooltipRef.current && chartContainerRef.current) {
          const chartRect = chartContainerRef.current.getBoundingClientRect();

          requestAnimationFrame(() => {
            if (!tooltipRef.current) return;

            const tooltipRect = tooltipRef.current.getBoundingClientRect();

            const x = param.point.x;
            const y = param.point.y;

            let left = x - tooltipRect.width - 20;

            if (left < 10) {
              left = x + 20;
            }

            let top = y - tooltipRect.height / 2;
            if (top < 10) {
              top = 10;
            } else if (top + tooltipRect.height > chartRect.height - 10) {
              top = chartRect.height - tooltipRect.height - 10;
            }

            tooltipRef.current.style.transform = 'translate3d(0, 0, 0)';
            tooltipRef.current.style.left = `${left}px`;
            tooltipRef.current.style.top = `${top}px`;
          });
        }
      }
    });
  };

  // 格式化金额显示
  const formatAmount = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return '0.00';
    return amount.toFixed(2);
  };

  // 计算布林带
  const calculateBollingerBands = (data: any[], period: number = 20, multiplier: number = 2) => {
    const result = {
      upper: [] as LineData[],
      middle: [] as LineData[],
      lower: [] as LineData[]
    };

    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        // 数据不足，跳过
        continue;
      }

      // 计算移动平均线（中轨）
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += data[j].close;
      }
      const sma = sum / period;

      // 计算标准差
      let variance = 0;
      for (let j = i - period + 1; j <= i; j++) {
        variance += Math.pow(data[j].close - sma, 2);
      }
      const stdDev = Math.sqrt(variance / period);

      // 计算上轨和下轨
      const upper = sma + (multiplier * stdDev);
      const lower = sma - (multiplier * stdDev);

      result.upper.push({ time: data[i].time, value: upper });
      result.middle.push({ time: data[i].time, value: sma });
      result.lower.push({ time: data[i].time, value: lower });
    }

    return result;
  };

  // 绘制订单标记
  const drawOrderMarkers = useCallback(() => {
    if (!candleSeries.current || !orders || orders.length === 0) return;

    const markers = orders.map(order => {
      // 判断订单成交时间对应的K线时间
      const orderTime = new Date(order.createTime);

      // 根据时间周期计算K线的结束时间
      let klineEndTime: Date;

      switch (interval) {
        case '1m':
          klineEndTime = new Date(Math.ceil(orderTime.getTime() / (60 * 1000)) * (60 * 1000));
          break;
        case '5m':
          klineEndTime = new Date(Math.ceil(orderTime.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000));
          break;
        case '15m':
          klineEndTime = new Date(Math.ceil(orderTime.getTime() / (15 * 60 * 1000)) * (15 * 60 * 1000));
          break;
        case '30m':
          klineEndTime = new Date(Math.ceil(orderTime.getTime() / (30 * 60 * 1000)) * (30 * 60 * 1000));
          break;
        case '1H':
          klineEndTime = new Date(Math.ceil(orderTime.getTime() / (60 * 60 * 1000)) * (60 * 60 * 1000));
          break;
        case '2H':
          klineEndTime = new Date(Math.ceil(orderTime.getTime() / (2 * 60 * 60 * 1000)) * (2 * 60 * 60 * 1000));
          break;
        case '4H':
          klineEndTime = new Date(Math.ceil(orderTime.getTime() / (4 * 60 * 60 * 1000)) * (4 * 60 * 60 * 1000));
          break;
        case '6H':
          klineEndTime = new Date(Math.ceil(orderTime.getTime() / (6 * 60 * 60 * 1000)) * (6 * 60 * 60 * 1000));
          break;
        case '12H':
          klineEndTime = new Date(Math.ceil(orderTime.getTime() / (12 * 60 * 60 * 1000)) * (12 * 60 * 60 * 1000));
          break;
        case '1D':
          const dayStart = new Date(orderTime);
          dayStart.setHours(0, 0, 0, 0);
          klineEndTime = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
          break;
        case '1W':
          const weekStart = new Date(orderTime);
          const dayOfWeek = weekStart.getDay();
          const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          weekStart.setDate(weekStart.getDate() - daysToMonday);
          weekStart.setHours(0, 0, 0, 0);
          klineEndTime = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case '1M':
          const monthStart = new Date(orderTime.getFullYear(), orderTime.getMonth(), 1);
          klineEndTime = new Date(orderTime.getFullYear(), orderTime.getMonth() + 1, 1);
          break;
        default:
          klineEndTime = orderTime;
      }

      // 格式化时间为K线图可识别的格式
      const timeForChart = Math.floor(klineEndTime.getTime() / 1000) as Time;

      // 构建标记文本
      let markerText = '';
      if (order.side === 'BUY') {
        // 买入标记：显示买入价格
        markerText = `${order.side} ${formatPrice(order.price)}`;
      } else {
        // 卖出标记：显示卖出价格、盈亏金额和利润率（使用不同方式突出显示）
        const profit = order.profit || 0;
        const profitRate = order.profitRate || 0;
        const profitSign = profit >= 0 ? '+' : '';
        const profitRateSign = profitRate >= 0 ? '+' : '';

        // 完全简化文本，直接显示价格和利润数据
        const profitDisplay = `${profitSign}${formatAmount(profit)}`;
        const rateDisplay = `${profitRateSign}${(profitRate * 100).toFixed(2)}%`;
        
        // 完全简化显示，只保留最关键信息
        markerText = `${order.side} ${formatPrice(order.price)}\n${profitDisplay}\n${rateDisplay}`;
      }

      return {
        time: timeForChart,
        position: order.side === 'BUY' ? 'belowBar' as SeriesMarkerPosition : 'aboveBar' as SeriesMarkerPosition,
        color: order.side === 'BUY' ? '#87CEEB' : (order.profit && order.profit >= 0 ? '#ff4444' : '#00aa00'),
        shape: order.side === 'BUY' ? 'arrowUp' as SeriesMarkerShape : 'arrowDown' as SeriesMarkerShape,
        text: markerText,
        size: 2, // 增大标记尺寸使其更醒目
      };
    });

    candleSeries.current.setMarkers(markers);
  }, [orders, interval]);

  // 暴露给父组件的方法
  useImperativeHandle(ref, () => ({
    highlightTimeRange: (startTime: string, endTime: string) => {
      // 实现高亮时间范围的逻辑
      console.log('高亮时间范围:', startTime, endTime);
      // 这里可以添加高亮显示的具体实现
    }
  }));

  // 加载K线数据
  const loadKlineData = useCallback(async () => {
    if (apiCallInProgressRef.current) {
      console.log('API调用正在进行中，跳过重复调用');
      return;
    }

    // 检查是否真的已经加载了数据
    if (dataLoadedRef.current && originalData.length > 0 && chart.current && candleSeries.current) {
      console.log('数据已加载且图表正常，跳过重复调用');
      return;
    }

    if (!symbol || !startTime || !cacheKey) {
      console.warn('缺少必要的参数，无法加载K线数据', { symbol, startTime, cacheKey });
      return;
    }

    // 确保图表组件已经初始化
    if (!chart.current || !candleSeries.current || !volumeSeries.current) {
      console.warn('图表组件未初始化，延迟加载数据');
      setTimeout(() => {
        if (chart.current && candleSeries.current && volumeSeries.current) {
          loadKlineData();
        }
      }, 500);
      return;
    }

    console.log('开始加载K线数据:', { symbol, interval, startTime, endTime });
    apiCallInProgressRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const startDate = startTime.split(' ')[0];
      const currentEndTime = endTime || new Date().toISOString();
      const endDate = currentEndTime.split('T')[0];

      const extendedStartDate = new Date(startDate);
      extendedStartDate.setDate(extendedStartDate.getDate() - 30);
      const requestStartDate = extendedStartDate.toISOString().split('T')[0];

      const extendedEndDate = new Date(endDate);
      extendedEndDate.setDate(extendedEndDate.getDate() + 15);
      const requestEndDate = extendedEndDate.toISOString().split('T')[0];

      // 检查缓存
      const cachedData = klineDataCache.get(cacheKey);

      if (isCacheValid(cachedData)) {
        console.log('使用缓存的K线数据');
        setOriginalData(cachedData!.data);

        if (candleSeries.current && volumeSeries.current && chart.current) {
          const convertedData = cachedData!.data.map(item => ({
            ...item,
            time: item.time as Time
          }));

          candleSeries.current.setData(convertedData);

          const volumeData = convertedData
            .filter(item => item && item.time != null && item.volume != null && item.close != null && item.open != null)
            .map(item => ({
              time: item.time,
              value: item.volume,
              color: item.close > item.open ? '#ff5555' : '#32a852',
            })) as HistogramData[];

          if (volumeData.length > 0) {
            volumeSeries.current.setData(volumeData);
          }

          // 计算并设置布林带数据（缓存数据）
          if (bollUpperSeries.current && bollMiddleSeries.current && bollLowerSeries.current) {
            const bollData = calculateBollingerBands(convertedData);
            bollUpperSeries.current.setData(bollData.upper);
            bollMiddleSeries.current.setData(bollData.middle);
            bollLowerSeries.current.setData(bollData.lower);
          }

          drawOrderMarkers();

          chart.current.timeScale().fitContent();
          setTimeout(() => {
            if (chart.current && startDate && endDate) {
              try {
                chart.current.timeScale().setVisibleRange({
                  from: startDate,
                  to: endDate,
                });
              } catch (error) {
                console.warn('设置可见范围失败:', error);
                // 如果设置可见范围失败，则使用fitContent作为备选方案
                chart.current.timeScale().fitContent();
              }
            }
          }, 100);
        }

        setLoading(false);
        setDataLoaded(true);
        dataLoadedRef.current = true;
        return;
      }

      console.log('从API获取K线数据:', { symbol, interval, startDate: requestStartDate, endDate: requestEndDate });
      let result;
      try {
        result = await fetchHistoryWithIntegrityCheckV2(
          symbol,
          interval,
          requestStartDate,
          requestEndDate
        );

        if (!result || !result.data || !Array.isArray(result.data) || result.data.length === 0) {
          setError('没有找到K线数据或数据格式错误');
          setLoading(false);
          return;
        }
      } catch (error) {
        console.error('加载K线数据失败:', error);
        setError('加载K线数据失败');
        setLoading(false);
        return;
      }

      // 保存到缓存
      klineDataCache.set(cacheKey, {
        data: result.data,
        timestamp: Date.now()
      });

      setOriginalData(result.data);

      console.log('原始K线数据示例:', result.data.length > 0 ? result.data[0] : '无数据');

      const convertedData = result.data
        .filter(item => item && item.time != null && item.open != null && item.high != null && item.low != null && item.close != null && item.volume != null)
        .map(item => ({
          ...item,
          time: item.time as Time
        }));

      if (candleSeries.current && volumeSeries.current && chart.current && convertedData.length > 0) {
        candleSeries.current.setData(convertedData);

        const volumeData = convertedData
          .filter(item => item && item.time != null && item.volume != null && item.close != null && item.open != null)
          .map(item => ({
            time: item.time,
            value: item.volume,
            color: item.close > item.open ? '#ff5555' : '#32a852',
          })) as HistogramData[];

        if (volumeData.length > 0) {
          volumeSeries.current.setData(volumeData);
        }

        // 计算并设置布林带数据
        if (bollUpperSeries.current && bollMiddleSeries.current && bollLowerSeries.current) {
          const bollData = calculateBollingerBands(convertedData);
          bollUpperSeries.current.setData(bollData.upper);
          bollMiddleSeries.current.setData(bollData.middle);
          bollLowerSeries.current.setData(bollData.lower);
        }

        drawOrderMarkers();

        if (chart.current && convertedData.length > 0) {
          chart.current.timeScale().fitContent();

          setTimeout(() => {
            if (chart.current && startDate && endDate) {
              try {
                chart.current.timeScale().setVisibleRange({
                  from: startDate,
                  to: endDate,
                });
              } catch (error) {
                console.warn('设置可见范围失败:', error);
                // 如果设置可见范围失败，则使用fitContent作为备选方案
                chart.current.timeScale().fitContent();
              }
            }
          }, 100);
        }
      }

      setLoading(false);
      setDataLoaded(true);
      dataLoadedRef.current = true;
    } catch (error) {
      console.error('加载K线数据失败:', error);
      setError('加载K线数据失败');
      setLoading(false);
    } finally {
      apiCallInProgressRef.current = false;
    }
  }, [symbol, interval, startTime, endTime, cacheKey, drawOrderMarkers]);

  // 初始化图表
  useEffect(() => {
    createCharts();

    return () => {
      if (chart.current) {
        chart.current.remove();
        chart.current = null;
      }
      candleSeries.current = null;
      volumeSeries.current = null;
    };
  }, [createCharts]);

  // 加载数据
  useEffect(() => {
    if (chart.current && candleSeries.current && volumeSeries.current) {
      loadKlineData();
    } else {
      console.warn('图表组件未完全初始化:', {
        chart: !!chart.current,
        candleSeries: !!candleSeries.current,
        volumeSeries: !!volumeSeries.current
      });
    }
  }, [loadKlineData]);

  // 添加重试机制，确保图表能够正常显示
  useEffect(() => {
    const retryTimer = setTimeout(() => {
      if (!dataLoaded && !loading && !error && chart.current && candleSeries.current && volumeSeries.current) {
        console.log('检测到图表未加载数据，尝试重新加载...');
        // 重置状态并重新加载
        dataLoadedRef.current = false;
        apiCallInProgressRef.current = false;
        loadKlineData();
      }
    }, 2000); // 2秒后检查

    return () => clearTimeout(retryTimer);
  }, [dataLoaded, loading, error, loadKlineData]);

  // 当订单数据变化时重新绘制标记
  useEffect(() => {
    if (dataLoaded) {
      drawOrderMarkers();
    }
  }, [orders, dataLoaded, drawOrderMarkers]);

  return (
    <div className="backtest-detail-chart-container">
      <div className="chart-header">
        {/*<h3>实时策略K线图 - {symbol} ({interval})</h3>*/}
        {loading && <span className="loading-text">加载中...</span>}
        {error && <span className="error-text">{error}</span>}
      </div>

      <div className="chart-wrapper" style={{ position: 'relative' }}>
        <div ref={chartContainerRef} className="chart-container" />

        {/* 悬浮信息窗口 */}
        {hoveredData && (
          <div
            ref={tooltipRef}
            className="chart-tooltip"
            style={{
              position: 'absolute',
              pointerEvents: 'none',
              zIndex: 1000,
              backgroundColor: 'rgba(30, 34, 45, 0.9)',
              border: '1px solid #2e3241',
              borderRadius: '4px',
              padding: '8px 12px',
              fontSize: '12px',
              color: '#d9d9d9',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
              minWidth: '180px',
              maxWidth: '280px'
            }}
          >
            <div className="tooltip-row">
              <span className="tooltip-label">时间:</span>
              <span className="tooltip-value">{hoveredData.time}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">开盘:</span>
              <span className="tooltip-value">{hoveredData.open}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">最高:</span>
              <span className="tooltip-value">{hoveredData.high}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">最低:</span>
              <span className="tooltip-value">{hoveredData.low}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">收盘:</span>
              <span className="tooltip-value">{hoveredData.close}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">成交量:</span>
              <span className="tooltip-value">{hoveredData.volume}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">涨跌:</span>
              <span className={`tooltip-value ${parseFloat(hoveredData.change) >= 0 ? 'positive' : 'negative'}`}>
                {hoveredData.change} ({hoveredData.changePercent}%)
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default RealTimeStrategyChart;
