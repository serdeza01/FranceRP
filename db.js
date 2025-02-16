// db.js
require('dotenv').config();
const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,       
  password: process.env.DB_PASSWORD, 
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10, // Limite du nombre de connexions simultanées
  queueLimit: 0
});

// Optionnel : Vérifier la connexion initiale
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Erreur de connexion à MySQL :', err);
  } else {
    console.log('Connecté à MySQL.');
    connection.release();
  }
});

module.exports = pool;