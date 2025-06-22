// server.js
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'caisse_eglise_db'
};

let db;

const typesOffrandeValides = [
    "Offrande ordinaire", "Offrande d'adoration", "Offrande d'action de grace",
    "Offrande de construction", "Dime", "Dime des offrandes"
];

async function initializeDatabase() {
    try {
        let tempConnection = await mysql.createConnection({
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password
        });
        await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
        console.log(`Base de données "${dbConfig.database}" vérifiée/créée.`);
        await tempConnection.end();

        db = await mysql.createConnection(dbConfig);
        console.log(`Connecté à la base de données MySQL: "${dbConfig.database}".`);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("Table 'users' vérifiée/créée.");

        await db.execute(`
            CREATE TABLE IF NOT EXISTS entrees (
                id INT AUTO_INCREMENT PRIMARY KEY,
                code VARCHAR(50),
                date_entree DATE NOT NULL,
                type_offrande VARCHAR(255) NOT NULL,
                montant DECIMAL(15, 2) NOT NULL,
                devise VARCHAR(10) NOT NULL,
                temoin VARCHAR(255),
                commentaires TEXT,
                utilisateur_id INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (utilisateur_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        console.log("Table 'entrees' modifiée/vérifiée.");

        await db.execute(`
            CREATE TABLE IF NOT EXISTS sorties (
                id INT AUTO_INCREMENT PRIMARY KEY,
                code VARCHAR(50),
                date_sortie DATE NOT NULL,
                type_transaction VARCHAR(255) NOT NULL,
                montant DECIMAL(15, 2) NOT NULL,
                devise VARCHAR(10) NOT NULL,
                temoin VARCHAR(255),
                commentaires TEXT,
                utilisateur_id INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (utilisateur_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        console.log("Table 'sorties' modifiée/vérifiée.");

        const [rows] = await db.execute("SELECT COUNT(*) as count FROM users");
        if (rows[0].count === 0) {
            const salt = bcrypt.genSaltSync(10);
            const hashedPassword = bcrypt.hashSync("admin123", salt);
            await db.execute("INSERT INTO users (username, password) VALUES (?, ?)", ["admin", hashedPassword]);
            console.log("Utilisateur 'admin' créé avec mot de passe 'admin123'");
        }

    } catch (err) {
        console.error("Erreur lors de l'initialisation de la base de données MySQL:", err.message);
        if (err.code === 'ER_ACCESS_DENIED_ERROR') console.error(`ERREUR CRITIQUE: Accès refusé pour l'utilisateur '${dbConfig.user}'.`);
        else if (err.code === 'ECONNREFUSED') console.error(`ERREUR CRITIQUE: Connexion refusée. Serveur MySQL démarré sur '${dbConfig.host}'?`);
        else if (err.code === 'ER_DBACCESS_DENIED_ERROR') console.error(`ERREUR CRITIQUE: L'utilisateur '${dbConfig.user}' n'a pas les droits pour '${dbConfig.database}'.`);
        process.exit(1);
    }
}

// --- Routes API ---

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: "Nom d'utilisateur et mot de passe requis." });
    }
    try {
        const [rows] = await db.execute("SELECT * FROM users WHERE username = ?", [username]);
        const user = rows[0];
        if (!user) return res.status(401).json({ message: "Nom d'utilisateur ou mot de passe incorrect." });
        const passwordIsValid = bcrypt.compareSync(password, user.password);
        if (!passwordIsValid) return res.status(401).json({ message: "Nom d'utilisateur ou mot de passe incorrect." });
        res.json({ id: user.id, username: user.username });
    } catch (err) {
        console.error("Erreur DB login:", err);
        res.status(500).json({ message: "Erreur serveur lors de la connexion." });
    }
});

