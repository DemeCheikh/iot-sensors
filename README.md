# iot-sensors

Ce projet utilise **Apache Cordova** pour développer une application mobile dédiée à la gestion et la visualisation de capteurs IoT.

## Stack technique

- **Cordova** : Framework principal pour le développement mobile multiplateforme.
- **HTML5 / CSS3 / JavaScript** : Technologies de base pour l’interface utilisateur et la logique applicative.
- **Plugins Cordova** : Pour accéder aux fonctionnalités natives (Bluetooth, réseau, stockage, etc.).

## Installation

```bash
git clone <repo-url>
cd iot-sensors
npm install
cordova platform add android   # ou ios selon la cible
cordova run android           # ou ios
```

## Fonctionnalités principales

- Connexion aux capteurs IoT via Bluetooth ou Wi-Fi
- Visualisation en temps réel des données des capteurs
- Historique des mesures
- Interface utilisateur responsive

## Démarrage rapide

1. Installer les dépendances nécessaires (`npm install`)
2. Ajouter la plateforme cible (`cordova platform add <platform>`)
3. Lancer l’application (`cordova run <platform>`)

## Contribution

Les contributions sont les bienvenues ! Veuillez ouvrir une issue ou une pull request.
