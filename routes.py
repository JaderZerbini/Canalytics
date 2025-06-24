# projeto_monitoramento/app/routes.py
import json
import datetime
import io # Mantenha por enquanto, pode ser útil para outras coisas, mas não para /api/map
from flask import Blueprint, render_template, jsonify, request, Response
from . import db
from .models import SoilParameter, Area, WeatherData, SoilAnalysisReading
from .utils import (
    get_weather_data_from_api, 
    # create_folium_map, # Não vamos mais usar esta para a rota /api/map
    generate_report_csv,
    fetch_pronasolos_data # Precisaremos desta para /api/soil_data
)
from .models import SoilParameter, Area, WeatherData, SoilAnalysisReading



main_bp = Blueprint('main', __name__)

@main_bp.route("/")
def dashboard():
    """Renderiza o dashboard principal."""
    return render_template("dashboard.html")

@main_bp.route("/api/weather")
def api_weather():
    """Endpoint da API para dados climáticos."""
    current, forecast = get_weather_data_from_api(db, WeatherData)
    return jsonify({"current": current, "forecast": forecast})

@main_bp.route("/api/parameters")
def api_parameters():
    """Endpoint da API para parâmetros de solo."""
    params = SoilParameter.query.all()
    # Enviar também min_value, max_value, optimal_min, optimal_max para lógica de cores no frontend
    return jsonify([{
        "id": p.id, 
        "name": p.name, 
        "unit": p.unit or "",
        "min_value": p.min_value,
        "max_value": p.max_value,
        "optimal_min": p.optimal_min,
        "optimal_max": p.optimal_max
    } for p in params])

# MODIFICADO: /api/areas (GET)
@main_bp.route("/api/areas", methods=["GET"])
def api_get_areas(): # Renomeado para clareza, já que temos POST abaixo
    """Endpoint da API para obter todas as áreas com detalhes."""
    areas = Area.query.order_by(Area.name).all()
    output = []
    for area in areas:
        try:
            coordinates = json.loads(area.coordinates) if area.coordinates else []
        except json.JSONDecodeError:
            coordinates = [] # Lidar com coordenadas malformadas, se houver
            print(f"Alerta: Coordenadas malformadas para a área ID {area.id}: {area.coordinates}")

        output.append({
            "id": area.id,
            "name": area.name,
            "description": area.description,
            "coordinates": coordinates, # Coordenadas já como lista de listas [lat, lng]
            "size_hectares": area.size_hectares,
            "created_at": area.created_at.isoformat() if area.created_at else None
        })
    return jsonify(output)

