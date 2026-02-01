import React, { useEffect, useState, useCallback, useRef } from 'react';
import './TelegramNewsPage.css';

interface TelegramMessage {
    id: number;
    chatId: number;
    chatTitle: string; // This is actually channelName (handle)
    messageId: number;
    text: string;
    senderName: string;
    senderUsername: string;
    receivedAt: string;
    messageDate: string;
}

interface TelegramChannel {
    id: number;
    channelName: string;
    title?: string;
    subscribers?: number;
    avatarUrl?: string;
    description?: string;
    active: boolean;
}

interface TelegramChannelDTO {
    name: string; // handle
    title: string;
    subscribers: number;
    avatarUrl: string;
    description: string;
}

interface PageResponse<T> {
    content: T[];
    totalPages: number;
    totalElements: number;
    number: number;
    size: number;
}

const TelegramNewsPage: React.FC = () => {
    const [messages, setMessages] = useState<TelegramMessage[]>([]);
    const [channels, setChannels] = useState<TelegramChannel[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState<number>(0);
    const [pageSize, setPageSize] = useState<number>(10);
    const [totalPages, setTotalPages] = useState<number>(0);
    const [totalElements, setTotalElements] = useState<number>(0);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

    // Search state
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [searchResults, setSearchResults] = useState<TelegramChannelDTO[]>([]);
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [showResults, setShowResults] = useState<boolean>(false);
    const searchRef = useRef<HTMLDivElement>(null);

    const fetchMessages = useCallback(async (pageNum: number) => {
        try {
            setLoading(true);
            // Add timestamp to prevent caching
            const response = await fetch(`/api/telegram/messages?page=${pageNum}&size=${pageSize}&_t=${new Date().getTime()}`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data: PageResponse<TelegramMessage> = await response.json();
            setMessages(data.content);
            setTotalPages(data.totalPages);
            setTotalElements(data.totalElements);
            setPage(data.number);
            setLoading(false);
            setIsRefreshing(false);
        } catch (err) {
            console.error('Error fetching messages:', err);
            setError('Failed to load messages');
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [pageSize]);

    const fetchChannels = async () => {
        try {
            const response = await fetch('/api/telegram/channels');
            if (response.ok) {
                const data = await response.json();
                setChannels(data);
            }
        } catch (err) {
            console.error('Error fetching channels:', err);
        }
    };

    useEffect(() => {
        fetchMessages(0);
        fetchChannels();
    }, [fetchMessages]);

    // Auto refresh every 30 seconds
    useEffect(() => {
        const timer = setInterval(() => {
            // Refresh current page
            fetchMessages(page);
        }, 30000);

        return () => clearInterval(timer);
    }, [fetchMessages, page]);

    // Adaptive page size calculation
    useEffect(() => {
        const calculatePageSize = () => {
            // Estimate available height: Window - Navbar(60) - Header(~100) - Channels(~60) - Pagination(~52) - Padding(48)
            // Item height: 110px + 12px gap = 122px
            // We can refine this by measuring DOM elements if needed, but a conservative estimate works for "filling the page"
            const headerHeight = document.querySelector('.news-header')?.clientHeight || 100;
            const channelsHeight = document.querySelector('.active-channels')?.clientHeight || 60;
            const paginationHeight = 52;
            const padding = 48;
            const navbarHeight = 60;
            
            const availableHeight = window.innerHeight - navbarHeight - headerHeight - channelsHeight - paginationHeight - padding;
            const itemHeight = 122; // 110px height + 12px gap
            
            const newSize = Math.max(3, Math.floor(availableHeight / itemHeight));
            
            setPageSize(prev => {
                if (prev !== newSize) return newSize;
                return prev;
            });
        };

        calculatePageSize();
        window.addEventListener('resize', calculatePageSize);
        
        // Also recalculate when channels change as it affects layout height
        return () => window.removeEventListener('resize', calculatePageSize);
    }, [channels.length]); // Recalculate if channels count changes (height might change)

    const handleMessageClick = (msg: TelegramMessage) => {
        if (msg.chatTitle === 'OKX公告' || msg.chatTitle === 'OKX Announcements') {
            // Extract URL from text
            const match = msg.text.match(/href="([^"]*)"/);
            if (match && match[1]) {
                window.open(match[1], '_blank');
            }
        } else {
            window.open(`https://t.me/${msg.chatTitle}/${msg.messageId}`, '_blank');
        }
    };

    // Click outside to close search results
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 0 && newPage < totalPages) {
            fetchMessages(newPage);
            // Scroll to top of list container if needed, but we are removing main scrollbar
            const listContainer = document.querySelector('.messages-list-view');
            if (listContainer) {
                listContainer.scrollTop = 0;
            }
        }
    };

    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        try {
            // Trigger backend scrape
            await fetch('/api/telegram/refresh', { method: 'POST' });
        } catch (e) {
            console.error("Refresh trigger failed", e);
        }
        fetchMessages(0); // Refresh goes to first page usually
        fetchChannels();
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        setShowResults(true);
        setSearchResults([]); // Clear previous results
        
        try {
            const response = await fetch(`/api/telegram/search?query=${encodeURIComponent(searchQuery.trim())}`);
            if (response.ok) {
                const data = await response.json();
                setSearchResults(data);
            }
        } catch (err) {
            console.error('Error searching channels:', err);
        } finally {
            setIsSearching(false);
        }
    };

    const handleAddChannel = async (channel: TelegramChannelDTO) => {
        try {
            const params = new URLSearchParams();
            params.append('channelName', channel.name);
            if (channel.title) params.append('title', channel.title);
            if (channel.subscribers) params.append('subscribers', channel.subscribers.toString());
            if (channel.avatarUrl) params.append('avatarUrl', channel.avatarUrl);

            const response = await fetch(`/api/telegram/channels?${params.toString()}`, {
                method: 'POST'
            });
            
            if (response.ok) {
                // setSearchQuery(''); // Don't clear search query immediately so user can see the button change
                // setShowResults(false); // Don't close results
                fetchChannels(); // Refresh channels list to update the button state
                // Trigger refresh after a short delay
                setTimeout(() => handleManualRefresh(), 1000);
            } else {
                alert('添加失败');
            }
        } catch (err) {
            console.error('Error adding channel:', err);
            alert('添加失败');
        }
    };

    // Fallback for direct input (if user presses enter without selecting result)
    const handleDirectAdd = async () => {
        if (!searchQuery.trim()) return;
        // Construct a dummy DTO
        const dummy: TelegramChannelDTO = {
            name: searchQuery.trim(),
            title: searchQuery.trim(),
            subscribers: 0,
            avatarUrl: '',
            description: ''
        };
        handleAddChannel(dummy);
    };

    const handleRemoveChannel = async (channelName: string) => {
        if (!window.confirm(`确定要删除频道 "${channelName}" 吗?`)) return;

        try {
            const response = await fetch(`/api/telegram/channels?channelName=${encodeURIComponent(channelName)}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                fetchChannels();
            }
        } catch (err) {
            console.error('Error removing channel:', err);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const isOkxChannel = (title: string) => {
        return title && (title.toLowerCase().includes('okx') || title.includes('欧易'));
    };

    const getChannelTitle = (chatTitle: string) => {
        // chatTitle in message is currently the channelName (handle)
        // Find channel by channelName
        const channel = channels.find(c => c.channelName === chatTitle);
        return channel && channel.title ? channel.title : chatTitle;
    };

    const getChannelAvatar = (chatTitle: string) => {
        // chatTitle is the handle
        if (isOkxChannel(chatTitle)) {
            // Default OKX avatar or specific one if stored
            // Using a generic OKX logo or placeholder if not in channels list
            // But we can check if it exists in channels
            const channel = channels.find(c => c.channelName === chatTitle);
            if (channel && channel.avatarUrl) return channel.avatarUrl;
            return 'https://www.okx.com/cdn/assets/imgs/226/7A70425717750C0C.png'; // Fallback OKX logo
        }
        
        const channel = channels.find(c => c.channelName === chatTitle);
        return channel?.avatarUrl || '';
    };

    const cleanMessageText = (html: string) => {
        if (!html) return '';
        // Remove "原文链接" and the link following it, including preceding line breaks
        let cleaned = html.replace(/(<br\s*\/?>\s*)*原文链接：<a[^>]*>.*?<\/a>/gi, '');
        // Replace all remaining <br> tags with spaces to compact the text
        cleaned = cleaned.replace(/<br\s*\/?>/gi, ' ');
        // Remove excessive spaces that might have been created
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        return cleaned;
    };

    return (
        <div className="telegram-news-page">
            <div className="news-header">
                <div className="header-left">
                    <h1>实时币圈资讯</h1>
                    <button 
                        className={`refresh-btn ${isRefreshing ? 'spinning' : ''}`} 
                        onClick={handleManualRefresh}
                        title="手动刷新"
                    >
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                            <path d="M23 4v6h-6"></path>
                            <path d="M1 20v-6h6"></path>
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                        </svg>
                        刷新
                    </button>
                </div>
                
                <div className="channel-management">
                    <div className="search-container" ref={searchRef}>
                        <div className="search-input-group">
                            <input 
                                type="text" 
                                placeholder="搜索频道 (如 jinse)" 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                            <button onClick={handleSearch} disabled={isSearching}>
                                {isSearching ? '搜索中...' : '搜索'}
                            </button>
                        </div>

                        {showResults && (
                            <div className="search-results">
                                {isSearching ? (
                                    <div className="search-loading">正在搜索...</div>
                                ) : searchResults.length === 0 ? (
                                    <div className="search-empty">
                                        未找到相关频道。
                                        <button className="btn-text" onClick={handleDirectAdd} style={{marginLeft: '8px', color: '#64B5F6', background: 'none', border: 'none', cursor: 'pointer'}}>
                                            直接添加 ID?
                                        </button>
                                    </div>
                                ) : (
                                    searchResults.map((result, idx) => {
                                        const isAdded = channels.some(c => c.channelName === result.name);
                                        return (
                                            <div key={idx} className="search-result-item">
                                                {result.avatarUrl && (
                                                    <img src={result.avatarUrl} alt="" className="channel-avatar" />
                                                )}
                                                <div className="result-info">
                                                    <div className="result-name">{result.title}</div>
                                                    <div className="result-meta">
                                                        <span>@{result.name}</span>
                                                        {result.subscribers > 0 && (
                                                            <span>• {result.subscribers.toLocaleString()} 订阅</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button 
                                                    className={`add-btn ${isAdded ? 'added' : ''}`}
                                                    onClick={() => !isAdded && handleAddChannel(result)}
                                                    disabled={isAdded}
                                                >
                                                    {isAdded ? '已添加' : '添加'}
                                                </button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="active-channels">
                <span className="label">已订阅:</span>
                {channels.map(ch => (
                    <span key={ch.id} className="channel-tag">
                        {ch.title || ch.channelName}
                        <button className="remove-btn" onClick={() => handleRemoveChannel(ch.channelName)}>×</button>
                    </span>
                ))}
            </div>
            
            {loading && messages.length === 0 ? (
                <div className="loading">正在加载消息...</div>
            ) : error ? (
                <div className="error">{error}</div>
            ) : (
                <>
                    <div className="messages-list-view">
                        {messages.length === 0 ? (
                            <div className="no-messages">
                                暂无消息。请添加频道开始订阅。
                            </div>
                        ) : (
                            messages.map((msg) => (
                                <div key={msg.id} className="message-row" onClick={() => handleMessageClick(msg)}>
                                    <div className="message-avatar-container">
                                        <img 
                                            src={getChannelAvatar(msg.chatTitle) || 'https://via.placeholder.com/40'} 
                                            alt="" 
                                            className="message-avatar"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/40?text=?';
                                            }}
                                        />
                                    </div>
                                    <div className="message-content-wrapper">
                                        <div className="row-meta">
                                            <span className={`channel-badge ${isOkxChannel(msg.chatTitle) ? 'okx' : ''}`}>
                                                {getChannelTitle(msg.chatTitle)}
                                            </span>
                                            <span className="time-badge">
                                                {formatDate(msg.receivedAt)}
                                            </span>
                                        </div>
                                        <div className="row-content">
                                            <div 
                                                className="message-text"
                                                dangerouslySetInnerHTML={{ __html: cleanMessageText(msg.text) }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {messages.length > 0 && (
                        <div className="pagination-container">
                            <div className="pagination-buttons">
                                <button
                                    onClick={() => handlePageChange(0)}
                                    disabled={page === 0}
                                    className="pagination-button"
                                >
                                    首页
                                </button>
                                <button
                                    onClick={() => handlePageChange(page - 1)}
                                    disabled={page === 0}
                                    className="pagination-button"
                                >
                                    上一页
                                </button>
                                <div className="pagination-info">
                                    {page + 1} / {totalPages} 页 (共 {totalElements} 条记录)
                                </div>
                                <button
                                    onClick={() => handlePageChange(page + 1)}
                                    disabled={page >= totalPages - 1}
                                    className="pagination-button"
                                >
                                    下一页
                                </button>
                                <button
                                    onClick={() => handlePageChange(totalPages - 1)}
                                    disabled={page >= totalPages - 1}
                                    className="pagination-button"
                                >
                                    末页
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default TelegramNewsPage;
