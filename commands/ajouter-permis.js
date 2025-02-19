const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ajouter-permis")
    .setDescription("Ajoute un permis pour un utilisateur")
    .addUserOption((option) =>
      option.setName("utilisateur").setDescription("Utilisateur à qui ajouter un permis").setRequired(true)
    )
    .addAttachmentOption((option) =>
      option.setName("image").setDescription("Image du permis").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("expiration").setDescription("Date d'expiration (YYYY-MM-DD)").setRequired(true)
    ),
  async execute(interaction) {
    const [permisRoles] = await db.execute(
      "SELECT role_id FROM role_permissions WHERE guild_id = ? AND permission_type = 'permis'",
      [interaction.guild.id]
    );

    const member = interaction.member;
    const hasPermission = permisRoles.some((role) => member.roles.cache.has(role.role_id));
    if (!hasPermission) {
      return interaction.reply({
        content: "Vous n'avez pas la permission d'ajouter un permis.",
        ephemeral: true,
      });
    }

    const user = interaction.options.getUser("utilisateur");
    const image = interaction.options.getAttachment("image");
    const expiration = interaction.options.getString("expiration");

    await db.execute(
      "INSERT INTO permis (guild_id, discord_id, image_path, expiration_date) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE image_path = ?, expiration_date = ?",
      [interaction.guild.id, user.id, image.url, expiration, image.url, expiration]
    );

    return interaction.reply({
      content: `Le permis pour ${user.username} a été ajouté avec succès.`,
      ephemeral: true,
    });
  },
};