# Rota /api/areas (POST) para criar área permanece similar
@main_bp.route("/api/areas", methods=["POST"])
def api_create_area():
    data = request.json
    
    if not data or not data.get("name") or not data.get("coordinates"):
        return jsonify({"error": "Nome e coordenadas são obrigatórios"}), 400
    
    try:
        # ... (sua lógica existente para coordinates_input e coordinates_json_string) ...
        coordinates_input = data["coordinates"]
        if isinstance(coordinates_input, list): 
            coordinates_json_string = json.dumps(coordinates_input)
        elif isinstance(coordinates_input, str): 
            json.loads(coordinates_input) 
            coordinates_json_string = coordinates_input
        else:
            return jsonify({"error": "Formato de coordenadas inválido"}), 400

        new_area = Area( # Renomeado para new_area para clareza
            name=data["name"],
            description=data.get("description", ""),
            coordinates=coordinates_json_string,
            size_hectares=float(data.get("size_hectares")) if data.get("size_hectares") else None
        )
        db.session.add(new_area)
        db.session.flush() # Para obter o new_area.id antes do commit final, se necessário para SoilAnalysisReading

        # --- NOVA LÓGICA PARA SALVAR DADOS DE SOLO ---
        soil_params_input = data.get("soil_params", {}) # Espera um objeto 'soil_params' no JSON
        
        analysis_date_str = soil_params_input.get("analysis_date")
        analysis_date_obj = None
        if analysis_date_str:
            try:
                analysis_date_obj = datetime.datetime.strptime(analysis_date_str, "%Y-%m-%d").date()
            except ValueError:
                print(f"Alerta: Data de análise inválida '{analysis_date_str}', usando data atual.")
                analysis_date_obj = datetime.date.today()
        else:
            analysis_date_obj = datetime.date.today()

        param_map = { # Mapeia nome do parâmetro para o ID do input do formulário e nome no DB
            "pH": {"id_form": "ph", "db_name": "pH"},
            "Nitrogênio": {"id_form": "nitrogenio", "db_name": "Nitrogênio"},
            "Fósforo": {"id_form": "fosforo", "db_name": "Fósforo"},
            "Potássio": {"id_form": "potassio", "db_name": "Potássio"},
            "Umidade": {"id_form": "umidade", "db_name": "Umidade"}
        }

        for param_name_db, info in param_map.items():
            # O frontend enviará 'param_ph', 'param_nitrogenio', etc.
            # Mas vamos pegar do objeto 'soil_params' que o JS vai montar
            value_str = soil_params_input.get(info["db_name"]) # Espera que o JS envie com o nome do DB

            if value_str is not None and value_str != '':
                try:
                    value = float(value_str)
                    parameter_obj = SoilParameter.query.filter_by(name=param_name_db).first()
                    if parameter_obj:
                        reading = SoilAnalysisReading(
                            area_id=new_area.id,
                            parameter_id=parameter_obj.id,
                            value=value,
                            analysis_date=analysis_date_obj,
                            notes=soil_params_input.get("notes")
                        )
                        db.session.add(reading)
                    else:
                        print(f"Alerta: Parâmetro '{param_name_db}' não encontrado no banco de dados.")
                except ValueError:
                    print(f"Alerta: Valor inválido '{value_str}' para o parâmetro '{param_name_db}'.")
        # --- FIM DA NOVA LÓGICA ---
        
        db.session.commit() # Commit final para Area e SoilAnalysisReadings
        
        new_area_details = {
            "id": new_area.id,
            "name": new_area.name,
            "description": new_area.description,
            "coordinates": json.loads(new_area.coordinates),
            "size_hectares": new_area.size_hectares,
            "created_at": new_area.created_at.isoformat() if new_area.created_at else None,
            "message": "Área e leituras de solo (se fornecidas) criadas com sucesso"
        }
        return jsonify(new_area_details), 201
    
    except json.JSONDecodeError:
        return jsonify({"error": "Coordenadas JSON inválidas"}), 400
    except Exception as e:
        db.session.rollback()
        print(f"Erro ao criar área: {str(e)}") # Log completo do erro
        import traceback
        traceback.print_exc() # Imprime o traceback completo no console do Flask
        return jsonify({"error": f"Erro interno ao criar área: {str(e)}"}), 500


# REMOVIDO/COMENTADO: Antiga rota /api/map
# @main_bp.route("/api/map")
# def api_map_old():
#     param_id_str = request.args.get("parameter_id")
#     # ... (código antigo)
#     # map_buffer = io.BytesIO() 
#     # folium_map.save(map_buffer, close_file=False)
#     # html_map_content = map_buffer.getvalue().decode('utf-8') 
#     # return html_map_content
#     pass # Não faz mais nada aqui

# NOVA ROTA: /api/soil_data (GET)


# app/routes.py

