# Application de Gestion de Trésorerie

Application web pour la gestion simple des finances (entrées/sorties) d'une trésorerie, conçue initialement pour une église mais adaptable à toute petite organisation.

![Aperçu de l'application](lien_vers_une_capture_d_ecran.png) 
<!-- Prenez une capture d'écran de votre application et ajoutez-la au dossier pour un rendu plus pro -->

## ✨ Fonctionnalités

-   **Tableau de bord** : Vue d'ensemble des soldes par catégorie et par devise (USD, CDF).
-   **Gestion des Entrées** : Ajout, modification et suppression des entrées financières.
-   **Gestion des Sorties** : Ajout, modification et suppression des dépenses.
-   **Rapports d'Inventaire** : Calcul de la variance (solde) sur des périodes filtrables (année, mois).
-   **Authentification Sécurisée** : Connexion et réinitialisation de mot de passe.
-   **Interface Moderne** : Design épuré et facile à utiliser.

## 🛠️ Technologies Utilisées

-   **Front-End** : HTML5, CSS3, JavaScript (Vanilla JS)
-   **Back-End** : Node.js, Express.js (ou l'outil que vous utilisez)
-   **Base de données** : SQLite, PostgreSQL, MySQL (précisez celle que vous utilisez)

## 🚀 Comment Lancer le Projet

Ce projet est composé d'un front-end (client) et d'un back-end (serveur). Vous devez lancer les deux pour que l'application fonctionne.

### Prérequis

-   Avoir [Node.js](https://nodejs.org/) installé.
-   Avoir une base de données (précisez laquelle) installée et configurée.

### 1. Installation

Clonez ce dépôt sur votre machine locale :
```bash
git clone https://github.com/VOTRE_NOM_UTILISATEUR/gestion-tresorerie-eglise.git
cd gestion-tresorerie-eglise
```

### 2. Configuration du Back-End (Serveur)

1.  Allez dans le dossier du back-end :
    ```bash
    cd backend
    ```

2.  Installez les dépendances :
    ```bash
    npm install
    ```

3.  Configurez vos variables d'environnement. Créez un fichier `.env` à la racine du dossier `backend` et remplissez-le selon le modèle de votre API (par exemple, les informations de connexion à la base de données).

4.  Lancez le serveur :
    ```bash
    npm start
    ```
    Le serveur devrait maintenant tourner sur `http://localhost:3000` (ou le port que vous avez défini).

### 3. Lancement du Front-End (Client)

Ouvrez simplement le fichier `frontend/index.html` dans votre navigateur web préféré (Google Chrome, Firefox, etc.).

L'application est maintenant prête à être utilisée ! Elle communiquera automatiquement avec le serveur que vous avez lancé localement.

---

## 🌐 Déploiement (Optionnel)

Pour rendre l'application accessible en ligne, vous devez déployer :
1.  Le **back-end** sur un service comme Render, Heroku ou un VPS.
2.  Le **front-end** sur un service d'hébergement statique comme GitHub Pages, Vercel ou Netlify.

N'oubliez pas de mettre à jour la variable `API_BASE_URL` dans le fichier `frontend/index.html` avec l'URL de votre API déployée.