const { SlashCommandBuilder } = require("discord.js");
const db = require("../../db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ajouter-carte-grise")
    .setDescription("Ajoute une carte grise pour un utilisateur")
    .addUserOption((option) =>
      option.setName("utilisateur").setDescription("Utilisateur à qui ajouter la carte grise").setRequired(true)
    )
    .addAttachmentOption((option) =>
      option.setName("image").setDescription("Image de la carte grise").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("expiration").setDescription("Date d'expiration de la carte grise").setRequired(true)
    ),
  async execute(interaction) {
    const [CarteGriseRoles] = await db.execute(
      "SELECT role_id FROM role_permissions WHERE guild_id = ? AND permission_type = 'carte-grise'",
      [interaction.guild.id]
    );

    const member = interaction.member;
    const hasPermission = CarteGriseRoles.some((role) => member.roles.cache.has(role.role_id));
    if (!hasPermission) {
      return interaction.reply({
        content: "Vous n'avez pas la permission d'ajouter une carte grise.",
        ephemeral: true,
      });
    }

    const user = interaction.options.getUser("utilisateur");
    const image = interaction.options.getAttachment("image");

    await db.execute(
      "INSERT INTO carte-grise (guild_id, discord_id, image_path) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE image_path = ?",
      [interaction.guild.id, user.id, image.url, expiration, image.url, expiration]
    );

    return interaction.reply({
      content: `La carte grise pour ${user.username} a été ajoutée avec succès.`,
      ephemeral: true,
    });
  },
};
