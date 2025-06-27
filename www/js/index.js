/**
 * Application IoT Sensors - Version améliorée
 * Surveillance des capteurs environnementaux
 */

class IoTSensorApp {
    constructor() {
        this.config = {
            apiUrl: 'https://api-sensor-ucad.onrender.com/api',
            refreshInterval: 30000,
            requestTimeout: 10000,
            maxRetries: 3,
            retryDelay: 2000
        };
        
        this.state = {
            autoRefresh: null,
            currentSensor: 'temperature',
            currentPeriod: 24,
            isOnline: false,
            retryCount: 0
        };
        
        this.sensors = {
            temperature: { label: 'Température', unit: '°C', endpoint: 'temperature' },
            ph: { label: 'pH', unit: '', endpoint: 'ph' },
            oxygen: { label: 'Oxygène', unit: 'mg/L', endpoint: 'oxygen' },
            luminosite: { label: 'Luminosité', unit: 'lux', endpoint: 'luminosite' }
        };
        
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        
        this.init();
    }

    /**
     * Initialisation de l'application
     */
    init() {
        this.loadSettings();
        this.bindEvents();
        this.startAutoRefresh();
        this.loadDashboardData();
        
        // Gestion des événements Cordova
        this.setupCordovaEvents();
    }

    /**
     * Liaison des événements
     */
    bindEvents() {
        // Délégation d'événements pour une meilleure performance
        $(document)
            .on('click', '#refresh-btn', () => this.loadDashboardData())
            .on('click', '.sensor-filter', this.handleSensorFilter.bind(this))
            .on('click', '.period-filter', this.handlePeriodFilter.bind(this))
            .on('click', '.sensor-card', this.handleSensorCardClick.bind(this))
            .on('click', '#save-settings', () => this.saveSettings())
            .on('click', '#test-connection', () => this.testConnection())
            .on('pagebeforeshow', '#history', () => this.loadHistoryData())
            .on('pagebeforeshow', '#stats', () => this.loadStatsData());
    }

    /**
     * Gestionnaire pour les filtres de capteurs
     */
    handleSensorFilter(event) {
        const $target = $(event.currentTarget);
        $('.sensor-filter').removeClass('active');
        $target.addClass('active');
        this.state.currentSensor = $target.data('sensor');
        this.loadHistoryData();
    }

    /**
     * Gestionnaire pour les filtres de période
     */
    handlePeriodFilter(event) {
        const $target = $(event.currentTarget);
        $('.period-filter').removeClass('active');
        $target.addClass('active');
        this.state.currentPeriod = $target.data('hours');
        this.loadStatsData();
    }

    /**
     * Gestionnaire pour les clics sur les cartes de capteurs
     */
    handleSensorCardClick(event) {
        const sensor = $(event.currentTarget).data('sensor');
        this.state.currentSensor = sensor;
        $.mobile.changePage('#history');
    }

    /**
     * Requête API avec gestion d'erreurs et retry
     */
    async apiRequest(endpoint, options = {}) {
        const {
            method = 'GET',
            timeout = this.config.requestTimeout,
            useCache = false,
            cacheKey = null
        } = options;

        // Vérification du cache
        if (useCache && cacheKey && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        const url = `${this.config.apiUrl}/${endpoint}`;
        
        for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
            try {
                const response = await $.ajax({
                    url,
                    type: method,
                    timeout,
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                });

                // Mise en cache si demandée
                if (useCache && cacheKey) {
                    this.cache.set(cacheKey, {
                        data: response,
                        timestamp: Date.now()
                    });
                }

                this.state.retryCount = 0;
                return response;

            } catch (error) {
                console.warn(`Tentative ${attempt + 1} échouée pour ${endpoint}:`, error);
                
                if (attempt < this.config.maxRetries) {
                    await this.delay(this.config.retryDelay * (attempt + 1));
                } else {
                    throw error;
                }
            }
        }
    }

    /**
     * Utilitaire pour créer un délai
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Chargement des données du dashboard avec gestion d'erreurs améliorée
     */
    async loadDashboardData() {
        try {
            this.showConnectionStatus('loading');
            
            const data = await this.apiRequest('system/status', {
                useCache: true,
                cacheKey: 'dashboard_status'
            });
            
            this.showConnectionStatus('online');
            this.updateDashboard(data);
            this.updateLastSync();
            
        } catch (error) {
            this.showConnectionStatus('offline');
            this.showError('Impossible de se connecter à l\'API', error);
            this.handleOfflineMode();
        }
    }

