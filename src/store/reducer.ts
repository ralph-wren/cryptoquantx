import { AppState } from './types';
import { ActionType } from './actions';
import { mockOrderBookData, mockTradeHistoryData, mockCryptoPairs } from '../data/mockData';
import { getDefaultStartDate, getDefaultEndDate } from '../constants/trading';

// 从localStorage获取保存的设置
const getSavedSettings = () => {
  try {
    const savedSettings = localStorage.getItem('cryptoquantx_chart_settings');
    return savedSettings ? JSON.parse(savedSettings) : null;
  } catch (error) {
    console.error('读取保存的设置失败:', error);
    return null;
  }
};

// 从localStorage获取保存的K线数据
const getSavedData = () => {
  try {
    const savedData = localStorage.getItem('cryptoquantx_candlestick_data');
    if (!savedData) {
      console.log('Redux初始化 - 没有保存的K线数据');
      return [];
    }
    
    // 获取元信息（如果有的话）
    const savedMeta = localStorage.getItem('cryptoquantx_candlestick_meta');
    const savedSettings = getSavedSettings();
    
    if (savedMeta && savedSettings) {
      const meta = JSON.parse(savedMeta);
      console.log('Redux初始化 - K线数据元信息:', {
        cached: { symbol: meta.symbol, timeframe: meta.timeframe },
        current: { symbol: savedSettings.selectedPair, timeframe: savedSettings.timeframe }
      });
    }
    
    const data = JSON.parse(savedData);
    console.log('Redux初始化 - 从localStorage恢复K线数据:', {
      dataLength: data.length,
      firstItem: data.length > 0 ? data[0] : null
    });
    return data;
  } catch (error) {
    console.error('读取保存的K线数据失败:', error);
    return [];
  }
};

// 获取保存的设置，如果没有则使用默认值
const savedSettings = getSavedSettings();
const savedData = getSavedData();

// 初始状态
const initialState: AppState = {
  marketType: savedSettings?.marketType || 'crypto', // 默认为加密货币市场
  selectedPair: savedSettings?.selectedPair || 'BTC-USDT',
  timeframe: savedSettings?.timeframe || '1D',
  dateRange: savedSettings?.dateRange || {
    startDate: getDefaultStartDate(),
    endDate: getDefaultEndDate()
  },
  candlestickData: savedData, // 从localStorage恢复K线数据
  orderBookData: mockOrderBookData,
  tradeHistoryData: mockTradeHistoryData,
  cryptoPairs: mockCryptoPairs,
  userOrders: [],
  backtestResults: null,
  backtestSummaries: [],
  isBacktesting: false,
  balance: {
    USDT: 10000,
    BTC: 0.5,
    ETH: 5
  }
};

// Reducer
const reducer = (state = initialState, action: any): AppState => {
  switch (action.type) {
    case ActionType.SET_MARKET_TYPE:
      return {
        ...state,
        marketType: action.payload
      };
    
    case ActionType.SET_SELECTED_PAIR:
      return {
        ...state,
        selectedPair: action.payload
      };
    
    case ActionType.SET_TIMEFRAME:
      return {
        ...state,
        timeframe: action.payload
      };
    
    case ActionType.SET_DATE_RANGE:
      return {
        ...state,
        dateRange: action.payload
      };
    
    case ActionType.UPDATE_CANDLESTICK_DATA:
      // console.log('Redux reducer - 更新K线数据:', {
      //   newDataLength: action.payload.length,
      //   oldDataLength: state.candlestickData.length,
      //   firstNewItem: action.payload.length > 0 ? action.payload[0] : null
      // });
      return {
        ...state,
        candlestickData: action.payload
      };
    
    case ActionType.UPDATE_ORDER_BOOK:
      return {
        ...state,
        orderBookData: action.payload
      };
    
    case ActionType.UPDATE_TRADE_HISTORY:
      return {
        ...state,
        tradeHistoryData: action.payload
      };
    
    case ActionType.UPDATE_CRYPTO_PAIRS:
      return {
        ...state,
        cryptoPairs: action.payload
      };
    
    case ActionType.ADD_USER_ORDER:
      return {
        ...state,
        userOrders: [...state.userOrders, action.payload]
      };
    
    case ActionType.UPDATE_USER_ORDER:
      return {
        ...state,
        userOrders: state.userOrders.map(order => 
          order.id === action.payload.orderId 
            ? { ...order, ...action.payload.updates } 
            : order
        )
      };
    
    case ActionType.CANCEL_USER_ORDER:
      return {
        ...state,
        userOrders: state.userOrders.map(order => 
          order.id === action.payload 
            ? { ...order, status: 'canceled', updatedAt: Date.now() } 
            : order
        )
      };
    
    case ActionType.START_BACKTEST:
      return {
        ...state,
        isBacktesting: true,
        backtestResults: null
      };
    
    case ActionType.FINISH_BACKTEST:
      return {
        ...state,
        isBacktesting: false,
        backtestResults: action.payload
      };
    
    case ActionType.CLEAR_BACKTEST_RESULTS:
      // 清除回测结果时，也从localStorage中移除
      try {
        localStorage.removeItem('backtest_results');
      } catch (error) {
        console.error('Failed to remove backtest results from localStorage:', error);
      }
      return {
        ...state,
        backtestResults: null
      };
    
    case ActionType.UPDATE_BALANCE:
      return {
        ...state,
        balance: {
          ...state.balance,
          ...action.payload
        }
      };
    
    case ActionType.SET_BACKTEST_SUMMARIES:
      return {
        ...state,
        backtestSummaries: action.payload
      };
    
    default:
      return state;
  }
};

export default reducer; 