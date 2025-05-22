const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("plaques-utilisateur")
        .setDescription("Lister toutes les plaques associées à un nom RP (et optionnel à un utilisateur Discord)")
        .addStringOption(opt =>
            opt.setName("prenom")
                .setDescription("Prénom RP")
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName("nom")
                .setDescription("Nom RP")
                .setRequired(true)
        )
        .addUserOption(opt =>
            opt.setName("utilisateur")
                .setDescription("Utilisateur Discord (optionnel)")
                .setRequired(false)
        ),

    async execute(interaction) {
        const prenom = interaction.options.getString("prenom");
        const nom = interaction.options.getString("nom");
        const discordUser = interaction.options.getUser("utilisateur");
        const currentGuildId = interaction.guild.id;

        const [linked] = await db.execute(`
      SELECT guild_id1, guild_id2 FROM linked_servers
      WHERE guild_id1 = ? OR guild_id2 = ?
    `, [currentGuildId, currentGuildId]);

        const allowedGuilds = new Set([currentGuildId]);
        for (const row of linked) {
            allowedGuilds.add(row.guild_id1);
            allowedGuilds.add(row.guild_id2);
        }

        let [plaques] = await db.execute(`
      SELECT * FROM plaque_registry 
      WHERE nom = ? AND prenom = ?
    `, [nom, prenom]);

        plaques = plaques.filter(p =>
            allowedGuilds.has(p.guild_id) &&
            (!discordUser || p.user_id === discordUser.id)
        );

        if (plaques.length === 0) {
            return interaction.reply({
                content: "❌ Aucune plaque trouvée correspondant à ce personnage sur ce serveur ou ses serveurs liés.",
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(`🚗 Plaques de ${prenom} ${nom}`)
            .setColor(0x3498db);

        for (const plaque of plaques) {
            const [[character]] = await db.execute(`
        SELECT jobs FROM \`characters\` 
        WHERE nom = ? AND user_id = ? AND guild_id = ?
      `, [nom, plaque.user_id, plaque.guild_id]);

            const user = await interaction.client.users.fetch(plaque.user_id).catch(() => null);
            embed.addFields({
                name: `Plaque : ${plaque.plaque}`,
                value: `👤 **Utilisateur :** ${user ? user.tag : "Inconnu"}\n📧 **Adresse mail :** ${user ? "Inconnue" : "N/A"}\n🧰 **Jobs :** ${character ? character.jobs : "Aucun"}\n🆔 **Serveur :** ${plaque.guild_id}`,
                inline: false
            });
        }

        return interaction.reply({ embeds: [embed] });
    }
};
