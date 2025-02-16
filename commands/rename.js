const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rename")
    .setDescription("Renomme le ticket actuel.")
    .addStringOption((option) =>
      option
        .setName("nom")
        .setDescription("Nouveau nom du ticket")
        .setRequired(true)
    ),
  async execute(interaction) {
    // Vérifier que le membre possède le rôle autorisé
    if (!interaction.member.roles.cache.has("1304151263851708458")) {
      return interaction.reply({
        content: "Vous n'avez pas la permission de renommer ce ticket.",
        ephemeral: true,
      });
    }

    const newName = interaction.options.getString("nom");

    // Renommage du canal courant
    try {
      await interaction.channel.setName(newName);
      await interaction.reply({ content: `Le ticket a été renommé en : ${newName}`, ephemeral: false });
    } catch (err) {
      console.error("Erreur lors du renommage du ticket :", err);
      await interaction.reply({ content: "Erreur lors du renommage du ticket.", ephemeral: true });
    }
  },
};
