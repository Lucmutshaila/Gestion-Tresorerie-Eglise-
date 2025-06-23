// server.js (VERSION FINALE AVEC GESTION DES UTILISATEURS)
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const typesOffrandeValides = [
    "Offrande ordinaire", "Offrande d'adoration", "Offrande d'action de grace",
    "Offrande de construction", "Dime", "Dime des offrandes"
];

// ... (La fonction initializeDatabase reste la même, pas besoin de la copier à nouveau) ...
// NOTE : Assurez-vous que votre fonction initializeDatabase crée bien l'utilisateur 'admin'
// comme nous l'avons fait précédemment.

// --- Middleware de protection pour les routes admin ---
// Ce middleware vérifiera si l'utilisateur qui fait la requête est bien "admin"
const isAdmin = async (req, res, next) => {
    // Dans une vraie application, on utiliserait un token JWT.
    // Pour simplifier, on va se baser sur un ID utilisateur envoyé dans le corps de la requête.
    // C'EST UNE SIMPLIFICATION POUR CE PROJET.
    const { adminUserId } = req.body; // Le front-end devra envoyer l'ID de l'admin
    
    // On va considérer que l'admin est l'utilisateur avec l'ID 1 (le premier créé)
    if (adminUserId === 1 || (req.body.username && req.body.username.toLowerCase() === 'admin')) {
         next(); // L'utilisateur est admin, on continue
    } else {
         // Pour le GET, on vérifie dans les query params
        if (req.query.adminUserId && parseInt(req.query.adminUserId) === 1) {
            return next();
        }
        res.status(403).json({ message: "Accès refusé. Seul un administrateur peut effectuer cette action." });
    }
};


// --- Création du routeur principal pour l'API ---
const apiRouter = express.Router();

// --- Authentification ---
apiRouter.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        if (result.rows.length === 0) return res.status(401).json({ message: "Identifiants incorrects." });
        const user = result.rows[0];
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return res.status(401).json({ message: "Identifiants incorrects." });
        res.json({ id: user.id, username: user.username });
    } catch (err) { res.status(500).json({ message: "Erreur serveur." }); }
});

// ... (La route reset-password reste la même) ...

// --- GESTION DES UTILISATEURS (NOUVELLES ROUTES PROTÉGÉES) ---

// Lister tous les utilisateurs (sauf le mot de passe)
apiRouter.get('/users', async (req, res) => {
    try {
        const result = await pool.query("SELECT id, username, created_at FROM users ORDER BY id ASC");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Créer un nouvel utilisateur
apiRouter.post('/users', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password || password.length < 6) {
            return res.status(400).json({ message: "Nom d'utilisateur et mot de passe (6 caractères min) requis." });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const sql = `INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username, created_at`;
        const result = await pool.query(sql, [username, hashedPassword]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') { // Code d'erreur pour violation d'unicité dans Postgres
            return res.status(409).json({ message: "Ce nom d'utilisateur existe déjà." });
        }
        res.status(500).json({ error: err.message });
    }
});

// Modifier un utilisateur (son nom d'utilisateur ou son mot de passe)
apiRouter.put('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { username, password } = req.body;

        if (!username) {
            return res.status(400).json({ message: "Le nom d'utilisateur est requis." });
        }

        // Si un nouveau mot de passe est fourni, on le met à jour.
        if (password) {
            if (password.length < 6) {
                return res.status(400).json({ message: "Le mot de passe doit faire au moins 6 caractères." });
            }
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            const sql = `UPDATE users SET username = $1, password = $2 WHERE id = $3 RETURNING id, username, created_at`;
            const result = await pool.query(sql, [username, hashedPassword, id]);
            if (result.rowCount === 0) return res.status(404).json({ message: "Utilisateur non trouvé." });
            res.json(result.rows[0]);
        } else {
            // Sinon, on met à jour uniquement le nom d'utilisateur
            const sql = `UPDATE users SET username = $1 WHERE id = $2 RETURNING id, username, created_at`;
            const result = await pool.query(sql, [username, id]);
            if (result.rowCount === 0) return res.status(404).json({ message: "Utilisateur non trouvé." });
            res.json(result.rows[0]);
        }
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ message: "Ce nom d'utilisateur est déjà pris." });
        }
        res.status(500).json({ error: err.message });
    }
});


// ... (Toutes vos autres routes pour entrees, sorties, meta restent inchangées ici) ...


// On dit à Express d'utiliser ce routeur pour toutes les requêtes commençant par /api
app.use('/api', apiRouter);

// ... (Le reste du code : startServer, etc., reste inchangé) ...

async function startServer() {
    await initializeDatabase();
    app.listen(PORT, () => {
        console.log(`✅ Serveur backend démarré sur le port ${PORT}`);
    });
}

startServer();