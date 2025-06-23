// server.js (VERSION FINALE AVEC GESTION DES UTILISATEURS - CODE COMPLET)
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

// LA FONCTION MANQUANTE EST ICI
async function initializeDatabase() {
    let client;
    try {
        client = await pool.connect();
        console.log('Connecté à la base de données PostgreSQL.');

        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("Table 'users' vérifiée/créée.");

        await client.query(`
            CREATE TABLE IF NOT EXISTS entrees (
                id SERIAL PRIMARY KEY,
                code VARCHAR(50) NOT NULL UNIQUE,
                date_entree DATE NOT NULL,
                type_offrande VARCHAR(255) NOT NULL,
                montant DECIMAL(15, 2) NOT NULL,
                devise VARCHAR(10) NOT NULL,
                temoin VARCHAR(255),
                commentaires TEXT,
                utilisateur_id INT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (utilisateur_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        console.log("Table 'entrees' vérifiée/créée.");

        await client.query(`
            CREATE TABLE IF NOT EXISTS sorties (
                id SERIAL PRIMARY KEY,
                code VARCHAR(50) NOT NULL UNIQUE,
                date_sortie DATE NOT NULL,
                type_transaction VARCHAR(255) NOT NULL,
                montant DECIMAL(15, 2) NOT NULL,
                devise VARCHAR(10) NOT NULL,
                temoin VARCHAR(255),
                commentaires TEXT NOT NULL,
                utilisateur_id INT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (utilisateur_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        console.log("Table 'sorties' vérifiée/créée.");

        const res = await client.query("SELECT COUNT(*) as count FROM users");
        if (res.rows[0].count === '0') {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash("admin123", salt);
            await client.query("INSERT INTO users (username, password) VALUES ($1, $2)", ["admin", hashedPassword]);
            console.log("Utilisateur 'admin' créé.");
        }
    } catch (err) {
        console.error("ERREUR CRITIQUE BDD:", err);
        process.exit(1);
    } finally {
        if (client) client.release();
    }
}


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
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erreur serveur." });
    }
});

apiRouter.post('/auth/reset-password', async (req, res) => {
    try {
        const { username, newPassword } = req.body;
        if (!username || !newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: "Données invalides." });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        const result = await pool.query("UPDATE users SET password = $1 WHERE username = $2", [hashedPassword, username]);
        if (result.rowCount === 0) return res.status(404).json({ message: "Utilisateur non trouvé." });
        res.status(200).json({ message: "Mot de passe réinitialisé." });
    } catch (err) { res.status(500).json({ message: "Erreur serveur." }); }
});

// --- Gestion des Utilisateurs ---
apiRouter.get('/users', async (req, res) => {
    try {
        const result = await pool.query("SELECT id, username, created_at FROM users ORDER BY id ASC");
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

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
        if (err.code === '23505') { return res.status(409).json({ message: "Ce nom d'utilisateur existe déjà." }); }
        res.status(500).json({ error: err.message });
    }
});

apiRouter.put('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { username, password } = req.body;
        if (!username) { return res.status(400).json({ message: "Le nom d'utilisateur est requis." }); }
        if (password) {
            if (password.length < 6) { return res.status(400).json({ message: "Le mot de passe doit faire au moins 6 caractères." }); }
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            const sql = `UPDATE users SET username = $1, password = $2 WHERE id = $3 RETURNING id, username, created_at`;
            const result = await pool.query(sql, [username, hashedPassword, id]);
            if (result.rowCount === 0) return res.status(404).json({ message: "Utilisateur non trouvé." });
            res.json(result.rows[0]);
        } else {
            const sql = `UPDATE users SET username = $1 WHERE id = $2 RETURNING id, username, created_at`;
            const result = await pool.query(sql, [username, id]);
            if (result.rowCount === 0) return res.status(404).json({ message: "Utilisateur non trouvé." });
            res.json(result.rows[0]);
        }
    } catch (err) {
        if (err.code === '23505') { return res.status(409).json({ message: "Ce nom d'utilisateur est déjà pris." }); }
        res.status(500).json({ error: err.message });
    }
});

