const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ajouter-assurance")
    .setDescription("Ajoute une assurance pour un utilisateur")
    .addUserOption((option) =>
      option.setName("utilisateur").setDescription("Utilisateur à qui ajouter une assurance").setRequired(true)
    )
    .addAttachmentOption((option) =>
      option.setName("image").setDescription("Image de la carte d'assurance").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("expiration").setDescription("Date d'expiration de l'assurance").setRequired(true)
    ),
  async execute(interaction) {
    const [assuranceRoles] = await db.execute(
      "SELECT role_id FROM role_permissions WHERE guild_id = ? AND permission_type = 'assurance'",
      [interaction.guild.id]
    );

    const member = interaction.member;
    const hasPermission = assuranceRoles.some((role) => member.roles.cache.has(role.role_id));
    if (!hasPermission) {
      return interaction.reply({
        content: "Vous n'avez pas la permission d'ajouter une assurance.",
        ephemeral: true,
      });
    }

    const user = interaction.options.getUser("utilisateur");
    const image = interaction.options.getAttachment("image");
    const expiration = interaction.options.getString("expiration");

    await db.execute(
      "INSERT INTO assurance (guild_id, discord_id, image_path, date_expiration) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE image_path = ?, date_expiration = ?",
      [interaction.guild.id, user.id, image.url, expiration, image.url, expiration]
    );

    return interaction.reply({
      content: `L'assurance pour ${user.username} a été ajoutée avec succès.`,
      ephemeral: true,
    });
  },
};
