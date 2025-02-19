const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require("discord.js");
const db = require("../db");

async function updatePresenceEmbed(guild, channelId) {
  try {
    const [rows] = await db.execute(
      "SELECT user_id, username FROM staff_presence WHERE present = true"
    );

    const availableStaff = rows.map(row => `- <@${row.user_id}>`).join("\n") || "Aucun";

    const file = new AttachmentBuilder("./image.png");
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle("Statut des Staffs disponibles en jeu")
      .setTimestamp()
      .setThumbnail("attachment://image.png")
      .addFields({
        name: "Disponibles",
        value: availableStaff,
        inline: false,
      });

    const channel = await guild.client.channels.fetch(channelId);
    if (!channel) {
      throw new Error(`Salon de présence introuvable (ID: ${channelId}).`);
    }

    const [existingMessages] = await db.execute(
      "SELECT message_id FROM embed_messages WHERE name = 'presence' AND channel_id = ?",
      [channelId]
    );

    if (existingMessages.length > 0) {
      try {
        const existingMessage = await channel.messages.fetch(existingMessages[0].message_id);
        await existingMessage.edit({ embeds: [embed], files: [file] });
        return;
      } catch (error) {
        console.error("Message de présence introuvable, un nouveau sera envoyé.");
      }
    }

    const newMessage = await channel.send({ embeds: [embed], files: [file] });
    await db.execute(
      "INSERT INTO embed_messages (name, message_id, channel_id) VALUES ('presence', ?, ?) ON DUPLICATE KEY UPDATE message_id = VALUES(message_id), channel_id = VALUES(channel_id)",
      [newMessage.id, channelId]
    );
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'embed de présence :", error);
  }
}

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
  async execute(interaction) {
    try {
      const status = interaction.options.getString("statut");
      const user = interaction.user;

      const [config] = await db.execute(
        "SELECT role_id, channel_id FROM presence_config WHERE guild_id = ?",
        [interaction.guild.id]
      );

      if (config.length === 0) {
        return interaction.reply({
          content: "La configuration de présence n'a pas été trouvée. Utilisez `/setup_presence` pour configurer.",
          ephemeral: true,
        });
      }

      const { role_id, channel_id } = config[0];
      const member = await interaction.guild.members.fetch(user.id);

      if (!member.roles.cache.has(role_id)) {
        return interaction.reply({
          content: "Vous n'avez pas la permission d'utiliser cette commande.",
          ephemeral: true,
        });
      }

      await db.execute(
        "INSERT INTO staff_presence (user_id, username, present) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE username = VALUES(username), present = VALUES(present)",
        [user.id, user.username, status === "disponible"]
      );

      await updatePresenceEmbed(interaction.guild, channel_id);

      await interaction.reply({
        content: `Vous êtes maintenant marqué comme ${status}.`,
        ephemeral: true,
      });
    } catch (error) {
      console.error("Erreur lors de la mise à jour de la présence :", error);
      await interaction.reply({
        content: "Une erreur est survenue lors de la mise à jour de ta présence.",
        ephemeral: true,
      });
    }
  },
};
