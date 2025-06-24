# -*- coding: utf-8 -*-
import datetime
from . import db # Importa a instância 'db' de app/__init__.py

class SoilParameter(db.Model):
    __tablename__ = "soil_parameters"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    description = db.Column(db.Text, nullable=True)
    unit = db.Column(db.String(20), nullable=True)
    min_value = db.Column(db.Float, nullable=True)
    max_value = db.Column(db.Float, nullable=True)
    optimal_min = db.Column(db.Float, nullable=True)
    optimal_max = db.Column(db.Float, nullable=True)

class Area(db.Model):
    __tablename__ = "areas"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    description = db.Column(db.Text, nullable=True)
    coordinates = db.Column(db.Text, nullable=False)  # JSON string de coordenadas do polígono
    size_hectares = db.Column(db.Float, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.datetime.utcnow)

class WeatherData(db.Model):
    __tablename__ = "weather_data"
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    temperature_max = db.Column(db.Float, nullable=False)
    temperature_min = db.Column(db.Float, nullable=False)
    precipitation = db.Column(db.Float, nullable=True)
    precipitation_probability = db.Column(db.Integer, nullable=True)
    humidity = db.Column(db.Float, nullable=True)
    wind_speed = db.Column(db.Float, nullable=True)
    weather_code = db.Column(db.Integer, nullable=True)
    weather_description = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.datetime.utcnow)

class SoilAnalysisReading(db.Model):
    __tablename__ = "soil_analysis_readings"
    id = db.Column(db.Integer, primary_key=True)
    area_id = db.Column(db.Integer, db.ForeignKey("areas.id", ondelete="CASCADE"), nullable=False)
    parameter_id = db.Column(db.Integer, db.ForeignKey("soil_parameters.id"), nullable=False)
    value = db.Column(db.Float, nullable=False)
    analysis_date = db.Column(db.Date, nullable=False, default=datetime.date.today) # Data da análise/inserção
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.datetime.utcnow)

    area = db.relationship("Area", backref=db.backref("soil_readings", lazy='dynamic', cascade="all, delete-orphan"))
    parameter = db.relationship("SoilParameter", backref=db.backref("soil_readings", lazy='dynamic'))

    def __repr__(self):
        return f'<SoilAnalysisReading for Area {self.area_id} - Param {self.parameter_id}: {self.value}>'