const { SlashCommandBuilder } = require("discord.js");
const db = require("../../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("assign-plaque")
        .setDescription("Assigner une plaque à un utilisateur")
        .addStringOption(opt =>
            opt.setName("plaque")
                .setDescription("Plaque d'immatriculation")
                .setRequired(true)
        )
        .addUserOption(opt =>
            opt.setName("utilisateur")
                .setDescription("Utilisateur à qui assigner")
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName("nom")
                .setDescription("Nom du personnage")
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName("prenom")
                .setDescription("Prénom du personnage")
                .setRequired(true)
        ),

    async execute(interaction) {
        if (!interaction.member.permissions.has("BanMembers")) {
            return interaction.reply({ content: "❌ Tu n'as pas la permission de **ban** pour utiliser cette commande.", ephemeral: true });
        }

        const plaque = interaction.options.getString("plaque").toUpperCase();
        const utilisateur = interaction.options.getUser("utilisateur");
        const nom = interaction.options.getString("nom");
        const prenom = interaction.options.getString("prenom");
        const guildId = interaction.guild.id;

        const [[personnage]] = await db.execute(`
            SELECT * FROM \`characters\` 
            WHERE guild_id = ? AND user_id = ? AND name = ?
        `, [guildId, utilisateur.id, nom]);

        if (!personnage) {
            return interaction.reply({ content: "❌ Aucun personnage correspondant trouvé pour ce nom.", ephemeral: true });
        }

        await db.execute(`
            REPLACE INTO plaque_registry (plaque, user_id, prenom, nom, guild_id)
            VALUES (?, ?, ?, ?, ?)
        `, [plaque, utilisateur.id, prenom, nom, guildId]);

        return interaction.reply({ content: `✅ Plaque **${plaque}** assignée à **${prenom} ${nom}**.`, ephemeral: true });
    }
};