    /**
     * Mise à jour du dashboard avec validation des données
     */
    updateDashboard(response) {
        // Vérifier si les données sont encapsulées dans un objet de réponse
        let data = response;
        if (response && response.success && response.data) {
            data = response.data;
        }

        if (!data || !data.latest_readings) {
            console.warn('Données invalides reçues:', response);
            return;
        }

        const readings = data.latest_readings;

        // Mise à jour avec validation pour chaque capteur
        this.updateSensorDisplay('temperature', readings.temperature, (val) => ({
            ambient: `${val.ambient}°C`,
            object: `${val.object}°C`,
            time: this.formatTime(val.datetime)
        }));

        this.updateSensorDisplay('ph', readings.ph, (val) => ({
            value: val.valeur.toFixed(1),
            time: this.formatTime(val.datetime)
        }));

        this.updateSensorDisplay('oxygen', readings.oxygen, (val) => ({
            value: `${val.valeur.toFixed(1)} mg/L`,
            time: this.formatTime(val.datetime)
        }));

        this.updateSensorDisplay('luminosite', readings.luminosite, (val) => ({
            value: `${val.valeur.toFixed(0)} lux`,
            time: this.formatTime(val.datetime)
        }));
    }

    /**
     * Mise à jour générique de l'affichage d'un capteur
     */
    updateSensorDisplay(sensorType, data, formatter) {
        if (!data) return;

        try {
            const formatted = formatter(data);
            
            switch (sensorType) {
                case 'temperature':
                    $('#temp-ambient').text(formatted.ambient);
                    $('#temp-object').text(formatted.object);
                    $('#temp-time').text(formatted.time);
                    break;
                case 'ph':
                    $('#ph-value').text(formatted.value);
                    $('#ph-time').text(formatted.time);
                    break;
                case 'oxygen':
                    $('#oxygen-value').text(formatted.value);
                    $('#oxygen-time').text(formatted.time);
                    break;
                case 'luminosite':
                    $('#light-value').text(formatted.value);
                    $('#light-time').text(formatted.time);
                    break;
            }
        } catch (error) {
            console.error(`Erreur lors de la mise à jour de ${sensorType}:`, error);
        }
    }

    /**
     * Chargement des données d'historique avec pagination
     */
    async loadHistoryData(limit = 50) {
        try {
            this.showLoading('#chart-placeholder', 'Chargement du graphique...');
            this.showLoading('#history-list', 'Chargement de l\'historique...');

            const response = await this.apiRequest(`${this.state.currentSensor}?limit=${limit}`, {
                useCache: true,
                cacheKey: `history_${this.state.currentSensor}_${limit}`
            });

            // Gérer la structure de réponse encapsulée
            let data = response;
            if (response && response.success && response.data) {
                data = response.data;
            }

            this.displayHistoryChart(data);
            this.displayHistoryList(data);

        } catch (error) {
            this.showError('Erreur lors du chargement de l\'historique', error);
            this.showErrorInContainer('#chart-placeholder', 'Erreur de chargement du graphique');
            this.showErrorInContainer('#history-list', 'Erreur de chargement de l\'historique');
        }
    }

    /**
     * Affichage amélioré du graphique d'historique
     */
    displayHistoryChart(data) {
        if (!Array.isArray(data) || data.length === 0) {
            $('#chart-placeholder').html(this.createNoDataMessage());
            return;
        }

        const sensor = this.sensors[this.state.currentSensor];
        const latest = data[0];
        
        let value;
        if (this.state.currentSensor === 'temperature') {
            value = `${latest.ambient}°C / ${latest.object}°C`;
        } else {
            value = `${latest.valeur} ${sensor.unit}`;
        }

        const chartHtml = `
            <div class="chart-container">
                <h3>${sensor.label}</h3>
                <div class="current-value">${value}</div>
                <div class="last-update">Dernière mesure: ${this.formatTime(latest.datetime)}</div>
                <div class="data-stats">
                    <span>Total: ${data.length} mesures</span>
                    <span>•</span>
                    <span>Période: ${this.getDataTimespan(data)}</span>
                </div>
            </div>
        `;

        $('#chart-placeholder').html(chartHtml);
    }

