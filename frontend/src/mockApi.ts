
export const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'https://market-confidence-backend.onrender.com';

export const mockMarketData = [
  { date: '2023-01-01', open: 100, high: 105, low: 98, close: 103, volume: 1000000 },
  { date: '2023-01-02', open: 103, high: 108, low: 102, close: 107, volume: 1200000 },
  { date: '2023-01-03', open: 107, high: 110, low: 105, close: 109, volume: 1100000 },
  { date: '2023-01-04', open: 109, high: 112, low: 108, close: 111, volume: 1300000 },
  { date: '2023-01-05', open: 111, high: 115, low: 110, close: 114, volume: 1400000 },
];

export const mockPortfolios = [
  {
    id: 'mock-portfolio-1',
    name: 'Sample Portfolio',
    assets: [
      { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', allocation: 40 },
      { symbol: 'MSFT', name: 'Microsoft Corporation', type: 'stock', allocation: 30 },
      { symbol: 'GOOGL', name: 'Alphabet Inc.', type: 'stock', allocation: 30 }
    ],
    created_at: '2023-01-01T00:00:00Z',
    investment_amount: 10000
  }
];

export const mockPortfolioPerformance = {
  performance: [
    { date: '2023-01-01', value: 100 },
    { date: '2023-01-02', value: 102 },
    { date: '2023-01-03', value: 105 },
    { date: '2023-01-04', value: 103 },
    { date: '2023-01-05', value: 108 }
  ]
};

export const mockEventAnalysis = {
  event: 'COVID-19 pandemic',
  analysis: 'The COVID-19 pandemic caused significant market volatility in early 2020, with global markets experiencing sharp declines in February and March. The MSCI World Index fell by approximately 34% from its peak in February to its trough in March 2020. However, markets recovered relatively quickly due to unprecedented monetary and fiscal stimulus from governments and central banks worldwide.',
  recovery_status: 'Market recovered after 140 days',
  percent_change: -34.2,
  time_period: {
    start_date: '2020-02-19',
    end_date: '2020-08-12'
  }
};

export const mockAssetSearch = [
  { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', allocation: 0 },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', type: 'stock', allocation: 0 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', type: 'stock', allocation: 0 },
  { symbol: 'MSFT', name: 'Microsoft Corporation', type: 'stock', allocation: 0 },
  { symbol: 'TSLA', name: 'Tesla Inc.', type: 'stock', allocation: 0 }
];

export const mockEventSimulation = {
  event: 'COVID-19 pandemic',
  portfolio: {
    id: 'mock-portfolio-1',
    name: 'Sample Portfolio'
  },
  time_period: {
    start_date: '2020-01-01',
    end_date: '2020-12-31',
    middle_date: '2020-03-23'
  },
  simulation_results: [
    {
      scenario: 'Hold through event',
      performance: [
        { date: '2020-01-01', value: 10000 },
        { date: '2020-02-19', value: 11200 },
        { date: '2020-03-23', value: 7500 },
        { date: '2020-08-12', value: 10500 },
        { date: '2020-12-31', value: 12000 }
      ],
      total_return: 20,
      max_drawdown: 33,
      recovery_days: 142
    },
    {
      scenario: 'Sell at event start',
      performance: [
        { date: '2020-01-01', value: 10000 },
        { date: '2020-02-19', value: 10000 },
        { date: '2020-03-23', value: 10000 },
        { date: '2020-08-12', value: 10000 },
        { date: '2020-12-31', value: 10000 }
      ],
      total_return: 0,
      max_drawdown: 0
    },
    {
      scenario: 'Buy at event bottom',
      performance: [
        { date: '2020-01-01', value: 10000 },
        { date: '2020-02-19', value: 10000 },
        { date: '2020-03-23', value: 10000 },
        { date: '2020-08-12', value: 13300 },
        { date: '2020-12-31', value: 15200 }
      ],
      total_return: 52,
      max_drawdown: 0
    }
  ],
  asset_performance: {
    'AAPL': {
      name: 'Apple Inc.',
      allocation: 40,
      performance: [
        { date: '2020-01-01', close: 75.0, allocation: 40 },
        { date: '2020-02-19', close: 80.0, allocation: 40 },
        { date: '2020-03-23', close: 57.0, allocation: 40 },
        { date: '2020-08-12', close: 113.0, allocation: 40 },
        { date: '2020-12-31', close: 132.0, allocation: 40 }
      ]
    },
    'MSFT': {
      name: 'Microsoft Corporation',
      allocation: 30,
      performance: [
        { date: '2020-01-01', close: 157.0, allocation: 30 },
        { date: '2020-02-19', close: 187.0, allocation: 30 },
        { date: '2020-03-23', close: 135.0, allocation: 30 },
        { date: '2020-08-12', close: 209.0, allocation: 30 },
        { date: '2020-12-31', close: 222.0, allocation: 30 }
      ]
    },
    'GOOGL': {
      name: 'Alphabet Inc.',
      allocation: 30,
      performance: [
        { date: '2020-01-01', close: 1368.0, allocation: 30 },
        { date: '2020-02-19', close: 1518.0, allocation: 30 },
        { date: '2020-03-23', close: 1056.0, allocation: 30 },
        { date: '2020-08-12', close: 1506.0, allocation: 30 },
        { date: '2020-12-31', close: 1752.0, allocation: 30 }
      ]
    }
  },
  advice: {
    best_scenario: 'Buy at event bottom',
    text: 'Based on the simulation, the best strategy would have been to buy at the market bottom during the COVID-19 pandemic. This approach would have yielded a 52% return compared to a 20% return from holding through the event. However, timing market bottoms is extremely difficult in practice. A more realistic approach would be to maintain a long-term investment horizon and potentially increase investments during significant market downturns if you have available capital.'
  }
};

export const shouldUseMockData = () => {
  const isGitHubPages = window.location.hostname.includes('github.io');
  
  const checkApiAvailability = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/health-check`, { 
        method: 'HEAD'
      });
      return response.ok;
    } catch (error) {
      console.warn('API not available, using mock data:', error);
      return false;
    }
  };
  
  if (isGitHubPages) {
    console.log('Running on GitHub Pages, using mock data');
    return true;
  }
  
  return !checkApiAvailability();
};
