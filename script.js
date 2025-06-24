// SCRIPT.JS - VERSÃO COMPLETA E INTEGRADA (2)

// ==========================================================================
// 1. VARIÁVEIS GLOBAIS
// ==========================================================================
let mapInstance = null;
let drawnItemsLayer = null;
let currentDrawnItem = null;
let areaLayersGroup = null;
let soilDataMarkersGroup = null;
let heatmapLayer = null;
let currentSelectedParameterId = null;
let allParametersData = [];
let allAreasData = [];
let isEditingArea = false;
let currentEditingAreaId = null;
let analysisAreaSelect, analysisParameterSelect, analysisValueInput, analysisInputDate, analysisNotesInput, saveAnalysisBtn, addAnalysisModalEl;
let currentAreaIdForHistory = null;
let soilHistoryModalEl, historyAreaNameEl, historyParameterSelectEl, soilHistoryTableBodyEl;
// Seletores de Elementos do DOM (serão cacheados em cacheDomSelectors)
let areaFormModalEl, areaFormModalLabel, areaForm, saveAreaChangesBtn, deleteAreaBtn,
    areaNameInput, areaDescriptionInput, areaSizeInput, areaAlqueiresDisplay,
    areaCoordinatesDisplayInput, areaCoordinatesInput, paramPhInput, paramNitrogenioInput,
    paramFosforoInput, paramPotassioInput, paramUmidadeInput, analysisDateInput, paramNotesInput,
    paramSelectGlobal, areaSelectGlobal, viewTypeSelectGlobal, refreshWeatherBtnGlobal;

// ==========================================================================
// 2. FUNÇÕES UTILITÁRIAS E DE CONFIGURAÇÃO INICIAL
// ==========================================================================

const loadingOverlay = (id, show) => {
    const mapContainer = document.getElementById(id);
    if (!mapContainer) return;
    let overlay = mapContainer.querySelector('.loading-overlay-dynamic');
    if (show) {
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'loading-overlay loading-overlay-dynamic active';
            overlay.innerHTML = '<div class="spinner-border text-success" role="status"><span class="visually-hidden">Carregando...</span></div>';
            mapContainer.appendChild(overlay);
        }
        overlay.style.display = 'flex';
    } else {
        if (overlay) {
            overlay.style.display = 'none';
        }
    }
};

function initializeDates() {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    const formatDate = (date) => date.toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"][name="end_date"]').forEach(input => {
        if (input) input.value = formatDate(today);
    });
    document.querySelectorAll('input[type="date"][name="start_date"]').forEach(input => {
        if (input) input.value = formatDate(thirtyDaysAgo);
    });
    if (analysisDateInput) analysisDateInput.value = formatDate(today);
    const analysisFormDateInput = document.getElementById('analysis-input-date');
    if (analysisFormDateInput) analysisFormDateInput.value = formatDate(today);
}

function cacheDomSelectors() {
    console.log("Caching DOM Selectors..."); // Log para saber que a função executou    
    areaFormModalEl = document.getElementById('areaFormModal');
    areaFormModalLabel = document.getElementById('areaFormModalLabel');
    areaForm = document.getElementById('area-form');
    saveAreaChangesBtn = document.getElementById('save-area-changes-btn');
    deleteAreaBtn = document.getElementById('delete-area-btn');
    areaNameInput = document.getElementById('area-name');
    areaDescriptionInput = document.getElementById('area-description');
    areaSizeInput = document.getElementById('area-size');
    areaAlqueiresDisplay = document.getElementById('area-alqueires');
    areaCoordinatesDisplayInput = document.getElementById('area-coordinates-display');
    areaCoordinatesInput = document.getElementById('area-coordinates');
    paramPhInput = document.getElementById('param-ph');
    paramNitrogenioInput = document.getElementById('param-nitrogenio');
    paramFosforoInput = document.getElementById('param-fosforo');
    paramPotassioInput = document.getElementById('param-potassio');
    paramUmidadeInput = document.getElementById('param-umidade');
    analysisDateInput = document.getElementById('analysis-date');
    paramNotesInput = document.getElementById('param-notes');
    paramSelectGlobal = document.getElementById('parameter-select');
    areaSelectGlobal = document.getElementById('area-select');
    viewTypeSelectGlobal = document.getElementById('view-type');
    refreshWeatherBtnGlobal = document.getElementById('refresh-weather');
    analysisAreaSelect = document.getElementById('analysis-area-select');
    analysisParameterSelect = document.getElementById('analysis-parameter-select'); 
    analysisValueInput = document.getElementById('analysis-value'); 
    analysisInputDate = document.getElementById('analysis-input-date'); 
    saveAnalysisBtn = document.getElementById('save-analysis-btn');
    analysisNotesInput = document.getElementById('analysis-notes');
    addAnalysisModalEl = document.getElementById('addAnalysisModal'); 
    soilHistoryModalEl = document.getElementById('soilHistoryModal');
    historyAreaNameEl = document.getElementById('history-area-name');
    historyParameterSelectEl = document.getElementById('history-parameter-select');
    soilHistoryTableBodyEl = document.getElementById('soil-history-table-body');

    
    console.log("saveAreaChangesBtn encontrado em cacheDomSelectors:", saveAreaChangesBtn); // Log específico
}

