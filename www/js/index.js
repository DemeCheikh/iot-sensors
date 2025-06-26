var app = {
    apiUrl: 'https://api-sensor-ucad.onrender.com/api/',
    refreshInterval: 30000,
    autoRefresh: null,
    currentSensor: 'temperature',
    currentPeriod: 24
};

// Initialisation de l'application
$(document).ready(function () {
    initApp();
});

function initApp() {
    // Charger les paramètres
    loadSettings();

    // Démarrer le rafraîchissement automatique
    startAutoRefresh();

    // Charger les données initiales
    loadDashboardData();

    // Événements
    bindEvents();
}

function bindEvents() {
    // Bouton actualiser
    $('#refresh-btn').on('click', function () {
        loadDashboardData();
    });

    // Filtres capteurs
    $('.sensor-filter').on('click', function () {
        $('.sensor-filter').removeClass('active');
        $(this).addClass('active');
        app.currentSensor = $(this).data('sensor');
        loadHistoryData();
    });

    // Filtres période
    $('.period-filter').on('click', function () {
        $('.period-filter').removeClass('active');
        $(this).addClass('active');
        app.currentPeriod = $(this).data('hours');
        loadStatsData();
    });

    // Cartes capteurs cliquables
    $('.sensor-card').on('click', function () {
        var sensor = $(this).data('sensor');
        app.currentSensor = sensor;
        $.mobile.changePage('#history');
    });

    // Paramètres
    $('#save-settings').on('click', saveSettings);
    $('#test-connection').on('click', testConnection);

    // Événements de page
    $(document).on('pagebeforeshow', '#history', function () {
        loadHistoryData();
    });

    $(document).on('pagebeforeshow', '#stats', function () {
        loadStatsData();
    });
}

// Chargement des données du dashboard
function loadDashboardData() {
    showConnectionStatus('loading');

    $.ajax({
        url: app.apiUrl + '/system/status',
        type: 'GET',
        timeout: 10000,
        success: function (data) {
            showConnectionStatus('online');
            updateDashboard(data);
            $('#last-sync').text('Sync: ' + new Date().toLocaleTimeString());
        },
        error: function () {
            showConnectionStatus('offline');
            showError('Impossible de se connecter à l\'API');
        }
    });
}

// Mise à jour du dashboard
function updateDashboard(data) {
    var readings = data.latest_readings;

    // Température
    if (readings.temperature) {
        $('#temp-ambient').text(readings.temperature.ambient + '°C');
        $('#temp-object').text(readings.temperature.object + '°C');
        $('#temp-time').text(formatTime(readings.temperature.datetime));
    }

    // pH
    if (readings.ph) {
        $('#ph-value').text(readings.ph.valeur.toFixed(1));
        $('#ph-time').text(formatTime(readings.ph.datetime));
    }

    // Oxygène
    if (readings.oxygen) {
        $('#oxygen-value').text(readings.oxygen.valeur.toFixed(1) + ' mg/L');
        $('#oxygen-time').text(formatTime(readings.oxygen.datetime));
    }

    // Luminosité
    if (readings.luminosite) {
        $('#light-value').text(readings.luminosite.valeur.toFixed(0) + ' lux');
        $('#light-time').text(formatTime(readings.luminosite.datetime));
    }
}

// Chargement des données d'historique
function loadHistoryData() {
    $('#chart-placeholder').html('<div class="loading">Chargement...</div>');
    $('#history-list').html('<li data-role="list-divider">Dernières mesures</li>');

    $.ajax({
        url: app.apiUrl + '/' + app.currentSensor + '?limit=50',
        type: 'GET',
        success: function (data) {
            displayHistoryChart(data);
            displayHistoryList(data);
        },
        error: function () {
            $('#chart-placeholder').html('<div class="error-message">Erreur de chargement</div>');
        }
    });
}

// Affichage du graphique d'historique (simplifié)
function displayHistoryChart(data) {
    var html = '<div style="text-align: center; padding: 20px;">';
    html += '<h3>' + getSensorLabel(app.currentSensor) + '</h3>';
    if (data.length > 0) {
        var latest = data[0];
        var value = app.currentSensor === 'temperature' ?
            latest.ambient + '°C / ' + latest.object + '°C' :
            latest.valeur + ' ' + getSensorUnit(app.currentSensor);
        html += '<div style="font-size: 2em; font-weight: bold; margin: 20px 0;">' + value + '</div>';
        html += '<div>Dernière mesure: ' + formatTime(latest.datetime) + '</div>';
        html += '<div style="margin-top: 20px;">Total: ' + data.length + ' mesures</div>';
    } else {
        html += '<div>Aucune donnée disponible</div>';
    }
    html += '</div>';
    $('#chart-placeholder').html(html);
}

// Affichage de la liste d'historique
function displayHistoryList(data) {
    var html = '<li data-role="list-divider">Dernières mesures (' + data.length + ')</li>';

    data.slice(0, 20).forEach(function (item) {
        var value = app.currentSensor === 'temperature' ?
            item.ambient + '°C / ' + item.object + '°C' :
            item.valeur + ' ' + getSensorUnit(app.currentSensor);

        html += '<li>';
        html += '<h3>' + value + '</h3>';
        html += '<p>' + formatDateTime(item.datetime) + '</p>';
        html += '</li>';
    });

    $('#history-list').html(html).listview('refresh');
}

