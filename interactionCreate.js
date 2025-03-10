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
    const robloxUsername =
      interaction.fields.getTextInputValue("roblox_username");
    const discordId = interaction.user.id;
    const verificationCode = generateVerificationCode();

    try {
      const queryInsert = `
        INSERT INTO user_roblox (discord_id, roblox_username, verification_code, verified)
        VALUES (?, ?, ?, 0)
        ON DUPLICATE KEY UPDATE roblox_username = VALUES(roblox_username), verification_code = VALUES(verification_code), verified = 0
      `;
      await db.execute(queryInsert, [
        discordId,
        robloxUsername,
        verificationCode,
      ]);

      await interaction.reply({
        content: `Ton code de vérification est : **${verificationCode}**.
Copie ce code dans ta bio (ou description) Roblox pour prouver que tu es bien le propriétaire du compte **${robloxUsername}**.
Ensuite, lance la commande \`/verifyroblox\` pour finaliser la vérification.`,
        ephemeral: true,
      });
    } catch (error) {
      console.error(
        "Erreur lors de l'enregistrement du compte Roblox :",
        error
      );
      await interaction.reply({
        content:
          "Une erreur est survenue lors de l'association de ton compte Roblox.",
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

    if (interaction.customId.startsWith("ticket_")) {
      const ticketIndex = interaction.customId.split("_")[1];

      const [rows] = await db.execute(
        "SELECT category_id, role_id, ticket_messages, embed_thumbnail FROM ticket_config WHERE guild_id = ?",
        [guild.id]
      );

      if (rows.length === 0) {
        return interaction.reply({
          content: "La configuration des tickets n'a pas été trouvée.",
          ephemeral: true,
        });
      }

      const { category_id, role_id, ticket_messages, embed_thumbnail } =
        rows[0];

      const ticketMessage = JSON.parse(ticket_messages)[ticketIndex].replace(
        /\//g,
        "\n"
      );

      const sanitizedDisplayName = interaction.member.displayName
        .replace(/\s+/g, "-")
        .toLowerCase();
      const channelName = `ticket-${sanitizedDisplayName}`;

      const category = guild.channels.cache.get(category_id);
      if (!category) {
        console.error("La catégorie n'existe pas.");
        return interaction.reply({
          content: "La catégorie spécifiée n'existe pas sur ce serveur.",
          ephemeral: true,
        });
      }

      const userTickets = guild.channels.cache.filter(
        (channel) =>
          channel.parentId === category.id &&
          channel.name.startsWith("ticket-") &&
          channel.name.includes(sanitizedDisplayName)
      );

      if (userTickets.size > 0) {
        await interaction.reply({
          content:
            "Vous avez déjà un ticket ouvert. Vous ne pouvez pas en créer un autre.",
          ephemeral: true,
        });
        return;
      }

      try {
        const user = interaction.user.id;
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
      
        const ticketEmbed = new EmbedBuilder()
          .setDescription(ticketMessage)
          .setColor(0x00aaff)
          .setFooter({
            text: `Ticket créé par ${interaction.user.tag}`,
            iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
          })
          .setTimestamp();
      
        if (
          embed_thumbnail &&
          typeof embed_thumbnail === "string" &&
          embed_thumbnail.trim().length > 0 &&
          (embed_thumbnail.startsWith("http://") ||
            embed_thumbnail.startsWith("https://"))
        ) {
          ticketEmbed.setThumbnail(embed_thumbnail);
        } else {
          console.log("Aucun thumbnail valide trouvé, l'embed sera envoyé sans thumbnail.");
        }
      
        await ticketChannel.send({ embeds: [ticketEmbed] });
      
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
        await ticketChannel.setTopic(interaction.user.id);
      } catch (err) {
        console.error("Erreur lors de la création du ticket :", err);
        await interaction.reply({
          content: "Une erreur est survenue lors de la création du ticket.",
          ephemeral: true,
        });
      }
    }

    // GESTION DE LA FERMETURE DU TICKET (affichage des options)
    if (interaction.customId === "close_ticket") {
      const ticketChannel = interaction.channel;
    
      await ticketChannel.permissionOverwrites.edit(interaction.user.id, {
        ViewChannel: false,
        SendMessages: false,
        ReadMessageHistory: false,
      }).catch(err => {
        console.error("Erreur lors de la révocation de l'accès pour le créateur :", err);
      });

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

    // GESTION DE LA FERMETURE FINALE DU TICKET AVEC TRANSCRIPT
    if (interaction.customId === "final_close_ticket") {
      const [config] = await db.execute(
        "SELECT role_id, transcript_channel_id FROM ticket_config WHERE guild_id = ?",
        [guild.id]
      );
      const { role_id, transcript_channel_id } = config[0];

      if (!interaction.member.roles.cache.has(role_id)) {
        return interaction.reply({
          content:
            "Vous n'êtes pas autorisé à fermer définitivement ce ticket.",
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

        const transcriptChannel = await guild.channels.fetch(
          transcript_channel_id
        );
        if (transcriptChannel) {
          await transcriptChannel.send({
            content: `Voici le transcript du ticket **${interaction.channel.name}** :`,
            files: [transcriptFile],
          });
        } else {
          console.error("Salon de transcript introuvable !");
        }
      } catch (err) {
        console.error(
          "Erreur lors de la création ou de l'envoi du transcript :",
          err
        );
      }

      setTimeout(() => {
        interaction.channel
          .delete()
          .catch((err) =>
            console.error("Erreur lors de la suppression du canal :", err)
          );
      }, 3000);
    }

    // GESTION DE LA FERMETURE SANS TRANSCRIPT
    if (interaction.customId === "close_ticket_no_transcript") {
      const [config] = await db.execute(
        "SELECT role_id FROM ticket_config WHERE guild_id = ?",
        [guild.id]
      );
      const { role_id } = config[0];

      if (!interaction.member.roles.cache.has(role_id)) {
        return interaction.reply({
          content:
            "Vous n'êtes pas autorisé à fermer définitivement ce ticket.",
          ephemeral: true,
        });
      }

      await interaction.reply({
        content: "Fermeture définitive du ticket...",
        ephemeral: true,
      });

      setTimeout(() => {
        interaction.channel
          .delete()
          .catch((err) =>
            console.error("Erreur lors de la suppression du canal :", err)
          );
      }, 3000);
    }

    // GESTION DE LA RÉOUVERTURE DU TICKET
    if (interaction.customId === "reopen_ticket") {
      const ticketChannel = interaction.channel;
      const creatorId = ticketChannel.topic;
      if (!creatorId) {
        return interaction.reply({
          content: "Impossible de retrouver le créateur du ticket.",
          ephemeral: true,
        });
      }
    
      await ticketChannel.permissionOverwrites.edit(creatorId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      }).catch(err => {
        console.error("Erreur lors de la réouverture du ticket pour le créateur :", err);
      });
    
      await interaction.reply({
        content: "Ce ticket a été réouvert.",
        ephemeral: true,
      });
    }    
  }
};