@main_bp.route("/api/soil_data") # GET
def api_get_soil_data_for_area():
    area_id_str = request.args.get("area_id")
    parameter_id_str = request.args.get("parameter_id")
    # Opcional: permitir buscar para uma data específica no futuro
    # specific_date_str = request.args.get("date") 

    if not area_id_str or not parameter_id_str:
        return jsonify({"error": "area_id e parameter_id são obrigatórios"}), 400

    try:
        area_id = int(area_id_str)
        parameter_id = int(parameter_id_str)
    except ValueError:
        return jsonify({"error": "area_id e parameter_id devem ser inteiros"}), 400

    area = Area.query.get(area_id)
    parameter = SoilParameter.query.get(parameter_id)

    if not area: return jsonify({"error": f"Área {area_id} não encontrada"}), 404
    if not parameter: return jsonify({"error": f"Parâmetro {parameter_id} não encontrado"}), 404

    # 1. Buscar a leitura mais recente no banco de dados para esta área e parâmetro
    latest_reading = SoilAnalysisReading.query.filter_by(
        area_id=area_id,
        parameter_id=parameter_id
    ).order_by(SoilAnalysisReading.analysis_date.desc(), SoilAnalysisReading.created_at.desc()).first()

    value_to_return = None
    analysis_date_to_return = None
    source = "Não disponível" # Fonte do dado
    notes_to_return = None
    center_coords_for_sim = None 

    if latest_reading:
        value_to_return = latest_reading.value
        analysis_date_to_return = latest_reading.analysis_date.isoformat() if latest_reading.analysis_date else None
        notes_to_return = latest_reading.notes
        source = f"Banco de Dados (Análise: {analysis_date_to_return or 'N/A'})"
        print(f"Dados de solo para Area ID {area_id}, Param ID {parameter_id} encontrados no DB: {value_to_return}")
    else:
        # 2. Se não houver leitura no DB, usar o fallback para dados simulados
        print(f"Nenhuma leitura no DB para Area ID {area_id}, Param ID {parameter_id}. Usando simulação.")
        try:
            coords_list = json.loads(area.coordinates)
            if coords_list and isinstance(coords_list, list) and len(coords_list) > 0:
                valid_points = [c for c in coords_list if isinstance(c, list) and len(c) == 2]
                if valid_points:
                    center_lat = sum(c[0] for c in valid_points) / len(valid_points)
                    center_lon = sum(c[1] for c in valid_points) / len(valid_points)
                    center_coords_for_sim = [center_lat, center_lon]
                    
                    soil_values = fetch_pronasolos_data(center_lat, center_lon, parameter.name) # utils.fetch_pronasolos_data
                    value_to_return = soil_values.get(parameter.name)
                    source = "Simulado (Pronasolos)"
                    print(f"Simulação para Area ID {area_id}, Param ID {parameter_id} retornou: {value_to_return}")
                else:
                    source = "Simulado (Coordenadas Inválidas para Centroide)"
                    print(f"Coordenadas inválidas para simulação na Area ID {area_id}.")
            else:
                source = "Simulado (Sem Coordenadas para Centroide)"
                print(f"Sem coordenadas para simulação na Area ID {area_id}.")
        except Exception as e_sim:
            print(f"Erro na simulação de fallback para Area ID {area_id}, Param ID {parameter_id}: {e_sim}")
            source = "Falha na Simulação"
            
    response_data = {
        "area_id": area.id,
        "area_name": area.name,
        "parameter_id": parameter.id,
        "parameter_name": parameter.name,
        "value": value_to_return,
        "unit": parameter.unit or "",
        "analysis_date": analysis_date_to_return,
        "notes": notes_to_return, # Adicionando notas da leitura
        "data_source": source,
        "min_value": parameter.min_value,
        "max_value": parameter.max_value,
        "optimal_min": parameter.optimal_min,
        "optimal_max": parameter.optimal_max
    }
    if center_coords_for_sim:
        response_data["center_coords_used_for_simulation"] = center_coords_for_sim # Nome mais claro
        
    return jsonify(response_data)

@main_bp.route("/api/reports")
def api_reports():
    # ... (seu código de relatórios existente) ...
    # Nenhuma mudança necessária aqui por enquanto, a menos que dependa de como o mapa era gerado
    report_type = request.args.get("report_type")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    area_id_str = request.args.get("area_id")
    parameter_id_str = request.args.get("parameter_id")
    
    if not report_type:
        return "Erro: report_type é obrigatório", 400
    
    area_id = None
    if area_id_str:
        try: area_id = int(area_id_str)
        except ValueError: return "Erro: area_id deve ser um número inteiro", 400
    
    parameter_id = None
    if parameter_id_str:
        try: parameter_id = int(parameter_id_str)
        except ValueError: return "Erro: parameter_id deve ser um número inteiro", 400
    
    csv_data = generate_report_csv(SoilParameter, Area, WeatherData, report_type, start_date, end_date, area_id, parameter_id)
    
    filename = f"relatorio_{report_type}_{datetime.date.today().strftime('%Y%m%d')}.csv"
    
    return Response(
        csv_data.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment;filename={filename}"}
    )

