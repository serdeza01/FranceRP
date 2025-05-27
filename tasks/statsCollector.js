const cron = require("node-cron");
const db = require("../db");

/**
 * Collecte les statistiques toutes les heures.
 * @param {import('discord.js').Client} client
 */
module.exports = function startStatsCollector(client) {
    cron.schedule("0 * * * *", async () => {
        try {
            const totalGuilds = client.guilds.cache.size;
            let totalUsers = 0;

            for (const guild of client.guilds.cache.values()) {
                totalUsers += guild.memberCount;
            }

            const now = new Date();
            const timestamp = now.toISOString().slice(0, 19).replace("T", " "); // Format MySQL DATETIME

            await db.execute(
                `INSERT INTO bot_stats (timestamp, user_count, server_count)
                 VALUES (?, ?, ?)`,
                [timestamp, totalUsers, totalGuilds]
            );

            console.log(`[StatsCollector] Statistiques enregistrées à ${timestamp}`);
        } catch (error) {
            console.error("[StatsCollector] Erreur lors de la collecte des stats :", error);
        }
    });

    console.log("[StatsCollector] Tâche planifiée (chaque heure) initialisée.");
};
