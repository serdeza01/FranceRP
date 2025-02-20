const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const db = require("../db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("deleteconfig")
    .setDescription("Supprime la configuration actuelle des tickets."),
  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
            content: "❌ Vous devez être administrateur pour utiliser cette commande.",
            ephemeral: true,
        });
    }

    try {
      const guildId = interaction.guild.id;

      const [rows] = await db.execute(
        "SELECT channel_id, message_id FROM embed_messages WHERE name = 'ticket_panel'",
        "SELECT channel_id FROM ticket_config WHERE guild_id = ?"
        [guildId]
      );

      if (rows.length > 0) {
        const { channel_id, message_id } = rows[0];
        const channel = await interaction.guild.channels.fetch(channel_id);

        if (channel) {
          try {
            const message = await channel.messages.fetch(message_id);
            await message.delete();
            console.log("Panneau de ticket supprimé avec succès.");
          } catch (error) {
            console.error("Erreur lors de la suppression du message du panneau :", error);
          }
        }
      }

      await db.execute("DELETE FROM ticket_config WHERE guild_id = ?", [guildId]);
      await db.execute("DELETE FROM embed_messages WHERE channel_id = ? AND name = 'ticket_panel'", [channel_id]);

      await interaction.reply({
        content: "✅ La configuration des tickets a été supprimée avec succès.",
        ephemeral: true,
      });

      console.log(`Configuration des tickets supprimée pour le serveur : ${interaction.guild.name}`);
    } catch (error) {
      console.error("Erreur lors de la suppression de la configuration des tickets :", error);
      await interaction.reply({
        content: "❌ Une erreur s'est produite lors de la suppression de la configuration.",
        ephemeral: true,
      });
    }
  },
};
