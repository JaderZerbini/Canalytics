# -*- coding: utf-8 -*-
import datetime
import random
import json
import requests
import csv
import io
import folium
from folium.plugins import HeatMap, MarkerCluster, Draw
# Não precisamos de 'db' aqui se as funções de salvamento/consulta estiverem em routes.py
# ou se passarmos 'db' e os modelos como argumentos.

# --- Dados Simulados e Funções Auxiliares ---
def create_simulated_data(db, SoilParameter, Area):
    """Cria dados simulados se o banco estiver vazio."""
    if SoilParameter.query.first() is None:
        print("Criando dados simulados para cana-de-açúcar...")
        # Parâmetros com novos limites para cana-de-açúcar
        params_data = [
            {
                "name": "pH", "unit": "", "description": "Nível de acidez/alcalinidade do solo", 
                "min_value": 4.0, "max_value": 8.5, # Faixa de tolerância da cana
                "optimal_min": 5.5, "optimal_max": 6.5 # Ideal
            },
            {
                "name": "Nitrogênio", "unit": "ppm", "description": "Nutriente essencial para crescimento", 
                "min_value": 10, "max_value": 150, # Faixa geral
                "optimal_min": 40, "optimal_max": 80 # Ideal para cana
            },
            {
                "name": "Fósforo", "unit": "ppm", "description": "Nutriente para desenvolvimento radicular (método resina)", 
                "min_value": 2, "max_value": 40,    # Faixa geral
                "optimal_min": 10, "optimal_max": 15 # Ideal para cana (resina)
            },
            {
                "name": "Potássio", "unit": "ppm", "description": "Nutriente para resistência e frutificação", 
                "min_value": 40, "max_value": 200,  # Faixa geral
                "optimal_min": 80, "optimal_max": 120 # Ideal para cana
            },
            {
                "name": "Umidade", "unit": "%", "description": "Percentual de água no solo", 
                "min_value": 10, "max_value": 90,   # Faixa geral
                "optimal_min": 60, "optimal_max": 70 # Ideal (da capacidade de campo)
            }
        ]
        for p_data in params_data:
            param = SoilParameter(**p_data)
            db.session.add(param)
        db.session.commit()

        # Áreas com as coordenadas fornecidas pelo usuário
        areas_data = [
            {
                "name": "Talhão A1", 
                "description": "Área Norte", 
                "coordinates": json.dumps([
                    [-21.496016, -51.063915],
                    [-21.495016, -51.062915],
                    [-21.497016, -51.062915],
                    [-21.497016, -51.064915],
                    [-21.496016, -51.063915]
                ]),
                "size_hectares": 12.5
            },
            {
                "name": "Talhão B2", 
                "description": "Área Central", 
                "coordinates": json.dumps([
                    [-21.518814, -51.060825],
                    [-21.517814, -51.059825],
                    [-21.519814, -51.059825],
                    [-21.519814, -51.061825],
                    [-21.518814, -51.060825]
                ]),
                "size_hectares": 15.2
            },
            {
                "name": "Talhão C3", 
                "description": "Área Sul", 
                "coordinates": json.dumps([
                    [-21.515261, -51.074301],
                    [-21.514261, -51.073301],
                    [-21.516261, -51.073301],
                    [-21.516261, -51.075301],
                    [-21.515261, -51.074301]
                ]),
                "size_hectares": 10.8
            }
        ]
        if Area.query.first() is None:
            for a_data in areas_data:
                area = Area(**a_data)
                db.session.add(area)
            db.session.commit()
        
        print("Dados simulados para cana-de-açúcar criados/verificados com sucesso!")
        
        
    else:
        print("Banco de dados já contém parâmetros. Verifique se os limites estão atualizados.")

