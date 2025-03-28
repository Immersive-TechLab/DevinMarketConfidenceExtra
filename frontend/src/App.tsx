import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Legend } from 'recharts';
import { Search, Plus, Edit, Trash, X, Eye, EyeOff, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface MarketData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface EventAnalysis {
  event: string;
  analysis: string;
  recovery_status: string;
  percent_change: number;
  time_period: {
    start_date: string;
    end_date: string;
  };
}

interface PortfolioAsset {
  symbol: string;
  name: string;
  type: string;
  allocation: number;
}

interface Portfolio {
  id: string;
  name: string;
  assets: PortfolioAsset[];
  created_at: string;
  investment_amount?: number;
}

interface SimulationResult {
  scenario: string;
  performance: {
    date: string;
    value: number;
  }[];
  total_return: number;
  max_drawdown: number;
  recovery_days?: number;
}

interface EventSimulation {
  event: string;
  portfolio: {
    id: string;
    name: string;
  };
  time_period: {
    start_date: string;
    end_date: string;
    middle_date: string;
  };
  simulation_results: SimulationResult[];
  asset_performance: {
    [symbol: string]: {
      name: string;
      allocation: number;
      performance: {
        date: string;
        close: number;
        allocation: number;
      }[];
    };
  };
  advice: {
    best_scenario: string;
    text: string;
  };
}


function App() {
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [eventInput, setEventInput] = useState<string>('');
  const [eventAnalysis, setEventAnalysis] = useState<EventAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [highlightPeriod, setHighlightPeriod] = useState<{start: string, end: string} | null>(null);
  
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [currentPortfolio, setCurrentPortfolio] = useState<Portfolio | null>(null);
  const [isCreatingPortfolio, setIsCreatingPortfolio] = useState<boolean>(false);
  const [isEditingPortfolio, setIsEditingPortfolio] = useState<boolean>(false);
  const [portfolioName, setPortfolioName] = useState<string>('');
  const [portfolioAssets, setPortfolioAssets] = useState<PortfolioAsset[]>([]);
  const [assetSearchQuery, setAssetSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<PortfolioAsset[]>([]);
  const [portfolioPerformance, setPortfolioPerformance] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'market' | 'portfolio'>('market');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('1y');
  const [eventSimulation, setEventSimulation] = useState<EventSimulation | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [portfolioMetrics, setPortfolioMetrics] = useState<{
    totalReturn: number;
    maxDrawdown: number;
    volatility: number;
    initialInvestment?: number;
    currentValue?: number;
  } | null>(null);
  const [investmentAmount, setInvestmentAmount] = useState<number | undefined>(undefined);
  const [selectedAssets, setSelectedAssets] = useState<{[key: string]: boolean}>({}); // Track which assets are visible
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState<boolean>(false);
  
  const significantEvents = [
    "COVID-19 pandemic",
    "2008 Financial Crisis",
    "Dot-com Bubble (2000)",
    "Black Monday (1987)",
    "1970s Oil Crisis",
    "2020 Stock Market Crash",
    "Brexit Referendum (2016)",
    "2010 Flash Crash",
    "2011 Sovereign Debt Crisis",
    "2015 Chinese Stock Market Crash",
    "Great Depression (1929)",
    "9/11 Terrorist Attacks (2001)",
    "2022 Russia-Ukraine Conflict",
    "2018 Cryptocurrency Crash",
    "1997 Asian Financial Crisis"
  ];
  
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const fetchMarketData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/market-data?period=${selectedPeriod}`);
      if (!response.ok) {
        throw new Error('Failed to fetch market data');
      }
      const data = await response.json();
      setMarketData(data);
    } catch (error) {
      console.error('Error fetching market data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPortfolios = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/portfolios`);
      if (!response.ok) {
        throw new Error('Failed to fetch portfolios');
      }
      const data = await response.json();
      setPortfolios(data);
    } catch (error) {
      console.error('Error fetching portfolios:', error);
    }
  };

  const fetchPortfolioPerformance = async (portfolioId: string) => {
    try {
      const portfolioResponse = await fetch(
        `${import.meta.env.VITE_API_URL}/api/portfolios/${portfolioId}`
      );
      if (!portfolioResponse.ok) {
        throw new Error('Failed to fetch portfolio details');
      }
      const portfolioData = await portfolioResponse.json();
      const investmentAmount = portfolioData.investment_amount || 10000; // Default to $10,000 if not specified
      
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/portfolios/${portfolioId}/performance?period=${selectedPeriod}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch portfolio performance');
      }
      const data = await response.json();
      
      const dollarPerformance = data.performance.map((point: any) => ({
        date: point.date,
        value: point.value * (investmentAmount / 100)
      }));
      
      setPortfolioPerformance(dollarPerformance);
      
      if (dollarPerformance && dollarPerformance.length > 1) {
        const firstValue = dollarPerformance[0].value;
        const lastValue = dollarPerformance[dollarPerformance.length - 1].value;
        const totalReturn = ((lastValue - firstValue) / firstValue) * 100;
        
        let maxDrawdown = 0;
        let peak = dollarPerformance[0].value;
        
        for (const point of dollarPerformance) {
          if (point.value > peak) {
            peak = point.value;
          }
          const drawdown = ((peak - point.value) / peak) * 100;
          if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
          }
        }
        
        const returns = [];
        for (let i = 1; i < dollarPerformance.length; i++) {
          const dailyReturn = (dollarPerformance[i].value - dollarPerformance[i-1].value) / dollarPerformance[i-1].value;
          returns.push(dailyReturn);
        }
        
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const volatility = Math.sqrt(variance) * 100;
        
        setPortfolioMetrics({
          totalReturn: totalReturn,
          maxDrawdown: maxDrawdown,
          volatility: volatility,
          initialInvestment: investmentAmount,
          currentValue: lastValue
        });
      } else {
        setPortfolioMetrics(null);
      }
    } catch (error) {
      console.error('Error fetching portfolio performance:', error);
      setPortfolioMetrics(null);
    }
  };

  const searchAssets = async () => {
    if (!assetSearchQuery.trim()) return;
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/search-assets?query=${encodeURIComponent(assetSearchQuery)}`
      );
      if (!response.ok) {
        throw new Error('Failed to search assets');
      }
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Error searching assets:', error);
      setSearchResults([]);
    }
  };
  
  const handleAssetSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAssetSearchQuery(e.target.value);
    
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    searchTimeout.current = setTimeout(() => {
      if (e.target.value.trim().length >= 2) {
        searchAssets();
      } else {
        setSearchResults([]);
      }
    }, 300);
  };

  const addAssetToPortfolio = (asset: PortfolioAsset) => {
    const existingIndex = portfolioAssets.findIndex((a) => a.symbol === asset.symbol);
    if (existingIndex >= 0) {
      return;
    }
    
    const totalAllocated = portfolioAssets.reduce((sum, asset) => sum + asset.allocation, 0);
    const remainingPercent = 100 - totalAllocated;
    const newAllocation = remainingPercent > 0 ? remainingPercent : 0;
    
    setPortfolioAssets([...portfolioAssets, { ...asset, allocation: newAllocation }]);
    setAssetSearchQuery('');
    setSearchResults([]);
  };

  const removeAssetFromPortfolio = (symbol: string) => {
    const updatedAssets = portfolioAssets.filter((asset) => asset.symbol !== symbol);
    setPortfolioAssets(updatedAssets);
  };

  const updateAssetAllocation = (symbol: string, allocation: number) => {
    const updatedAssets = portfolioAssets.map((asset) => {
      if (asset.symbol === symbol) {
        return { ...asset, allocation };
      }
      return asset;
    });
    setPortfolioAssets(updatedAssets);
  };

  const savePortfolio = async () => {
    if (portfolioAssets.length === 0) {
      alert('Please add at least one asset to your portfolio');
      return; // Validation failed
    }
    
    const totalAllocation = portfolioAssets.reduce((sum, asset) => sum + asset.allocation, 0);
    if (Math.abs(totalAllocation - 100) > 0.01) {
      alert('Total allocation must equal 100%');
      return;
    }
    
    const portfolioData = {
      name: portfolioName.trim() || 'My Portfolio',
      assets: portfolioAssets,
      investment_amount: investmentAmount
    };
    
    console.log('Saving portfolio data:', portfolioData);
    console.log('API URL:', import.meta.env.VITE_API_URL);
    
    try {
      let response;
      if (isEditingPortfolio && currentPortfolio) {
        response = await fetch(`${import.meta.env.VITE_API_URL}/api/portfolios/${currentPortfolio.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(portfolioData),
        });
      } else {
        console.log('Creating new portfolio');
        response = await fetch(`${import.meta.env.VITE_API_URL}/api/portfolios`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(portfolioData),
        });
        console.log('Response status:', response.status);
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response not OK:', errorText);
        throw new Error(`Failed to save portfolio: ${errorText}`);
      }
      
      const savedPortfolio = await response.json();
      console.log('Portfolio saved successfully:', savedPortfolio);
      
      setPortfolioName('');
      setPortfolioAssets([]);
      setIsCreatingPortfolio(false);
      setIsEditingPortfolio(false);
      fetchPortfolios();
      
      if (!isEditingPortfolio) {
        setCurrentPortfolio(savedPortfolio);
        fetchPortfolioPerformance(savedPortfolio.id);
      }
    } catch (error: any) {
      console.error('Error saving portfolio:', error);
      alert(`Error saving portfolio: ${error.message || 'Unknown error'}`);
    }
  };

  const deletePortfolio = async (portfolioId: string) => {
    if (!confirm('Are you sure you want to delete this portfolio?')) {
      return;
    }
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/portfolios/${portfolioId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete portfolio');
      }
      
      if (currentPortfolio && currentPortfolio.id === portfolioId) {
        setCurrentPortfolio(null);
        setPortfolioPerformance([]);
      }
      
      fetchPortfolios();
    } catch (error) {
      console.error('Error deleting portfolio:', error);
    }
  };

  useEffect(() => {
    fetchMarketData();
  }, [selectedPeriod]);
  
  useEffect(() => {
    if (activeTab === 'portfolio') {
      fetchPortfolios();
    }
  }, [activeTab]);
  
  useEffect(() => {
    if (currentPortfolio) {
      fetchPortfolioPerformance(currentPortfolio.id);
    }
  }, [currentPortfolio, selectedPeriod]);

  useEffect(() => {
    fetchPortfolios();
  }, []);
  
  useEffect(() => {
    if (eventSimulation?.asset_performance) {
      const initialSelectedState: {[key: string]: boolean} = {};
      Object.keys(eventSimulation.asset_performance).forEach(symbol => {
        initialSelectedState[symbol] = true;
      });
      setSelectedAssets(initialSelectedState);
    }
  }, [eventSimulation]);

  useEffect(() => {
    if (currentPortfolio) {
      fetchPortfolioPerformance(currentPortfolio.id);
    }
  }, [currentPortfolio, selectedPeriod]);

  const handleEventAnalysis = async () => {
    if (!eventInput.trim()) return;
    
    setIsAnalyzing(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/analyze-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ event: eventInput }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to analyze event');
      }
      
      const analysisData = await response.json();
      console.log('Event analysis data:', analysisData);
      console.log('Setting highlight period:', {
        start: analysisData.time_period.start_date,
        end: analysisData.time_period.end_date
      });
      setEventAnalysis(analysisData);
      
      if (analysisData.time_period && analysisData.time_period.start_date && analysisData.time_period.end_date) {
        const startDate = new Date(analysisData.time_period.start_date);
        const endDate = new Date(analysisData.time_period.end_date);
        
        setHighlightPeriod({
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0]
        });
        
        const bufferBefore = new Date(startDate);
        bufferBefore.setMonth(bufferBefore.getMonth() - 3);
        
        const bufferAfter = new Date(endDate);
        bufferAfter.setMonth(bufferAfter.getMonth() + 3);
        
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/market-data?start=${bufferBefore.toISOString().split('T')[0]}&end=${bufferAfter.toISOString().split('T')[0]}`
        );
        
        if (response.ok) {
          const periodData = await response.json();
          console.log('Fetched historical data:', periodData.length, 'data points');
          
          if (periodData.length > 0) {
            setMarketData(periodData);
          }
        }
      }
    } catch (error) {
      console.error('Error analyzing event:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const simulateEventImpact = async () => {
    if (!currentPortfolio || !eventInput.trim()) return;
    
    setIsSimulating(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/portfolios/event-simulation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          portfolio_id: currentPortfolio.id,
          event: eventInput
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to simulate event impact');
      }
      
      const simulationData = await response.json();
      console.log('Event simulation data:', simulationData);
      setEventSimulation(simulationData);
    } catch (error) {
      console.error('Error simulating event impact:', error);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleEventAnalysis();
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };
  
  const generatePDFReport = () => {
    console.log('Generate PDF Report function called');
    
    try {
      if (!currentPortfolio) {
        console.error('No portfolio selected');
        return;
      }
      
      if (!portfolioMetrics) {
        console.error('No portfolio metrics available');
        return;
      }
      
      console.log('Creating PDF document');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      pdf.setFillColor(59, 130, 246);
      pdf.rect(0, 0, pageWidth, 20, 'F');
      
      pdf.setFontSize(18);
      pdf.setTextColor(255, 255, 255); // White color for header
      pdf.text('Market Confidence', pageWidth / 2, 13, { align: 'center' });
      
      pdf.setFontSize(16);
      pdf.setTextColor(59, 130, 246); // Blue color
      pdf.text(`Portfolio Report: ${currentPortfolio.name}`, pageWidth / 2, 30, { align: 'center' });
      
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100); // Gray color
      const creationDate = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      pdf.text(`Generated on: ${creationDate}`, pageWidth / 2, 37, { align: 'center' });
      
      pdf.setDrawColor(59, 130, 246);
      pdf.setLineWidth(0.5);
      pdf.line(14, 40, pageWidth - 14, 40);
      
      pdf.setFontSize(14);
      pdf.setTextColor(59, 130, 246);
      pdf.text('Investment Summary', 14, 50);
      
      console.log('Adding investment data');
      const investmentData = [
        ['Initial Investment', formatCurrency(portfolioMetrics.initialInvestment || 0)],
        ['Current Value', formatCurrency(portfolioMetrics.currentValue || 0)],
        ['Total Return', `${portfolioMetrics.totalReturn >= 0 ? '+' : ''}${portfolioMetrics.totalReturn.toFixed(2)}%`]
      ];
      
      console.log('Creating investment table');
      try {
        autoTable(pdf, {
          startY: 55,
          head: [['Metric', 'Value']],
          body: investmentData,
          theme: 'grid',
          headStyles: { 
            fillColor: [59, 130, 246], 
            textColor: [255, 255, 255],
            fontStyle: 'bold'
          },
          alternateRowStyles: {
            fillColor: [240, 247, 255]
          },
          styles: { 
            overflow: 'linebreak', 
            cellWidth: 'auto',
            cellPadding: 4
          },
          margin: { top: 10 }
        });
      } catch (tableError) {
        console.error('Error creating investment table:', tableError);
        pdf.text('Initial Investment: ' + formatCurrency(portfolioMetrics.initialInvestment || 0), 14, 60);
        pdf.text('Current Value: ' + formatCurrency(portfolioMetrics.currentValue || 0), 14, 67);
        pdf.text('Total Return: ' + `${portfolioMetrics.totalReturn >= 0 ? '+' : ''}${portfolioMetrics.totalReturn.toFixed(2)}%`, 14, 74);
      }
      
      let yPosition = 85; // Fallback position if autoTable fails
      
      try {
        yPosition = (pdf as any).lastAutoTable.finalY + 15;
        
        if (portfolioPerformance && portfolioPerformance.length > 0) {
          pdf.setFontSize(14);
          pdf.setTextColor(59, 130, 246);
          pdf.text('Portfolio Performance', 14, yPosition);
          
          const canvas = document.createElement('canvas');
          canvas.width = 800;
          canvas.height = 400;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            const chartMargin = { top: 40, right: 40, bottom: 40, left: 60 };
            const chartWidth = canvas.width - chartMargin.left - chartMargin.right;
            const chartHeight = canvas.height - chartMargin.top - chartMargin.bottom;
            
            const values = portfolioPerformance.map(point => point.value);
            const minValue = Math.min(...values) * 0.95;
            const maxValue = Math.max(...values) * 1.05;
            const valueRange = maxValue - minValue;
            
            ctx.strokeStyle = '#666666';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(chartMargin.left, chartMargin.top);
            ctx.lineTo(chartMargin.left, chartHeight + chartMargin.top);
            ctx.lineTo(chartWidth + chartMargin.left, chartHeight + chartMargin.top);
            ctx.stroke();
            
            if (portfolioPerformance.length > 1) {
              ctx.strokeStyle = '#3b82f6';
              ctx.lineWidth = 3;
              ctx.beginPath();
              
              portfolioPerformance.forEach((point, index) => {
                const x = chartMargin.left + (index / (portfolioPerformance.length - 1)) * chartWidth;
                const y = chartMargin.top + chartHeight - ((point.value - minValue) / valueRange) * chartHeight;
                
                if (index === 0) {
                  ctx.moveTo(x, y);
                } else {
                  ctx.lineTo(x, y);
                }
              });
              
              ctx.stroke();
              
              const gradient = ctx.createLinearGradient(0, chartMargin.top, 0, chartHeight + chartMargin.top);
              gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
              gradient.addColorStop(1, 'rgba(59, 130, 246, 0.05)');
              
              ctx.fillStyle = gradient;
              ctx.beginPath();
              ctx.moveTo(chartMargin.left, chartHeight + chartMargin.top);
              
              portfolioPerformance.forEach((point, index) => {
                const x = chartMargin.left + (index / (portfolioPerformance.length - 1)) * chartWidth;
                const y = chartMargin.top + chartHeight - ((point.value - minValue) / valueRange) * chartHeight;
                ctx.lineTo(x, y);
              });
              
              ctx.lineTo(chartWidth + chartMargin.left, chartHeight + chartMargin.top);
              ctx.closePath();
              ctx.fill();
              
              ctx.fillStyle = '#ffffff';
              ctx.strokeStyle = '#3b82f6';
              ctx.lineWidth = 2;
              
              const pointInterval = Math.max(1, Math.floor(portfolioPerformance.length / 10));
              
              portfolioPerformance.forEach((point, index) => {
                if (index % pointInterval === 0 || index === portfolioPerformance.length - 1) {
                  const x = chartMargin.left + (index / (portfolioPerformance.length - 1)) * chartWidth;
                  const y = chartMargin.top + chartHeight - ((point.value - minValue) / valueRange) * chartHeight;
                  
                  ctx.beginPath();
                  ctx.arc(x, y, 4, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.stroke();
                }
              });
              
              ctx.fillStyle = '#666666';
              ctx.font = '12px Arial';
              ctx.textAlign = 'center';
              
              const dateLabels = [
                portfolioPerformance[0].date,
                portfolioPerformance[Math.floor(portfolioPerformance.length / 2)].date,
                portfolioPerformance[portfolioPerformance.length - 1].date
              ];
              
              dateLabels.forEach((date, index) => {
                const x = chartMargin.left + (index / 2) * chartWidth;
                ctx.fillText(formatDate(date), x, chartHeight + chartMargin.top + 20);
              });
              
              ctx.textAlign = 'right';
              const valueLabels = [
                minValue,
                minValue + valueRange / 2,
                maxValue
              ];
              
              valueLabels.forEach((value, index) => {
                const y = chartMargin.top + chartHeight - (index / 2) * chartHeight;
                ctx.fillText(formatCurrency(value), chartMargin.left - 10, y + 4);
              });
              
              ctx.fillStyle = '#3b82f6';
              ctx.font = 'bold 16px Arial';
              ctx.textAlign = 'center';
              ctx.fillText('Portfolio Value Over Time', canvas.width / 2, 20);
            }
            
            const chartImage = canvas.toDataURL('image/png');
            pdf.addImage(chartImage, 'PNG', 14, yPosition + 5, pageWidth - 28, 70);
            
            yPosition += 80;
          }
        }
        
        pdf.setFontSize(14);
        pdf.setTextColor(59, 130, 246);
        pdf.text('Performance Metrics', 14, yPosition);
        
        const performanceData = [
          ['Total Return', `${portfolioMetrics.totalReturn >= 0 ? '+' : ''}${portfolioMetrics.totalReturn.toFixed(2)}%`],
          ['Max Drawdown', `-${portfolioMetrics.maxDrawdown.toFixed(2)}%`],
          ['Volatility', `${portfolioMetrics.volatility.toFixed(2)}%`]
        ];
        
        autoTable(pdf, {
          startY: yPosition + 5,
          head: [['Metric', 'Value']],
          body: performanceData,
          theme: 'grid',
          headStyles: { 
            fillColor: [59, 130, 246], 
            textColor: [255, 255, 255],
            fontStyle: 'bold'
          },
          alternateRowStyles: {
            fillColor: [240, 247, 255]
          },
          styles: { 
            overflow: 'linebreak', 
            cellWidth: 'auto',
            cellPadding: 4
          },
          margin: { top: 10 }
        });
        
        yPosition = (pdf as any).lastAutoTable.finalY + 15;
      } catch (tableError) {
        console.error('Error creating performance metrics table:', tableError);
        pdf.text('Performance Metrics', 14, yPosition);
        pdf.text('Total Return: ' + `${portfolioMetrics.totalReturn >= 0 ? '+' : ''}${portfolioMetrics.totalReturn.toFixed(2)}%`, 14, yPosition + 7);
        pdf.text('Max Drawdown: ' + `-${portfolioMetrics.maxDrawdown.toFixed(2)}%`, 14, yPosition + 14);
        pdf.text('Volatility: ' + `${portfolioMetrics.volatility.toFixed(2)}%`, 14, yPosition + 21);
        yPosition += 30;
      }
      
      if (yPosition > pageHeight - 80) {
        pdf.addPage();
        yPosition = 20;
      }
      
      pdf.setFontSize(14);
      pdf.setTextColor(59, 130, 246);
      pdf.text('Asset Allocation', 14, yPosition);
      
      try {
        const assetData = currentPortfolio.assets.map(asset => [
          asset.symbol,
          asset.name,
          `${asset.allocation.toFixed(2)}%`,
          formatCurrency((portfolioMetrics.initialInvestment || 0) * (asset.allocation / 100))
        ]);
        
        autoTable(pdf, {
          startY: yPosition + 5,
          head: [['Symbol', 'Name', 'Allocation', 'Amount']],
          body: assetData,
          theme: 'grid',
          headStyles: { 
            fillColor: [59, 130, 246], 
            textColor: [255, 255, 255],
            fontStyle: 'bold'
          },
          alternateRowStyles: {
            fillColor: [240, 247, 255]
          },
          styles: { 
            overflow: 'linebreak', 
            cellWidth: 'auto',
            cellPadding: 4
          },
          margin: { top: 10 }
        });
        
        yPosition = (pdf as any).lastAutoTable.finalY + 15;
        
        if (currentPortfolio.assets.length > 0) {
          const canvas = document.createElement('canvas');
          canvas.width = 400;
          canvas.height = 400;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            const colors = [
              '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
              '#ec4899', '#06b6d4', '#84cc16', '#6366f1', '#14b8a6'
            ];
            
            const total = currentPortfolio.assets.reduce((sum, asset) => sum + asset.allocation, 0);
            
            let startAngle = 0;
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const radius = Math.min(centerX, centerY) - 40;
            
            ctx.fillStyle = '#3b82f6';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Asset Allocation', centerX, 30);
            
            currentPortfolio.assets.forEach((asset, index) => {
              const sliceAngle = (asset.allocation / total) * 2 * Math.PI;
              const endAngle = startAngle + sliceAngle;
              
              ctx.beginPath();
              ctx.moveTo(centerX, centerY);
              ctx.arc(centerX, centerY, radius, startAngle, endAngle);
              ctx.closePath();
              
              ctx.fillStyle = colors[index % colors.length];
              ctx.fill();
              
              if (asset.allocation / total > 0.05) {
                const midAngle = startAngle + sliceAngle / 2;
                const labelRadius = radius * 0.7;
                const labelX = centerX + Math.cos(midAngle) * labelRadius;
                const labelY = centerY + Math.sin(midAngle) * labelRadius;
                
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(asset.symbol, labelX, labelY);
              }
              
              startAngle = endAngle;
            });
            
            const legendX = 40;
            let legendY = canvas.height - 30 - (currentPortfolio.assets.length * 20);
            
            currentPortfolio.assets.forEach((asset, index) => {
              ctx.fillStyle = colors[index % colors.length];
              ctx.fillRect(legendX, legendY, 15, 15);
              
              ctx.fillStyle = '#333333';
              ctx.font = '12px Arial';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.fillText(`${asset.symbol} (${asset.allocation.toFixed(1)}%)`, legendX + 25, legendY + 7);
              
              legendY += 20;
            });
            
            const chartImage = canvas.toDataURL('image/png');
            pdf.addImage(chartImage, 'PNG', (pageWidth - 100) / 2, yPosition, 100, 100);
            
            yPosition += 110;
          }
        }
      } catch (tableError) {
        console.error('Error creating asset allocation table:', tableError);
        yPosition += 7;
        currentPortfolio.assets.forEach((asset, index) => {
          pdf.text(`${asset.symbol} (${asset.name}): ${asset.allocation.toFixed(2)}% - ${formatCurrency((portfolioMetrics.initialInvestment || 0) * (asset.allocation / 100))}`, 
            14, yPosition + (index * 7));
        });
        yPosition += (currentPortfolio.assets.length * 7) + 10;
      }
      
      if (eventSimulation && eventSimulation.event) {
        try {
          pdf.addPage();
          
          pdf.setFillColor(59, 130, 246);
          pdf.rect(0, 0, pageWidth, 20, 'F');
          
          pdf.setFontSize(18);
          pdf.setTextColor(255, 255, 255);
          pdf.text('Event Impact Analysis', pageWidth / 2, 13, { align: 'center' });
          
          pdf.setFontSize(14);
          pdf.setTextColor(59, 130, 246);
          pdf.text(`Event: ${eventSimulation.event}`, 14, 30);
          
          pdf.setFontSize(12);
          pdf.setTextColor(100, 100, 100);
          pdf.text(`Analysis Period: ${formatDate(eventSimulation.time_period.start_date)} - ${formatDate(eventSimulation.time_period.end_date)}`, 14, 40);
          
          pdf.setDrawColor(59, 130, 246);
          pdf.setLineWidth(0.5);
          pdf.line(14, 45, pageWidth - 14, 45);
          
          const scenarioData = eventSimulation.simulation_results.map(result => [
            result.scenario,
            `${result.total_return >= 0 ? '+' : ''}${result.total_return.toFixed(2)}%`,
            `-${result.max_drawdown.toFixed(2)}%`,
            result.recovery_days ? `${result.recovery_days} days` : 'N/A'
          ]);
          
          pdf.setFontSize(14);
          pdf.setTextColor(59, 130, 246);
          pdf.text('Scenario Comparison', 14, 55);
          
          autoTable(pdf, {
            startY: 60,
            head: [['Scenario', 'Return', 'Max Drawdown', 'Recovery Time']],
            body: scenarioData,
            theme: 'grid',
            headStyles: { 
              fillColor: [59, 130, 246], 
              textColor: [255, 255, 255],
              fontStyle: 'bold'
            },
            alternateRowStyles: {
              fillColor: [240, 247, 255]
            },
            styles: { 
              overflow: 'linebreak', 
              cellWidth: 'auto',
              cellPadding: 4
            },
            margin: { top: 10 }
          });
          
          const lastY = (pdf as any).lastAutoTable.finalY + 15;
          
          if (eventSimulation.advice && eventSimulation.advice.text) {
            pdf.setFontSize(14);
            pdf.setTextColor(59, 130, 246);
            pdf.text('Investment Advice', 14, lastY);
            
            pdf.setFontSize(11);
            pdf.setTextColor(50, 50, 50);
            
            pdf.setFillColor(240, 247, 255);
            pdf.roundedRect(10, lastY + 5, pageWidth - 20, 50, 3, 3, 'F');
            
            const splitText = pdf.splitTextToSize(eventSimulation.advice.text, pageWidth - 30);
            pdf.text(splitText, 15, lastY + 15);
          }
        } catch (eventError) {
          console.error('Error adding event analysis to PDF:', eventError);
        }
      }
      
      console.log('Creating PDF preview');
      const pdfDataUrl = pdf.output('datauristring');
      setPdfPreviewUrl(pdfDataUrl);
      setIsPdfPreviewOpen(true);
      
      console.log('PDF preview ready');
    } catch (error) {
      console.error('Error generating PDF report:', error);
    }
  };

  const PDFViewerModal = () => {
    if (!isPdfPreviewOpen || !pdfPreviewUrl) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-4 w-11/12 h-5/6 max-w-6xl flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Portfolio Report Preview</h3>
            <button 
              onClick={() => setIsPdfPreviewOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={24} />
            </button>
          </div>
          <div className="flex-grow overflow-auto">
            <iframe 
              src={pdfPreviewUrl} 
              className="w-full h-full border-0"
              title="PDF Preview"
            />
          </div>
          <div className="flex justify-end mt-4">
            <button
              onClick={() => setIsPdfPreviewOpen(false)}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded mr-2 hover:bg-gray-300"
            >
              Close
            </button>
            <button
              onClick={() => {
                if (currentPortfolio) {
                  const link = document.createElement('a');
                  link.href = pdfPreviewUrl;
                  link.download = `Market_Confidence_${currentPortfolio.name}.pdf`;
                  link.click();
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
            >
              <Download size={16} className="mr-1" />
              <span>Download</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 rounded shadow-md">
          <p className="font-semibold">{formatDate(label)}</p>
          <p className="text-blue-600">Price: {formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Market Confidence</h1>
          <p className="text-gray-600">MSCI World Index Market Analysis</p>
          
          <div className="mt-4 border-b border-gray-200">
            <nav className="-mb-px flex">
              <button
                className={`mr-8 py-2 ${activeTab === 'market' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('market')}
              >
                Market Analysis
              </button>
              <button
                className={`py-2 ${activeTab === 'portfolio' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('portfolio')}
              >
                Portfolio Management
              </button>
            </nav>
          </div>
        </header>

        {activeTab === 'market' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Market Data Chart */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="p-4 border-b">
                  <h5 className="text-xl font-bold">MSCI World Index</h5>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button 
                      className={`px-3 py-1 text-xs rounded-md ${selectedPeriod === '1mo' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                      onClick={() => setSelectedPeriod('1mo')}
                    >
                      1mo
                    </button>
                    <button 
                      className={`px-3 py-1 text-xs rounded-md ${selectedPeriod === '3mo' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                      onClick={() => setSelectedPeriod('3mo')}
                    >
                      3mo
                    </button>
                    <button 
                      className={`px-3 py-1 text-xs rounded-md ${selectedPeriod === '6mo' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                      onClick={() => setSelectedPeriod('6mo')}
                    >
                      6mo
                    </button>
                    <button 
                      className={`px-3 py-1 text-xs rounded-md ${selectedPeriod === '1y' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                      onClick={() => setSelectedPeriod('1y')}
                    >
                      1y
                    </button>
                    <button 
                      className={`px-3 py-1 text-xs rounded-md ${selectedPeriod === '5y' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                      onClick={() => setSelectedPeriod('5y')}
                    >
                      5y
                    </button>
                    <button 
                      className={`px-3 py-1 text-xs rounded-md ${selectedPeriod === 'max' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                      onClick={() => setSelectedPeriod('max')}
                    >
                      max
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  {isLoading ? (
                    <div className="h-80 flex items-center justify-center">
                      <p>Loading market data...</p>
                    </div>
                  ) : marketData.length > 0 ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={marketData}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={(tick) => {
                              const date = new Date(tick);
                              return date.toLocaleDateString('en-US', { month: 'numeric', year: '2-digit' });
                            }}
                          />
                          <YAxis 
                            domain={['auto', 'auto']}
                            tickFormatter={(tick) => `$${tick}`}
                          />
                          <Tooltip content={<CustomTooltip />} />
                          <Line 
                            type="monotone" 
                            dataKey="close" 
                            stroke="#3b82f6" 
                            dot={false} 
                            activeDot={{ r: 8 }} 
                          />
                          
                          {/* Highlight event period if available */}
                          {highlightPeriod && (
                            <>
                              {console.log('Market data dates:', marketData.map(d => d.date))}
                              {console.log('Highlight period:', highlightPeriod)}
                              {/* Add shaded area for the entire event period */}
                              {marketData.some(d => d.date === highlightPeriod.start || 
                                 (new Date(d.date) >= new Date(highlightPeriod.start) && 
                                  new Date(d.date) <= new Date(highlightPeriod.end))) && (
                                <ReferenceArea
                                  x1={highlightPeriod.start}
                                  x2={highlightPeriod.end}
                                  fill="#ef4444"
                                  fillOpacity={0.1}
                                  stroke="none"
                                />
                              )}
                              {marketData.some(d => d.date === highlightPeriod.start || 
                                 new Date(d.date) >= new Date(highlightPeriod.start)) && (
                                <ReferenceLine 
                                  x={highlightPeriod.start} 
                                  stroke="#ef4444" 
                                  strokeWidth={2}
                                  label={{ value: 'Event Start', position: 'top' }}
                                />
                              )}
                              {marketData.some(d => d.date === highlightPeriod.end || 
                                 new Date(d.date) <= new Date(highlightPeriod.end)) && (
                                <ReferenceLine 
                                  x={highlightPeriod.end} 
                                  stroke="#ef4444" 
                                  strokeWidth={2}
                                  label={{ value: 'Event End', position: 'top' }}
                                />
                              )}
                            </>
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-80 flex items-center justify-center">
                      <p>No market data available</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Market Event Analysis Instructions */}
            <div>
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="p-4 border-b">
                  <h5 className="text-xl font-bold">Market Event Analysis</h5>
                </div>
                <div className="p-4">
                  <div className="space-y-4">
                    <p className="text-gray-600">
                      Welcome! This section shows the MSCI World Index performance over time.
                    </p>
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-center gap-2">
                        <div className="relative w-full max-w-md mx-auto">
                          <input
                            type="text"
                            placeholder="Enter a global event (e.g., COVID-19 pandemic)..."
                            value={eventInput}
                            onChange={(e) => setEventInput(e.target.value)}
                            onKeyUp={handleKeyPress}
                            className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            list="significant-events"
                          />
                          <datalist id="significant-events">
                            {significantEvents.map((event, index) => (
                              <option key={index} value={event} />
                            ))}
                          </datalist>
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                        </div>
                        <button 
                          onClick={handleEventAnalysis}
                          className={`px-4 py-2 rounded-md ${isAnalyzing ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                          disabled={isAnalyzing}
                        >
                          {isAnalyzing ? 'Analyzing...' : 'Analyze'}
                        </button>
                      </div>
                    </div>
                    
                    {eventAnalysis && (
                      <div className="mt-6 space-y-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <h3 className="font-semibold text-blue-800">{eventAnalysis.event}</h3>
                          <p className="mt-2 text-gray-700">{eventAnalysis.analysis}</p>
                        </div>
                        
                        <div className="border-t pt-4">
                          <h4 className="font-semibold mb-2">Event Analysis:</h4>
                          <div className="space-y-2">
                            <p><span className="font-medium">Market Impact:</span> {eventAnalysis.percent_change.toFixed(2)}%</p>
                            <p><span className="font-medium">Recovery Status:</span> {eventAnalysis.recovery_status}</p>
                            <p><span className="font-medium">Time Period:</span> {eventAnalysis.time_period.start_date} to {eventAnalysis.time_period.end_date}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Portfolio List and Management */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center">
                  <h5 className="text-xl font-bold">Your Portfolios</h5>
                  <button
                    onClick={() => {
                      setIsCreatingPortfolio(true);
                      setIsEditingPortfolio(false);
                      setPortfolioName('');
                      setPortfolioAssets([]);
                      setCurrentPortfolio(null);
                    }}
                    className="p-2 bg-blue-600 text-white rounded-md flex items-center"
                  >
                    <Plus size={16} className="mr-1" /> New Portfolio
                  </button>
                </div>
                <div className="p-4">
                  {portfolios.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No portfolios yet. Create your first portfolio!</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-200">
                      {portfolios.map((portfolio) => (
                        <li key={portfolio.id} className="py-3">
                          <div className="flex justify-between items-center">
                            <button
                              onClick={() => {
                                setCurrentPortfolio(portfolio);
                                setIsCreatingPortfolio(false);
                                setIsEditingPortfolio(false);
                                fetchPortfolioPerformance(portfolio.id);
                              }}
                              className={`text-left flex-1 ${currentPortfolio?.id === portfolio.id ? 'font-semibold text-blue-600' : ''}`}
                            >
                              {portfolio.name}
                            </button>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => {
                                  setIsEditingPortfolio(true);
                                  setIsCreatingPortfolio(false);
                                  setCurrentPortfolio(portfolio);
                                  setPortfolioName(portfolio.name);
                                  setPortfolioAssets(portfolio.assets);
                                  setInvestmentAmount(portfolio.investment_amount);
                                }}
                                className="text-gray-500 hover:text-blue-600"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={() => deletePortfolio(portfolio.id)}
                                className="text-gray-500 hover:text-red-600"
                              >
                                <Trash size={16} />
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
            
            {/* Portfolio Performance Chart */}
            <div className="lg:col-span-2">
              {currentPortfolio ? (
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                  <div className="p-4 border-b">
                    <h5 className="text-xl font-bold">{currentPortfolio.name} Performance</h5>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button 
                        className={`px-3 py-1 text-xs rounded-md ${selectedPeriod === '1mo' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                        onClick={() => setSelectedPeriod('1mo')}
                      >
                        1mo
                      </button>
                      <button 
                        className={`px-3 py-1 text-xs rounded-md ${selectedPeriod === '3mo' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                        onClick={() => setSelectedPeriod('3mo')}
                      >
                        3mo
                      </button>
                      <button 
                        className={`px-3 py-1 text-xs rounded-md ${selectedPeriod === '6mo' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                        onClick={() => setSelectedPeriod('6mo')}
                      >
                        6mo
                      </button>
                      <button 
                        className={`px-3 py-1 text-xs rounded-md ${selectedPeriod === '1y' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                        onClick={() => setSelectedPeriod('1y')}
                      >
                        1y
                      </button>
                      <button 
                        className={`px-3 py-1 text-xs rounded-md ${selectedPeriod === '5y' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                        onClick={() => setSelectedPeriod('5y')}
                      >
                        5y
                      </button>
                    </div>
                    
                    {/* Event Analysis Section */}
                    {currentPortfolio && portfolioPerformance.length > 0 && (
                      <div className="mt-4 bg-white p-4 rounded-lg border border-blue-100">
                        <h6 className="font-medium text-blue-800 mb-3">Market Event Analysis</h6>
                        <p className="text-sm text-gray-600 mb-3">
                          Analyze how global events impact your portfolio and get personalized investment advice.
                        </p>
                        <div className="flex flex-col gap-3">
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <input
                                type="text"
                                placeholder="Enter a global event (e.g., COVID-19 pandemic)..."
                                value={eventInput}
                                onChange={(e) => setEventInput(e.target.value)}
                                onKeyUp={handleKeyPress}
                                className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                            </div>
                            <button 
                              onClick={() => {
                                if (eventInput.trim()) {
                                  handleEventAnalysis();
                                }
                              }}
                              className={`px-4 py-2 rounded-md ${isAnalyzing ? 'bg-gray-300 cursor-not-allowed' : eventInput.trim() ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'}`}
                            >
                              {isAnalyzing ? 'Analyzing...' : 'Analyze'}
                            </button>
                          </div>
                          
                          {eventAnalysis && (
                            <div className="mt-2 space-y-3">
                              <div className="bg-blue-50 p-3 rounded-lg">
                                <h3 className="font-semibold text-blue-800">{eventAnalysis.event}</h3>
                                <p className="mt-2 text-sm text-gray-700">{eventAnalysis.analysis}</p>
                                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                                  <div>
                                    <span className="font-medium">Market Impact:</span> 
                                    <span className={eventAnalysis.percent_change >= 0 ? 'text-green-600' : 'text-red-600'}>
                                      {eventAnalysis.percent_change.toFixed(2)}%
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-medium">Recovery:</span> {eventAnalysis.recovery_status}
                                  </div>
                                  <div>
                                    <span className="font-medium">Period:</span> {eventAnalysis.time_period.start_date.substring(0, 7)} to {eventAnalysis.time_period.end_date.substring(0, 7)}
                                  </div>
                                </div>
                              </div>
                              
                              <button
                                onClick={simulateEventImpact}
                                className={`w-full px-4 py-2 rounded-md ${isSimulating ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                disabled={isSimulating}
                              >
                                {isSimulating ? 'Simulating...' : `Simulate Impact on ${currentPortfolio.name}`}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    {portfolioPerformance.length > 0 ? (
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={portfolioPerformance}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="date" 
                              tickFormatter={(tick) => {
                                const date = new Date(tick);
                                return date.toLocaleDateString('en-US', { month: 'numeric', year: '2-digit' });
                              }}
                            />
                            <YAxis 
                              domain={['auto', 'auto']}
                              tickFormatter={(tick) => `$${tick}`}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Line 
                              type="monotone" 
                              dataKey="value" 
                              stroke="#3b82f6" 
                              dot={false} 
                              activeDot={{ r: 8 }} 
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-80 flex items-center justify-center">
                        <p>No performance data available</p>
                      </div>
                    )}
                    
                    {/* Display event simulation results in portfolio tab if available */}
                    {activeTab === 'portfolio' && eventSimulation && (
                      <div className="mt-6 bg-white rounded-lg shadow-md overflow-hidden">
                        <div className="p-4 border-b">
                          <h5 className="text-xl font-bold">Event Impact Simulation</h5>
                          <p className="text-gray-600">How {eventSimulation.portfolio.name} would have performed during {eventSimulation.event}</p>
                        </div>
                        
                        <div className="p-4">
                          <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart
                                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis 
                                  dataKey="date" 
                                  type="category"
                                  allowDuplicatedCategory={false}
                                  tickFormatter={(tick) => {
                                    const date = new Date(tick);
                                    return date.toLocaleDateString('en-US', { month: 'numeric', year: '2-digit' });
                                  }}
                                />
                                <YAxis 
                                  domain={['auto', 'auto']}
                                  tickFormatter={(tick) => `$${tick.toFixed(0)}`}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                
                                {/* Reference line for middle date */}
                                <ReferenceLine
                                  x={eventSimulation.time_period.middle_date}
                                  stroke="#ff0000"
                                  strokeDasharray="3 3"
                                  label={{ value: 'Decision Point', position: 'top', fill: '#ff0000', fontSize: 12 }}
                                />
                                
                                {eventSimulation.simulation_results.map((result, index) => {
                                  const colors = ['#3b82f6', '#10b981', '#ef4444'];
                                  return (
                                    <Line
                                      key={result.scenario}
                                      data={result.performance}
                                      type="monotone"
                                      dataKey="value"
                                      name={result.scenario}
                                      stroke={colors[index % colors.length]}
                                      dot={false}
                                      strokeWidth={2}
                                    />
                                  );
                                })}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                          
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                            {eventSimulation.simulation_results.map((result) => (
                              <div key={result.scenario} className={`p-4 rounded-lg ${
                                result.scenario === eventSimulation.advice.best_scenario 
                                  ? 'bg-blue-50 border border-blue-200' 
                                  : 'bg-gray-50'
                              }`}>
                                <h6 className="font-semibold mb-2">{result.scenario}</h6>
                                <div className="space-y-1 text-sm">
                                  <p>
                                    <span className="font-medium">Total Return:</span> 
                                    <span className={result.total_return >= 0 ? 'text-green-600' : 'text-red-600'}>
                                      {result.total_return.toFixed(2)}%
                                    </span>
                                  </p>
                                  <p><span className="font-medium">Max Drawdown:</span> {result.max_drawdown.toFixed(2)}%</p>
                                  <p>
                                    <span className="font-medium">Recovery Period:</span> 
                                    {result.recovery_days ? `${result.recovery_days} days` : 'No recovery'}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          <div className="mt-6 bg-blue-50 p-4 rounded-lg">
                            <h6 className="font-semibold mb-2">Investment Advice</h6>
                            <p className="text-gray-700">{eventSimulation.advice.text}</p>
                            <p className="mt-2 font-medium">
                              Best Strategy: 
                              <span className={`ml-2 ${
                                eventSimulation.advice.best_scenario === 'No Changes' ? 'text-blue-600' :
                                eventSimulation.advice.best_scenario === '20% Withdrawal' ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {eventSimulation.advice.best_scenario}
                              </span>
                            </p>
                          </div>
                          
                          {/* Asset Performance Chart */}
                          {eventSimulation.asset_performance && Object.keys(eventSimulation.asset_performance).length > 0 && (
                            <div className="mt-8 bg-white p-4 rounded-lg border border-gray-200">
                              <h6 className="text-lg font-semibold mb-4 text-blue-800">Portfolio Assets Performance During Event</h6>
                              <p className="text-sm text-gray-600 mb-4">
                                See how each asset in your portfolio performed during {eventSimulation.event} on a single chart.
                              </p>
                              
                              {/* Combined Performance Chart */}
                              <div className="h-96 mb-6">
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart
                                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                                  >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis 
                                      dataKey="date" 
                                      type="category"
                                      allowDuplicatedCategory={false}
                                      tickFormatter={(tick) => {
                                        const date = new Date(tick);
                                        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
                                      }}
                                      tick={{ fontSize: 12 }}
                                    />
                                    <YAxis 
                                      domain={['auto', 'auto']}
                                      tickFormatter={(tick) => `$${tick.toFixed(0)}`}
                                      tick={{ fontSize: 12 }}
                                      width={50}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend />
                                    
                                    {/* Reference line for middle date */}
                                    <ReferenceLine
                                      x={eventSimulation.time_period.middle_date}
                                      stroke="#ff0000"
                                      strokeDasharray="3 3"
                                      label={{ 
                                        value: 'Decision Point', 
                                        position: 'insideTopRight',
                                        fill: '#ff0000', 
                                        fontSize: 12,
                                        offset: 10
                                      }}
                                    />
                                    
                                    {/* Generate a line for each selected asset */}
                                    {Object.entries(eventSimulation.asset_performance)
                                      .filter(([symbol]) => selectedAssets[symbol] !== false) // Only show selected assets
                                      .map(([symbol, data], index) => {
                                        const colors = [
                                          "#3b82f6", // blue
                                          "#10b981", // green
                                          "#f59e0b", // amber
                                          "#8b5cf6", // violet
                                          "#ec4899", // pink
                                          "#06b6d4", // cyan
                                          "#f43f5e", // rose
                                          "#84cc16"  // lime
                                        ];
                                        
                                        const colorIndex = index % colors.length;
                                        
                                        return (
                                          <Line
                                            key={symbol}
                                            data={data.performance.map(point => ({
                                              date: point.date,
                                              value: point.close * (data.allocation / 100) * 
                                                (currentPortfolio?.investment_amount || 1)
                                            }))}
                                            type="monotone"
                                            dataKey="value"
                                            name={symbol}
                                            stroke={colors[colorIndex]}
                                            dot={false}
                                            strokeWidth={2}
                                            activeDot={{ r: 6 }}
                                          />
                                        );
                                    })}
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                              
                              {/* Asset Performance Summary */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {Object.entries(eventSimulation.asset_performance).map(([symbol, data]) => {
                                  const startValue = data.performance[0]?.close || 0;
                                  const endValue = data.performance[data.performance.length - 1]?.close || 0;
                                  const percentChange = startValue > 0 ? ((endValue - startValue) / startValue) * 100 : 0;
                                  const dollarValue = (data.allocation / 100) * (currentPortfolio?.investment_amount || 0);
                                  const isSelected = selectedAssets[symbol] !== false; // Default to true if not set
                                  
                                  return (
                                    <div key={symbol} className={`p-3 rounded-lg border shadow-sm ${isSelected ? 'bg-gray-50 border-gray-200' : 'bg-gray-100 border-gray-300'}`}>
                                      <div className="flex justify-between items-center mb-2">
                                        <h6 className="font-semibold text-gray-800 flex items-center">
                                          <button 
                                            onClick={() => setSelectedAssets(prev => ({...prev, [symbol]: !isSelected}))}
                                            className="mr-2 text-gray-500 hover:text-blue-600 focus:outline-none"
                                            title={isSelected ? "Hide from chart" : "Show on chart"}
                                          >
                                            {isSelected ? <Eye size={16} /> : <EyeOff size={16} />}
                                          </button>
                                          {symbol}
                                        </h6>
                                        <div className={`text-sm font-bold ${percentChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                          {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(2)}%
                                        </div>
                                      </div>
                                      <p className="text-xs text-gray-500 mb-2">{data.name}</p>
                                      <div className="flex justify-between text-xs">
                                        <span>{data.allocation.toFixed(2)}%</span>
                                        <span>{formatCurrency(dollarValue)}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Portfolio Summary and Performance Metrics */}
                    {portfolioMetrics && (
                      <>
                        {/* Portfolio Investment Summary */}
                        <div className="mt-4 bg-blue-50 p-4 rounded-lg border border-blue-100">
                          <div className="flex justify-between items-center mb-2">
                            <h6 className="text-lg font-semibold text-blue-800">Investment Summary</h6>
                            <button 
                              onClick={generatePDFReport}
                              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                            >
                              <Download size={16} className="mr-1" />
                              <span>View Report</span>
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-gray-600">Initial Investment</p>
                              <p className="text-xl font-bold">{formatCurrency(portfolioMetrics.initialInvestment || 0)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Current Value</p>
                              <p className="text-xl font-bold">{formatCurrency(portfolioMetrics.currentValue || 0)}</p>
                            </div>
                          </div>
                          
                          {/* Asset Allocation Summary */}
                          <div className="mt-4">
                            <h6 className="text-sm font-semibold text-blue-800 mb-2">Asset Allocation</h6>
                            <div className="grid grid-cols-1 gap-2">
                              {currentPortfolio.assets.map(asset => (
                                <div key={asset.symbol} className="flex justify-between items-center p-2 bg-white rounded border border-gray-100">
                                  <div>
                                    <span className="font-medium">{asset.symbol}</span>
                                    <span className="text-xs text-gray-500 ml-2">({asset.name})</span>
                                  </div>
                                  <div className="flex items-center">
                                    <span className="text-sm">{asset.allocation}%</span>
                                    <span className="text-xs text-gray-500 ml-2">
                                      {formatCurrency((portfolioMetrics.initialInvestment || 0) * (asset.allocation / 100))}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        
                        {/* Performance Metrics */}
                        <div className="mt-4 grid grid-cols-3 gap-4">
                          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                            <p className="text-sm text-gray-500">Total Return</p>
                          <p className={`text-xl font-bold ${portfolioMetrics.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {portfolioMetrics.totalReturn >= 0 ? '+' : ''}{portfolioMetrics.totalReturn.toFixed(2)}%
                          </p>
                          {portfolioMetrics.initialInvestment && (
                            <div className="mt-2 text-sm text-gray-500">
                              <div>Initial: {formatCurrency(portfolioMetrics.initialInvestment)}</div>
                              <div>Current: {formatCurrency(portfolioMetrics.currentValue || 0)}</div>
                            </div>
                          )}
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                          <p className="text-sm text-gray-500">Max Drawdown</p>
                          <p className="text-xl font-bold text-red-600">
                            -{portfolioMetrics.maxDrawdown.toFixed(2)}%
                          </p>
                          {portfolioMetrics.initialInvestment && portfolioMetrics.maxDrawdown > 0 && (
                            <div className="mt-2 text-sm text-gray-500">
                              Max Loss: {formatCurrency(portfolioMetrics.initialInvestment * (portfolioMetrics.maxDrawdown / 100))}
                            </div>
                          )}
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                          <p className="text-sm text-gray-500">Volatility</p>
                          <p className="text-xl font-bold text-gray-800">
                            {portfolioMetrics.volatility.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-md p-6 h-full flex items-center justify-center">
                  <p className="text-gray-500">Select a portfolio to view its performance</p>
                </div>
              )}
            </div>
            
            {/* Portfolio Modal */}
            {(isCreatingPortfolio || isEditingPortfolio) && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-y-auto">
                  <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center z-10">
                    <h5 className="text-xl font-bold">{isEditingPortfolio ? 'Edit Portfolio' : 'Create Portfolio'}</h5>
                    <button 
                      onClick={() => {
                        setIsCreatingPortfolio(false);
                        setIsEditingPortfolio(false);
                        setPortfolioName('');
                        setPortfolioAssets([]);
                        setInvestmentAmount(undefined);
                      }}
                      className="text-gray-500 hover:text-gray-700"
                      aria-label="Close"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className="p-6">
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label htmlFor="portfolio-name" className="block text-sm font-medium text-gray-700 mb-1">Portfolio Name</label>
                          <input
                            id="portfolio-name"
                            type="text"
                            value={portfolioName}
                            onChange={(e) => setPortfolioName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="My Portfolio"
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="investment-amount" className="block text-sm font-medium text-gray-700 mb-1">Investment Amount ($)</label>
                          <input
                            id="investment-amount"
                            type="number"
                            min="0"
                            step="1"
                            value={investmentAmount || ''}
                            onChange={(e) => setInvestmentAmount(e.target.value ? Number(e.target.value) : undefined)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter investment amount in dollars"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label htmlFor="asset-search" className="block text-sm font-medium text-gray-700 mb-2">Add Assets</label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <input
                              id="asset-search"
                              type="text"
                              value={assetSearchQuery}
                              onChange={handleAssetSearchInputChange}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && assetSearchQuery.trim()) {
                                  searchAssets();
                                }
                              }}
                              className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Search by symbol or name (e.g., AAPL, Apple)"
                              aria-label="Search assets"
                            />
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                            
                            {/* Suggestions Dropdown */}
                            {searchResults.length > 0 && (
                              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                <ul className="py-1" role="listbox">
                                  {searchResults.map((asset) => (
                                    <li 
                                      key={asset.symbol}
                                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex justify-between"
                                      onClick={() => {
                                        addAssetToPortfolio(asset);
                                        setSearchResults([]);
                                        setAssetSearchQuery('');
                                      }}
                                      role="option"
                                    >
                                      <div>
                                        <span className="font-medium">{asset.symbol}</span>
                                        <span className="text-gray-500 ml-2 text-sm">{asset.name}</span>
                                      </div>
                                      <span className="text-xs px-2 py-1 bg-gray-100 rounded-full">{asset.type}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => searchAssets()}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                            disabled={!assetSearchQuery.trim()}
                            aria-label="Search for assets"
                          >
                            Search
                          </button>
                        </div>
                      </div>
                      
                      {/* Portfolio Assets */}
                      {portfolioAssets.length > 0 && (
                        <div>
                          <h6 className="text-sm font-medium text-gray-700 mb-2">Portfolio Composition</h6>
                          <div className="border border-gray-200 rounded-md overflow-hidden">
                            <div className="overflow-x-auto max-h-[300px]">
                              <table className="w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50 sticky top-0">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Allocation %</th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {portfolioAssets.map((asset) => (
                                    <tr key={asset.symbol}>
                                      <td className="px-3 py-2 whitespace-nowrap">{asset.symbol}</td>
                                      <td className="px-3 py-2 whitespace-nowrap">{asset.name}</td>
                                      <td className="px-3 py-2 whitespace-nowrap">{asset.type}</td>
                                      <td className="px-3 py-2 whitespace-nowrap">
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          value={asset.allocation}
                                          onChange={(e) => updateAssetAllocation(asset.symbol, parseFloat(e.target.value))}
                                          className="w-20 px-2 py-1 border border-gray-300 rounded-md"
                                          aria-label={`Allocation percentage for ${asset.symbol}`}
                                        />
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap text-right">
                                        <button
                                          onClick={() => removeAssetFromPortfolio(asset.symbol)}
                                          className="text-red-500 hover:text-red-700"
                                          aria-label={`Remove ${asset.symbol} from portfolio`}
                                        >
                                          <X size={16} />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex justify-end space-x-3 pt-4 sticky bottom-0 bg-white pb-2">
                        <button
                          onClick={() => {
                            setIsCreatingPortfolio(false);
                            setIsEditingPortfolio(false);
                            setPortfolioName('');
                            setPortfolioAssets([]);
                            setInvestmentAmount(undefined);
                          }}
                          className="px-5 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={savePortfolio}
                          className="px-5 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                        >
                          {isEditingPortfolio ? 'Update Portfolio' : 'Create Portfolio'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* PDF Preview Modal */}
      <PDFViewerModal />
    </div>
  );
}

export default App;
