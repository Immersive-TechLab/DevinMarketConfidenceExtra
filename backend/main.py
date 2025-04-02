from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import os
import openai
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List, Tuple
import datetime
import uuid
import numpy as np
from event_analyzer import analyze_event

load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")

load_dotenv()

app = FastAPI(title="Market Confidence API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://market-impact-app-8g0glxhd.devinapps.com", "https://immersive-techlab.github.io"],  # Specific allowed origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

portfolios = {}

class EventRequest(BaseModel):
    event: str

class EventSimulationRequest(BaseModel):
    portfolio_id: str
    event: str

class SimulationResult(BaseModel):
    scenario: str
    performance: List[Dict[str, Any]]
    total_return: float
    max_drawdown: float
    recovery_days: Optional[int] = None
    
class PortfolioAsset(BaseModel):
    symbol: str
    name: str
    type: str = Field(..., description="Type of asset: 'fund', 'etf', or 'equity'")
    allocation: float = Field(..., description="Percentage allocation in the portfolio")

class Portfolio(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    assets: List[PortfolioAsset] = []
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now)
    investment_amount: Optional[float] = None
    
class PortfolioCreate(BaseModel):
    name: str
    assets: List[PortfolioAsset] = []
    investment_amount: Optional[float] = None
    
@app.get("/")
async def root():
    return {"message": "Welcome to the Market Confidence API"}