def get_weather_data_from_api(db, WeatherData): # Adicionado db e WeatherData
    """Obtém dados reais de previsão do tempo da API OpenMeteo."""
    try:
        latitude = -21.510037
        longitude = -51.066347
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": latitude, "longitude": longitude,
            "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weathercode",
            "current": "temperature_2m,relative_humidity_2m,precipitation,weathercode,windspeed_10m",
            "timezone": "America/Sao_Paulo", "forecast_days": 7
        }
        response = requests.get(url, params=params)
        data = response.json()
        
        if response.status_code != 200:
            print(f"Erro ao obter dados da API: {data.get('reason', 'Erro desconhecido')}")
            return get_simulated_weather_data(db, WeatherData) # Fallback
        
        weather_descriptions = {
            0: "Céu limpo", 1: "Principalmente limpo", 2: "Parcialmente nublado", 3: "Nublado", 45: "Neblina",
            48: "Neblina com deposição de geada", 51: "Garoa leve", 53: "Garoa moderada", 55: "Garoa intensa",
            56: "Garoa congelante leve", 57: "Garoa congelante intensa", 61: "Chuva leve", 63: "Chuva moderada",
            65: "Chuva intensa", 66: "Chuva congelante leve", 67: "Chuva congelante intensa", 71: "Neve leve",
            73: "Neve moderada", 75: "Neve intensa", 77: "Grãos de neve", 80: "Pancadas de chuva leves",
            81: "Pancadas de chuva moderadas", 82: "Pancadas de chuva violentas", 85: "Pancadas de neve leves",
            86: "Pancadas de neve intensas", 95: "Tempestade", 96: "Tempestade com granizo leve", 99: "Tempestade com granizo intenso"
        }
        
        current_data = data.get("current", {})
        current_weather_code = current_data.get("weathercode")
        current = {
            "temperature": current_data.get("temperature_2m"), "humidity": current_data.get("relative_humidity_2m"),
            "precipitation": current_data.get("precipitation", 0), "wind_speed": current_data.get("windspeed_10m"),
            "weather_code": current_weather_code, "weather_description": weather_descriptions.get(current_weather_code, "Desconhecido")
        }
        
        daily_data = data.get("daily", {})
        days_of_week = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]
        forecast = []
        
        dates = daily_data.get("time", [])
        max_temps = daily_data.get("temperature_2m_max", [])
        min_temps = daily_data.get("temperature_2m_min", [])
        precips = daily_data.get("precipitation_sum", [])
        precip_probs = daily_data.get("precipitation_probability_max", [])
        weather_codes = daily_data.get("weathercode", [])
        
        for i in range(len(dates)):
            date = datetime.datetime.strptime(dates[i], "%Y-%m-%d").date()
            day_of_week = days_of_week[date.weekday()]
            weather_code = weather_codes[i] if i < len(weather_codes) else 0
            
            forecast.append({
                "date": date.isoformat(), "day_of_week": day_of_week,
                "temperature_max": max_temps[i] if i < len(max_temps) else None,
                "temperature_min": min_temps[i] if i < len(min_temps) else None,
                "precipitation": precips[i] if i < len(precips) else 0,
                "precipitation_probability": precip_probs[i] if i < len(precip_probs) else 0,
                "weather_code": weather_code, "weather_description": weather_descriptions.get(weather_code, "Desconhecido")
            })
        
        save_weather_data_to_db(db, WeatherData, current, forecast)
        return current, forecast
        
    except Exception as e:
        print(f"Erro ao obter dados meteorológicos da API: {str(e)}")
        return get_simulated_weather_data(db, WeatherData) # Fallback

def get_simulated_weather_data(db, WeatherData): # Adicionado db e WeatherData
    """Retorna dados simulados de previsão do tempo (fallback)."""
    today = datetime.date.today()
    forecast = []
    weather_descriptions = {0: "Céu limpo", 2: "Parcialmente nublado", 61: "Chuva leve", 80: "Pancadas de chuva"}
    days_of_week = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]
    
    current_temp = round(random.uniform(18, 32), 1)
    current_humidity = random.randint(40, 85)
    current_precip = round(random.uniform(0, 5), 1)
    current_wind = round(random.uniform(5, 20), 1)
    current_code = random.choice(list(weather_descriptions.keys()))

    current = {
        "temperature": current_temp, "humidity": current_humidity, "precipitation": current_precip,
        "wind_speed": current_wind, "weather_code": current_code,
        "weather_description": weather_descriptions.get(current_code, "Desconhecido")
    }

    for i in range(7):
        date = today + datetime.timedelta(days=i)
        day_of_week_idx = date.weekday()
        code = random.choice(list(weather_descriptions.keys()))
        max_temp = round(random.uniform(25, 35), 1)
        min_temp = round(max_temp - random.uniform(5, 12), 1)
        precip = round(random.uniform(0, 15), 1) if code > 50 else 0
        precip_prob = random.randint(0, 100) if code > 50 else random.randint(0, 20)
        
        forecast.append({
            "date": date.isoformat(), "day_of_week": days_of_week[day_of_week_idx],
            "temperature_max": max_temp, "temperature_min": min_temp,
            "precipitation": precip, "precipitation_probability": precip_prob,
            "weather_code": code, "weather_description": weather_descriptions.get(code, "Desconhecido")
        })
    
    save_weather_data_to_db(db, WeatherData, current, forecast)
    return current, forecast

