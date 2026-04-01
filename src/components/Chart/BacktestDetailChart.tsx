import React, { useRef, useEffect, useState, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { createChart, CrosshairMode, Time, ISeriesApi, IChartApi, SeriesMarkerPosition, HistogramData, LineData } from 'lightweight-charts';
import { BacktestTradeDetail, CandlestickData } from '../../store/types';
import { formatPrice } from '../../utils/helpers';
import { fetchHistoryWithIntegrityCheckV2, fetchBacktestSummary } from '../../services/api';
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
// 使用window对象存储全局缓存，确保在页面刷新前一直有效
if (!window.klineDataCache) {
  window.klineDataCache = new Map();
}
const klineDataCache = window.klineDataCache;

// 缓存有效期（毫秒）
const CACHE_TTL = 30 * 60 * 1000; // 30分钟

// 添加防抖函数
const debounce = (fn: Function, delay: number) => {
  let timer: NodeJS.Timeout | null = null;
  return (...args: any[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, delay);
  };
};

interface BacktestDetailChartProps {
  symbol: string;
  startTime: string;
  endTime: string;
  tradeDetails: BacktestTradeDetail[];
  selectedTrade?: BacktestTradeDetail | null;
  backtestId?: string;
}

// 使用forwardRef包装组件，以支持ref传递
const BacktestDetailChart = forwardRef<{
  highlightTimeRange: (startTime: string, endTime: string) => void
}, BacktestDetailChartProps>((props, ref) => {
  const {
    symbol,
    startTime,
    endTime,
    tradeDetails,
    selectedTrade,
    backtestId
  } = props;
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const candleSeries = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeries = useRef<ISeriesApi<'Histogram'> | null>(null);
  const equityCurveSeries = useRef<ISeriesApi<'Line'> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef<boolean>(true);
  const dataLoadedRef = useRef<boolean>(false);
  const apiCallInProgressRef = useRef<boolean>(false);
  const highlightedAreaRef = useRef<any>(null); // 用于存储高亮区域
  
  const [hoveredData, setHoveredData] = useState<{
    time: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
    change: string;
    changePercent: string;
    equity?: string;
  } | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [originalData, setOriginalData] = useState<any[]>([]);
  const [equityCurveData, setEquityCurveData] = useState<any[]>([]);
  const [intervalVal, setIntervalVal] = useState<string>('1D');
  const [dataLoaded, setDataLoaded] = useState<boolean>(false);
  const [equityCurveLoaded, setEquityCurveLoaded] = useState<boolean>(false);
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties | null>(null);
  const highlightOverlayRef = useRef<HTMLDivElement>(null);
  const [selectedKlineIndices, setSelectedKlineIndices] = useState<{start: number, end: number} | null>(null);

  // 生成缓存键 - 使用useMemo优化
  const cacheKey = useMemo(() => {
    if (!symbol || !startTime || !endTime) return '';
    
    const startDate = startTime.split(' ')[0];
    const endDate = endTime.split(' ')[0];
    
    // 为了确保有足够的上下文，我们获取稍微扩展的时间范围
    const extendedStartDate = new Date(startDate);
    extendedStartDate.setDate(extendedStartDate.getDate() - 30);
    const requestStartDate = extendedStartDate.toISOString().split('T')[0];
    
    const extendedEndDate = new Date(endDate);
    extendedEndDate.setDate(extendedEndDate.getDate() + 15);
    const requestEndDate = extendedEndDate.toISOString().split('T')[0];
    
    // 从URL中获取interval参数，如果没有则使用默认值1D
    const urlParams = new URLSearchParams(window.location.search);
    const urlInterval = urlParams.get('interval') || '1D';
    
    return `${symbol}_${urlInterval}_${requestStartDate}_${requestEndDate}`;
  }, [symbol, startTime, endTime]);

  // 检查缓存是否有效
  const isCacheValid = (cacheEntry: { data: CandlestickData[], timestamp: number } | undefined): boolean => {
    if (!cacheEntry) return false;
    const now = Date.now();
    return (now - cacheEntry.timestamp) < CACHE_TTL;
  };

  // 格式化日期为显示格式
  const formatDate = (timestamp: number | string): string => {
    let date;
    
    // 处理不同格式的时间戳
    if (typeof timestamp === 'number') {
      // 如果是10位时间戳（秒），转换为毫秒
      if (timestamp < 10000000000) {
        date = new Date(timestamp * 1000);
      } else {
        // 如果是13位时间戳（毫秒）
        date = new Date(timestamp);
      }
    } else if (typeof timestamp === 'string') {
      // 处理字符串格式日期
      date = new Date(timestamp);
    } else {
      return '无效日期';
    }
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      return '无效日期';
    }
    
    // 格式化为 YYYY-MM-DD HH:MM:SS 格式
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).replace(/\//g, '-'); // 将斜杠替换为短横线
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

  // 获取资金曲线数据
  const loadEquityCurveData = useCallback(async () => {
    if (!backtestId) return [];
    
    try {
      // 从URL中获取backtestId，如果props中没有提供
      const urlParams = new URLSearchParams(window.location.search);
      const currentBacktestId = backtestId || urlParams.get('backtestId');
      
      if (!currentBacktestId) {
        console.warn('缺少backtestId，无法获取资金曲线数据');
        return [];
      }
      
      console.log('获取资金曲线数据，backtestId:', currentBacktestId);
      
      const response = await fetch(`/api/backtest/ta4j/equity-curve/${currentBacktestId}`);
      if (!response.ok) {
        throw new Error(`获取资金曲线数据失败: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result && result.code === 200 && Array.isArray(result.data) && result.data.length > 0) {
        console.log('获取到资金曲线数据:', result.data.length, '条', result.data[0]);
        setEquityCurveData(result.data);
        setEquityCurveLoaded(true);
        return result.data;
      } else {
        console.error('资金曲线数据格式错误:', result);
        return [];
      }
    } catch (error) {
      console.error('加载资金曲线数据失败:', error);
      return [];
    }
  }, [backtestId]);

  // 创建图表
  const createCharts = useCallback(() => {
    if (!chartContainerRef.current) return;
    
    // 如果图表已经创建，不要重复创建
    if (chart.current) return;
    
    try {
      // 创建主图表
      chart.current = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 450, // 将高度从600px减少到450px
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
        priceScaleId: 'volume', // 使用单独的价格轴
        scaleMargins: {
          top: 0.8, // 将成交量图表放在主图表下方
          bottom: 0,
        },
      });
      
      // 添加资金曲线系列，使用左侧价格轴
      equityCurveSeries.current = chart.current.addLineSeries({
        color: '#f48fb1',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        priceFormat: {
          type: 'price',
          precision: 2,
          minMove: 0.01,
        },
        priceScaleId: 'left', // 使用左侧价格轴
        title: '', // 添加标题
        // 确保资金曲线不与K线混合
        lineStyle: 0, // 设置线条样式为实线
      });
      
      // 为左侧价格轴设置显示属性
      chart.current.priceScale('left').applyOptions({
        borderColor: '#2e3241',
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
        visible: true,
        autoScale: true,
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
      // 清理可能部分创建的引用
      if (chart.current) {
        chart.current.remove();
        chart.current = null;
      }
      candleSeries.current = null;
      volumeSeries.current = null;
      equityCurveSeries.current = null;
    }
  }, []);

  // 更新后的setupCrosshairMoveHandler函数，支持显示资金曲线数据
  const setupCrosshairMoveHandler = () => {
    if (!chart.current || !candleSeries.current) return;

    // 主图表十字线移动事件
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

      // 检查series引用是否存在
      if (!candleSeries.current || !volumeSeries.current) {
        setHoveredData(null);
        return;
      }
      
      const candleData = param.seriesPrices.get(candleSeries.current);
      const volumeData = param.seriesPrices.get(volumeSeries.current);
      
      // 获取资金曲线数据
      let equityData = null;
      if (equityCurveSeries.current) {
        try {
          equityData = param.seriesPrices.get(equityCurveSeries.current);
          // 如果equityData为undefined，尝试从equityCurveData中获取对应时间点的数据
          if (equityData === undefined && equityCurveData && equityCurveData.length > 0) {
            // 获取当前时间点
            let currentTime;
            if (typeof param.time === 'object' && param.time !== null) {
              const { year, month, day, hour,minute,second } = param.time;
              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
              // 查找匹配的数据点
              const matchingPoint = equityCurveData.find(item => 
                item && item.timestamp && typeof item.timestamp === 'string' && item.timestamp.includes(dateStr)
              );
              if (matchingPoint && typeof matchingPoint.value === 'number') {
                equityData = matchingPoint.value;
                console.log('从equityCurveData找到匹配的资金数据:', matchingPoint);
              }
            }
          }
        } catch (err) {
          console.error('获取资金曲线数据错误:', err);
        }
      }
      
      // 调试资金曲线数据
      // console.log('十字线移动时的数据:', { 
      //   time: param.time,
      //   equityCurveSeriesExists: !!equityCurveSeries.current,
      //   equityData,
      //   allSeries: Array.from(param.seriesPrices.keys()).map((s: any) => s && s.seriesType ? s.seriesType() : 'unknown')
      // });
      
      if (candleData && volumeData && candleData.open != null && candleData.high != null && candleData.low != null && candleData.close != null && volumeData != null) {
        // 调试日志，查看K线数据的具体内容
        // console.log('K线数据:', {
        //   open: candleData.open,
        //   high: candleData.high,
        //   low: candleData.low,
        //   close: candleData.close,
        //   volume: volumeData,
        //   openType: typeof candleData.open,
        //   highType: typeof candleData.high,
        //   lowType: typeof candleData.low,
        //   closeType: typeof candleData.close,
        //   volumeType: typeof volumeData
        // });
        // 调试信息，查看param.time的实际类型和值
        // console.log('param.time类型:', typeof param.time, 'param.time值:', param.time);
        
        let time;
        
        // 尝试从原始数据中找到对应的K线，以获取准确的时间
        if (originalData && originalData.length > 0) {
          let matchedCandle = null;
          
          // 根据param.time的类型采用不同的匹配策略
          if (typeof param.time === 'object' && param.time.year && param.time.month && param.time.day) {
            const { year, month, day, hour = 0, minute = 0, second = 0 } = param.time;
            const paramDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            
            // 先尝试精确匹配，包括时分秒
            const fullTimeStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour || 0).padStart(2, '0')}:${String(minute || 0).padStart(2, '0')}:${String(second || 0).padStart(2, '0')}`;
            
            // 先尝试精确匹配完整时间
            matchedCandle = originalData.find(item => 
              item && item.openTime && item.openTime === fullTimeStr
            );
            
            // 如果没找到，退化为日期匹配
            if (!matchedCandle) {
              matchedCandle = originalData.find(item => {
                if (!item || !item.openTime) return false;
                return item.openTime.includes(paramDateStr);
              });
            }
          } else if (typeof param.time === 'number') {
            // 将时间戳转换为日期字符串进行匹配
            const dateFromTimestamp = new Date(param.time < 10000000000 ? param.time * 1000 : param.time);
            const year = dateFromTimestamp.getFullYear();
            const month = String(dateFromTimestamp.getMonth() + 1).padStart(2, '0');
            const day = String(dateFromTimestamp.getDate()).padStart(2, '0');
            const hour = String(dateFromTimestamp.getHours()).padStart(2, '0');
            const minute = String(dateFromTimestamp.getMinutes()).padStart(2, '0');
            const second = String(dateFromTimestamp.getSeconds()).padStart(2, '0');
            
            // 构建完整时间字符串
            const fullTimeStr = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
            const paramDateStr = `${year}-${month}-${day}`;
            
            // 先尝试精确匹配完整时间
            matchedCandle = originalData.find(item => 
              item && item.openTime && item.openTime === fullTimeStr
            );
            
            // 如果没找到，退化为日期匹配
            if (!matchedCandle) {
              matchedCandle = originalData.find(item => {
                if (!item || !item.openTime) return false;
                return item.openTime.includes(paramDateStr);
              });
            }
          }
          
          if (matchedCandle) {
            // 使用原始K线数据的完整时间，包括秒
            time = matchedCandle.closeTime;
            console.log('使用原始K线的完整时间:', time);
          } else {
            // 如果没有找到匹配的K线，则使用格式化的时间
            if (typeof param.time === 'object' && param.time !== null) {
              // 从对象中提取年月日并格式化
              const { year, month, day, hour , minute , second  } = param.time;
              // 创建一个日期对象用于格式化
              const dateObj = new Date(year, month , day, hour , minute, second );
              time = formatDate(dateObj.getTime()); // 转换为时间戳再格式化
            } else if (typeof param.time === 'number') {
              // 如果是时间戳，使用formatDate格式化
              time = formatDate(param.time);
            } else {
              // 如果是字符串，直接使用
              time = String(param.time);
            }
          }
        } else {
          // 如果没有原始数据，则使用格式化的时间
          if (typeof param.time === 'object' && param.time !== null) {
            // 从对象中提取年月日并格式化
            const { year, month, day, hour = 0, minute = 0, second = 0 } = param.time;
            // 创建一个日期对象用于格式化
            const dateObj = new Date(year, month - 1, day, hour || 0, minute || 0, second || 0);
            time = formatDate(dateObj.getTime()); // 转换为时间戳再格式化
          } else if (typeof param.time === 'number') {
            // 如果是时间戳，使用formatDate格式化
            time = formatDate(param.time);
          } else {
            // 如果是字符串，直接使用
            time = String(param.time);
          }
        }
        
        // 确保价格数据是数字类型
        const open = typeof candleData.open === 'number' ? formatPrice(candleData.open) : candleData.open;
        const high = typeof candleData.high === 'number' ? formatPrice(candleData.high) : candleData.high;
        const low = typeof candleData.low === 'number' ? formatPrice(candleData.low) : candleData.low;
        const close = typeof candleData.close === 'number' ? formatPrice(candleData.close) : candleData.close;
        const volume = typeof volumeData === 'number' ? formatVolume(volumeData) : volumeData;
        
        // 计算涨跌幅（只在价格是数字时计算）
        let change = '0.00';
        let changePercent = '0.00';
        
        if (typeof candleData.close === 'number' && typeof candleData.open === 'number') {
          change = (candleData.close - candleData.open).toFixed(2);
          changePercent = ((candleData.close - candleData.open) / candleData.open * 100).toFixed(2);
        }
        
        // 添加资金曲线数据到悬浮信息
        let hoveredInfo: any = {
          time,
          open,
          high,
          low,
          close,
          volume,
          change,
          changePercent
        };
        
        // 如果有资金曲线数据，添加到悬浮信息中
        if (equityData !== null && equityData !== undefined) {
          // 检查equityData的类型，可能是数字或对象
          if (typeof equityData === 'number') {
            hoveredInfo.equity = equityData; // 保存原始数值，在显示时再格式化
            // console.log('悬浮窗添加资金数据(数字):', equityData);
          } else if (typeof equityData === 'object' && equityData !== null) {
            // 如果是对象，尝试获取value属性
            if ('value' in equityData) {
              hoveredInfo.equity = equityData.value; // 保存原始数值
              console.log('悬浮窗添加资金数据(对象):', equityData);
            } else {
              // 尝试其他可能的属性名
              const possibleValueProps = ['close', 'price', 'amount', 'equity'];
              for (const prop of possibleValueProps) {
                if (prop in equityData && equityData[prop] !== null && equityData[prop] !== undefined) {
                  hoveredInfo.equity = equityData[prop]; // 保存原始数值
                  console.log(`悬浮窗添加资金数据(${prop}):`, equityData);
                  break;
                }
              }
            }
          }
        } else {
          // 尝试从equityCurveData中查找当前时间点的资金数据
          try {
            if (originalData && originalData.length > 0 && equityCurveData && equityCurveData.length > 0) {
              // 获取当前K线的时间
              const currentCandle = candleData;
              if (currentCandle && param.time) {
                // 获取当前时间
                let dateStr: string = '';
                if (typeof param.time === 'object' && param.time.year && param.time.month && param.time.day) {
                  dateStr = `${param.time.year}-${String(param.time.month).padStart(2, '0')}-${String(param.time.day).padStart(2, '0')}-${String(param.time.hour).padStart(2, '0')}-${String(param.time.minute).padStart(2, '0')}-${String(param.time.second).padStart(2, '0')}`;
                } else if (typeof param.time === 'number') {
                  const date = new Date(param.time < 10000000000 ? param.time * 1000 : param.time);
                  dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
                }
                
                if (dateStr) {
                  // 查找匹配的资金数据点
                  const matchingPoint = equityCurveData.find(item => 
                    item && item.timestamp && typeof item.timestamp === 'string' && item.timestamp.includes(dateStr)
                  );
                  
                  if (matchingPoint && typeof matchingPoint.value === 'number') {
                    hoveredInfo.equity = matchingPoint.value; // 保存原始数值
                    console.log('从equityCurveData找到匹配的资金数据:', matchingPoint);
                  }
                }
              }
            }
          } catch (err) {
            console.error('查找匹配资金数据错误:', err);
          }
        }
        
        // if (hoveredInfo.equity === undefined || hoveredInfo.equity === null) {
        //   console.log('没有找到资金曲线数据');
        // }
        
        // 更新悬浮数据
        setHoveredData(hoveredInfo);
        
        // 设置浮层位置跟随鼠标
        if (tooltipRef.current && chartContainerRef.current) {
          // 获取chart容器的位置和大小
          const chartRect = chartContainerRef.current.getBoundingClientRect();
          
          // 在下一帧更新tooltip位置，确保DOM已更新
          requestAnimationFrame(() => {
            if (!tooltipRef.current) return;
            
            // 获取tooltip的尺寸
            const tooltipRect = tooltipRef.current.getBoundingClientRect();
            
            // 计算相对于chart容器的鼠标位置
            const x = param.point.x;
            const y = param.point.y;
            
            // 始终将悬浮窗放在鼠标左侧
            let left = x - tooltipRect.width - 20;
            
            // 如果左侧空间不足，再考虑放在右侧
            if (left < 10) {
              left = x + 20;
            }
            
            let top = y - tooltipRect.height / 2; // 垂直居中对齐
            if (top < 10) {
              top = 10; // 如果太靠上，则固定在顶部
            } else if (top + tooltipRect.height > chartRect.height - 10) {
              top = chartRect.height - tooltipRect.height - 10; // 如果太靠下，则固定在底部
            }
            
            // 更新tooltip位置
            tooltipRef.current.style.transform = 'translate3d(0, 0, 0)'; // 启用硬件加速
            tooltipRef.current.style.left = `${left}px`;
            tooltipRef.current.style.top = `${top}px`;
          });
        }
      }
    });
  };

  // 加载K线数据 - 使用useCallback优化
  const loadKlineData = useCallback(async () => {
    // 防止重复调用
    if (apiCallInProgressRef.current || dataLoadedRef.current) {
      console.log('API调用正在进行中或数据已加载，跳过重复调用');
      return;
    }
    
    if (!symbol || !startTime || !endTime || !cacheKey) {
      console.warn('缺少必要的参数，无法加载K线数据');
      return;
    }

    // 标记API调用开始
    apiCallInProgressRef.current = true;
    setLoading(true);
    setError(null);

    try {
      // 从开始日期到结束日期获取K线数据
      const startDate = startTime.split(' ')[0];
      const endDate = endTime.split(' ')[0];
      
      // 获取回测使用的周期
      // 从URL中获取interval参数，如果没有则使用props中的interval或默认为1D
      const urlParams = new URLSearchParams(window.location.search);
      const urlInterval = urlParams.get('interval');
      
      // 尝试从URL中获取backtestId
      const backtestId = urlParams.get('backtestId') || 
                        (tradeDetails.length > 0 ? tradeDetails[0].backtestId : '');
      
      // 默认使用1D
      let dataInterval = '1D';
      
      // 优先使用URL中指定的interval
      if (urlInterval) {
        dataInterval = urlInterval;
      } 
      // 否则尝试从回测汇总中获取
      else if (backtestId && isInitialLoad.current) {
        try {
          const backtestSummary = await fetchBacktestSummary(backtestId);
          if (backtestSummary && backtestSummary.intervalVal) {
            dataInterval = backtestSummary.intervalVal;
          }
        } catch (err) {
          console.error('获取回测汇总失败:', err);
        }
      }
      
      console.log('使用K线周期:', dataInterval);
      
      // 保存当前使用的周期，供其他函数使用
      setIntervalVal(dataInterval);
      
      // 为了确保有足够的上下文，我们获取稍微扩展的时间范围
      // 计算开始日期前30天的日期作为请求开始日期
      const extendedStartDate = new Date(startDate);
      extendedStartDate.setDate(extendedStartDate.getDate() - 30);
      const requestStartDate = extendedStartDate.toISOString().split('T')[0];
      
      // 计算结束日期后15天的日期作为请求结束日期
      const extendedEndDate = new Date(endDate);
      extendedEndDate.setDate(extendedEndDate.getDate() + 15);
      const requestEndDate = extendedEndDate.toISOString().split('T')[0];
      
      // 检查缓存
      const cachedData = klineDataCache.get(cacheKey);
      
      if (isCacheValid(cachedData)) {
        console.log('使用缓存的K线数据');
        setOriginalData(cachedData!.data);
        
        // 更新图表
        if (candleSeries.current && volumeSeries.current && chart.current) {
          const convertedData = cachedData!.data.map(item => ({
            ...item,
            time: item.time as Time
          }));
          
          // 设置K线数据
          candleSeries.current.setData(convertedData);
          
          // 设置成交量数据
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
          
          // 绘制交易标记
          drawTradeMarkers();
          
          // 设置图表时间范围
          chart.current.timeScale().fitContent();
          setTimeout(() => {
            if (chart.current) {
              chart.current.timeScale().setVisibleRange({
                from: startDate,
                to: endDate,
              });
            }
          }, 100);
        }
        
        setLoading(false);
        setDataLoaded(true);
        dataLoadedRef.current = true;
        return;
      }
      
      // 获取K线数据，使用fetchHistoryWithIntegrityCheckV2函数
      console.log('从API获取K线数据:', { symbol, interval: dataInterval, startDate: requestStartDate, endDate: requestEndDate });
      let result;
      try {
        result = await fetchHistoryWithIntegrityCheckV2(
          symbol,
          dataInterval, // 使用确定的interval值
          requestStartDate, // formatDateString会自动添加 00:00:00
          requestEndDate    // formatDateString会自动添加 00:00:00
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
      
      // 保存原始K线数据，包含完整的日期时间信息
      setOriginalData(result.data);
      
      // 调试信息，查看原始数据的格式
      console.log('原始K线数据示例:', result.data.length > 0 ? result.data[0] : '无数据');
      
      // fetchHistoryWithIntegrityCheck返回的data已经是CandlestickData[]格式
      // 需要将time字段转换为Time类型以兼容lightweight-charts
      const convertedData = result.data
        .filter(item => item && item.time != null && item.open != null && item.high != null && item.low != null && item.close != null && item.volume != null)
        .map(item => ({
          ...item,
          time: item.time as Time
        }));
      
      // 更新K线图 - 添加更严格的检查
      if (candleSeries.current && volumeSeries.current && chart.current && convertedData.length > 0) {
        // 直接使用转换好的数据
        candleSeries.current.setData(convertedData);
        
        // 创建成交量数据
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
        
        // 绘制交易标记
        drawTradeMarkers();
        
        // 设置图表时间范围，聚焦于回测的开始和结束时间
        if (chart.current && convertedData.length > 0) {
          // 首先让图表适应所有内容
          chart.current.timeScale().fitContent();
          
          // 然后设置可见范围为回测的开始和结束时间
          setTimeout(() => {
            if (chart.current) {
              const from = startDate;
              const to = endDate;
              
              // 设置时间范围
              chart.current.timeScale().setVisibleRange({
                from,
                to,
              });
            }
          }, 100); // 小延迟确保渲染完成
        }
      }
      
      setLoading(false);
      setDataLoaded(true);
      dataLoadedRef.current = true;
    } catch (err) {
      console.error('加载K线数据失败:', err);
      setError('加载K线数据失败');
      setLoading(false);
    } finally {
      isInitialLoad.current = false;
      apiCallInProgressRef.current = false;
    }
  }, [symbol, startTime, endTime, cacheKey]);

  // 防抖处理的加载函数
  const debouncedLoadKlineData = useMemo(() => 
    debounce(() => {
      if (!dataLoadedRef.current) {
        loadKlineData();
      }
    }, 300)
  , [loadKlineData]);

  // 添加一个通用的时间格式化函数
  const formatChartTime = (timeStr: string): number | string => {
    if (!timeStr) return '';
    
    // 检查原始数据的时间格式
    let timeFormat = 'string';
    if (originalData && originalData.length > 0) {
      const firstItem = originalData[0];
      if (typeof firstItem.time === 'number') {
        timeFormat = 'number';
      }
    }
    
    if (timeFormat === 'number') {
      // 转换为时间戳
      const timestamp = Math.floor(new Date(timeStr).getTime() / 1000);
      return timestamp;
    } else {
      // 根据K线周期决定时间格式
      if (intervalVal === '1D' || intervalVal === '3D' || intervalVal === '1W' || intervalVal === '1M') {
        // 日线及以上周期只需要日期部分
        return timeStr.split(' ')[0];
      }
      // 分钟线需要完整时间
      return timeStr;
    }
  };

  // 绘制交易标记
  const drawTradeMarkers = () => {
    if (!candleSeries.current || !tradeDetails || tradeDetails.length === 0) return;
    
    try {
      // 准备买入和卖出标记
      const markers = tradeDetails.map(trade => {
        // 判断是买入还是卖出
        const isBuy = trade.type === 'BUY' || trade.type === 'LONG' || trade.type === 'buy' || trade.type === 'long';
        
        // 买入或卖出标记
        const entryTime = formatChartTime(trade.entryTime);
        const entryMarker = {
          time: typeof entryTime === 'string' ? entryTime : entryTime, // 如果是字符串就保持不变，如果是数字也保持不变
          position: isBuy ? 'belowBar' : 'aboveBar' as SeriesMarkerPosition,
          color: isBuy ? '#00FFFF' : '#FF00FF', // 买入青色，卖出品红色
          shape: isBuy ? 'arrowUp' : 'arrowDown',
          text: `${isBuy ? '买入' : '卖出'} ${formatPrice(trade.entryPrice)}`,
          size: 1,
          id: `entry-${trade.id || ''}`,
        };
        
        // 平仓标记
        let exitMarker = null;
        if (trade.exitTime) {
          const exitTime = formatChartTime(trade.exitTime);
          exitMarker = {
            time: typeof exitTime === 'string' ? exitTime : exitTime, // 如果是字符串就保持不变，如果是数字也保持不变
            position: isBuy ? 'aboveBar' : 'belowBar' as SeriesMarkerPosition,
            color: isBuy ? '#FFFF00' : '#00FF00', // 买入平仓黄色，卖出平仓绿色
            shape: isBuy ? 'arrowDown' : 'arrowUp',
            text: `平仓 ${formatPrice(trade.exitPrice)} ${trade.profit !== undefined ? `(${trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)})` : ''}`,
            size: 1,
            id: `exit-${trade.id || ''}`,
          };
        }
        
        return exitMarker ? [entryMarker, exitMarker] : [entryMarker];
      }).flat().filter(Boolean);
      
      // 设置标记
      candleSeries.current.setMarkers(markers as any[]);
      
      console.log('绘制了交易标记:', markers.length, '个，第一个标记时间:', markers[0]?.time);
    } catch (error) {
      console.error('绘制交易标记错误:', error);
    }
  };

  // 加载K线数据后绘制资金曲线
  const drawEquityCurve = useCallback(async () => {
    if (!equityCurveSeries.current || !chart.current) return;
    
    // 如果没有资金曲线数据，先加载
    let curveData = equityCurveData;
    if (curveData.length === 0) {
      curveData = await loadEquityCurveData();
      if (!curveData || curveData.length === 0) {
        console.warn('无法获取资金曲线数据');
        return;
      }
    }
    
    try {
      console.log('原始资金曲线数据:', curveData.slice(0, 5));
      
      // 如果没有K线数据，无法进行对齐
      if (!originalData || originalData.length === 0) {
        console.warn('没有K线数据，无法对齐资金曲线');
        return;
      }
      
      // 创建K线时间点的映射，用于快速查找
      const klineTimeMap = new Map();
      
      // 保存所有K线的日期部分，用于日期匹配
      const klineDateMap = new Map();
      
      originalData.forEach((kline, index) => {
        let dateStr = '';
        let fullTime = '';
        
        if (typeof kline.time === 'object' && kline.time !== null) {
          // 从对象中提取年月日时分秒
          const { year, month, day, hour = 0, minute = 0, second = 0 } = kline.time;
          dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          fullTime = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
        } else if (typeof kline.time === 'number') {
          // 从时间戳中提取年月日时分秒
          const date = new Date(kline.time < 10000000000 ? kline.time * 1000 : kline.time);
          dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          fullTime = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
        } else if (typeof kline.time === 'string') {
          // 如果是字符串格式，直接使用
          dateStr = kline.time.includes(' ') ? kline.time.split(' ')[0] : kline.time;
          fullTime = kline.time;
        }
        
        // 如果K线有openTime或closeTime属性，优先使用它作为完整时间
        if (kline.closeTime) {
          fullTime = kline.closeTime;
          dateStr = kline.closeTime.includes(' ') ? kline.closeTime.split(' ')[0] : kline.closeTime;
        } else if (kline.openTime) {
          fullTime = kline.openTime;
          dateStr = kline.openTime.includes(' ') ? kline.openTime.split(' ')[0] : kline.openTime;
        }
        
        if (dateStr) {
          // 存储K线索引、时间格式和完整时间
          klineTimeMap.set(fullTime, {
            index,
            time: kline.time,
            fullTime: fullTime,
            dateStr: dateStr
          });
          
          // 同时保存日期部分到日期映射
          if (!klineDateMap.has(dateStr)) {
            klineDateMap.set(dateStr, []);
          }
          klineDateMap.get(dateStr).push({
            index,
            time: kline.time,
            fullTime: fullTime
          });
        }
      });
      
      console.log('K线时间映射创建完成，共', klineTimeMap.size, '个时间点');
      
      // 预处理资金曲线数据，将其按日期分组
      const equityByDate = new Map<string, Map<string, number>>();
      let lastKnownEquity: number | null = null;
      
      curveData.forEach(item => {
        if (!item || !item.timestamp || item.value === undefined) return;
        
        // 处理资金曲线时间戳
        let timeStr = '';
        let dateStr = '';
        
        if (typeof item.timestamp === 'string') {
          timeStr = item.timestamp;
          dateStr = item.timestamp.includes(' ') ? item.timestamp.split(' ')[0] : item.timestamp;
        } else if (typeof item.timestamp === 'number') {
          const date = new Date(item.timestamp < 10000000000 ? item.timestamp * 1000 : item.timestamp);
          timeStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
          dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        }
        
        if (timeStr && dateStr) {
          // 存储资金曲线值到日期映射
          if (!equityByDate.has(dateStr)) {
            equityByDate.set(dateStr, new Map<string, number>());
          }
          const dateMap = equityByDate.get(dateStr);
          if (dateMap) {
            dateMap.set(timeStr, item.value);
          }
          
          // 更新最后已知资金值
          lastKnownEquity = item.value;
        }
      });
      
      // 为每个K线分配资金值，优先使用精确匹配，然后是当天最后的资金值
      const formattedData: LineData[] = [];
      let firstEquityFound = false;
      let lastEquityValue: number | null = null;
      
      // 按时间顺序处理K线数据
      const sortedKlineTimes = Array.from(klineTimeMap.keys()).sort();
      
      sortedKlineTimes.forEach(fullTime => {
        const klineInfo = klineTimeMap.get(fullTime);
        let equityValue = null;
        
        // 1. 优先尝试精确匹配完整时间
        const exactTimeMatchFound = equityByDate.has(klineInfo.dateStr) && 
                                  equityByDate.get(klineInfo.dateStr)?.has(fullTime);
        if (exactTimeMatchFound && equityByDate.get(klineInfo.dateStr)) {
          const timeMap = equityByDate.get(klineInfo.dateStr);
          if (timeMap && timeMap.has(fullTime)) {
            equityValue = timeMap.get(fullTime) as number;
            firstEquityFound = true;
          }
        }
        // 2. 然后尝试匹配同一天的任意时间点
        else if (equityByDate.has(klineInfo.dateStr)) {
          const dateEquities = Array.from(equityByDate.get(klineInfo.dateStr)?.entries() || []);
          
          if (dateEquities.length > 0) {
            // 选择当天最后一个资金值
            const lastEquityForDay = dateEquities[dateEquities.length - 1][1];
            equityValue = lastEquityForDay;
            firstEquityFound = true;
          }
        }
        // 3. 如果前两种方法都失败，使用之前找到的最后一个资金值
        else if (firstEquityFound && lastEquityValue !== null) {
          equityValue = lastEquityValue;
        }
        
        // 只有在我们已经找到了第一个资金值之后，才添加数据点
        if (equityValue !== null) {
          formattedData.push({
            time: klineInfo.time,
            value: equityValue
          });
          lastEquityValue = equityValue;
        }
      });
      
      console.log('生成的资金曲线数据点数:', formattedData.length, 
                '首条数据:', formattedData[0], 
                '末条数据:', formattedData[formattedData.length - 1],
                '覆盖率:', (formattedData.length / sortedKlineTimes.length * 100).toFixed(2) + '%');
      
      // 设置资金曲线数据
      equityCurveSeries.current.setData(formattedData);
      
      // 显示资金曲线价格坐标轴
      chart.current.priceScale('left').applyOptions({
        visible: true,
        autoScale: true,
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      });
    } catch (error) {
      console.error('绘制资金曲线错误:', error);
    }
  }, [equityCurveData, loadEquityCurveData, originalData]);

  // 初始化图表 - 仅在组件挂载时执行一次
  useEffect(() => {
    createCharts();
    
    return () => {
      // 清理图表和所有引用
      if (chart.current) {
        chart.current.remove();
        chart.current = null;
      }
      candleSeries.current = null;
      volumeSeries.current = null;
      equityCurveSeries.current = null;
      // 重置数据加载状态
      dataLoadedRef.current = false;
    };
  }, [createCharts]);

  // 当交易详情更新时，重新绘制标记
  useEffect(() => {
    if (candleSeries.current && tradeDetails && tradeDetails.length > 0 && dataLoaded) {
      drawTradeMarkers();
    }
  }, [tradeDetails, dataLoaded]);
  
  // 加载K线数据 - 使用防抖处理，避免重复调用
  useEffect(() => {
    if (symbol && startTime && endTime && cacheKey && !dataLoadedRef.current) {
      console.log('触发K线数据加载');
      debouncedLoadKlineData();
    }
  }, [symbol, startTime, endTime, cacheKey, debouncedLoadKlineData]);

  // 当K线数据加载完成后，加载资金曲线数据
  useEffect(() => {
    if (dataLoaded && !equityCurveLoaded && backtestId) {
      loadEquityCurveData();
    }
  }, [dataLoaded, equityCurveLoaded, backtestId, loadEquityCurveData]);
  
  // 当资金曲线数据加载完成后，绘制资金曲线
  useEffect(() => {
    if (equityCurveData.length > 0 && equityCurveSeries.current) {
      drawEquityCurve();
    }
  }, [equityCurveData, drawEquityCurve]);

  // 修改safelyRemoveHighlight函数
  const safelyRemoveHighlight = useCallback(() => {
    // 移除DOM高亮覆盖层
    setHighlightStyle(null);
    
    // 同时清理任何可能存在的图表高亮元素
    if (highlightedAreaRef.current) {
      try {
        if (Array.isArray(highlightedAreaRef.current)) {
          highlightedAreaRef.current.forEach(item => {
            try {
              if (!item) return;
              
              if (chart.current && typeof item === 'object' && 'setData' in item) {
                try {
                  if (item && typeof item.setData === 'function') {
                    item.setData([]);
                    if (chart.current && chart.current.removeSeries) {
                      chart.current.removeSeries(item);
                    }
                  }
                } catch (innerError) {
                  console.error('移除图表系列失败:', innerError);
                  try {
                    if (item && typeof item.setData === 'function') {
                      item.setData([]);
                    }
                  } catch (e) {
                    console.error('清空系列数据失败:', e);
                  }
                }
              }
            } catch (err) {
              console.error('移除高亮元素失败:', err);
            }
          });
        }
        
        highlightedAreaRef.current = null;
      } catch (error) {
        console.error('清除高亮区域错误:', error);
      }
    }
  }, []);
  
  // 在组件卸载时清理资源
  useEffect(() => {
    return () => {
      safelyRemoveHighlight();
      
      // 清理图表资源
      if (chart.current) {
        chart.current.remove();
        chart.current = null;
      }
    };
  }, [safelyRemoveHighlight]);

  // 添加一个函数来找到交易对应的K线索引
  const findKlineIndexByTime = (time: string, data: any[]): number => {
    if (!data || data.length === 0) return -1;
    
    console.log('findKlineIndexByTime - 输入时间:', time);
    console.log('findKlineIndexByTime - 数据样本:', data.slice(0, 3).map(k => ({
      time: k.time,
      timeType: typeof k.time,
      timeStr: k.time ? k.time.toString() : 'null'
    })));
    
    // 从时间字符串中提取日期部分，格式化为 YYYY-MM-DD
    let targetDateStr = '';
    if (time.includes(' ')) {
      targetDateStr = time.split(' ')[0]; // 提取日期部分
    } else {
      targetDateStr = time;
    }
    
    console.log('目标日期字符串:', targetDateStr);
    
    // 尝试精确匹配日期字符串
    for (let i = 0; i < data.length; i++) {
      const kline = data[i];
      let klineDateStr = '';
      
      if (typeof kline.time === 'object' && kline.time !== null) {
        // 处理对象格式时间
        const { year, month, day } = kline.time;
        klineDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      } else if (typeof kline.time === 'string') {
        // 处理字符串格式时间
        klineDateStr = kline.time.includes(' ') ? kline.time.split(' ')[0] : kline.time;
      } else if (typeof kline.time === 'number') {
        // 处理数字格式时间 - 使用收盘时间
        const date = new Date(kline.time < 10000000000 ? kline.time * 1000 : kline.time);
        klineDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      }
      
      // 精确匹配日期字符串
      if (klineDateStr === targetDateStr) {
        console.log('找到精确匹配:', targetDateStr, '在索引', i, '时间值:', kline.time);
        return i;
      }
    }
    
    console.log('未找到精确匹配，将使用最接近的时间');
    
    // 如果没有精确匹配，使用最接近的时间
    const targetTime = new Date(targetDateStr).getTime();
    if (isNaN(targetTime)) {
      console.error('无效的日期格式:', targetDateStr);
      return -1;
    }
    
    // 找到最接近的K线
    let closestIndex = -1;
    let minTimeDiff = Number.MAX_VALUE;
    
    data.forEach((kline, index) => {
      let klineTime;
      
      if (typeof kline.time === 'number') {
        klineTime = kline.time < 10000000000 ? kline.time * 1000 : kline.time; // 秒转毫秒
      } else if (typeof kline.time === 'string') {
        const dateStr = kline.time.includes(' ') ? kline.time.split(' ')[0] : kline.time;
        klineTime = new Date(dateStr).getTime();
      } else if (typeof kline.time === 'object' && kline.time !== null) {
        // 处理对象格式时间
        const { year, month, day } = kline.time;
        klineTime = new Date(year, month - 1, day).getTime();
      } else {
        return; // 跳过无法处理的格式
      }
      
      if (isNaN(klineTime)) {
        return; // 跳过无效的时间
      }
      
      const timeDiff = Math.abs(klineTime - targetTime);
      if (timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        closestIndex = index;
      }
    });
    
    console.log('最接近的K线索引:', closestIndex, '时间差(ms):', minTimeDiff);
    return closestIndex;
  };

  // 暴露给父组件的方法
  useImperativeHandle(ref, () => ({
    // 高亮显示指定时间范围
    highlightTimeRange: (startTime: string, endTime: string) => {
      if (!chart.current || !candleSeries.current || !originalData || originalData.length === 0 || !chartContainerRef.current) return;
      
      try {
        // 清除之前的高亮区域
        safelyRemoveHighlight();
        
        console.log('高亮时间范围:', startTime, endTime);
        
        // 找到对应的K线索引
        const startIndex = findKlineIndexByTime(startTime, originalData);
        const endIndex = findKlineIndexByTime(endTime, originalData);
        
        if (startIndex === -1 || endIndex === -1) {
          console.error('无法找到对应的K线');
          return;
        }
        
        // 保存选中的K线索引，用于后续更新高亮区域
        setSelectedKlineIndices({start: startIndex, end: endIndex});
        
        console.log('找到K线索引:', startIndex, endIndex);
        
        // 获取这些K线的时间值
        const startKline = originalData[startIndex];
        const endKline = originalData[endIndex];
        
        if (!startKline || !endKline) {
          console.error('无法获取K线数据');
          return;
        }
        
        // 转换为图表时间格式
        const startTimeFormatted = typeof startKline.time === 'number' 
          ? startKline.time 
          : formatChartTime(startKline.time.toString());
        
        const endTimeFormatted = typeof endKline.time === 'number' 
          ? endKline.time 
          : formatChartTime(endKline.time.toString());
        
        console.log('格式化后的时间:', startTimeFormatted, endTimeFormatted);
        
        // 计算交易区间的中心点索引
        const midIndex = Math.floor((startIndex + endIndex) / 2);
        
        // 计算需要显示的时间范围，使交易区间居中
        // 在交易区间两侧各添加足够的K线，确保交易区间居中
        const visibleRange = 40; // 总共显示的K线数量
        const halfRange = Math.floor(visibleRange / 2);
        
        // 计算可见范围的起始和结束索引
        const visibleStartIndex = Math.max(0, midIndex - halfRange);
        const visibleEndIndex = Math.min(originalData.length - 1, midIndex + halfRange);
        
        const visibleStartKline = originalData[visibleStartIndex];
        const visibleEndKline = originalData[visibleEndIndex];
        
        const visibleStartTime = typeof visibleStartKline.time === 'number' 
          ? visibleStartKline.time 
          : formatChartTime(visibleStartKline.time.toString());
        
        const visibleEndTime = typeof visibleEndKline.time === 'number' 
          ? visibleEndKline.time 
          : formatChartTime(visibleEndKline.time.toString());
        
        // 获取当前K线宽度
        const currentOptions = chart.current.timeScale().options();
        const currentBarSpacing = currentOptions.barSpacing;
        
        // 设置可见范围
        chart.current.timeScale().setVisibleRange({
          from: visibleStartTime,
          to: visibleEndTime
        });
        
        // 确保K线宽度不变
        chart.current.timeScale().applyOptions({
          barSpacing: currentBarSpacing
        });
        
        // 更新高亮区域
        updateHighlightArea();
      } catch (error) {
        console.error('高亮时间范围错误:', error);
      }
    }
  }));

  // 在选中交易变化时的处理
  useEffect(() => {
    if (!dataLoaded || !originalData || originalData.length === 0) return;
    
    // 清除之前的高亮区域
    safelyRemoveHighlight();
    setSelectedKlineIndices(null);
    
    if (selectedTrade) {
      // 延迟执行，确保图表已经完全加载
      setTimeout(() => {
        try {
          if (!chart.current || !chartContainerRef.current) return;
          
          console.log('选中交易时间范围:', selectedTrade.entryTime, selectedTrade.exitTime);
          
          // 找到对应的K线索引
          const startIndex = findKlineIndexByTime(selectedTrade.entryTime, originalData);
          const endIndex = findKlineIndexByTime(selectedTrade.exitTime, originalData);
          
          if (startIndex === -1 || endIndex === -1) {
            console.error('无法找到对应的K线');
            return;
          }
          
          // 保存选中的K线索引，用于后续更新高亮区域
          setSelectedKlineIndices({start: startIndex, end: endIndex});
          
          console.log('找到K线索引:', startIndex, endIndex);
          
          // 获取这些K线的时间值
          const startKline = originalData[startIndex];
          const endKline = originalData[endIndex];
          
          if (!startKline || !endKline) {
            console.error('无法获取K线数据');
            return;
          }
          
          // 转换为图表时间格式
          const startTimeFormatted = typeof startKline.time === 'number' 
            ? startKline.time 
            : formatChartTime(startKline.time.toString());
          
          const endTimeFormatted = typeof endKline.time === 'number' 
            ? endKline.time 
            : formatChartTime(endKline.time.toString());
          
          console.log('格式化后的时间:', startTimeFormatted, endTimeFormatted);
          
          // 计算交易区间的中心点索引
          const midIndex = Math.floor((startIndex + endIndex) / 2);
          
          // 计算需要显示的时间范围，使交易区间居中
          // 在交易区间两侧各添加足够的K线，确保交易区间居中
          const visibleRange = 40; // 总共显示的K线数量
          const halfRange = Math.floor(visibleRange / 2);
          
          // 计算可见范围的起始和结束索引
          const visibleStartIndex = Math.max(0, midIndex - halfRange);
          const visibleEndIndex = Math.min(originalData.length - 1, midIndex + halfRange);
          
          const visibleStartKline = originalData[visibleStartIndex];
          const visibleEndKline = originalData[visibleEndIndex];
          
          const visibleStartTime = typeof visibleStartKline.time === 'number' 
            ? visibleStartKline.time 
            : formatChartTime(visibleStartKline.time.toString());
          
          const visibleEndTime = typeof visibleEndKline.time === 'number' 
            ? visibleEndKline.time 
            : formatChartTime(visibleEndKline.time.toString());
          
          // 获取当前K线宽度
          const currentOptions = chart.current.timeScale().options();
          const currentBarSpacing = currentOptions.barSpacing;
          
          // 设置可见范围
          chart.current.timeScale().setVisibleRange({
            from: visibleStartTime,
            to: visibleEndTime
          });
          
          // 确保K线宽度不变
          chart.current.timeScale().applyOptions({
            barSpacing: currentBarSpacing
          });
          
          // 更新高亮区域
          updateHighlightArea();
        } catch (error) {
          console.error('高亮选中交易时间范围错误:', error);
        }
      }, 200);
    } else {
      // 如果没有选中交易，清除高亮
      safelyRemoveHighlight();
    }
  }, [selectedTrade, dataLoaded, originalData, intervalVal, safelyRemoveHighlight]);

  // 添加一个函数来更新高亮区域
  const updateHighlightArea = useCallback(() => {
    if (!chart.current || !chartContainerRef.current || !selectedKlineIndices || !originalData || originalData.length === 0) return;
    
    try {
      const { start: startIndex, end: endIndex } = selectedKlineIndices;
      
      // 获取这些K线的时间值
      const startKline = originalData[startIndex];
      const endKline = originalData[endIndex];
      
      if (!startKline || !endKline) return;
      
      // 转换为图表时间格式
      const startTimeFormatted = typeof startKline.time === 'number' 
        ? startKline.time 
        : (typeof startKline.time === 'string' ? formatChartTime(startKline.time) : 0);
      
      const endTimeFormatted = typeof endKline.time === 'number' 
        ? endKline.time 
        : (typeof endKline.time === 'string' ? formatChartTime(endKline.time) : 0);
      
      // 获取K线在图表上的坐标
      const startCoord = chart.current.timeScale().timeToCoordinate(startTimeFormatted);
      const endCoord = chart.current.timeScale().timeToCoordinate(endTimeFormatted);
      
      if (startCoord === null || endCoord === null) {
        console.error('无法获取K线坐标');
        return;
      }
      
      // 获取当前K线宽度
      const currentOptions = chart.current.timeScale().options();
      const currentBarSpacing = currentOptions.barSpacing;
      
      // 计算高亮区域的位置和尺寸
      const left = Math.min(startCoord, endCoord);
      // 确保宽度至少包含一根K线
      const width = Math.max(Math.abs(endCoord - startCoord), currentBarSpacing);
      
      // 设置高亮样式
      setHighlightStyle({
        position: 'absolute',
        left: `${left}px`,
        top: '0',
        width: `${width}px`,
        height: '100%',
        backgroundColor: 'rgba(255, 192, 0, 0.15)',
        borderLeft: '1px solid rgba(255, 192, 0, 0.5)',
        borderRight: '1px solid rgba(255, 192, 0, 0.5)',
        pointerEvents: 'none', // 允许点击穿透
        zIndex: 2 // 确保在K线上方，但在工具提示下方
      });
    } catch (error) {
      console.error('更新高亮区域位置错误:', error);
    }
  }, [selectedKlineIndices, originalData]);

  // 添加图表滚动事件监听
  useEffect(() => {
    if (!chart.current) return;
    
    const handleScroll = () => {
      if (selectedKlineIndices) {
        updateHighlightArea();
      }
    };
    
    // 订阅图表的可见范围变化事件
    chart.current.timeScale().subscribeVisibleLogicalRangeChange(handleScroll);
    
    return () => {
      // 取消订阅
      if (chart.current) {
        chart.current.timeScale().unsubscribeVisibleLogicalRangeChange(handleScroll);
      }
    };
  }, [chart, selectedKlineIndices, updateHighlightArea]);

  // 在图表大小变化时更新高亮区域位置
  useEffect(() => {
    const handleResize = () => {
      if (selectedKlineIndices) {
        updateHighlightArea();
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [selectedKlineIndices, updateHighlightArea]);

  return (
    <div className="backtest-detail-chart-container">
      <div 
        ref={chartContainerRef} 
        className="chart" 
        style={{ 
          height: 'auto', // 由固定600px改为自适应
          minHeight: 300,
          maxHeight: 600,
          visibility: loading ? 'hidden' : 'visible',
          position: 'relative' // 添加相对定位，作为高亮覆盖层的定位参考
        }}
      >
        {/* 高亮覆盖层 */}
        {highlightStyle && (
          <div
            ref={highlightOverlayRef}
            style={highlightStyle}
            className="highlight-overlay"
          />
        )}
      </div>
      
      {/* K线详细信息浮层 */}
      {hoveredData && (
        <div 
          ref={tooltipRef} 
          style={{
            position: 'absolute',
            zIndex: 100,
            backgroundColor: 'rgba(30, 34, 45, 0.9)',
            border: '1px solid #2e3241',
            borderRadius: '4px',
            padding: '8px 12px',
            color: '#d9d9d9',
            fontSize: '12px',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
            pointerEvents: 'none', // 允许鼠标点击事件穿透到下面的图表
            left: '0px', // 初始位置，会被JavaScript动态更新
            top: '0px',  // 初始位置，会被JavaScript动态更新
            minWidth: '180px',
            maxWidth: '250px'
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
             <span style={{
              color: '#00FFFF', // 鲜艳的青色
              fontWeight: '700',
              fontSize: '14px'
            }}>{hoveredData.close}</span>
          </div>
          <div className="tooltip-row">
            <span className="tooltip-label">成交量:</span>
            <span className="tooltip-value">{hoveredData.volume}</span>
          </div>
          <div className="tooltip-row">
            <span className="tooltip-label">涨跌:</span>
            <span style={{
              color: parseFloat(String(hoveredData.change).replace(/[^\d.-]/g, '') || '0') >= 0 ? '#ff5555' : '#32a852',
              fontWeight: '500'
            }}>
              {hoveredData.change} ({hoveredData.changePercent}%)
            </span>
          </div>
          {/* 添加资金曲线数据显示 - 始终显示，如果没有数据则显示"--" */}
          <div className="tooltip-row">
            <span className="tooltip-label">资金:</span>
            <span style={{
              color: '#FF1493', // 鲜艳的粉红色
              fontWeight: '700',
              fontSize: '14px'
            }}>
              {hoveredData.equity !== undefined && hoveredData.equity !== null ? 
                (typeof hoveredData.equity === 'number' ? formatPrice(hoveredData.equity) : String(hoveredData.equity)) : 
                '--'}
            </span>
          </div>
        </div>
      )}
      
      {/* 加载状态提示 */}
      {loading && (
        <div className="chart-loading">加载K线数据中...</div>
      )}
      
      {/* 错误提示 */}
      {error && (
        <div className="chart-error">{error}</div>
      )}
    </div>
  );
});

export default BacktestDetailChart;