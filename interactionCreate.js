const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  AttachmentBuilder,
} = require("discord.js");

const db = require("./db");
if (
  typeof interaction !== "undefined" &&
  interaction.isModalSubmit() &&
  interaction.customId === "connectRobloxModal"
) {
  const generateVerificationCode = (length = 6) => {
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let code = "";
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  (async () => {
    const robloxUsername = interaction.fields.getTextInputValue("roblox_username");
    const discordId = interaction.user.id;
    const verificationCode = generateVerificationCode();

    try {
      const queryInsert = `
        INSERT INTO user_roblox (discord_id, roblox_username, verification_code, verified)
        VALUES (?, ?, ?, 0)
        ON DUPLICATE KEY UPDATE roblox_username = VALUES(roblox_username), verification_code = VALUES(verification_code), verified = 0
      `;
      await db.execute(queryInsert, [discordId, robloxUsername, verificationCode]);

      await interaction.reply({
        content: `Ton code de vérification est : **${verificationCode}**.
Copie ce code dans ta bio (ou description) Roblox pour prouver que tu es bien le propriétaire du compte **${robloxUsername}**.
Ensuite, lance la commande \`/verifyroblox\` pour finaliser la vérification.`,
        ephemeral: true,
      });
    } catch (error) {
      console.error("Erreur lors de l'enregistrement du compte Roblox :", error);
      await interaction.reply({
        content: "Une erreur est survenue lors de l'association de ton compte Roblox.",
        ephemeral: true,
      });
    }
  })();

  return;
}

module.exports = async (interaction) => {
  if (interaction.isCommand()) {
    // Vous pouvez ajouter ici la gestion d'autres commandes slash si nécessaire
    return;
  }

  if (interaction.isButton()) {
    const guild = interaction.guild;

    if (interaction.customId.startsWith('ticket_')) {
      const ticketIndex = interaction.customId.split('_')[1];
      const [rows] = await db.execute("SELECT category_id, role_id, ticket_messages FROM ticket_config WHERE guild_id = ?", [guild.id]);

      if (rows.length === 0) {
        return interaction.reply({
          content: "La configuration des tickets n'a pas été trouvée.",
          ephemeral: true,
        });
      }

      const { category_id, role_id, ticket_messages } = rows[0];
      const ticketMessage = JSON.parse(ticket_messages)[ticketIndex];

      const sanitizedDisplayName = interaction.member.displayName.replace(/\s+/g, '-').toLowerCase();
      const channelName = `ticket-${sanitizedDisplayName}`;

      const category = guild.channels.cache.get(category_id);
      if (!category) return console.error("La catégorie n'existe pas.");

      const userTickets = category.children.filter(channel => {
        return channel.name.startsWith(`ticket-`) && channel.name.includes(sanitizedDisplayName);
      });

      if (userTickets.size > 0) {
        await interaction.reply({
          content: "Vous avez déjà un ticket ouvert. Vous ne pouvez pas en créer un autre.",
          ephemeral: true,
        });
        return;
      }

      try {
        const ticketChannel = await guild.channels.create({
          name: channelName,
          parent: category_id,
          permissionOverwrites: [
            {
              id: guild.id,
              deny: ["ViewChannel"],
            },
            {
              id: interaction.user.id,
              allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
            },
            {
              id: role_id,
              allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
            },
          ],
        });

        await ticketChannel.send({ content: `<@${interaction.user.id}>` });
        await ticketChannel.send({ content: ticketMessage });

        const closeButtonRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("close_ticket")
            .setLabel("Fermer le ticket")
            .setStyle(ButtonStyle.Danger)
        );

        await ticketChannel.send({ components: [closeButtonRow] });

        await interaction.reply({
          content: `Votre ticket a été créé : ${ticketChannel}`,
          ephemeral: true,
        });
      } catch (err) {
        console.error("Erreur lors de la création du ticket :", err);
        await interaction.reply({
          content: "Une erreur est survenue lors de la création du ticket.",
          ephemeral: true,
        });
      }
    }

    if (interaction.customId === "close_ticket") {
      const ticketChannel = interaction.channel;
      const [config] = await db.execute("SELECT role_id FROM ticket_config WHERE guild_id = ?", [guild.id]);
      const { role_id } = config[0];

      if (!interaction.member.roles.cache.has(role_id)) {
        return interaction.reply({
          content: "Vous n'êtes pas autorisé à fermer ce ticket.",
          ephemeral: true,
        });
      }

      const closeEmbed = new EmbedBuilder()
        .setDescription("Le ticket va être fermé. Choisissez une option :")
        .setColor(0xff0000);

      const closeOptionsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("final_close_ticket")
          .setLabel("Transcript & Fermer")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("close_ticket_no_transcript")
          .setLabel("Fermer sans Transcript")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("reopen_ticket")
          .setLabel("Réouvrir le ticket")
          .setStyle(ButtonStyle.Success)
      );

      await ticketChannel.send({
        embeds: [closeEmbed],
        components: [closeOptionsRow],
      });
    }

    if (interaction.customId === "final_close_ticket") {
      const [config] = await db.execute("SELECT role_id, transcript_channel_id FROM ticket_config WHERE guild_id = ?", [guild.id]);
      const { role_id, transcript_channel_id } = config[0];

      if (!interaction.member.roles.cache.has(role_id)) {
        return interaction.reply({
          content: "Vous n'êtes pas autorisé à fermer définitivement ce ticket.",
          ephemeral: true,
        });
      }

      await interaction.reply({
        content: "Création du transcript et fermeture définitive du ticket...",
        ephemeral: true,
      });

      try {
        const fetchedMessages = await interaction.channel.messages.fetch({
          limit: 100,
        });
        const sortedMessages = fetchedMessages.sort(
          (a, b) => a.createdTimestamp - b.createdTimestamp
        );

        let transcriptText = `Transcript du ticket: ${interaction.channel.name}\n\n`;
        sortedMessages.forEach((msg) => {
          const timestamp = new Date(msg.createdTimestamp).toLocaleString();
          transcriptText += `[${timestamp}] ${msg.author.tag}: ${msg.content}\n`;
        });

        const transcriptBuffer = Buffer.from(transcriptText, "utf-8");
        const transcriptFile = new AttachmentBuilder(transcriptBuffer, {
          name: `transcript-${interaction.channel.name}.txt`,
        });

        const transcriptChannel = await guild.channels.fetch(transcript_channel_id);
        if (transcriptChannel) {
          await transcriptChannel.send({
            content: `Voici le transcript du ticket **${interaction.channel.name}** :`,
            files: [transcriptFile],
          });
        } else {
          console.error("Salon de transcript introuvable !");
        }
      } catch (err) {
        console.error("Erreur lors de la création ou de l'envoi du transcript :", err);
      }

      setTimeout(() => {
        interaction.channel.delete().catch((err) => console.error("Erreur lors de la suppression du canal :", err));
      }, 3000);
    }

    if (interaction.customId === "close_ticket_no_transcript") {
      const [config] = await db.execute("SELECT role_id FROM ticket_config WHERE guild_id = ?", [guild.id]);
      const { role_id } = config[0];

      if (!interaction.member.roles.cache.has(role_id)) {
        return interaction.reply({
          content: "Vous n'êtes pas autorisé à fermer définitivement ce ticket.",
          ephemeral: true,
        });
      }

      await interaction.reply({
        content: "Fermeture définitive du ticket...",
        ephemeral: true,
      });

      setTimeout(() => {
        interaction.channel.delete().catch((err) => console.error("Erreur lors de la suppression du canal :", err));
      }, 3000);
    }

    if (interaction.customId === "reopen_ticket") {
      const [config] = await db.execute("SELECT role_id FROM ticket_config WHERE guild_id = ?", [guild.id]);
      const { role_id } = config[0];

      if (!interaction.member.roles.cache.has(role_id)) {
        return interaction.reply({
          content: "Vous n'êtes pas autorisé à réouvrir ce ticket.",
          ephemeral: true,
        });
      }

      await interaction.channel.permissionOverwrites.edit(interaction.guild.id, {
        ViewChannel: true,
      });

      await interaction.reply({
        content: "Ce ticket a été réouvert.",
        ephemeral: true,
      });
    }
  }
};