// ==========================================================================
// 3. FUNÇÕES RELACIONADAS AO CLIMA
// ==========================================================================
async function loadWeatherData() {
    const currentWeatherEl = document.getElementById('current-weather');
    const forecastEl = document.getElementById('forecast');
    if (!currentWeatherEl || !forecastEl) {
        console.error("Elementos do clima não encontrados no DOM.");
        return;
    }
    currentWeatherEl.innerHTML = `<div class="text-center"><div class="spinner-border text-primary"></div><p>Carregando clima...</p></div>`;
    forecastEl.innerHTML = `<div class="text-center"><div class="spinner-border text-info"></div><p>Carregando previsão...</p></div>`;
    try {
        const response = await fetch('/api/weather');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status} ao buscar /api/weather`);
        const data = await response.json();
        
        const cw = data.current;
        let weatherIcon = 'fa-sun';
        if (cw.weather_code >= 95) weatherIcon = 'fa-bolt';
        else if (cw.weather_code >= 80) weatherIcon = 'fa-cloud-showers-heavy';
        else if (cw.weather_code >= 60) weatherIcon = 'fa-cloud-rain';
        else if (cw.weather_code >= 45) weatherIcon = 'fa-smog';
        else if (cw.weather_code >= 3) weatherIcon = 'fa-cloud';
        else if (cw.weather_code >= 1) weatherIcon = 'fa-cloud-sun';
        
        currentWeatherEl.innerHTML = `
            <div class="d-flex align-items-center mb-3">
                <div class="me-3"><i class="fas ${weatherIcon} fa-4x text-primary"></i></div>
                <div>
                    <h2 class="mb-0">${cw.temperature !== undefined ? cw.temperature.toFixed(1) + '°C' : 'N/A'}</h2>
                    <p class="mb-0">${cw.weather_description || 'N/A'}</p>
                </div>
            </div>
            <div class="row">
                <div class="col-sm-6 col-md-12 col-lg-4 mb-2 mb-lg-0"><p><i class="fas fa-tint me-2 text-primary"></i> Umid: ${cw.humidity !== undefined ? cw.humidity + '%' : 'N/A'}</p></div>
                <div class="col-sm-6 col-md-12 col-lg-4 mb-2 mb-lg-0"><p><i class="fas fa-wind me-2 text-primary"></i> Vento: ${cw.wind_speed !== undefined ? cw.wind_speed + ' km/h' : 'N/A'}</p></div>
                <div class="col-sm-12 col-md-12 col-lg-4"><p><i class="fas fa-cloud-rain me-2 text-primary"></i> Precip: ${cw.precipitation !== undefined ? cw.precipitation + ' mm' : 'N/A'}</p></div>
            </div>`;

        let forecastHtml = '<div class="row">';
        if (data.forecast && Array.isArray(data.forecast)) {
            data.forecast.forEach(day => {
                let dayIcon = 'fa-sun';
                if (day.weather_code >= 95) dayIcon = 'fa-bolt';
                else if (day.weather_code >= 80) dayIcon = 'fa-cloud-showers-heavy';
                else if (day.weather_code >= 60) dayIcon = 'fa-cloud-rain';
                else if (day.weather_code >= 45) dayIcon = 'fa-smog';
                else if (day.weather_code >= 3) dayIcon = 'fa-cloud';
                else if (day.weather_code >= 1) dayIcon = 'fa-cloud-sun';
                
                let tempClass = 'text-primary';
                if (day.temperature_max > 30) tempClass = 'text-danger';
                else if (day.temperature_max > 25) tempClass = 'text-warning';
                
                forecastHtml += `
                    <div class="col-sm-6 col-lg-12 col-xl-6 mb-3">
                        <div class="card forecast-card h-100">
                            <div class="card-header bg-light">
                                <h6 class="card-title mb-0">${day.day_of_week || 'N/A'}</h6>
                                <small class="text-muted">${day.date ? day.date.substring(5).replace('-', '/') : 'N/A'}</small>
                            </div>
                            <div class="card-body text-center">
                                <div class="mb-2"><i class="fas ${dayIcon} fa-2x text-primary"></i><div><small>${day.weather_description || 'N/A'}</small></div></div>
                                <div class="row">
                                    <div class="col-6"><div class="fw-bold ${tempClass}">${day.temperature_max !== undefined ? day.temperature_max.toFixed(1) + '°C' : 'N/A'}</div><div class="small">Máx</div></div>
                                    <div class="col-6"><div class="fw-bold text-info">${day.temperature_min !== undefined ? day.temperature_min.toFixed(1) + '°C' : 'N/A'}</div><div class="small">Mín</div></div>
                                </div>
                            </div>
                            <div class="card-footer bg-light small">
                                <div class="d-flex justify-content-between">
                                    <div><i class="fas fa-tint text-primary"></i> ${day.precipitation_probability !== undefined ? day.precipitation_probability + '%' : 'N/A'}</div>
                                    <div><i class="fas fa-cloud-rain text-primary"></i> ${day.precipitation !== undefined ? day.precipitation + ' mm' : 'N/A'}</div>
                                </div>
                            </div>
                        </div>
                    </div>`;
            });
        }
        forecastHtml += '</div>';
        forecastEl.innerHTML = forecastHtml;
    } catch (error) {
        console.error('Erro ao carregar clima:', error);
        const errorMsg = `<div class="alert alert-danger"><i class="fas fa-exclamation-circle me-2"></i>Erro ao carregar clima. ${error.message || ''} <button class="btn btn-sm btn-outline-danger mt-1" onclick="loadWeatherData()"><i class="fas fa-sync-alt me-1"></i> Tentar</button></div>`;
        currentWeatherEl.innerHTML = errorMsg;
        forecastEl.innerHTML = errorMsg.replace("clima", "previsão");
    }
}

// ==========================================================================
// 4. FUNÇÕES PRINCIPAIS DO MAPA
// ==========================================================================
function initializeLeafletMap() {
    console.log("Inicializando mapa Leaflet...");
    const mapContainer = document.getElementById('map-container');
    if (!mapContainer) {
        console.error("Elemento #map-container não encontrado!");
        return;
    }
    const initialLoadingOverlay = mapContainer.querySelector('.loading-overlay-dynamic');
    if (initialLoadingOverlay) initialLoadingOverlay.remove();

    if (mapInstance) {
        mapInstance.remove();
        mapInstance = null;
    }
    mapInstance = L.map('map-container').setView([-21.510037, -51.066347], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapInstance);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxZoom: 18,
        id: 'esri-satellite'
    }).addTo(mapInstance); 

    drawnItemsLayer = new L.FeatureGroup().addTo(mapInstance); 
    areaLayersGroup = new L.FeatureGroup().addTo(mapInstance); 
    soilDataMarkersGroup = new L.FeatureGroup().addTo(mapInstance); 

    const drawControl = new L.Control.Draw({
        edit: { featureGroup: drawnItemsLayer, remove: true },
        draw: {
            polygon: true, rectangle: true,
            polyline: false, circle: false, marker: false, circlemarker: false
        }
    });
    mapInstance.addControl(drawControl);

    mapInstance.on(L.Draw.Event.CREATED, function (e) {
        const layer = e.layer;
        drawnItemsLayer.clearLayers(); 
        drawnItemsLayer.addLayer(layer);
        currentDrawnItem = layer; 

        let coordinates;
        let areaMetrosQuadrados = 0;

        if (layer instanceof L.Polygon || layer instanceof L.Rectangle) {
            const latLngs = (layer instanceof L.Polygon) ? layer.getLatLngs()[0] : layer.getLatLngs();
            coordinates = latLngs.map(latLng => [parseFloat(latLng.lat.toFixed(6)), parseFloat(latLng.lng.toFixed(6))]);
            
            if (coordinates && coordinates.length > 0) {
                const firstPoint = coordinates[0];
                const lastPoint = coordinates[coordinates.length - 1];
                if (firstPoint && lastPoint && (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1])) {
                    coordinates.push([...firstPoint]); 
                }

                if (typeof L.GeometryUtil !== 'undefined' && L.GeometryUtil.geodesicArea) {
                    const leafletLatLngs = latLngs.map(p => L.latLng(p.lat, p.lng));
                    areaMetrosQuadrados = L.GeometryUtil.geodesicArea(leafletLatLngs);
                } else if (typeof turf !== 'undefined' && coordinates && coordinates.length > 2) {
                    try {
                        const turfCoords = coordinates.map(coord => [coord[1], coord[0]]); 
                        const turfPolygon = turf.polygon([turfCoords]);
                        areaMetrosQuadrados = turf.area(turfPolygon);
                    } catch (turfError) { console.error("Erro ao calcular área com Turf.js (CREATED):", turfError); }
                }
            }
        }
        
        if(areaCoordinatesInput) areaCoordinatesInput.value = JSON.stringify(coordinates || []);
        if(areaCoordinatesDisplayInput) areaCoordinatesDisplayInput.value = JSON.stringify(coordinates || [], null, 2);
        
        const areaHectares = (areaMetrosQuadrados / 10000).toFixed(2);
        if(areaSizeInput) areaSizeInput.value = areaHectares;

        const alqueiresPaulista = (parseFloat(areaHectares) / 2.42).toFixed(2);
        if (areaAlqueiresDisplay) areaAlqueiresDisplay.textContent = alqueiresPaulista;
        
        if(saveAreaChangesBtn) {
            saveAreaChangesBtn.disabled = false; 
            console.log("Botão Salvar HABILITADO após desenho. Estado disabled:", saveAreaChangesBtn.disabled);}
        else {
            console.error("Botão Salvar (saveAreaChangesBtn) não encontrado no evento CREATED.");  
        }    
        });

    mapInstance.on(L.Draw.Event.EDITED, function (e) {
        console.log("Evento EDITED disparado");
        e.layers.eachLayer(function (layer) { 
            currentDrawnItem = layer; 
            
            let coordinates;
            let areaMetrosQuadrados = 0;

            if (layer instanceof L.Polygon || layer instanceof L.Rectangle) {
                const latLngs = (layer instanceof L.Polygon) ? layer.getLatLngs()[0] : layer.getLatLngs();
                coordinates = latLngs.map(latLng => [parseFloat(latLng.lat.toFixed(6)), parseFloat(latLng.lng.toFixed(6))]);
                
                if (coordinates && coordinates.length > 0) {
                    const firstPoint = coordinates[0];
                    const lastPoint = coordinates[coordinates.length - 1];
                    if (firstPoint && lastPoint && (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1])) {
                        coordinates.push([...firstPoint]);
                    }

                    if (typeof L.GeometryUtil !== 'undefined' && L.GeometryUtil.geodesicArea) {
                        const leafletLatLngs = latLngs.map(p => L.latLng(p.lat, p.lng));
                        areaMetrosQuadrados = L.GeometryUtil.geodesicArea(leafletLatLngs);
                    } else if (typeof turf !== 'undefined' && coordinates && coordinates.length > 2) {
                        try {
                            const turfCoords = coordinates.map(coord => [coord[1], coord[0]]);
                            const turfPolygon = turf.polygon([turfCoords]);
                            areaMetrosQuadrados = turf.area(turfPolygon);
                        } catch (turfError) { console.error("Erro ao calcular área com Turf.js (EDITED):", turfError); }
                    }
                }
            }
            
            if(areaCoordinatesInput) areaCoordinatesInput.value = JSON.stringify(coordinates || []);
            if(areaCoordinatesDisplayInput) areaCoordinatesDisplayInput.value = JSON.stringify(coordinates || [], null, 2);
            
            const areaHectares = (areaMetrosQuadrados / 10000).toFixed(2);
            if(areaSizeInput) areaSizeInput.value = areaHectares;

            const alqueiresPaulista = (parseFloat(areaHectares) / 2.42).toFixed(2);
            if (areaAlqueiresDisplay) areaAlqueiresDisplay.textContent = alqueiresPaulista;

            console.log("Área editada, coordenadas e área atualizadas no formulário.");
        });
    });

    mapInstance.on(L.Draw.Event.DELETED, function (e) {
        console.log("Evento DELETED disparado. Área desenhada foi removida do mapa.");
        currentDrawnItem = null;
        
        if(areaCoordinatesInput) areaCoordinatesInput.value = '';
        if(areaCoordinatesDisplayInput) areaCoordinatesDisplayInput.value = '';
        if(areaSizeInput) areaSizeInput.value = '';
        if (areaAlqueiresDisplay) areaAlqueiresDisplay.textContent = '0.00';
        
        if(saveAreaChangesBtn) saveAreaChangesBtn.disabled = true; 
    });
    console.log("Mapa Leaflet e controles de desenho inicializados.");
}

async function fetchAllParameters() {
    try {
        const response = await fetch('/api/parameters');
        if (!response.ok) throw new Error('Falha ao buscar parâmetros');
        allParametersData = await response.json();
        console.log("Parâmetros carregados:", allParametersData);
        
        if(paramSelectGlobal){
            paramSelectGlobal.innerHTML = '<option value="">Selecione Parâmetro</option>';
            allParametersData.forEach(p => paramSelectGlobal.innerHTML += `<option value="${p.id}">${p.name}</option>`);
            if (allParametersData.length > 0) {
                paramSelectGlobal.value = allParametersData[0].id.toString();
                currentSelectedParameterId = allParametersData[0].id.toString();
            }
        }

        const soilParamSelect = document.getElementById('soil-parameter');
         if(soilParamSelect){
            soilParamSelect.innerHTML = '<option value="">Todos os Parâmetros</option>';
            allParametersData.forEach(p => soilParamSelect.innerHTML += `<option value="${p.id}">${p.name}</option>`);
         }
    } catch (error) {
        console.error("Erro ao carregar parâmetros:", error);
    }
}

async function fetchAllAreas() {
    try {
        const response = await fetch('/api/areas');
        if (!response.ok) throw new Error('Falha ao buscar áreas');
        allAreasData = await response.json();
        console.log("Áreas carregadas:", allAreasData);
        
        if(areaSelectGlobal){
            areaSelectGlobal.innerHTML = '<option value="">Todas as Áreas</option>';
            allAreasData.forEach(a => areaSelectGlobal.innerHTML += `<option value="${a.id}">${a.name}</option>`);
        }
        
        const soilAreaSelect = document.getElementById('soil-area');
        if(soilAreaSelect){
            soilAreaSelect.innerHTML = '<option value="">Todas as Áreas</option>';
            allAreasData.forEach(a => soilAreaSelect.innerHTML += `<option value="${a.id}">${a.name}</option>`);
        }
    } catch (error) {
        console.error("Erro ao carregar áreas:", error);
    }
}

async function displayAreasOnMap(areasToDisplay) {
    if (!mapInstance || !areaLayersGroup) {
        console.warn("displayAreasOnMap: Instância do mapa ou grupo de camadas de área não está pronto.");
        return;
    }
    areaLayersGroup.clearLayers(); // Limpa talhões antigos antes de redesenhar

    console.log("Exibindo áreas no mapa:", areasToDisplay.length > 0 ? areasToDisplay : "Nenhuma área para exibir");

    for (const area of areasToDisplay) { 
        if (area.coordinates && Array.isArray(area.coordinates) && area.coordinates.length > 0) {
            let fillColor = 'rgba(0, 0, 255, 0.2)'; // Azul translúcido padrão para o polígono
            let fillOpacity = 0.2;
            let basePopupContent = `<b>${area.name}</b><br>
                                  ${area.description || ''}<br>
                                  Tamanho: ${area.size_hectares !== null && area.size_hectares !== undefined ? area.size_hectares.toFixed(2) : 'N/A'} ha`;
            let soilParamInfoForPopup = ""; // Informação do parâmetro de solo para o popup

            // Se um parâmetro estiver selecionado, busca dados para colorir o polígono e adicionar ao popup
            if (currentSelectedParameterId && currentSelectedParameterId !== "") {
                try {
                    const soilDataResponse = await fetch(`/api/soil_data?area_id=${area.id}&parameter_id=${currentSelectedParameterId}`);
                    if (soilDataResponse.ok) {
                        const soilData = await soilDataResponse.json();
                        if (soilData && soilData.value !== null && typeof soilData.value !== 'undefined') {
                            // Usar os detalhes do parâmetro retornados pela API /api/soil_data
                            const parameterDetails = { 
                                min_value: soilData.min_value, 
                                max_value: soilData.max_value, 
                                optimal_min: soilData.optimal_min, 
                                optimal_max: soilData.optimal_max
                            };
                            fillColor = getMarkerColorForValue(soilData.value, parameterDetails);
                            fillOpacity = 0.6; // Aumenta a opacidade para a cor ser mais visível
                            soilParamInfoForPopup = `<br><hr style="margin: 2px 0;" />${soilData.parameter_name}: ${soilData.value} ${soilData.unit || ''}`;
                        } else {
                            // console.log(`Valor nulo/indefinido para param ${currentSelectedParameterId} na área ${area.id}. Usando cor padrão.`);
                        }
                    } else {
                        console.warn(`Falha ao buscar dados de solo para colorir polígono da área ${area.id}, param ${currentSelectedParameterId}. Status: ${soilDataResponse.status}`);
                    }
                } catch (error) {
                    console.error(`Erro no fetch para colorir polígono da área ${area.id}:`, error);
                }
            }
            
            const fullPopupContent = basePopupContent + soilParamInfoForPopup + 
                `<br><hr style="margin: 5px 0;"/>
                 <div class="d-flex justify-content-start mt-1"> <!-- Flex container para botões -->
                     <button class="btn btn-sm btn-outline-primary me-2 edit-area-btn" data-area-id="${area.id}">
                         <i class="fas fa-edit"></i> Editar
                     </button>
                     <button class="btn btn-sm btn-outline-info view-history-btn" data-area-id="${area.id}">
                         <i class="fas fa-history"></i> Histórico
                     </button>
                 </div>`;

            try {
                // Tenta criar o polígono. As coordenadas devem ser [[lat,lng], [lat,lng]...]
                // ou para multipolígonos [[[lat,lng],...], [[lat,lng],...]]
                // Para um polígono simples, L.polygon espera um array de LatLngs ou um array de arrays [lat,lng]
                let polygonCoords = area.coordinates;
                // Adiciona uma verificação: se o primeiro elemento de area.coordinates também for um array,
                // e o primeiro elemento desse array interno NÃO for um número, então provavelmente é um multipolígono
                // ou um polígono com buracos, e L.polygon pode precisar apenas do primeiro anel para um polígono simples.
                // Para simplificar, assumimos que area.coordinates é para um polígono simples.
                if (Array.isArray(area.coordinates[0]) && Array.isArray(area.coordinates[0][0]) && area.coordinates.length === 1) {
                    polygonCoords = area.coordinates[0]; // Pega o primeiro (e único) anel de coordenadas
                }


                const polygon = L.polygon(polygonCoords, {
                    color: 'darkblue', // Cor da borda do polígono
                    weight: 2,
                    fillColor: fillColor, 
                    fillOpacity: fillOpacity,
                    // dashArray: '5, 5' // Linha tracejada, se desejar
                })
                .bindPopup(fullPopupContent, {minWidth: 230, maxHeight: 300}) // Adicionado maxHeight
                .addTo(areaLayersGroup);

            } catch (e) {
                console.error("Erro ao criar polígono para área ID:", area.id, "Coordenadas problemáticas:", area.coordinates, "Erro:", e);
            }      
        } // Fecha if (area.coordinates && ...)
    } // Fecha for (const area of areasToDisplay)
} // Fecha a função displayAreasOnMap


async function fetchAndDisplaySoilDataForArea(areaId, parameterId) {
     if (!mapInstance || !soilDataMarkersGroup) {
        console.warn("fetchAndDisplaySoilDataForArea: Instância do mapa ou grupo de marcadores não está pronto.");
        return null;
    }
    if (!parameterId || parameterId === "") { 
        console.warn(`fetchAndDisplaySoilDataForArea chamado para area ${areaId} sem um parameterId válido.`);
        return null;
    }
    
    try {
        const apiUrl = `/api/soil_data?area_id=${areaId}&parameter_id=${parameterId}`;
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            console.warn(`Não foi possível obter dados de solo para area ${areaId} e parametro ${parameterId}. Status: ${response.status}. URL: ${apiUrl}`);
            return null;
        }
        const data = await response.json();
        console.log(`Dados de solo recebidos para Área ID ${data.area_id} (${data.area_name}), Param ID ${data.parameter_id} (${data.parameter_name}):`, data.value, data.unit);

        if (data.value === null || typeof data.value === 'undefined') {
            console.log(`Valor nulo ou indefinido para ${data.parameter_name} na área ${data.area_name}.`);
            return data; 
        }

        const area = allAreasData.find(a => a.id == areaId); 
        if (!area || !area.coordinates || area.coordinates.length === 0) {
            console.warn("fetchAndDisplaySoilDataForArea: Área não encontrada ou sem coordenadas em allAreasData para ID:", areaId);
            return data;
        }

        let center;
        try {
            let polygonForBounds;
            if (Array.isArray(area.coordinates[0]) && typeof area.coordinates[0][0] === 'number') {
                polygonForBounds = L.polygon(area.coordinates);
            } else if (Array.isArray(area.coordinates[0]) && Array.isArray(area.coordinates[0][0])) {
                polygonForBounds = L.polygon(area.coordinates[0]);
            } else {
                 console.warn("Formato de coordenadas da área não reconhecido para cálculo de bounds:", area.id, area.coordinates);
                 return data; 
            }
            if (!polygonForBounds.getBounds().isValid()) {
                console.warn("Bounds inválidos para área ID:", areaId, "Coordenadas:", area.coordinates);
                return data;
            }
            center = polygonForBounds.getBounds().getCenter();
        } catch(e){
            console.error("Erro ao calcular centroide para área ID:", areaId, e, "Coordenadas:", area.coordinates);
            return data;
        }
        
        const parameterDetailsFromData = {
            min_value: data.min_value, max_value: data.max_value,
            optimal_min: data.optimal_min, optimal_max: data.optimal_max
        };
        
        const viewType = viewTypeSelectGlobal ? viewTypeSelectGlobal.value : 'markers';
        if (viewType === 'markers' || viewType === 'both') {
            // console.log(`Adicionando marcador para Área: ${data.area_name}, Parâmetro: ${data.parameter_name}, Valor: ${data.value}`);
            L.marker(center, {
                icon: L.AwesomeMarkers.icon({
                    icon: 'info-circle',
                    markerColor: getMarkerColorForValue(data.value, parameterDetailsFromData),
                    prefix: 'fa'
                })
            })
            .bindPopup(`<b>${data.area_name}</b><br>${data.parameter_name}: ${data.value} ${data.unit || ''}`)
            .addTo(soilDataMarkersGroup);
        }
        return data; 
    } catch (error) {
        console.error(`Erro GERAL em fetchAndDisplaySoilDataForArea para área ${areaId}, param ${parameterId}:`, error);
        return null;
    }
}

function getMarkerColorForValue(value, parameterDetails) {
    if (value === null || typeof value === 'undefined') {
        return 'cadetblue'; 
    }
    if (!parameterDetails || 
        parameterDetails.optimal_min === null || parameterDetails.optimal_max === null ||
        parameterDetails.min_value === null || parameterDetails.max_value === null) {
        return 'blue'; 
    }
    const val = parseFloat(value);
    if (isNaN(val)) return 'cadetblue'; // Se o valor não for um número após parseFloat

    if (val < parameterDetails.min_value || val > parameterDetails.max_value) {
        return 'red'; 
    } else if (val < parameterDetails.optimal_min || val > parameterDetails.optimal_max) {
        return 'orange'; 
    } else {
        return 'green'; 
    }
}

async function updateMapDisplay() {
    console.log("Atualizando display do mapa...");
    if (!mapInstance) {
        console.log("Instância do mapa não pronta para updateMapDisplay.");
        return;
    }
    loadingOverlay('map-container', true);

    currentSelectedParameterId = paramSelectGlobal ? paramSelectGlobal.value : null;
    const selectedAreaId = areaSelectGlobal ? areaSelectGlobal.value : null;
    const viewType = viewTypeSelectGlobal ? viewTypeSelectGlobal.value : 'markers';

    // Limpar camadas de dados ANTES de redesenhar polígonos ou buscar novos dados
    areaLayersGroup.clearLayers(); 
    soilDataMarkersGroup.clearLayers(); 
    if (heatmapLayer) {
        mapInstance.removeLayer(heatmapLayer);
        heatmapLayer = null;
    }

    let areasToProcess = allAreasData;
    if (selectedAreaId && selectedAreaId !== "") { // Se uma área específica for selecionada
        areasToProcess = allAreasData.filter(a => a.id == selectedAreaId);
        if (areasToProcess.length > 0 && areasToProcess[0].coordinates && areasToProcess[0].coordinates.length > 0) {
            try {
                let polygonForBounds;
                 if (Array.isArray(areasToProcess[0].coordinates[0]) && typeof areasToProcess[0].coordinates[0][0] === 'number') {
                    polygonForBounds = L.polygon(areasToProcess[0].coordinates);
                } else if (Array.isArray(areasToProcess[0].coordinates[0]) && Array.isArray(areasToProcess[0].coordinates[0][0])) {
                    polygonForBounds = L.polygon(areasToProcess[0].coordinates[0]);
                }
                if (polygonForBounds) {
                    const bounds = polygonForBounds.getBounds();
                    if (bounds.isValid()) mapInstance.fitBounds(bounds);
                }
            } catch(e){ console.error("Erro ao ajustar bounds para área selecionada:", e); }
        }
    }
    
    // Desenha os polígonos das áreas (agora coloridos se parâmetro selecionado)
    // e também adiciona marcadores se viewType permitir
    await displayAreasOnMap(areasToProcess); 

    // Lógica para Heatmap (se viewType for heatmap ou both)
    // Os dados de solo já foram buscados (e marcadores adicionados, se aplicável) por displayAreasOnMap
    // Agora, precisamos coletar esses dados para o heatmap, ou refazer o fetch
    if (currentSelectedParameterId && currentSelectedParameterId !== "" && (viewType === 'heatmap' || viewType === 'both')) {
        console.log("Preparando dados para heatmap...");
        
        const soilDataPromisesForHeatmap = areasToProcess.map(area =>
            // Re-fetch para garantir os dados mais recentes para o heatmap,
            // ou você poderia armazenar os resultados de displayAreasOnMap
            fetch(`/api/soil_data?area_id=${area.id}&parameter_id=${currentSelectedParameterId}`)
                .then(res => res.ok ? res.json() : null)
                .catch(err => { console.error("Erro no fetch para heatmap:", err); return null; })
        );
        const soilDataResultsForHeatmap = (await Promise.all(soilDataPromisesForHeatmap)).filter(data => data && data.value !== null && typeof data.value !== 'undefined');
        
        if (soilDataResultsForHeatmap.length > 0) {
            const heatPoints = soilDataResultsForHeatmap.map(data => {
                const areaForCoords = allAreasData.find(a => a.id === data.area_id);
                if (areaForCoords && areaForCoords.coordinates && areaForCoords.coordinates.length > 0) {
                     try {
                        const center = L.polygon( (Array.isArray(areaForCoords.coordinates[0]) && typeof areaForCoords.coordinates[0][0] === 'number') ? areaForCoords.coordinates : areaForCoords.coordinates[0] ).getBounds().getCenter();
                        return [center.lat, center.lng, parseFloat(data.value) || 0.1];
                     } catch (e) {
                         console.error("Erro ao calcular centro para heatmap ponto, área ID:", areaForCoords.id, e);
                         return null;
                     }
                }
                return null;
            }).filter(p => p !== null);

            if (heatPoints.length > 0) {
                heatmapLayer = L.heatLayer(heatPoints, { radius: 35, blur: 25, maxZoom: 17 }).addTo(mapInstance);
            } else {
                 console.log("Nenhum ponto válido para o heatmap após mapeamento.");
            }
        } else {
            console.log("Nenhum dado de solo válido para gerar heatmap.");
        }
    }
    
    // Se a visualização for APENAS heatmap, e displayAreasOnMap adicionou marcadores, limpe-os.
    if (viewType === 'heatmap' && soilDataMarkersGroup) {
        // console.log("Visualização é apenas heatmap, limpando marcadores de dados de solo.");
        // A lógica em fetchAndDisplaySoilDataForArea já cuida de não adicionar marcadores se viewType não for 'markers' ou 'both'
        // Mas para garantir que NENHUM marcador apareça se for SÓ heatmap:
        soilDataMarkersGroup.clearLayers();
    }

    loadingOverlay('map-container', false);
    console.log("Display do mapa atualizado.");
}

// ==========================================================================
// 5. FUNÇÕES PARA MANIPULAR O MODAL E FORMULÁRIO DE ÁREA (CRIAR/EDITAR)
// ==========================================================================
function prepareModalForCreate() {
    console.log("Preparando modal para CRIAR NOVO talhão.");
    isEditingArea = false;
    currentEditingAreaId = null;

    if (areaFormModalLabel) areaFormModalLabel.textContent = 'Novo Talhão';
    
    if (!currentDrawnItem) { 
        if (areaForm) areaForm.reset();
        if (areaCoordinatesDisplayInput) areaCoordinatesDisplayInput.placeholder = "Desenhe a área no mapa.";
        if (areaCoordinatesInput) areaCoordinatesInput.value = '';
        if (areaSizeInput) areaSizeInput.value = '';
        if (areaAlqueiresDisplay) areaAlqueiresDisplay.textContent = '0.00';
        if (saveAreaChangesBtn) saveAreaChangesBtn.disabled = true;
    } else {
        // Se há um currentDrawnItem, o botão de salvar deve estar habilitado
        // (o evento CREATED já deve ter feito isso, mas garantimos aqui)
        console.log("currentDrawnItem existe, mantendo dados do desenho e habilitando salvar.");
        if (saveAreaChangesBtn) saveAreaChangesBtn.disabled = false;
    }
    
    if (analysisDateInput) initializeDates(); // Reseta data de análise para hoje
    if (deleteAreaBtn) deleteAreaBtn.style.display = 'none'; 

    // Não limpar drawnItemsLayer aqui, pois pode conter o desenho que o usuário quer salvar.
    // Ele será limpo após o salvamento ou se o usuário cancelar/desenhar de novo.
    console.log("Modal preparado para criar. currentDrawnItem:", currentDrawnItem);
}

async function prepareModalForEdit(areaId) {
    isEditingArea = true;
    currentEditingAreaId = areaId;

    if (!areaId) {
        console.error("ID da área para edição não fornecido.");
        prepareModalForCreate(); 
        return;
    }
    console.log("Preparando modal para editar área ID:", areaId);
    loadingOverlay('map-container', true); // Mostrar loading enquanto busca

    try {
        const response = await fetch(`/api/areas/${areaId}`);
        if (!response.ok) {
            throw new Error(`Falha ao buscar dados da área ${areaId}. Status: ${response.status}`);
        }
        const areaData = await response.json();
        console.log("Dados da área para edição:", areaData);

        if (areaFormModalLabel) areaFormModalLabel.textContent = `Editar Talhão: ${areaData.name || 'Sem Nome'}`;
        if (areaForm) areaForm.reset();

        if (areaNameInput) areaNameInput.value = areaData.name || '';
        if (areaDescriptionInput) areaDescriptionInput.value = areaData.description || '';
        if (areaSizeInput) areaSizeInput.value = areaData.size_hectares !== null && areaData.size_hectares !== undefined ? areaData.size_hectares.toFixed(2) : '';
        
        const hectares = parseFloat(areaData.size_hectares) || 0;
        const alqueires = (hectares / 2.42).toFixed(2);
        if (areaAlqueiresDisplay) areaAlqueiresDisplay.textContent = alqueires;

        if (areaCoordinatesInput) areaCoordinatesInput.value = JSON.stringify(areaData.coordinates || []);
        if (areaCoordinatesDisplayInput) areaCoordinatesDisplayInput.value = JSON.stringify(areaData.coordinates || [], null, 2);

        // Preencher parâmetros de solo
        if (areaData.soil_params) {
            if (paramPhInput) paramPhInput.value = areaData.soil_params.pH !== null && areaData.soil_params.pH !== undefined ? areaData.soil_params.pH : '';
            if (paramNitrogenioInput) paramNitrogenioInput.value = areaData.soil_params.Nitrogênio !== null && areaData.soil_params.Nitrogênio !== undefined ? areaData.soil_params.Nitrogênio : '';
            if (paramFosforoInput) paramFosforoInput.value = areaData.soil_params.Fósforo !== null && areaData.soil_params.Fósforo !== undefined ? areaData.soil_params.Fósforo : '';
            if (paramPotassioInput) paramPotassioInput.value = areaData.soil_params.Potássio !== null && areaData.soil_params.Potássio !== undefined ? areaData.soil_params.Potássio : '';
            if (paramUmidadeInput) paramUmidadeInput.value = areaData.soil_params.Umidade !== null && areaData.soil_params.Umidade !== undefined ? areaData.soil_params.Umidade : '';
        }
        if (analysisDateInput) analysisDateInput.value = areaData.analysis_date || new Date().toISOString().split('T')[0]; // Default para hoje se nulo
        if (paramNotesInput) paramNotesInput.value = areaData.param_notes || '';
        
        if (saveAreaChangesBtn) {
            saveAreaChangesBtn.textContent = 'Salvar Alterações';
            saveAreaChangesBtn.disabled = false; 
        }
        if (deleteAreaBtn) deleteAreaBtn.style.display = 'inline-block'; 

        if(drawnItemsLayer) drawnItemsLayer.clearLayers(); 
        if (areaData.coordinates && areaData.coordinates.length > 0) {
            try {
                const editLayer = L.polygon(areaData.coordinates); 
                drawnItemsLayer.addLayer(editLayer);
                currentDrawnItem = editLayer; 
                // mapInstance.fitBounds(editLayer.getBounds()); // Opcional
            } catch (e) {
                console.error("Erro ao adicionar polígono da área para edição no mapa:", e, areaData.coordinates);
            }
        } else {
            currentDrawnItem = null; 
             if (areaCoordinatesDisplayInput) areaCoordinatesDisplayInput.placeholder = "Sem coordenadas. Desenhe uma nova forma.";
        }
        loadingOverlay('map-container', false);
    } catch (error) {
        console.error("Erro ao preparar modal para edição:", error);
        alert(`Erro ao carregar dados do talhão: ${error.message}`);
        prepareModalForCreate(); 
        const modalInstance = bootstrap.Modal.getInstance(areaFormModalEl);
        if(modalInstance) modalInstance.hide();
        loadingOverlay('map-container', false);
    }
}

async function handleSaveAreaChanges() {
     alert("handleSaveAreaChanges FOI CHAMADA!"); // Alerta para teste rápido
    console.log("handleSaveAreaChanges disparado! isEditing:", isEditingArea, "currentEditingAreaId:", currentEditingAreaId);
    const name = areaNameInput.value;
    const description = areaDescriptionInput.value;
    const size = areaSizeInput.value;
    
    let coordinatesToSave;
    if (currentDrawnItem && drawnItemsLayer.hasLayer(currentDrawnItem)) {
        const layer = currentDrawnItem;
        if (layer instanceof L.Polygon || layer instanceof L.Rectangle) {
            const latLngs = (layer instanceof L.Polygon) ? layer.getLatLngs()[0] : layer.getLatLngs();
            coordinatesToSave = latLngs.map(latLng => [parseFloat(latLng.lat.toFixed(6)), parseFloat(latLng.lng.toFixed(6))]);
            if (coordinatesToSave && coordinatesToSave.length > 0) { 
                const firstPoint = coordinatesToSave[0];
                const lastPoint = coordinatesToSave[coordinatesToSave.length - 1];
                if (firstPoint && lastPoint && (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1])) {
                    coordinatesToSave.push([...firstPoint]);
                }
            }
        }
    } else if (areaCoordinatesInput && areaCoordinatesInput.value) { 
        try { coordinatesToSave = JSON.parse(areaCoordinatesInput.value); } 
        catch(e) { console.error("Coordenadas no input oculto são inválidas:", e); coordinatesToSave = []; }
    } else { // Se não há desenho e nem coordenadas no input (caso de edição onde geometria não foi tocada mas queremos salvar outros dados)
        if (isEditingArea && currentEditingAreaId) {
            const originalArea = allAreasData.find(a => a.id == currentEditingAreaId);
            if (originalArea) coordinatesToSave = originalArea.coordinates; // Usa as coordenadas originais
        }
    }


    if (!name) { alert('Nome é obrigatório.'); 
        console.log("Validação falhou: nome não pode ser vazio.");
        return; }
    if (!coordinatesToSave || coordinatesToSave.length === 0) { 
        if (!isEditingArea) { // Para novo talhão, coordenadas são essenciais (do desenho)
            alert('Coordenadas são obrigatórias. Desenhe uma área no mapa.'); return;
        }
        // Se editando, e não há coordenadas novas nem antigas válidas, é um problema.
        // Mas a lógica acima tenta pegar as originais se não houver currentDrawnItem.
    }

    const soilParams = {
        "pH": paramPhInput ? paramPhInput.value : null,
        "Nitrogênio": paramNitrogenioInput ? paramNitrogenioInput.value : null,
        "Fósforo": paramFosforoInput ? paramFosforoInput.value : null,
        "Potássio": paramPotassioInput ? paramPotassioInput.value : null,
        "Umidade": paramUmidadeInput ? paramUmidadeInput.value : null,
        "analysis_date": analysisDateInput ? analysisDateInput.value : null,
        "notes": paramNotesInput ? paramNotesInput.value : null
    };

    for (const key in soilParams) {
        if (soilParams[key] === "" && key !== "notes" && key !== "analysis_date") { 
            delete soilParams[key]; // Não envia parâmetros de valor numérico vazios
        } else if (soilParams[key] === "" && (key === "notes" || key === "analysis_date")) {
            soilParams[key] = null; // Envia null se data ou notas forem explicitamente esvaziadas
        }
    }
    
    const payload = {
        name, description,
        size_hectares: (size !== '' && !isNaN(parseFloat(size))) ? parseFloat(size) : null,
        coordinates: coordinatesToSave,
        soil_params: soilParams
    };
    console.log("Payload para API:", payload); // LOG DO PAYLOAD

    let url = '/api/areas';
    let method = 'POST';

    if (isEditingArea && currentEditingAreaId) {
        url = `/api/areas/${currentEditingAreaId}`;
        method = 'PUT';
    }
    console.log("Enviando para:", method, url);

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log("Resposta da API recebida, status:", response.status); // LOG DA RESPOSTA
        const responseData = await response.json();

        if (response.ok) {
            const modalInstance = bootstrap.Modal.getInstance(areaFormModalEl);
            if (modalInstance) modalInstance.hide();
            
            await fetchAllAreas(); 
            updateMapDisplay();    
            alert(responseData.message || (isEditingArea ? 'Talhão atualizado com sucesso!' : 'Talhão criado com sucesso!'));
        } else {
            alert(`Erro: ${responseData.error || response.statusText}`);
        }
    } catch (error) {
        console.error('Erro ao salvar/atualizar talhão:', error);
        alert('Erro ao salvar/atualizar talhão. Verifique o console.');
    }
}

async function handleDeleteArea() {
    if (!isEditingArea || !currentEditingAreaId) {
        console.warn("Tentativa de deletar sem área em modo de edição.");
        return;
    }
    const areaNameToDelete = areaNameInput ? (areaNameInput.value || `Talhão ID ${currentEditingAreaId}`) : `Talhão ID ${currentEditingAreaId}`;
    if (confirm(`Tem certeza que deseja excluir o talhão "${areaNameToDelete}"? Esta ação não pode ser desfeita.`)) {
        try {
            const response = await fetch(`/api/areas/${currentEditingAreaId}`, { method: 'DELETE' });
            if (!response.ok) { // Checa se a resposta não foi OK
                const errorData = await response.json().catch(() => ({error: response.statusText})); // Tenta pegar JSON, senão usa statusText
                throw new Error(errorData.error || `Erro HTTP ${response.status}`);
            }
            const responseData = await response.json(); 
            alert(responseData.message || "Talhão excluído com sucesso.");
            const modalInstance = bootstrap.Modal.getInstance(areaFormModalEl);
            if(modalInstance) modalInstance.hide();
            await fetchAllAreas();
            updateMapDisplay();
        } catch (error) {
            console.error("Erro ao excluir talhão:", error);
            alert(`Erro ao excluir talhão: ${error.message || "Erro desconhecido"}. Verifique o console.`);
        }
    }
}

// ==========================================================================
// 6. FUNÇÕES DE UTILIDADE ADICIONAIS (Ex: Relatórios)
// ==========================================================================
function generateReport(reportType) {
    const form = document.getElementById(`${reportType}-report-form`);
    const formData = new FormData(form);
    const params = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
        if (value) params.append(key, value);
    }
    window.location.href = `/api/reports?${params.toString()}`;
}


async function fetchAndDisplaySoilHistory() { // <<< DEFINIÇÃO DA FUNÇÃO
    if (!currentAreaIdForHistory || !soilHistoryTableBodyEl || !historyParameterSelectEl) {
        console.warn("fetchAndDisplaySoilHistory: Pré-condições não atendidas (IDs ou elementos DOM ausentes).");
        if (soilHistoryTableBodyEl) {
            soilHistoryTableBodyEl.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Erro de configuração ao carregar histórico.</td></tr>';
        }
        return;
    }

    const selectedParameterIdForHistory = historyParameterSelectEl.value; 
    
    let url = `/api/areas/${currentAreaIdForHistory}/soil_history`;
    if (selectedParameterIdForHistory && selectedParameterIdForHistory !== "") { // Se um parâmetro específico for selecionado
        url += `?parameter_id=${selectedParameterIdForHistory}`;
    }
    console.log("Buscando histórico de solo de:", url);

    // Limpar tabela antes de buscar novos dados
    soilHistoryTableBodyEl.innerHTML = '<tr><td colspan="5" class="text-center">Carregando histórico...</td></tr>';

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorText = await response.text(); // Tenta pegar mais detalhes do erro
            throw new Error(`Falha ao buscar histórico de solo. Status: ${response.status}. Detalhes: ${errorText}`);
        }
        const historyData = await response.json();
        console.log("Dados do histórico recebidos:", historyData);

        soilHistoryTableBodyEl.innerHTML = ''; // Limpa a mensagem "Carregando..."

        if (historyData.length === 0) {
            soilHistoryTableBodyEl.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum registro de análise encontrado para esta seleção.</td></tr>';
            return;
        }

        historyData.forEach(reading => {
            const row = soilHistoryTableBodyEl.insertRow();
            row.insertCell().textContent = reading.analysis_date ? new Date(reading.analysis_date + 'T00:00:00').toLocaleDateString() : 'N/A';
            row.insertCell().textContent = reading.parameter_name || 'N/A';
            row.insertCell().textContent = reading.value !== null && typeof reading.value !== 'undefined' ? reading.value.toFixed(2) : 'N/A'; 
            row.insertCell().textContent = reading.unit || '';
            row.insertCell().textContent = reading.notes || '';
            // Você pode adicionar uma célula para ações (editar/deletar leitura) aqui no futuro
            // const actionsCell = row.insertCell();
            // actionsCell.innerHTML = `<button class="btn btn-sm btn-outline-warning edit-reading-btn" data-reading-id="${reading.reading_id}">E</button> <button class="btn btn-sm btn-outline-danger delete-reading-btn" data-reading-id="${reading.reading_id}">X</button>`;
        });

    } catch (error) {
        console.error("Erro ao buscar ou exibir histórico de solo:", error);
        if (soilHistoryTableBodyEl) {
            soilHistoryTableBodyEl.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Erro ao carregar histórico: ${error.message}</td></tr>`;
        }
    }
}


