const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ajouter-permis")
    .setDescription("Ajoute un permis pour un utilisateur")
    .addUserOption((option) =>
      option
        .setName("utilisateur")
        .setDescription("Utilisateur à qui ajouter un permis")
        .setRequired(true)
    )
    .addAttachmentOption((option) =>
      option
        .setName("image")
        .setDescription("Image du permis")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("expiration")
        .setDescription("Date d'expiration (YYYY-MM-DD)")
        .setRequired(true)
    ),

  async execute(interaction) {
    // Vérification du rôle (remplacez par l'ID du rôle requis)
    if (!interaction.member.roles.cache.has("1326923044500934656")) {
      return interaction.reply({
        content: "Vous n'avez pas la permission d'ajouter un permis.",
        ephemeral: true,
      });
    }

    const user = interaction.options.getUser("utilisateur");
    const image = interaction.options.getAttachment("image");
    const expiration = interaction.options.getString("expiration");

    try {
      // Utilisation du mode Promise avec le pool
      await db.promise().execute(
        "INSERT INTO permis (discord_id, image_path, expiration_date) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE image_path = ?, expiration_date = ?",
        [user.id, image.url, expiration, image.url, expiration]
      );
      return interaction.reply({
        content: `Le permis pour ${user.username} a été ajouté avec succès.`,
        ephemeral: false, // réponse publique
      });
    } catch (err) {
      console.error("Erreur MySQL:", err);
      return interaction.reply({
        content: "Erreur lors de l'ajout du permis.",
        ephemeral: true,
      });
    }
  },
};