    /**
     * Calcul de la période couverte par les données
     */
    getDataTimespan(data) {
        if (data.length < 2) return 'Données insuffisantes';
        
        const oldest = new Date(data[data.length - 1].datetime);
        const newest = new Date(data[0].datetime);
        const diffHours = Math.round((newest - oldest) / (1000 * 60 * 60));
        
        if (diffHours < 24) return `${diffHours}h`;
        return `${Math.round(diffHours / 24)}j`;
    }

    /**
     * Affichage de la liste d'historique avec pagination virtuelle
     */
    displayHistoryList(data, maxItems = 20) {
        if (!Array.isArray(data)) {
            $('#history-list').html('<li data-role="list-divider">Erreur de données</li>');
            return;
        }

        const sensor = this.sensors[this.state.currentSensor];
        let html = `<li data-role="list-divider">Dernières mesures (${data.length})</li>`;

        const itemsToShow = data.slice(0, maxItems);
        
        itemsToShow.forEach(item => {
            const value = this.state.currentSensor === 'temperature'
                ? `${item.ambient}°C / ${item.object}°C`
                : `${item.valeur} ${sensor.unit}`;

            html += `
                <li class="history-item">
                    <h3>${value}</h3>
                    <p class="timestamp">${this.formatDateTime(item.datetime)}</p>
                    <p class="sensor-type">${sensor.label}</p>
                </li>
            `;
        });

        if (data.length > maxItems) {
            html += `<li class="load-more-item"><a href="#" onclick="app.loadMoreHistory()">Charger plus (${data.length - maxItems} restants)</a></li>`;
        }

        $('#history-list').html(html).listview('refresh');
    }

    /**
     * Chargement des statistiques avec cache intelligent
     */
    async loadStatsData() {
        try {
            this.showLoading('#stats-content', 'Chargement des statistiques...');

            const response = await this.apiRequest(`sensors/stats?hours=${this.state.currentPeriod}`, {
                useCache: true,
                cacheKey: `stats_${this.state.currentPeriod}`
            });

            // Gérer la structure de réponse encapsulée
            let data = response;
            if (response && response.success && response.data) {
                data = response.data;
            }

            this.displayStats(data);

        } catch (error) {
            this.showError('Erreur lors du chargement des statistiques', error);
            this.showErrorInContainer('#stats-content', 'Erreur de chargement des statistiques');
        }
    }

    /**
     * Affichage des statistiques avec design amélioré
     */
    displayStats(data) {
        if (!data || !data.counts) {
            $('#stats-content').html(this.createNoDataMessage('Aucune statistique disponible'));
            return;
        }

        let html = '<div class="stats-grid">';

        // Statistiques par capteur
        Object.entries(data.counts).forEach(([key, count]) => {
            if (key !== 'total' && this.sensors[key]) {
                const sensor = this.sensors[key];
                html += `
                    <div class="stat-card">
                        <div class="stat-header">
                            <h4>${sensor.label}</h4>
                        </div>
                        <div class="stat-value">${count}</div>
                        <div class="stat-label">mesures</div>
                    </div>
                `;
            }
        });

        html += '</div>';

        // Résumé total
        html += `
            <div class="stats-summary">
                <h3>Résumé de la période</h3>
                <div class="summary-item">
                    <span class="summary-label">Total des mesures:</span>
                    <span class="summary-value">${data.counts.total}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Période analysée:</span>
                    <span class="summary-value">${this.state.currentPeriod} heures</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Fréquence moyenne:</span>
                    <span class="summary-value">${this.calculateAverageFrequency(data.counts.total)} mesures/heure</span>
                </div>
            </div>
        `;

        $('#stats-content').html(html);
    }

    /**
     * Calcul de la fréquence moyenne
     */
    calculateAverageFrequency(totalMeasures) {
        const avgPerHour = Math.round((totalMeasures / this.state.currentPeriod) * 10) / 10;
        return avgPerHour;
    }