// Chargement des statistiques
function loadStatsData() {
    $('#stats-content').html('<div class="loading">Chargement des statistiques...</div>');

    $.ajax({
        url: app.apiUrl + '/sensors/stats?hours=' + app.currentPeriod,
        type: 'GET',
        success: function (data) {
            displayStats(data);
        },
        error: function () {
            $('#stats-content').html('<div class="error-message">Erreur de chargement</div>');
        }
    });
}

// Affichage des statistiques
function displayStats(data) {
    var html = '<div class="ui-grid-a">';

    Object.keys(data.counts).forEach(function (key) {
        if (key !== 'total') {
            html += '<div class="ui-block-a ui-block-b" style="margin: 5px 0;">';
            html += '<div class="ui-bar ui-corner-all" style="text-align: center; padding: 10px;">';
            html += '<h4>' + getSensorLabel(key) + '</h4>';
            html += '<div style="font-size: 2em; font-weight: bold;">' + data.counts[key] + '</div>';
            html += '<div>mesures</div>';
            html += '</div></div>';
        }
    });

    html += '</div>';
    html += '<div class="ui-bar ui-corner-all" style="text-align: center; padding: 15px; margin-top: 20px; background-color: #f0f0f0;">';
    html += '<h3>Total: ' + data.counts.total + ' mesures</h3>';
    html += '<p>Période: ' + app.currentPeriod + ' heures</p>';
    html += '</div>';

    $('#stats-content').html(html);
}

// Fonctions utilitaires
function formatTime(datetime) {
    return new Date(datetime).toLocaleTimeString();
}

function formatDateTime(datetime) {
    return new Date(datetime).toLocaleString();
}

function getSensorLabel(sensor) {
    var labels = {
        'temperature': 'Température',
        'ph': 'pH',
        'oxygen': 'Oxygène',
        'luminosite': 'Luminosité'
    };
    return labels[sensor] || sensor;
}

function getSensorUnit(sensor) {
    var units = {
        'ph': '',
        'oxygen': 'mg/L',
        'luminosite': 'lux'
    };
    return units[sensor] || '';
}

function showConnectionStatus(status) {
    var indicator = $('#status-indicator');
    var text = $('#connection-status');

    switch (status) {
        case 'online':
            indicator.removeClass('status-offline').addClass('status-online');
            text.text('En ligne');
            break;
        case 'offline':
            indicator.removeClass('status-online').addClass('status-offline');
            text.text('Hors ligne');
            break;
        case 'loading':
            indicator.removeClass('status-online status-offline');
            text.text('Connexion...');
            break;
    }
}

function showError(message) {
    // Afficher une notification d'erreur
    console.error(message);
}

// Rafraîchissement automatique
function startAutoRefresh() {
    if (app.autoRefresh) {
        clearInterval(app.autoRefresh);
    }

    app.autoRefresh = setInterval(function () {
        if ($.mobile.activePage.attr('id') === 'dashboard') {
            loadDashboardData();
        }
    }, app.refreshInterval);
}

// Gestion des paramètres
function loadSettings() {
    // Dans une vraie app Cordova, utiliser le stockage local
    var settings = JSON.parse(localStorage.getItem('iot-settings') || '{}');

    if (settings.apiUrl) {
        app.apiUrl = settings.apiUrl;
        $('#api-url').val(settings.apiUrl);
    }

    if (settings.refreshInterval) {
        app.refreshInterval = settings.refreshInterval * 1000;
        $('#refresh-interval').val(settings.refreshInterval);
    }
}

function saveSettings() {
    var settings = {
        apiUrl: $('#api-url').val(),
        refreshInterval: parseInt($('#refresh-interval').val()),
        notifications: $('#notifications').is(':checked')
    };

    localStorage.setItem('iot-settings', JSON.stringify(settings));
    app.apiUrl = settings.apiUrl;
    app.refreshInterval = settings.refreshInterval * 1000;

    startAutoRefresh();

    // Afficher confirmation
    $('<div>').simpledialog2({
        mode: 'blank',
        headerText: 'Paramètres sauvegardés',
        headerClose: true,
        blankContent: '<p>Les paramètres ont été sauvegardés avec succès.</p>'
    });
}

function testConnection() {
    $.ajax({
        url: $('#api-url').val() + '/system/status',
        type: 'GET',
        timeout: 5000,
        success: function () {
            $('<div>').simpledialog2({
                mode: 'blank',
                headerText: 'Test de connexion',
                headerClose: true,
                blankContent: '<p style="color: green;">✓ Connexion réussie!</p>'
            });
        },
        error: function () {
            $('<div>').simpledialog2({
                mode: 'blank',
                headerText: 'Test de connexion',
                headerClose: true,
                blankContent: '<p style="color: red;">✗ Connexion échouée!</p>'
            });
        }
    });
}

// Gestion des événements Cordova
document.addEventListener('deviceready', function () {
    console.log('Cordova is ready');
    // Initialiser les plugins Cordova ici si nécessaire
}, false);

// Pause/Resume de l'application
document.addEventListener('pause', function () {
    if (app.autoRefresh) {
        clearInterval(app.autoRefresh);
    }
}, false);

document.addEventListener('resume', function () {
    startAutoRefresh();
    loadDashboardData();
}, false);