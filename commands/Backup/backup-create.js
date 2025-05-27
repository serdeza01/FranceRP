const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { generateBackupData } = require("../../tasks/generateBackupData");
const db = require("../../db");
const zlib = require("zlib");
const { syncUser } = require("../../tasks/users-backup-commands");


module.exports = {
    data: new SlashCommandBuilder()
        .setName("backup-create")
        .setDescription("Crée une sauvegarde complète du serveur Discord.")
        .addStringOption(opt =>
            opt.setName("nom")
                .setDescription("Nom de la sauvegarde (optionnel)")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await syncUser(interaction);
        await interaction.deferReply({ ephemeral: true });

        const userId = interaction.user.id;
        const guild = interaction.guild;
        const customName = interaction.options.getString("nom");

        try {
            const data = await generateBackupData(guild);
            const jsonString = JSON.stringify(data, (_key, value) =>
                typeof value === 'bigint' ? value.toString() : value
            );
            const compressed = zlib.deflateSync(Buffer.from(jsonString)).toString("base64");


            const now = new Date();
            const name = customName || `${guild.name} - ${now.toLocaleDateString("fr-FR")}`;

            await db.execute(`
                INSERT INTO backups (user_id, guild_id, name, data, created_at, automatic)
                VALUES (?, ?, ?, ?, NOW(), 0)
            `, [userId, guild.id, name, compressed]);

            return interaction.editReply({
                content: `✅ Sauvegarde "${name}" créée avec succès.`
            });

        } catch (err) {
            console.error("Erreur lors de la création du backup:", err);
            return interaction.editReply({
                content: "❌ Une erreur est survenue lors de la sauvegarde du serveur."
            });
        }
    },

    async runAutoBackups(client) {
        const [configs] = await db.execute("SELECT * FROM auto_backup_configs");
        const now = Date.now();

        for (const config of configs) {
            const { guild_id, user_id, interval, last_run } = config;

            if (!client.guilds.cache.has(guild_id)) continue;
            const guild = await client.guilds.fetch(guild_id).catch(() => null);
            if (!guild) continue;

            const msInterval = interval === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
            if (last_run && now - new Date(last_run).getTime() < msInterval) continue;

            try {
                const data = await generateBackupData(guild);
                const jsonString = JSON.stringify(data, (_key, value) =>
                    typeof value === 'bigint' ? value.toString() : value
                );
                const compressed = zlib.deflateSync(Buffer.from(jsonString)).toString("base64");

                const name = `${guild.name} - ${new Date().toLocaleDateString("fr-FR")}`;

                await db.execute(`
                    INSERT INTO backups (user_id, guild_id, name, data, created_at, automatic)
                    VALUES (?, ?, ?, ?, NOW(), 1)
                `, [user_id, guild.id, name, compressed]);

                await db.execute("UPDATE auto_backup_configs SET last_run = NOW() WHERE guild_id = ?", [guild.id]);

                console.log(`✅ Auto-backup créé pour ${guild.name}`);
            } catch (err) {
                console.error(`❌ Erreur backup auto pour ${guild.name}:`, err);
            }
        }
    }
};