async function openSoilHistoryModal(areaId) {
    if (!areaId) return;
    currentAreaIdForHistory = areaId;
    const areaData = allAreasData.find(a => a.id == currentAreaIdForHistory);

    if (historyAreaNameEl && areaData) {
        historyAreaNameEl.textContent = `Talhão: ${areaData.name}`;
    } else if (historyAreaNameEl) {
        historyAreaNameEl.textContent = `Talhão ID: ${currentAreaIdForHistory}`;
    }

    // Popular dropdown de parâmetros no modal de histórico
    if (historyParameterSelectEl && allParametersData.length > 0) {
        historyParameterSelectEl.innerHTML = '<option value="">Todos os Parâmetros</option>'; // Opção para ver todos
        allParametersData.forEach(p => {
            historyParameterSelectEl.innerHTML += `<option value="${p.id}">${p.name}</option>`;
        });
    } else if (historyParameterSelectEl) {
        historyParameterSelectEl.innerHTML = '<option value="">Nenhum parâmetro carregado</option>';
    }
    
    // Limpar tabela e selecionar "Todos os Parâmetros" por padrão (ou o primeiro)
    if (soilHistoryTableBodyEl) soilHistoryTableBodyEl.innerHTML = '<tr><td colspan="5" class="text-center">Selecione um parâmetro para ver o histórico ou veja todos.</td></tr>';
    if (historyParameterSelectEl) historyParameterSelectEl.value = ""; // Default para "Todos"
    
    await fetchAndDisplaySoilHistory(); // Carrega o histórico para "Todos" ou o primeiro selecionado

    const modal = bootstrap.Modal.getInstance(soilHistoryModalEl) || new bootstrap.Modal(soilHistoryModalEl);
    modal.show();
}


