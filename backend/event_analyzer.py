import os
import openai
from dotenv import load_dotenv
import yfinance as yf
import datetime
from typing import Dict, Any, Tuple, Optional

load_dotenv()

openai.api_key = os.getenv("OPENAI_API_KEY")

def analyze_event(event: str) -> Tuple[Dict[str, Any], Optional[str], Optional[str]]:
    """
    Analyze a global event and its impact on the MSCI World Index
    
    Parameters:
    - event: The global event to analyze (e.g., "COVID-19 pandemic")
    
    Returns:
    - Tuple containing:
        - Event analysis data
        - Start date for the event period
        - End date for the event period (or None if ongoing)
    """
    time_period = get_event_time_period(event)
    
    if not time_period:
        return {
            "event": event,
            "analysis": "Could not determine the time period for this event.",
            "recovery_status": "Unknown"
        }, None, None
    
    start_date = time_period.get("start_date")
    end_date = time_period.get("end_date")
    
    market_data = get_market_data_for_period(start_date, end_date)
    
    if not market_data or len(market_data) < 2:
        return {
            "event": event,
            "analysis": "Insufficient market data available for this time period.",
            "recovery_status": "Unknown"
        }, start_date, end_date
    
    impact_data = calculate_market_impact(market_data)
    
    analysis = generate_event_analysis(event, impact_data)
    
    return analysis, start_date, end_date

def get_event_time_period(event: str) -> Dict[str, str]:
    """
    Use OpenAI to determine the time period of a global event
    """
    try:
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a financial analyst assistant. Provide accurate time periods for global events."},
                {"role": "user", "content": f"What is the start date and end date of the {event}? Respond in JSON format with 'start_date' and 'end_date' in YYYY-MM-DD format. If the event is ongoing, use today's date as the end date."}
            ],
            response_format={"type": "json_object"}
        )
        
        import json
        content = response.choices[0].message.content
        return json.loads(content)
    except Exception as e:
        print(f"Error getting event time period: {e}")
        return {}

def get_market_data_for_period(start_date: str, end_date: str) -> list:
    """
    Get MSCI World Index data for a specific time period
    """
    try:
        ticker = "^990100-USD-STRD"
        data = yf.Ticker(ticker)
        
        start_date_obj = datetime.datetime.strptime(start_date, "%Y-%m-%d")
        buffer_start = (start_date_obj - datetime.timedelta(days=30)).strftime("%Y-%m-%d")
        
        history = data.history(start=buffer_start, end=end_date)
        
        result = []
        for date, row in history.iterrows():
            result.append({
                "date": date.strftime("%Y-%m-%d"),
                "close": float(row["Close"])
            })
        
        return result
    except Exception as e:
        print(f"Error getting market data: {e}")
        return []

def calculate_market_impact(market_data: list) -> Dict[str, Any]:
    """
    Calculate the impact of an event on the market
    """
    if not market_data or len(market_data) < 2:
        return {
            "pre_event_value": None,
            "lowest_value": None,
            "current_value": None,
            "percent_change": None,
            "recovery_days": None,
            "recovered": None
        }
    
    pre_event_days = min(30, len(market_data) // 3)
    pre_event_value = sum(item["close"] for item in market_data[:pre_event_days]) / pre_event_days
    
    event_data = market_data[pre_event_days:]
    
    if not event_data:
        return {
            "pre_event_value": pre_event_value,
            "lowest_value": None,
            "current_value": None,
            "percent_change": None,
            "recovery_days": None,
            "recovered": None
        }
    
    lowest_point = min(event_data, key=lambda x: x["close"])
    lowest_value = lowest_point["close"]
    lowest_date = lowest_point["date"]
    
    current_value = event_data[-1]["close"]
    
    percent_change = ((lowest_value - pre_event_value) / pre_event_value) * 100
    
    recovered = current_value >= pre_event_value
    
    recovery_days = None
    if recovered:
        lowest_index = next((i for i, item in enumerate(event_data) if item["date"] == lowest_date), 0)
        for i in range(lowest_index + 1, len(event_data)):
            if event_data[i]["close"] >= pre_event_value:
                recovery_date = datetime.datetime.strptime(event_data[i]["date"], "%Y-%m-%d")
                lowest_date_obj = datetime.datetime.strptime(lowest_date, "%Y-%m-%d")
                recovery_days = (recovery_date - lowest_date_obj).days
                break
    
    return {
        "pre_event_value": pre_event_value,
        "lowest_value": lowest_value,
        "current_value": current_value,
        "percent_change": percent_change,
        "recovery_days": recovery_days,
        "recovered": recovered
    }

def generate_event_analysis(event: str, impact_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate analysis of the event's impact on the market using OpenAI
    """
    try:
        percent_change = impact_data.get("percent_change")
        recovered = impact_data.get("recovered")
        recovery_days = impact_data.get("recovery_days")
        
        recovery_status = "Market did not fully recover"
        if recovered:
            recovery_status = f"Market recovered after {recovery_days} days" if recovery_days else "Market recovered"
        
        prompt = f"""
        Analyze the impact of the {event} on the MSCI World Index:
        - Market declined by approximately {abs(percent_change):.2f}% during this event
        - {recovery_status}
        
        Provide a concise analysis paragraph explaining how this event affected global markets, 
        what factors contributed to the decline, and the recovery process if applicable.
        """
        
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a financial analyst providing concise market event analysis."},
                {"role": "user", "content": prompt}
            ]
        )
        
        analysis_text = response.choices[0].message.content.strip()
        
        return {
            "event": event,
            "analysis": analysis_text,
            "percent_change": percent_change,
            "recovery_status": recovery_status
        }
    except Exception as e:
        print(f"Error generating analysis: {e}")
        return {
            "event": event,
            "analysis": f"Unable to generate analysis due to an error: {str(e)}",
            "recovery_status": "Unknown"
        }
