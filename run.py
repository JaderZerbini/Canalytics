# -*- coding: utf-8 -*-
from app import create_app, db
from app.models import SoilParameter, Area # Importar modelos para create_simulated_data
from app.utils import create_simulated_data # Importar a função

app = create_app()

if __name__ == "__main__":
    with app.app_context():
        print("Inicializando banco de dados...")
        db.create_all()  # Cria tabelas se não existirem
        
        # Passar db e os modelos para a função create_simulated_data
        create_simulated_data(db, SoilParameter, Area) # Popula com dados simulados se vazio
        
        print("Banco de dados pronto.")
    
    print("Iniciando servidor Flask...")
    print(f"Acesse em: http://127.0.0.1:{app.config.get('PORT', 5000)}")
    app.run(
        debug=app.config.get('DEBUG', True), 
        host=app.config.get('HOST', "0.0.0.0"), 
        port=app.config.get('PORT', 5000)
    )