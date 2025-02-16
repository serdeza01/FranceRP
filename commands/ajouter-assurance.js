// ajouter-assurance.js
const { SlashCommandBuilder } = require("discord.js");
const db = require("../db"); // db est maintenant un pool de connexions

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ajouter-assurance")
    .setDescription("Ajoute une assurance pour un utilisateur")
    .addUserOption((option) =>
      option
        .setName("utilisateur")
        .setDescription("Utilisateur à qui ajouter une assurance")
        .setRequired(true)
    )
    .addAttachmentOption((option) =>
      option
        .setName("image")
        .setDescription("Image de la carte d'assurance")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("expiration")
        .setDescription("Date d'expiration de l'assurance")
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      if (!interaction.member.roles.cache.has("1328419821901189170")) {
        return interaction.reply({
          content: "Vous n'avez pas la permission d'ajouter une assurance.",
          ephemeral: true,
        });
      }

      const user = interaction.options.getUser("utilisateur");
      const image = interaction.options.getAttachment("image");
      const expiration = interaction.options.getString("expiration");

      // Utilisation du pool en mode Promise
      await db
        .promise()
        .execute(
          "INSERT INTO assurance (discord_id, image_path, date_expiration) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE image_path = ?, date_expiration = ?",
          [user.id, image.url, expiration, image.url, expiration]
        );

      return interaction.reply({
        content: `L'assurance pour ${user.username} a été ajoutée avec succès.`,
        ephemeral: true,
      });
    } catch (err) {
      console.error("Erreur MySQL:", err);
      return interaction.reply({
        content: "Une erreur est survenue lors de l'ajout de l'assurance.",
        ephemeral: true,
      });
    }
  },
};