// NOUVELLE ROUTE: Réinitialisation du mot de passe (version simplifiée)
app.post('/api/auth/reset-password', async (req, res) => {
    const { username, newPassword } = req.body;

    if (!username || !newPassword) {
        return res.status(400).json({ message: "Nom d'utilisateur et nouveau mot de passe requis." });
    }
    if (newPassword.length < 6) { // Longueur minimale pour le mot de passe
        return res.status(400).json({ message: "Le nouveau mot de passe doit comporter au moins 6 caractères." });
    }

    try {
        const [users] = await db.execute("SELECT id FROM users WHERE username = ?", [username]);
        if (users.length === 0) {
            return res.status(404).json({ message: "Nom d'utilisateur non trouvé." });
        }
        const userId = users[0].id;

        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(newPassword, salt);

        const [updateResult] = await db.execute("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, userId]);

        if (updateResult.affectedRows === 0) {
            console.error(`Échec de la mise à jour du mot de passe pour l'utilisateur ID ${userId}.`);
            return res.status(500).json({ message: "Erreur lors de la mise à jour du mot de passe." });
        }

        console.log(`Mot de passe réinitialisé pour l'utilisateur: ${username}`);
        res.status(200).json({ message: "Mot de passe réinitialisé avec succès !" });

    } catch (err) {
        console.error("Erreur DB lors de la réinitialisation du mot de passe:", err);
        res.status(500).json({ message: "Erreur serveur lors de la réinitialisation du mot de passe." });
    }
});


app.get('/api/meta/types-offrandes', (req, res) => {
    res.json(typesOffrandeValides);
});


// --- Entrées ---
app.get('/api/entrees', async (req, res) => {
    try {
        const [rows] = await db.execute("SELECT * FROM entrees ORDER BY date_entree DESC, id DESC");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ "error": err.message });
    }
});

app.post('/api/entrees', async (req, res) => {
    const { code, date_entree, type_offrande, montant, devise, temoin, commentaires, utilisateur_id } = req.body;
    if (!date_entree || !type_offrande || montant == null || !devise || !code) {
        return res.status(400).json({ message: "Code, date, type d'offrande, montant et devise sont requis." });
    }
    if (!typesOffrandeValides.includes(type_offrande)) {
        return res.status(400).json({ message: "Type d'offrande invalide." });
    }
    const sql = `INSERT INTO entrees (code, date_entree, type_offrande, montant, devise, temoin, commentaires, utilisateur_id) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [code, date_entree, type_offrande, montant, devise, temoin, commentaires, utilisateur_id];
    try {
        const [result] = await db.execute(sql, params);
        res.status(201).json({
            id: result.insertId, code, date_entree, type_offrande, montant, devise, temoin, commentaires, utilisateur_id
        });
    } catch (err) {
        console.error("Erreur API POST /entrees:", err);
        res.status(500).json({ "error": err.message });
    }
});

app.delete('/api/entrees/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.execute('DELETE FROM entrees WHERE id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: "Entrée non trouvée." });
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ "error": err.message });
    }
});

// --- Sorties ---
app.get('/api/sorties', async (req, res) => {
    try {
        const [rows] = await db.execute("SELECT * FROM sorties ORDER BY date_sortie DESC, id DESC");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ "error": err.message });
    }
});

app.post('/api/sorties', async (req, res) => {
    const { code, date_sortie, type_transaction, montant, devise, temoin, commentaires, utilisateur_id } = req.body;
    if (!date_sortie || !type_transaction || montant == null || !devise || !commentaires || !code) {
        return res.status(400).json({ message: "Code, date, type de transaction, montant, devise et commentaires sont requis." });
    }
    const typesValidesPourSortie = [...typesOffrandeValides, "Autre Dépense"]; // Liste combinée
    if (!typesValidesPourSortie.includes(type_transaction)) {
        console.warn(`Type de transaction "${type_transaction}" non standard pour une sortie.`);
        // Vous pourriez rejeter ici si le type n'est pas dans la liste attendue.
        // return res.status(400).json({ message: "Type de transaction invalide." });
    }
    const sql = `INSERT INTO sorties (code, date_sortie, type_transaction, montant, devise, temoin, commentaires, utilisateur_id) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [code, date_sortie, type_transaction, montant, devise, temoin, commentaires, utilisateur_id];
    try {
        const [result] = await db.execute(sql, params);
        res.status(201).json({
            id: result.insertId, code, date_sortie, type_transaction, montant, devise, temoin, commentaires, utilisateur_id
        });
    } catch (err) {
        console.error("Erreur API POST /sorties:", err);
        res.status(500).json({ "error": err.message });
    }
});

app.delete('/api/sorties/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.execute('DELETE FROM sorties WHERE id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: "Sortie non trouvée." });
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ "error": err.message });
    }
});


app.use((req, res) => {
    res.status(404).json({ message: "Désolé, cette route n'existe pas !" });
});

async function startServer() {
    await initializeDatabase();
    app.listen(PORT, () => {
        console.log(`Serveur backend démarré sur http://localhost:${PORT}`);
    });
}

startServer();

process.on('SIGINT', async () => {
    if (db) await db.end();
    console.log('Connexion à la base de données MySQL fermée.');
    process.exit(0);
});