# --- NOVAS ROTAS E MODIFICAÇÕES PARA EDIÇÃO/DELEÇÃO DE ÁREAS ---

@main_bp.route("/api/areas/<int:area_id>", methods=["GET"])
def api_get_specific_area(area_id):
    """Endpoint para obter detalhes de uma área específica, incluindo suas leituras de solo mais recentes."""
    area = Area.query.get_or_404(area_id) # Retorna 404 se não encontrar
    
    soil_readings_data = {}
    # Buscar as leituras mais recentes para os parâmetros principais
    # Idealmente, você teria uma lista definida de parâmetros que quer buscar/exibir
    parameters_to_fetch = SoilParameter.query.filter(SoilParameter.name.in_(['pH', 'Nitrogênio', 'Fósforo', 'Potássio', 'Umidade'])).all()

    latest_analysis_date = None

    for param in parameters_to_fetch:
        latest_reading = SoilAnalysisReading.query.filter_by(
            area_id=area.id,
            parameter_id=param.id
        ).order_by(SoilAnalysisReading.analysis_date.desc(), SoilAnalysisReading.created_at.desc()).first()
        
        if latest_reading:
            soil_readings_data[param.name] = latest_reading.value # Usar o nome do parâmetro como chave
            if latest_reading.analysis_date:
                if latest_analysis_date is None or latest_reading.analysis_date > latest_analysis_date:
                    latest_analysis_date = latest_reading.analysis_date
        else:
            soil_readings_data[param.name] = None # Ou algum valor padrão se não houver leitura

    # Pegar notas da última leitura de qualquer parâmetro (simplificação)
    # Uma abordagem melhor seria ter notas por análise geral ou por área.
    general_notes = None
    if latest_analysis_date:
         some_reading_with_date = SoilAnalysisReading.query.filter_by(area_id=area.id, analysis_date=latest_analysis_date).first()
         if some_reading_with_date:
             general_notes = some_reading_with_date.notes


    output = {
        "id": area.id,
        "name": area.name,
        "description": area.description,
        "coordinates": json.loads(area.coordinates) if area.coordinates else [],
        "size_hectares": area.size_hectares,
        "created_at": area.created_at.isoformat() if area.created_at else None,
        "soil_params": soil_readings_data, # Dicionário com { "pH": valor, "Nitrogênio": valor, ... }
        "analysis_date": latest_analysis_date.isoformat() if latest_analysis_date else None,
        "param_notes": general_notes
    }
    return jsonify(output)


