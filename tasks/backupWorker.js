const db = require("../db");
const zlib = require("zlib");

async function runAutoBackups(client) {
    setInterval(async () => {
        const [settings] = await db.execute(`
            SELECT * FROM auto_backup_settings
        `);

        for (const setting of settings) {
            const guild = client.guilds.cache.get(setting.guild_id);
            if (!guild) continue;

            const now = new Date();
            const last = setting.last_backup ? new Date(setting.last_backup) : null;
            const diff = last ? (now - last) / (1000 * 60 * 60) : Infinity;

            if (diff < setting.interval_hours) continue;

            try {
                const data = await generateBackupData(guild);
                const compressed = zlib.deflateSync(Buffer.from(JSON.stringify(data))).toString("base64");

                const name = `${guild.name} - ${now.toLocaleDateString("fr-FR")}`;

                await db.execute(`
                    INSERT INTO backups (user_id, guild_id, name, data, created_at, automatic)
                    VALUES (?, ?, ?, ?, NOW(), 1)
                `, [setting.user_id, guild.id, name, compressed]);

                await db.execute(`
                    UPDATE auto_backup_settings SET last_backup = NOW() WHERE guild_id = ?
                `, [guild.id]);

                console.log(`[Backup Auto] Sauvegarde faite pour ${guild.name}`);
            } catch (err) {
                console.error(`[Backup Auto] Échec pour ${guild.id} :`, err.message);
            }
        }
    }, 1000 * 60 * 5);
}

module.exports = { runAutoBackups };
