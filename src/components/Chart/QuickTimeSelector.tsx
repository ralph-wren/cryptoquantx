import React, { useState, useEffect } from 'react';
import './QuickTimeSelector.css';
import { getCurrentTimeString, getTodayDateString } from '../../services/api';

interface QuickTimeSelectorProps {
  onTimeRangeSelect: (startDate: string, endDate: string) => void;
  currentStartDate?: string; // 当前选中的开始日期
  currentEndDate?: string;   // 当前选中的结束日期
}

const QuickTimeSelector: React.FC<QuickTimeSelectorProps> = ({ 
  onTimeRangeSelect,
  currentStartDate,
  currentEndDate 
}) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // 计算指定时间前的日期（仅日期部分）
  const getDateBefore = (months: number): string => {
    const date = new Date();
    date.setMonth(date.getMonth() - months);
    return date.toISOString().split('T')[0];
  };

  // 快捷时间选项
  const timeOptions: Array<{ label: string; months: number; isToday?: boolean }> = [
    { label: '今天', months: 0, isToday: true },
    { label: '1个月', months: 1 },
    { label: '3个月', months: 3 },
    { label: '半年', months: 6 },
    { label: '1年', months: 12 },
    { label: '2年', months: 24 },
    { label: '3年', months: 36 },
    { label: '5年', months: 60 }
  ];

  // 根据当前日期范围判断选中的选项
  useEffect(() => {
    if (!currentStartDate) {
      setSelectedOption(null);
      return;
    }

    const startDateOnly = currentStartDate.split(' ')[0];
    const today = getTodayDateString();

    // 检查是否是"今天"
    if (startDateOnly === today) {
      setSelectedOption('今天');
      return;
    }

    // 检查其他时间范围（允许1天的误差）
    for (const option of timeOptions) {
      if (!option.isToday) {
        const expectedDate = getDateBefore(option.months);
        const startDate = new Date(startDateOnly);
        const expectedDateObj = new Date(expectedDate);
        const diffDays = Math.abs((startDate.getTime() - expectedDateObj.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 1) {
          setSelectedOption(option.label);
          return;
        }
      }
    }

    // 如果不匹配任何预设选项，清除选中状态
    setSelectedOption(null);
  }, [currentStartDate, currentEndDate]);

  const handleQuickSelect = (months: number, isToday = false, label: string) => {
    setSelectedOption(label);
    
    if (isToday) {
      // 今天：开始时间是今天00:00:00，结束时间是当前精确时间
      const startDate = `${getTodayDateString()} 00:00:00`;
      const endDate = getCurrentTimeString();
      onTimeRangeSelect(startDate, endDate);
    } else {
      // 其他时间范围：开始时间是指定日期00:00:00，结束时间是当前精确时间
      const startDate = `${getDateBefore(months)} 00:00:00`;
      const endDate = getCurrentTimeString();
      onTimeRangeSelect(startDate, endDate);
    }
  };

  return (
    <div className="quick-time-selector">
      <div className="quick-time-buttons">
        {timeOptions.map(option => (
          <button
            key={option.label}
            className={`quick-time-button ${selectedOption === option.label ? 'active' : ''}`}
            onClick={() => handleQuickSelect(option.months, option.isToday, option.label)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickTimeSelector;