@main_bp.route("/api/areas/<int:area_id>", methods=["PUT"])
def api_update_area(area_id):
    """Endpoint para atualizar uma área existente e suas leituras de solo."""
    area = Area.query.get_or_404(area_id)
    data = request.json

    if not data:
        return jsonify({"error": "Nenhum dado fornecido"}), 400

    # Atualizar campos da Área
    if "name" in data:
        area.name = data["name"]
    if "description" in data:
        area.description = data.get("description") # Permite None
    if "size_hectares" in data:
        try:
            area.size_hectares = float(data["size_hectares"]) if data["size_hectares"] is not None else None
        except (ValueError, TypeError):
            return jsonify({"error": "Tamanho (hectares) inválido"}), 400
    if "coordinates" in data:
        try:
            coords_input = data["coordinates"]
            if isinstance(coords_input, list):
                area.coordinates = json.dumps(coords_input)
            elif isinstance(coords_input, str):
                json.loads(coords_input) # Valida
                area.coordinates = coords_input
            else:
                raise ValueError("Formato de coordenadas inválido")
        except (ValueError, json.JSONDecodeError):
            return jsonify({"error": "Coordenadas inválidas"}), 400

    # Atualizar/Criar Leituras de Solo
    soil_params_input = data.get("soil_params", {})
    analysis_date_str = soil_params_input.get("analysis_date")
    analysis_date_obj = None

    if analysis_date_str:
        try:
            analysis_date_obj = datetime.datetime.strptime(analysis_date_str, "%Y-%m-%d").date()
        except ValueError:
            analysis_date_obj = area.soil_readings.order_by(SoilAnalysisReading.analysis_date.desc()).first().analysis_date if area.soil_readings.count() > 0 else datetime.date.today()
            print(f"Alerta: Data de análise inválida '{analysis_date_str}' para atualização, usando data existente ou atual.")
    else: # Se não fornecer data, usar a data da leitura mais recente para este talhão ou hoje
        # Isso é importante para agrupar as leituras de uma mesma "análise"
        existing_latest_reading = SoilAnalysisReading.query.filter_by(area_id=area.id).order_by(SoilAnalysisReading.analysis_date.desc()).first()
        if existing_latest_reading and existing_latest_reading.analysis_date:
            analysis_date_obj = existing_latest_reading.analysis_date
        else:
            analysis_date_obj = datetime.date.today()


    param_map = {
        "pH": "pH", "Nitrogênio": "Nitrogênio", "Fósforo": "Fósforo",
        "Potássio": "Potássio", "Umidade": "Umidade"
    }

    notes_to_save = soil_params_input.get("notes")

    for param_name_db, input_key in param_map.items(): # input_key é o mesmo que param_name_db aqui
        value_str = soil_params_input.get(input_key) # Frontend envia com o nome do parâmetro (ex: "pH")

        if value_str is not None and value_str != '':
            try:
                value = float(value_str)
                parameter_obj = SoilParameter.query.filter_by(name=param_name_db).first()
                if parameter_obj:
                    # Tenta encontrar uma leitura existente para esta área, parâmetro e data para ATUALIZAR
                    # Se você quiser sempre criar uma nova leitura para um "histórico", remova esta lógica de busca.
                    reading = SoilAnalysisReading.query.filter_by(
                        area_id=area.id,
                        parameter_id=parameter_obj.id,
                        analysis_date=analysis_date_obj 
                    ).first()

                    if reading: # Atualiza existente
                        reading.value = value
                        reading.notes = notes_to_save # Atualiza notas em todas as leituras desta análise
                        reading.created_at = datetime.datetime.utcnow() # Atualiza timestamp
                    else: # Cria nova
                        reading = SoilAnalysisReading(
                            area_id=area.id,
                            parameter_id=parameter_obj.id,
                            value=value,
                            analysis_date=analysis_date_obj,
                            notes=notes_to_save
                        )
                        db.session.add(reading)
                else:
                    print(f"Alerta (Update): Parâmetro '{param_name_db}' não encontrado.")
            except ValueError:
                print(f"Alerta (Update): Valor inválido '{value_str}' para '{param_name_db}'.")
        elif value_str == '': # Se o usuário apagar o valor, podemos remover a leitura ou setar para None
            # Por simplicidade, vamos ignorar campos vazios, o que significa que não são atualizados.
            # Para remover, você precisaria de uma lógica como:
            # parameter_obj = SoilParameter.query.filter_by(name=param_name_db).first()
            # if parameter_obj:
            #    reading = SoilAnalysisReading.query.filter_by(area_id=area.id, parameter_id=parameter_obj.id, analysis_date=analysis_date_obj).first()
            #    if reading: db.session.delete(reading)
            pass


    try:
        db.session.commit()
        # Retornar os dados atualizados da área, incluindo as novas leituras de solo
        return api_get_specific_area(area_id) # Chama a outra rota para formatar a resposta
    except Exception as e:
        db.session.rollback()
        print(f"Erro ao atualizar área {area_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Erro interno ao atualizar área: {str(e)}"}), 500