// ==========================================================================
// 7. INICIALIZAÇÃO DA PÁGINA E EVENT LISTENERS PRINCIPAIS
// ==========================================================================
async function loadInitialDataAndSetupListeners() {
    console.log("Carregando dados iniciais e configurando listeners...");
    
    await fetchAllParameters();
    await fetchAllAreas();    
    if (analysisAreaSelect && allAreasData.length > 0) {
      analysisAreaSelect.innerHTML = '<option value="">Selecione um Talhão</option>';
      allAreasData.forEach(a => analysisAreaSelect.innerHTML += `<option value="${a.id}">${a.name}</option>`);
    }
    if (analysisParameterSelect && allParametersData.length > 0) {
      analysisParameterSelect.innerHTML = '<option value="">Selecione um Parâmetro</option>';
      allParametersData.forEach(p => analysisParameterSelect.innerHTML += `<option value="${p.id}">${p.name} (${p.unit || ''})</option>`);
    }

    if (saveAnalysisBtn) {
      saveAnalysisBtn.addEventListener('click', async function() {
          const areaId = analysisAreaSelect.value;
          const parameterId = analysisParameterSelect.value;
          const value = analysisValueInput.value;
          const date = document.getElementById('analysis-input-date').value; // Pega o valor do input de data específico deste modal
          const notes = analysisNotesInput.value;

          if (!areaId || !parameterId || value === '' || !date) {
              alert("Por favor, preencha todos os campos obrigatórios: Talhão, Parâmetro, Valor e Data da Análise.");
              return;
          }

          const payload = {
              area_id: parseInt(areaId),
              parameter_id: parseInt(parameterId),
              value: parseFloat(value),
              analysis_date: date, // Formato YYYY-MM-DD
              notes: notes
          };

          console.log("Salvando nova análise de solo:", payload);

          try {
              const response = await fetch('/api/soil_readings', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
              });
              const responseData = await response.json();

              if (response.ok) {
                  alert(responseData.message || "Análise de solo salva com sucesso!");
                  // Fechar o modal de adicionar análise
                  const modalInstance = bootstrap.Modal.getInstance(addAnalysisModalEl);
                  if (modalInstance) modalInstance.hide();
                  document.getElementById('add-analysis-form').reset(); // Limpa o formulário

                  // Atualizar o mapa para refletir o novo dado (se relevante para a visualização atual)
                  updateMapDisplay(); 
              } else {
                  alert(`Erro ao salvar análise: ${responseData.error || response.statusText}`);
              }
          } catch (error) {
              console.error("Erro no fetch ao salvar análise:", error);
              alert("Erro de comunicação ao salvar análise. Verifique o console.");
          }
      });
    }

    if (addAnalysisModalEl) {
     addAnalysisModalEl.addEventListener('show.bs.modal', function() {
         // Popular selects aqui também é uma opção se os dados podem mudar
         // ou apenas garantir que a data esteja correta.
         const dateInput = document.getElementById('analysis-input-date');
         if (dateInput && !dateInput.value) { // Só preenche se estiver vazio
              dateInput.value = new Date().toISOString().split('T')[0];
         }
         document.getElementById('add-analysis-form').reset(); // Limpa outros campos
         if (dateInput) dateInput.value = new Date().toISOString().split('T')[0]; // Define a data novamente após o reset
     });
    }

    if (historyParameterSelectEl) {
    historyParameterSelectEl.addEventListener('change', fetchAndDisplaySoilHistory);
    }

    if (paramSelectGlobal) paramSelectGlobal.addEventListener('change', updateMapDisplay);
    if (areaSelectGlobal) areaSelectGlobal.addEventListener('change', updateMapDisplay);
    if (viewTypeSelectGlobal) viewTypeSelectGlobal.addEventListener('change', updateMapDisplay);
    
    if (saveAreaChangesBtn) { // saveAreaChangesBtn é definido em cacheDomSelectors
        console.log("Adicionando listener para saveAreaChangesBtn", saveAreaChangesBtn); // LOG DE DEBUG
        saveAreaChangesBtn.addEventListener('click', handleSaveAreaChanges);
    } else {
        console.error("Botão '#save-area-changes-btn' NÃO encontrado para adicionar listener.");
    }

    if (deleteAreaBtn) {
        deleteAreaBtn.addEventListener('click', handleDeleteArea);
    } else {
        console.error("Botão '#delete-area-btn' não encontrado.");
    }
    
    if (areaFormModalEl) {
     areaFormModalEl.addEventListener('show.bs.modal', function (event) {
         console.log("Evento 'show.bs.modal' para areaFormModal. isEditingArea:", isEditingArea);
         // Se não estiver explicitamente no modo de edição (que seria definido por prepareModalForEdit),
         // então chamamos prepareModalForCreate.
         // prepareModalForCreate agora é inteligente o suficiente para não apagar
         // os dados de um desenho recém-feito se currentDrawnItem existir.
         if (!isEditingArea) { 
             prepareModalForCreate();
         }
         // Se isEditingArea for true, prepareModalForEdit já terá sido chamado
         // pelo clique no botão "Editar" do popup.
     });

     areaFormModalEl.addEventListener('hidden.bs.modal', function () {
         // Sempre resetar ao fechar para garantir estado limpo para a próxima vez
         console.log("Evento 'hidden.bs.modal' para areaFormModal.");
         if (!isEditingArea && currentDrawnItem) {
             // Se estava criando, não salvou, e tinha um desenho, talvez perguntar se quer descartar?
             // Por ora, vamos limpar o desenho se o modal for fechado sem salvar.
             console.log("Limpando desenho não salvo ao fechar modal de criação.");
             if (drawnItemsLayer) drawnItemsLayer.clearLayers();
             currentDrawnItem = null;
         }
         
         isEditingArea = false;
         currentEditingAreaId = null;
         // O reset do formulário dentro de prepareModalForCreate será chamado na próxima abertura
         // ou podemos resetar aqui também se quisermos garantir.
         if (areaForm) areaForm.reset();
         if (areaAlqueiresDisplay) areaAlqueiresDisplay.textContent = "0.00";
         if (saveAreaChangesBtn) saveAreaChangesBtn.disabled = true;
         if (deleteAreaBtn) deleteAreaBtn.style.display = 'none';
         console.log("Modal #areaFormModal fechado, estado de edição e formulário resetados.");
     });
    }

    if (mapInstance) {
        mapInstance.on('popupopen', function (e) {
            if (e.popup && e.popup._container) {
                const popupNode = e.popup._container;
                const editButton = popupNode.querySelector('.edit-area-btn');
                if (editButton) {
                    const newEditButton = editButton.cloneNode(true);
                    editButton.parentNode.replaceChild(newEditButton, editButton);
                    
                    newEditButton.addEventListener('click', async function () {
                        const areaId = this.getAttribute('data-area-id');
                        console.log("Botão Editar no popup clicado para área ID:", areaId);
                        if(mapInstance) mapInstance.closePopup();
                        
                        await prepareModalForEdit(areaId); 
                        
                        const modalInstance = bootstrap.Modal.getInstance(areaFormModalEl) || new bootstrap.Modal(areaFormModalEl);
                        modalInstance.show();
                    });
                }
                // Dentro do mapInstance.on('popupopen', ...)
                // ... (código para o botão de editar) ...
                const historyButton = popupNode.querySelector('.view-history-btn'); // Novo seletor
                if (historyButton) {
                    const newHistoryButton = historyButton.cloneNode(true);
                    historyButton.parentNode.replaceChild(newHistoryButton, historyButton);
    
                    newHistoryButton.addEventListener('click', function () {
                        const areaId = this.getAttribute('data-area-id');
                        console.log("Botão Ver Histórico clicado para área ID:", areaId);
                        if(mapInstance) mapInstance.closePopup();
                        openSoilHistoryModal(areaId);
                    });
                }



            }
        });
    } else {
        console.warn("mapInstance não definido ao tentar adicionar listener de popupopen em loadInitialDataAndSetupListeners.");
    }

    updateMapDisplay(); 
    console.log("Setup inicial de listeners concluído.");
}

// script.js

window.addEventListener('load', () => {
    console.log("Evento 'load' da window disparado. Iniciando setup...");
    
    cacheDomSelectors(); 
    initializeLeafletMap(); 
    loadWeatherData();
    loadInitialDataAndSetupListeners(); 
    initializeDates();
    
    if (refreshWeatherBtnGlobal) {
        refreshWeatherBtnGlobal.addEventListener('click', loadWeatherData);
    }
});