@app.get("/api/market-data")
async def get_market_data(
    period: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None
):
    """
    Get MSCI World Index market data
    
    Parameters:
    - period: Time period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
    - start: Start date in YYYY-MM-DD format (overrides period if provided)
    - end: End date in YYYY-MM-DD format (overrides period if provided)
    """
    try:
        ticker = "^990100-USD-STRD"
        data = yf.Ticker(ticker)
        
        if start and end:
            history = data.history(start=start, end=end)
        else:
            period = period or "1y"
            history = data.history(period=period)
        
        result = []
        for date, row in history.iterrows():
            result.append({
                "date": date.strftime("%Y-%m-%d"),
                "open": float(row["Open"]),
                "high": float(row["High"]),
                "low": float(row["Low"]),
                "close": float(row["Close"]),
                "volume": float(row["Volume"]) if "Volume" in row else 0
            })
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-event")
async def analyze_market_event(request: EventRequest) -> Dict[str, Any]:
    """
    Analyze a global event's impact on the MSCI World Index
    
    Parameters:
    - event: The global event to analyze (e.g., "COVID-19 pandemic")
    
    Returns:
    - Analysis of the event's impact on the market
    - Time period information
    """
    try:
        analysis, start_date, end_date = analyze_event(request.event)
        return {
            "event": request.event,
            "analysis": analysis.get("analysis", "Analysis not available"),
            "recovery_status": analysis.get("recovery_status", "Unknown"),
            "percent_change": analysis.get("percent_change"),
            "time_period": {
                "start_date": start_date,
                "end_date": end_date
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/search-assets")
async def search_assets(query: str):
    """
    Search for assets by name or symbol
    
    Parameters:
    - query: Search query
    
    Returns:
    - List of matching assets with symbol, name, and type
    """
    valid_assets = [
        {"symbol": "AAPL", "name": "Apple Inc.", "type": "equity"},
        {"symbol": "MSFT", "name": "Microsoft Corporation", "type": "equity"},
        {"symbol": "AMZN", "name": "Amazon.com, Inc.", "type": "equity"},
        {"symbol": "GOOGL", "name": "Alphabet Inc.", "type": "equity"},
        {"symbol": "META", "name": "Meta Platforms, Inc.", "type": "equity"},
        {"symbol": "TSLA", "name": "Tesla, Inc.", "type": "equity"},
        {"symbol": "SPY", "name": "SPDR S&P 500 ETF Trust", "type": "etf"},
        {"symbol": "QQQ", "name": "Invesco QQQ Trust", "type": "etf"},
        {"symbol": "VTI", "name": "Vanguard Total Stock Market ETF", "type": "etf"},
        {"symbol": "VOO", "name": "Vanguard S&P 500 ETF", "type": "etf"},
        {"symbol": "VEA", "name": "Vanguard FTSE Developed Markets ETF", "type": "etf"},
        {"symbol": "VWO", "name": "Vanguard FTSE Emerging Markets ETF", "type": "etf"},
        {"symbol": "BND", "name": "Vanguard Total Bond Market ETF", "type": "etf"},
        {"symbol": "AGG", "name": "iShares Core U.S. Aggregate Bond ETF", "type": "etf"},
        {"symbol": "GLD", "name": "SPDR Gold Shares", "type": "etf"},
        {"symbol": "IWM", "name": "iShares Russell 2000 ETF", "type": "etf"},
        {"symbol": "EFA", "name": "iShares MSCI EAFE ETF", "type": "etf"},
        {"symbol": "LQD", "name": "iShares iBoxx $ Investment Grade Corporate Bond ETF", "type": "etf"},
        {"symbol": "XLF", "name": "Financial Select Sector SPDR Fund", "type": "etf"},
        {"symbol": "XLE", "name": "Energy Select Sector SPDR Fund", "type": "etf"}
    ]
    
    query = query.lower()
    results = [
        asset for asset in valid_assets
        if query in asset["symbol"].lower() or query in asset["name"].lower()
    ]
    
    return results[:10]  # Limit to 10 results

@app.get("/api/asset/{symbol}")
async def get_asset_data(symbol: str, period: Optional[str] = "1y"):
    """
    Get historical data for a specific asset
    
    Parameters:
    - symbol: Asset symbol (e.g., AAPL, SPY)
    - period: Time period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
    
    Returns:
    - Historical price data for the asset
    """
    try:
        data = yf.Ticker(symbol)
        history = data.history(period=period)
        
        result = []
        for date, row in history.iterrows():
            result.append({
                "date": date.strftime("%Y-%m-%d"),
                "open": float(row["Open"]),
                "high": float(row["High"]),
                "low": float(row["Low"]),
                "close": float(row["Close"]),
                "volume": float(row["Volume"]) if "Volume" in row else 0
            })
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/portfolios", response_model=Portfolio)
async def create_portfolio(portfolio: PortfolioCreate):
    """
    Create a new portfolio
    
    Parameters:
    - portfolio: Portfolio data including name and assets
    
    Returns:
    - Created portfolio with ID
    """
    new_portfolio = Portfolio(
        name=portfolio.name,
        assets=portfolio.assets,
        investment_amount=portfolio.investment_amount
    )
    portfolios[new_portfolio.id] = new_portfolio
    return new_portfolio

@app.get("/api/portfolios", response_model=List[Portfolio])
async def list_portfolios():
    """
    List all portfolios
    
    Returns:
    - List of all portfolios
    """
    return list(portfolios.values())

@app.get("/api/portfolios/{portfolio_id}", response_model=Portfolio)
async def get_portfolio(portfolio_id: str):
    """
    Get a specific portfolio by ID
    
    Parameters:
    - portfolio_id: Portfolio ID
    
    Returns:
    - Portfolio details
    """
    if portfolio_id not in portfolios:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return portfolios[portfolio_id]

@app.put("/api/portfolios/{portfolio_id}", response_model=Portfolio)
async def update_portfolio(portfolio_id: str, portfolio_update: PortfolioCreate):
    """
    Update a portfolio
    
    Parameters:
    - portfolio_id: Portfolio ID
    - portfolio_update: Updated portfolio data
    
    Returns:
    - Updated portfolio
    """
    if portfolio_id not in portfolios:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    existing_portfolio = portfolios[portfolio_id]
    updated_portfolio = Portfolio(
        id=existing_portfolio.id,
        name=portfolio_update.name,
        assets=portfolio_update.assets,
        created_at=existing_portfolio.created_at,
        investment_amount=portfolio_update.investment_amount
    )
    
    portfolios[portfolio_id] = updated_portfolio
    return updated_portfolio

@app.delete("/api/portfolios/{portfolio_id}")
async def delete_portfolio(portfolio_id: str):
    """
    Delete a portfolio
    
    Parameters:
    - portfolio_id: Portfolio ID
    
    Returns:
    - Success message
    """
    if portfolio_id not in portfolios:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    del portfolios[portfolio_id]
    return {"message": "Portfolio deleted successfully"}

@app.get("/api/portfolios/{portfolio_id}/performance")
async def get_portfolio_performance(portfolio_id: str, period: Optional[str] = "1y"):
    """
    Get performance data for a portfolio
    
    Parameters:
    - portfolio_id: Portfolio ID
    - period: Time period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
    
    Returns:
    - Historical performance data for the portfolio
    """
    if portfolio_id not in portfolios:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    portfolio = portfolios[portfolio_id]
    
    performance_data = {}
    for asset in portfolio.assets:
        try:
            data = yf.Ticker(asset.symbol)
            history = data.history(period=period)
            
            asset_data = []
            for date, row in history.iterrows():
                asset_data.append({
                    "date": date.strftime("%Y-%m-%d"),
                    "close": float(row["Close"]),
                    "allocation": asset.allocation
                })
            
            performance_data[asset.symbol] = asset_data
        except Exception as e:
            continue
    
    dates = set()
    for asset_data in performance_data.values():
        for data_point in asset_data:
            dates.add(data_point["date"])
    
    dates = sorted(list(dates))
    portfolio_performance = []
    
    for date in dates:
        portfolio_value = 0
        for symbol, asset_data in performance_data.items():
            data_point = next((d for d in asset_data if d["date"] == date), None)
            if data_point:
                portfolio_value += data_point["close"] * (data_point["allocation"] / 100)
        
        if portfolio.investment_amount is not None and portfolio_value > 0:
            portfolio_value = portfolio_value * portfolio.investment_amount
        
        portfolio_performance.append({
            "date": date,
            "value": portfolio_value
        })
    
    return {
        "portfolio": {
            "id": portfolio.id,
            "name": portfolio.name
        },
        "performance": portfolio_performance
    }

@app.post("/api/portfolios/event-simulation")
async def simulate_portfolio_event(request: EventSimulationRequest):
    """
    Simulate portfolio performance during a market event under three scenarios:
    1. Withdraw 20% in the middle of the event
    2. Add 20% in the middle of the event 
    3. Make no changes
    
    Parameters:
    - portfolio_id: ID of the portfolio to simulate
    - event: The global event to analyze
    
    Returns:
    - Simulation results for each scenario
    - Investment advice based on historical performance
    """
    if request.portfolio_id not in portfolios:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    portfolio = portfolios[request.portfolio_id]
    
    analysis, start_date, end_date = analyze_event(request.event)
    
    if not start_date or not end_date:
        raise HTTPException(status_code=400, detail="Could not determine event time period")
    
    event_data = {}
    for asset in portfolio.assets:
        try:
            data = yf.Ticker(asset.symbol)
            history = data.history(start=start_date, end=end_date)
            
            asset_data = []
            for date, row in history.iterrows():
                asset_data.append({
                    "date": date.strftime("%Y-%m-%d"),
                    "close": float(row["Close"]),
                    "allocation": asset.allocation
                })
            
            event_data[asset.symbol] = asset_data
        except Exception as e:
            continue
    
    dates = set()
    for asset_data in event_data.values():
        for data_point in asset_data:
            dates.add(data_point["date"])
    
    dates = sorted(list(dates))
    if len(dates) == 0:
        raise HTTPException(status_code=400, detail="Insufficient market data for simulation")
        
    middle_idx = len(dates) // 2
    middle_date = dates[middle_idx]
    
    simulation_results = []
    
    no_change_performance = calculate_scenario_performance(event_data, dates, "no_change", portfolio=portfolio)
    no_change_metrics = calculate_performance_metrics(no_change_performance)
    simulation_results.append({
        "scenario": "No Changes",
        "performance": no_change_performance,
        "total_return": no_change_metrics["total_return"],
        "max_drawdown": no_change_metrics["max_drawdown"],
        "recovery_days": no_change_metrics["recovery_days"]
    })
    
    withdraw_performance = calculate_scenario_performance(event_data, dates, "withdraw", middle_date, portfolio=portfolio)
    withdraw_metrics = calculate_performance_metrics(withdraw_performance)
    simulation_results.append({
        "scenario": "20% Withdrawal",
        "performance": withdraw_performance,
        "total_return": withdraw_metrics["total_return"],
        "max_drawdown": withdraw_metrics["max_drawdown"],
        "recovery_days": withdraw_metrics["recovery_days"]
    })
    
    add_performance = calculate_scenario_performance(event_data, dates, "add", middle_date, portfolio=portfolio)
    add_metrics = calculate_performance_metrics(add_performance)
    simulation_results.append({
        "scenario": "20% Addition",
        "performance": add_performance,
        "total_return": add_metrics["total_return"],
        "max_drawdown": add_metrics["max_drawdown"],
        "recovery_days": add_metrics["recovery_days"]
    })
    
    advice = generate_investment_advice(simulation_results, request.event)
    
    asset_performance = {}
    for symbol, asset_data in event_data.items():
        asset_info = next((a for a in portfolio.assets if a.symbol == symbol), None)
        if asset_info:
            asset_performance[symbol] = {
                "name": asset_info.name,
                "allocation": asset_info.allocation,
                "performance": asset_data
            }
    
    return {
        "event": request.event,
        "portfolio": {
            "id": portfolio.id,
            "name": portfolio.name
        },
        "time_period": {
            "start_date": start_date,
            "end_date": end_date,
            "middle_date": middle_date
        },
        "simulation_results": simulation_results,
        "asset_performance": asset_performance,
        "advice": advice
    }

def calculate_scenario_performance(event_data, dates, scenario, middle_date=None, portfolio=None):
    """
    Calculate portfolio performance under a specific scenario
    
    Parameters:
    - event_data: Market data for each asset
    - dates: List of dates to calculate performance for
    - scenario: Scenario type (withdraw, add, hold)
    - middle_date: Date to apply scenario changes
    - portfolio: Portfolio object with investment_amount
    """
    performance = []
    
    for date in dates:
        portfolio_value = 0
        adjustment_factor = 1.0
        
        if scenario == "withdraw" and middle_date and date >= middle_date:
            adjustment_factor = 0.8  # 20% withdrawal
        elif scenario == "add" and middle_date and date >= middle_date:
            adjustment_factor = 1.2  # 20% addition
        
        for symbol, asset_data in event_data.items():
            data_point = next((d for d in asset_data if d["date"] == date), None)
            if data_point:
                portfolio_value += data_point["close"] * (data_point["allocation"] / 100)
        
        portfolio_value *= adjustment_factor
        
        if portfolio and portfolio.investment_amount is not None and portfolio_value > 0:
            portfolio_value = portfolio_value * portfolio.investment_amount
        
        performance.append({
            "date": date,
            "value": portfolio_value
        })
    
    return performance

def calculate_performance_metrics(performance_data):
    """
    Calculate performance metrics for a scenario
    """
    if not performance_data or len(performance_data) < 2:
        return {
            "total_return": 0,
            "max_drawdown": 0,
            "recovery_days": None
        }
    
    initial_value = performance_data[0]["value"]
    final_value = performance_data[-1]["value"]
    
    total_return = ((final_value - initial_value) / initial_value) * 100
    
    peak_value = performance_data[0]["value"]
    max_drawdown = 0
    
    for point in performance_data:
        if point["value"] > peak_value:
            peak_value = point["value"]
        
        current_drawdown = (peak_value - point["value"]) / peak_value * 100
        max_drawdown = max(max_drawdown, current_drawdown)
    
    lowest_point_idx = min(range(len(performance_data)), key=lambda i: performance_data[i]["value"])
    recovery_days = None
    
    if lowest_point_idx < len(performance_data) - 1:
        lowest_value = performance_data[lowest_point_idx]["value"]
        lowest_date = datetime.datetime.strptime(performance_data[lowest_point_idx]["date"], "%Y-%m-%d")
        
        for i in range(lowest_point_idx + 1, len(performance_data)):
            if performance_data[i]["value"] >= initial_value:
                recovery_date = datetime.datetime.strptime(performance_data[i]["date"], "%Y-%m-%d")
                recovery_days = (recovery_date - lowest_date).days
                break
    
    return {
        "total_return": total_return,
        "max_drawdown": max_drawdown,
        "recovery_days": recovery_days
    }

def generate_investment_advice(simulation_results, event):
    """
    Generate investment advice based on simulation results
    """
    try:
        scenarios = {result["scenario"]: {
            "total_return": result["total_return"],
            "max_drawdown": result["max_drawdown"],
            "recovery_days": result["recovery_days"]
        } for result in simulation_results}
        
        best_scenario = max(scenarios.items(), key=lambda x: x[1]["total_return"])[0]
        
        prompt = f"""
        Analyze the performance of three investment strategies during the {event}:
        
        1. No Changes: 
           - Total Return: {scenarios['No Changes']['total_return']:.2f}%
           - Maximum Drawdown: {scenarios['No Changes']['max_drawdown']:.2f}%
           - Recovery Days: {scenarios['No Changes']['recovery_days'] or 'N/A'}
           
        2. 20% Withdrawal (in the middle of the event): 
           - Total Return: {scenarios['20% Withdrawal']['total_return']:.2f}%
           - Maximum Drawdown: {scenarios['20% Withdrawal']['max_drawdown']:.2f}%
           - Recovery Days: {scenarios['20% Withdrawal']['recovery_days'] or 'N/A'}
           
        3. 20% Addition (in the middle of the event): 
           - Total Return: {scenarios['20% Addition']['total_return']:.2f}%
           - Maximum Drawdown: {scenarios['20% Addition']['max_drawdown']:.2f}%
           - Recovery Days: {scenarios['20% Addition']['recovery_days'] or 'N/A'}
        
        Based on this data, provide concise investment advice (1-2 paragraphs) about which strategy performed best during this event and why.
        Include advice on what an investor should consider when facing similar market conditions in the future.
        """
        
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a financial advisor providing evidence-based investment advice."},
                {"role": "user", "content": prompt}
            ]
        )
        
        return {
            "best_scenario": best_scenario,
            "text": response.choices[0].message.content.strip()
        }
    except Exception as e:
        print(f"Error generating investment advice: {e}")
        return {
            "best_scenario": "No Changes",
            "text": "Unable to generate investment advice. Please analyze the simulation data to determine the best strategy."
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
