const { SlashCommandBuilder } = require("discord.js");
const db = require("../../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("assign-plaque")
        .setDescription("Assigner une plaque d'immatriculation à un utilisateur")
        .addUserOption(opt =>
            opt.setName("utilisateur")
                .setDescription("Utilisateur à qui appartient la plaque")
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName("prenom")
                .setDescription("Prénom du propriétaire")
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName("nom")
                .setDescription("Nom du propriétaire (nom RP, identique à celui en BDD)")
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName("plaque")
                .setDescription("Plaque à assigner")
                .setRequired(true)
        ),

    async execute(interaction) {
        const user = interaction.options.getUser("utilisateur");
        const prenom = interaction.options.getString("prenom");
        const nom = interaction.options.getString("nom").toUpperCase();
        const plaque = interaction.options.getString("plaque").toUpperCase();
        const guildId = interaction.guild.id;

        const [characterRows] = await db.execute(`
            SELECT * FROM characters 
            WHERE guild_id = ? AND user_id = ? AND name = ?
        `, [guildId, user.id, nom]);

        if (characterRows.length === 0) {
            return interaction.reply({ content: "❌ Aucun personnage trouvé avec ce nom pour cet utilisateur.", ephemeral: true });
        }

        const [[existing]] = await db.execute(`
            SELECT * FROM plaque_registry WHERE plaque = ?
        `, [plaque]);

        if (existing) {
            return interaction.reply({ content: "❌ Cette plaque est déjà assignée à quelqu'un.", ephemeral: true });
        }

        await db.execute(`
            INSERT INTO plaque_registry (plaque, user_id, prenom, nom, guild_id)
            VALUES (?, ?, ?, ?, ?)
        `, [plaque, user.id, prenom, nom, guildId]);

        return interaction.reply({ content: `✅ La plaque \`${plaque}\` a été assignée à **${prenom} ${nom}**.` });
    }
};
