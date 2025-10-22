const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../../../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("recherche-plaque")
        .setDescription("Rechercher à qui appartient une plaque")
        .addStringOption(opt =>
            opt.setName("plaque")
                .setDescription("Plaque à rechercher")
                .setRequired(true)
        ),

    async execute(interaction) {
        const plaque = interaction.options.getString("plaque").toUpperCase();
        const guildId = interaction.guild.id;

        const [[plaqueData]] = await db.execute(`
            SELECT * FROM plaque_registry WHERE plaque = ?
        `, [plaque]);

        if (!plaqueData) {
            return interaction.reply({ content: "❌ Aucune plaque trouvée.", ephemeral: true });
        }

        const [[link]] = await db.execute(`
            SELECT * FROM linked_servers 
            WHERE (guild_id1 = ? AND guild_id2 = ?) OR (guild_id1 = ? AND guild_id2 = ?)
        `, [guildId, plaqueData.guild_id, plaqueData.guild_id, guildId]);

        if (plaqueData.guild_id !== guildId && !link) {
            return interaction.reply({ content: "❌ Cette plaque n'est pas accessible depuis ce serveur.", ephemeral: true });
        }
        let character = null;
        let user = null;

        if (plaqueData.user_id) {
            const [characterRows] = await db.execute(`
                SELECT job1, job2 FROM \`characters\`
                WHERE user_id = ? AND guild_id = ? AND LOWER(name) LIKE LOWER(?)
            `, [plaqueData.user_id, plaqueData.guild_id, `%${plaqueData.nom}%`]);
            character = characterRows[0];

            user = await interaction.client.users.fetch(plaqueData.user_id).catch(() => null);
        }
        
        const embed = new EmbedBuilder()
            .setTitle(`🔎 Résultat pour la plaque ${plaque}`)
            .setColor(0x00B0F4)
            .addFields(
                { name: "Nom", value: `${plaqueData.prenom} ${plaqueData.nom}`, inline: true },
                { name: "Utilisateur Discord", value: user ? user.tag : (plaqueData.user_id ? "Inconnu" : "Non spécifié"), inline: true },
                { name: "Jobs", value: character ? `${character.job1 || "Aucun"} / ${character.job2 || "Aucun"}` : "Aucun", inline: false }
            )
            .setFooter({ text: "Données récupérées avec succès" });

        return interaction.reply({ embeds: [embed] });
    }
};