@main_bp.route("/api/areas/<int:area_id>", methods=["DELETE"])
def api_delete_area(area_id):
    """Endpoint para deletar uma área."""
    area = Area.query.get_or_404(area_id)
    try:
        db.session.delete(area) # Graças ao cascade, as leituras de solo associadas serão deletadas
        db.session.commit()
        return jsonify({"message": f"Área {area_id} e suas leituras de solo foram deletadas com sucesso."}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Erro ao deletar área {area_id}: {str(e)}")
        return jsonify({"error": f"Erro interno ao deletar área: {str(e)}"}), 500
    
@main_bp.route("/api/areas/<int:area_id>/soil_history")
def api_get_soil_history_for_area(area_id):
    area = Area.query.get_or_404(area_id)
    parameter_id_str = request.args.get("parameter_id")
    
    query = SoilAnalysisReading.query.filter_by(area_id=area.id)
    
    if parameter_id_str:
        try:
            parameter_id = int(parameter_id_str)
            query = query.filter_by(parameter_id=parameter_id)
        except ValueError:
            return jsonify({"error": "parameter_id deve ser um inteiro"}), 400
    
    history_readings = query.order_by(SoilAnalysisReading.analysis_date.asc(), SoilAnalysisReading.created_at.asc()).all()
    
    output = []
    for reading in history_readings:
        param_name = reading.parameter.name if reading.parameter else "Desconhecido"
        output.append({
            "reading_id": reading.id,
            "parameter_id": reading.parameter_id,
            "parameter_name": param_name,
            "value": reading.value,
            "unit": reading.parameter.unit if reading.parameter else "",
            "analysis_date": reading.analysis_date.isoformat() if reading.analysis_date else None,
            "notes": reading.notes
        })
    return jsonify(output)

@main_bp.route("/api/soil_readings", methods=["POST"]) # <<< VERIFIQUE ESTA LINHA
def add_soil_reading():
    data = request.json
    required_fields = ["area_id", "parameter_id", "value", "analysis_date"] # analysis_date agora é mais crucial
    if not all(field in data and data[field] is not None and data[field] != '' for field in required_fields):
        # Permite notes ser opcional/vazio
        missing_or_empty = [field for field in required_fields if not (field in data and data[field] is not None and data[field] != '')]
        return jsonify({"error": f"Campos obrigatórios ausentes ou vazios: {', '.join(missing_or_empty)}"}), 400

    try:
        area_id = int(data["area_id"])
        parameter_id = int(data["parameter_id"])
        value = float(data["value"])
        analysis_date_str = data["analysis_date"] # Já verificamos que não é vazio
        
        analysis_date_obj = datetime.datetime.strptime(analysis_date_str, "%Y-%m-%d").date()

        area = Area.query.get(area_id)
        parameter = SoilParameter.query.get(parameter_id)
        if not area or not parameter:
            return jsonify({"error": "Área ou Parâmetro não encontrado"}), 404

        # Se quiser atualizar uma leitura existente para a mesma data, precisaria de lógica aqui.
        # Por agora, estamos sempre criando uma nova leitura para o histórico.
        reading = SoilAnalysisReading(
            area_id=area_id,
            parameter_id=parameter_id,
            value=value,
            analysis_date=analysis_date_obj,
            notes=data.get("notes") # notes é opcional
        )
        db.session.add(reading)
        db.session.commit()
        
        print(f"Nova leitura de solo salva: AreaID {reading.area_id}, ParamID {reading.parameter_id}, Valor {reading.value}, Data {reading.analysis_date}")

        return jsonify({
            "message": "Leitura de solo adicionada com sucesso", 
            "reading_id": reading.id,
            "area_id": reading.area_id,
            "parameter_id": reading.parameter_id,
            "value": reading.value,
            "analysis_date": reading.analysis_date.isoformat()
        }), 201

    except ValueError as ve:
        # Erro de conversão de tipo (int, float) ou formato de data
        return jsonify({"error": f"Valor inválido fornecido: {str(ve)}"}), 400
    except Exception as e:
        db.session.rollback()
        print(f"Erro interno ao adicionar leitura de solo: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Erro interno ao adicionar leitura: {str(e)}"}), 500