    /**
     * Gestion des paramètres avec validation
     */
    loadSettings() {
        try {
            const settings = JSON.parse(localStorage.getItem('iot-settings') || '{}');

            if (settings.apiUrl && this.isValidUrl(settings.apiUrl)) {
                this.config.apiUrl = settings.apiUrl;
                $('#api-url').val(settings.apiUrl);
            }

            if (settings.refreshInterval && settings.refreshInterval >= 5) {
                this.config.refreshInterval = settings.refreshInterval * 1000;
                $('#refresh-interval').val(settings.refreshInterval);
            }

            if (settings.notifications !== undefined) {
                $('#notifications').prop('checked', settings.notifications);
            }
        } catch (error) {
            console.error('Erreur lors du chargement des paramètres:', error);
        }
    }

    /**
     * Sauvegarde des paramètres avec validation
     */
    saveSettings() {
        try {
            const apiUrl = $('#api-url').val().trim();
            const refreshInterval = parseInt($('#refresh-interval').val());
            const notifications = $('#notifications').is(':checked');

            // Validation
            if (!this.isValidUrl(apiUrl)) {
                this.showValidationError('URL API invalide');
                return;
            }

            if (refreshInterval < 5 || refreshInterval > 300) {
                this.showValidationError('Intervalle de rafraîchissement doit être entre 5 et 300 secondes');
                return;
            }

            const settings = { apiUrl, refreshInterval, notifications };
            
            localStorage.setItem('iot-settings', JSON.stringify(settings));
            
            // Mise à jour de la configuration
            this.config.apiUrl = apiUrl;
            this.config.refreshInterval = refreshInterval * 1000;
            
            // Redémarrage du rafraîchissement automatique
            this.startAutoRefresh();
            
            // Vider le cache pour forcer le rechargement avec la nouvelle URL
            this.cache.clear();

            this.showSuccessDialog('Paramètres sauvegardés avec succès');

        } catch (error) {
            console.error('Erreur lors de la sauvegarde:', error);
            this.showError('Erreur lors de la sauvegarde des paramètres');
        }
    }

    /**
     * Test de connexion amélioré
     */
    async testConnection() {
        const apiUrl = $('#api-url').val().trim();
        
        if (!this.isValidUrl(apiUrl)) {
            this.showValidationError('URL API invalide');
            return;
        }

        try {
            this.showConnectionTestDialog('Test en cours...', 'loading');
            
            const response = await $.ajax({
                url: `${apiUrl}/system/status`,
                type: 'GET',
                timeout: 5000
            });

            // Vérifier si la réponse a la bonne structure
            if (response && (response.success || response.latest_readings)) {
                this.showConnectionTestDialog('✓ Connexion réussie!', 'success');
            } else {
                this.showConnectionTestDialog('⚠ Connexion établie mais format de réponse inattendu', 'warning');
            }
            
        } catch (error) {
            const errorMsg = error.status 
                ? `✗ Erreur ${error.status}: ${error.statusText}`
                : '✗ Connexion échouée! Vérifiez l\'URL et la connectivité réseau.';
            
            this.showConnectionTestDialog(errorMsg, 'error');
        }
    }

    /**
     * Validation d'URL
     */
    isValidUrl(string) {
        try {
            new URL(string);
            return string.startsWith('http://') || string.startsWith('https://');
        } catch (_) {
            return false;
        }
    }

    /**
     * Gestion du mode hors ligne
     */
    handleOfflineMode() {
        // Essayer de charger les données depuis le cache
        const cachedData = this.cache.get('dashboard_status');
        if (cachedData) {
            console.log('Utilisation des données en cache');
            this.updateDashboard(cachedData.data);
            this.showInfo('Données en cache affichées (mode hors ligne)');
        }
    }

    /**
     * Rafraîchissement automatique intelligent
     */
    startAutoRefresh() {
        if (this.state.autoRefresh) {
            clearInterval(this.state.autoRefresh);
        }

        this.state.autoRefresh = setInterval(() => {
            // Ne rafraîchir que si on est sur le dashboard et que l'app est active
            if ($.mobile.activePage && $.mobile.activePage.attr('id') === 'dashboard') {
                if (!document.hidden) { // Page visibility API
                    this.loadDashboardData();
                }
            }
        }, this.config.refreshInterval);
    }

