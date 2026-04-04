import { createStore } from 'redux';
import reducer from './reducer';
import { BacktestResults } from './types';

// 从localStorage加载回测结果
const loadBacktestResults = (): BacktestResults | null => {
  try {
    const savedResults = localStorage.getItem('backtest_results');
    if (savedResults) {
      return JSON.parse(savedResults);
    }
    return null;
  } catch (error) {
    console.error('Failed to load backtest results from localStorage:', error);
    return null;
  }
};

// 创建store，使用reducer的默认初始状态（包含从localStorage恢复的数据）
const store = createStore(reducer);

// 如果有保存的回测结果，则设置到store中
const savedBacktestResults = loadBacktestResults();
if (savedBacktestResults) {
  store.dispatch({ type: 'FINISH_BACKTEST', payload: savedBacktestResults });
}

// 订阅store变化，保存回测结果和设置到localStorage
store.subscribe(() => {
  try {
    const state = store.getState();
    const { backtestResults, marketType, selectedPair, timeframe, dateRange } = state;
    
    // 保存回测结果
    if (backtestResults) {
      localStorage.setItem('backtest_results', JSON.stringify(backtestResults));
    }
    
    // 保存图表设置（包括市场类型和选中的交易对）
    const chartSettings = {
      marketType,
      selectedPair,
      timeframe,
      dateRange
    };
    localStorage.setItem('cryptoquantx_chart_settings', JSON.stringify(chartSettings));
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
});

export default store; 