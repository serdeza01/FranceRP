const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rename")
    .setDescription("Renomme le ticket actuel.")
    .addStringOption((option) =>
      option
        .setName("nom")
        .setDescription("Nouveau nom du ticket")
        .setRequired(true)
    ), async execute(interaction) {
      const [config] = await db.execute("SELECT role_id FROM ticket_config WHERE guild_id = ?", [interaction.guild.id]);
      if (!config[0]) {
        return interaction.reply({
          content: "La configuration du ticket n'a pas été trouvée. Utilisez `/setup_ticket` pour configurer.",
          ephemeral: true,
        });
      }

      const member = await interaction.guild.members.fetch(interaction.user.id);
      if (!member.roles.cache.has(config[0].role_id)) {
        return interaction.reply({
          content: "Vous n'avez pas la permission d'utiliser cette commande.",
          ephemeral: true,
        });
      }

      const newName = interaction.options.getString("nom");

      try {
        await interaction.channel.setName(newName);
        await interaction.reply({
          content: `Le ticket a été renommé en : ${newName}`,
          ephemeral: true,
        });
      } catch (err) {
        console.error("Erreur lors du renommage du ticket :", err);
        await interaction.reply({
          content: "Erreur lors du renommage du ticket.",
          ephemeral: true,
        });
      }
    },
};