// --- Méta-données ---
apiRouter.get('/meta/types-offrandes', (req, res) => { res.json(typesOffrandeValides); });

// --- Entrées ---
apiRouter.get('/entrees', async (req, res) => { try { const result = await pool.query("SELECT * FROM entrees ORDER BY date_entree DESC, id DESC"); res.json(result.rows); } catch (err) { res.status(500).json({ error: err.message }); } });
apiRouter.post('/entrees', async (req, res) => { const { code, date_entree, type_offrande, montant, devise, temoin, commentaires, utilisateur_id } = req.body; try { const sql = `INSERT INTO entrees (code, date_entree, type_offrande, montant, devise, temoin, commentaires, utilisateur_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`; const result = await pool.query(sql, [code, date_entree, type_offrande, montant, devise, temoin, commentaires, utilisateur_id]); res.status(201).json(result.rows[0]); } catch (err) { res.status(500).json({ error: err.message }); } });
apiRouter.put('/entrees/:id', async (req, res) => { const { id } = req.params; const { date_entree, type_offrande, montant, devise, temoin, commentaires } = req.body; try { const sql = `UPDATE entrees SET date_entree = $1, type_offrande = $2, montant = $3, devise = $4, temoin = $5, commentaires = $6 WHERE id = $7 RETURNING *`; const result = await pool.query(sql, [date_entree, type_offrande, montant, devise, temoin, commentaires, id]); if (result.rowCount === 0) return res.status(404).json({ message: "Entrée non trouvée." }); res.json(result.rows[0]); } catch (err) { res.status(500).json({ error: err.message }); } });
apiRouter.delete('/entrees/:id', async (req, res) => { try { const result = await pool.query('DELETE FROM entrees WHERE id = $1', [req.params.id]); if (result.rowCount === 0) return res.status(404).json({ message: "Entrée non trouvée." }); res.status(204).send(); } catch (err) { res.status(500).json({ error: err.message }); } });

// --- Sorties ---
apiRouter.get('/sorties', async (req, res) => { try { const result = await pool.query("SELECT * FROM sorties ORDER BY date_sortie DESC, id DESC"); res.json(result.rows); } catch (err) { res.status(500).json({ error: err.message }); } });
apiRouter.post('/sorties', async (req, res) => { const { code, date_sortie, type_transaction, montant, devise, temoin, commentaires, utilisateur_id } = req.body; try { const sql = `INSERT INTO sorties (code, date_sortie, type_transaction, montant, devise, temoin, commentaires, utilisateur_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`; const result = await pool.query(sql, [code, date_sortie, type_transaction, montant, devise, temoin, commentaires, utilisateur_id]); res.status(201).json(result.rows[0]); } catch (err) { res.status(500).json({ error: err.message }); } });
apiRouter.put('/sorties/:id', async (req, res) => { const { id } = req.params; const { date_sortie, type_transaction, montant, devise, temoin, commentaires } = req.body; try { const sql = `UPDATE sorties SET date_sortie = $1, type_transaction = $2, montant = $3, devise = $4, temoin = $5, commentaires = $6 WHERE id = $7 RETURNING *`; const result = await pool.query(sql, [date_sortie, type_transaction, montant, devise, temoin, commentaires, id]); if (result.rowCount === 0) return res.status(404).json({ message: "Sortie non trouvée." }); res.json(result.rows[0]); } catch (err) { res.status(500).json({ error: err.message }); } });
apiRouter.delete('/sorties/:id', async (req, res) => { try { const result = await pool.query('DELETE FROM sorties WHERE id = $1', [req.params.id]); if (result.rowCount === 0) return res.status(404).json({ message: "Sortie non trouvée." }); res.status(204).send(); } catch (err) { res.status(500).json({ error: err.message }); } });

// On dit à Express d'utiliser ce routeur pour toutes les requêtes commençant par /api
app.use('/api', apiRouter);

// Gestion des routes non trouvées (doit être à la fin)
app.use((req, res) => {
    res.status(404).json({ message: "Route non trouvée." });
});

async function startServer() {
    await initializeDatabase();
    app.listen(PORT, () => {
        console.log(`✅ Serveur backend démarré sur le port ${PORT}`);
    });
}

startServer();