def save_weather_data_to_db(db, WeatherData, current, forecast): # Adicionado db e WeatherData
    """Salva os dados meteorológicos no banco de dados."""
    try:
        for day_data in forecast:
            date = datetime.datetime.strptime(day_data["date"], "%Y-%m-%d").date()
            existing = WeatherData.query.filter_by(date=date).first()
            if existing:
                existing.temperature_max = day_data["temperature_max"]
                existing.temperature_min = day_data["temperature_min"]
                existing.precipitation = day_data["precipitation"]
                existing.precipitation_probability = day_data["precipitation_probability"]
                existing.weather_code = day_data["weather_code"]
                existing.weather_description = day_data["weather_description"]
                existing.created_at = datetime.datetime.utcnow()
                if date == datetime.date.today(): # Only update current day's humidity/wind from current
                    existing.humidity = current.get("humidity")
                    existing.wind_speed = current.get("wind_speed")

            else:
                weather_entry = WeatherData(
                    date=date,
                    temperature_max=day_data["temperature_max"],
                    temperature_min=day_data["temperature_min"],
                    precipitation=day_data["precipitation"],
                    precipitation_probability=day_data["precipitation_probability"],
                    humidity=current.get("humidity") if date == datetime.date.today() else None,
                    wind_speed=current.get("wind_speed") if date == datetime.date.today() else None,
                    weather_code=day_data["weather_code"],
                    weather_description=day_data["weather_description"]
                )
                db.session.add(weather_entry)
        db.session.commit()
    except Exception as e:
        print(f"Erro ao salvar dados meteorológicos no banco: {str(e)}")
        db.session.rollback()

def fetch_pronasolos_data(lat, lon, parameter=None): # Esta função será usada por /api/soil_data
    # ... (código existente) ...
    soil_data = {
        "pH": round(random.uniform(4.5, 7.5), 1), "Nitrogênio": round(random.uniform(10, 50), 1),
        "Fósforo": round(random.uniform(5, 30), 1), "Potássio": round(random.uniform(50, 200), 1),
        "Umidade": round(random.uniform(20, 70), 1), "Matéria Orgânica": round(random.uniform(1, 5), 1),
        "Argila": round(random.uniform(10, 60), 1), "Silte": round(random.uniform(10, 40), 1),
        "Areia": round(random.uniform(10, 80), 1), "CTC": round(random.uniform(5, 20), 1),
        "Saturação por Bases": round(random.uniform(30, 80), 1)
    }
    if parameter and parameter in soil_data:
        return {parameter: soil_data[parameter]}
    return soil_data

def generate_report_csv(SoilParameter, Area, WeatherData, report_type, start_date_str=None, end_date_str=None, area_id=None, parameter_id=None): # Adicionado Modelos
    """Gera um relatório CSV com base nos filtros."""
    start_date = datetime.datetime.strptime(start_date_str, "%Y-%m-%d").date() if start_date_str else datetime.date.today() - datetime.timedelta(days=30)
    end_date = datetime.datetime.strptime(end_date_str, "%Y-%m-%d").date() if end_date_str else datetime.date.today()
    
    csv_data = io.StringIO()
    csv_writer = csv.writer(csv_data)
    
    if report_type == "soil":
        areas_query = Area.query
        if area_id: areas_query = areas_query.filter_by(id=area_id)
        areas = areas_query.all()
        
        parameters_query = SoilParameter.query
        if parameter_id: parameters_query = parameters_query.filter_by(id=parameter_id)
        parameters = parameters_query.all()
        
        csv_writer.writerow(["Área", "Tamanho (ha)", "Parâmetro", "Valor", "Unidade", "Data Simulação"])
        for area_obj in areas:
            if area_obj:
                try:
                    coordinates = json.loads(area_obj.coordinates)
                    center_lat = sum([coord[0] for coord in coordinates]) / len(coordinates)
                    center_lon = sum([coord[1] for coord in coordinates]) / len(coordinates)
                    for param in parameters:
                        soil_data = fetch_pronasolos_data(center_lat, center_lon, param.name)
                        value = soil_data.get(param.name, "N/A")
                        csv_writer.writerow([
                            area_obj.name, area_obj.size_hectares, param.name, value, param.unit,
                            datetime.date.today().strftime("%d/%m/%Y")
                        ])
                except Exception as e:
                    print(f"Erro ao processar área {area_obj.name} para relatório: {str(e)}")
                    continue
    
    elif report_type == "weather":
        weather_entries = WeatherData.query.filter(
            WeatherData.date.between(start_date, end_date)
        ).order_by(WeatherData.date).all()
        
        csv_writer.writerow([
            "Data", "Temperatura Máx (°C)", "Temperatura Mín (°C)", 
            "Precipitação (mm)", "Prob. Precipitação (%)", 
            "Condição", "Umidade (%)", "Vento (km/h)"
        ])
        for data_entry in weather_entries:
            csv_writer.writerow([
                data_entry.date.strftime("%d/%m/%Y"), data_entry.temperature_max, data_entry.temperature_min,
                data_entry.precipitation, data_entry.precipitation_probability, data_entry.weather_description,
                data_entry.humidity, data_entry.wind_speed
            ])
    
    csv_data.seek(0)
    return csv_data