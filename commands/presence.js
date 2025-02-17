const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("presence")
    .setDescription("Signaler sa disponibilité en tant que staff.")
    .addStringOption((option) =>
      option
        .setName("statut")
        .setDescription("Choisissez votre statut")
        .setRequired(true)
        .addChoices(
          { name: "Disponible", value: "disponible" },
          { name: "Indisponible", value: "indisponible" }
        )
    ),
  async execute(
    interaction,
    { staffStatus, updatePresenceEmbed, CHANNEL_ID, STAFF_ROLE_ID }
  ) {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!member.roles.cache.has(STAFF_ROLE_ID)) {
      return interaction.reply({
        content: "Vous n'avez pas la permission d'utiliser cette commande.",
        ephemeral: true,
      });
    }

    const status = interaction.options.getString("statut");
    if (status === "indisponible") {
      staffStatus.delete(interaction.user.id);
    } else {
      staffStatus.set(interaction.user.id, status);
    }

    await updatePresenceEmbed(interaction.guild, CHANNEL_ID);
    return interaction.reply({
      content: `Vous êtes maintenant marqué comme ${status}.`,
      ephemeral: true,
    });
  },
};
