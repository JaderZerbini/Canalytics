# -*- coding: utf-8 -*-
import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

def create_app(config_object='app.config.Config'):
    """
    Fábrica de aplicativos para criar e configurar a instância do Flask.
    """
    app = Flask(__name__)
    app.config.from_object(config_object)

    db.init_app(app)

    with app.app_context():
        # Importar rotas (Blueprints)
        from . import routes
        app.register_blueprint(routes.main_bp)

        # Importar modelos para que o SQLAlchemy possa encontrá-los
        from . import models 

        # Você pode mover a criação de tabelas e dados simulados para cá
        # se preferir, ou mantê-los em run.py para execução explícita.
        # Exemplo:
        # db.create_all()
        # from .utils import create_simulated_data
        # create_simulated_data(db, models.SoilParameter, models.Area)

    return app