    /**
     * Configuration des événements Cordova
     */
    setupCordovaEvents() {
        document.addEventListener('deviceready', () => {
            console.log('Cordova initialisé');
            this.onDeviceReady();
        }, false);

        document.addEventListener('pause', () => {
            console.log('Application en pause');
            this.onPause();
        }, false);

        document.addEventListener('resume', () => {
            console.log('Application reprise');
            this.onResume();
        }, false);

        // Gestion de la visibilité de la page
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.onPause();
            } else {
                this.onResume();
            }
        });
    }

    /**
     * Événements du cycle de vie de l'application
     */
    onDeviceReady() {
        // Initialisation des plugins Cordova
        if (window.StatusBar) {
            window.StatusBar.styleDefault();
        }
    }

    onPause() {
        if (this.state.autoRefresh) {
            clearInterval(this.state.autoRefresh);
        }
    }

    onResume() {
        this.startAutoRefresh();
        // Petit délai pour laisser l'app se stabiliser
        setTimeout(() => {
            this.loadDashboardData();
        }, 1000);
    }

    /**
     * Utilitaires d'interface utilisateur
     */
    showLoading(selector, message = 'Chargement...') {
        $(selector).html(`<div class="loading-indicator">${message}</div>`);
    }

    showErrorInContainer(selector, message) {
        $(selector).html(`<div class="error-message">${message}</div>`);
    }

    createNoDataMessage(message = 'Aucune donnée disponible') {
        return `<div class="no-data-message">${message}</div>`;
    }

    showConnectionStatus(status) {
        const indicator = $('#status-indicator');
        const text = $('#connection-status');

        indicator.removeClass('status-online status-offline status-loading');
        
        switch (status) {
            case 'online':
                indicator.addClass('status-online');
                text.text('En ligne');
                this.state.isOnline = true;
                break;
            case 'offline':
                indicator.addClass('status-offline');
                text.text('Hors ligne');
                this.state.isOnline = false;
                break;
            case 'loading':
                indicator.addClass('status-loading');
                text.text('Connexion...');
                break;
        }
    }

    updateLastSync() {
        const now = new Date();
        $('#last-sync').text(`Sync: ${now.toLocaleTimeString()}`);
    }

    showError(message, error = null) {
        console.error(message, error);
        
        // Affichage discret dans l'interface
        const errorContainer = $('#error-toast');
        if (errorContainer.length) {
            errorContainer.text(message).fadeIn().delay(5000).fadeOut();
        }
    }

    showInfo(message) {
        console.info(message);
        // Implémentation d'une notification info si nécessaire
    }

    showSuccessDialog(message) {
        if (typeof $('<div>').simpledialog2 === 'function') {
            $('<div>').simpledialog2({
                mode: 'blank',
                headerText: 'Succès',
                headerClose: true,
                blankContent: `<p style="color: green;">${message}</p>`
            });
        } else {
            alert(message);
        }
    }

    showValidationError(message) {
        if (typeof $('<div>').simpledialog2 === 'function') {
            $('<div>').simpledialog2({
                mode: 'blank',
                headerText: 'Erreur de validation',
                headerClose: true,
                blankContent: `<p style="color: red;">${message}</p>`
            });
        } else {
            alert('Erreur: ' + message);
        }
    }

    showConnectionTestDialog(message, type) {
        const colors = {
            'success': 'green',
            'error': 'red',
            'warning': 'orange',
            'loading': 'blue'
        };
        const color = colors[type] || 'black';
        
        if (typeof $('<div>').simpledialog2 === 'function') {
            $('<div>').simpledialog2({
                mode: 'blank',
                headerText: 'Test de connexion',
                headerClose: true,
                blankContent: `<p style="color: ${color};">${message}</p>`
            });
        } else {
            alert(message);
        }
    }

    /**
     * Utilitaires de formatage
     */
    formatTime(datetime) {
        try {
            return new Date(datetime).toLocaleTimeString('fr-FR');
        } catch (error) {
            return 'Heure invalide';
        }
    }

    formatDateTime(datetime) {
        try {
            return new Date(datetime).toLocaleString('fr-FR');
        } catch (error) {
            return 'Date invalide';
        }
    }

    /**
     * Nettoyage des ressources
     */
    destroy() {
        if (this.state.autoRefresh) {
            clearInterval(this.state.autoRefresh);
        }
        this.cache.clear();
    }
}

// Initialisation globale
let app;

$(document).ready(function() {
    app = new IoTSensorApp();
});

// Export pour utilisation en module si nécessaire
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IoTSensorApp;
}