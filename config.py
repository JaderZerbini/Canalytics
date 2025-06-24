# -*- coding: utf-8 -*-
import os

# Define o diretório base do projeto (um nível acima da pasta 'app')
basedir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "sua-chave-secreta-aqui-mais-segura")
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL") or \
        "sqlite:///" + os.path.join(basedir, "monitoramento.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    DEBUG = True # Mude para False em produção
    HOST = "0.0.0.0"
    PORT = 5000