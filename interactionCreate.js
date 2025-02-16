const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, AttachmentBuilder } = require("discord.js");

module.exports = async (interaction) => {
  if (!interaction.isButton()) return;

  const guild = interaction.guild;
  // ID de la catégorie où les tickets seront créés.
  const categoryId = "1304200059851640863";

  // --- Création du ticket selon le bouton cliqué ---
  if (
    interaction.customId === "ticket_support" ||
    interaction.customId === "ticket_unban" ||
    interaction.customId === "ticket_gang"
  ) {
    let baseChannelName, messageContent;

    if (interaction.customId === "ticket_support") {
      baseChannelName = "dmd-aide";
      messageContent =
        "Merci d'avoir contacté le support de RP France, merci de décrire votre problème et de patienter le temps qu'un membre du staff prenne en charge votre demande.";
    } else if (interaction.customId === "ticket_unban") {
      baseChannelName = "dmd-unban";
      messageContent =
        "Merci d'avoir ouvert un ticket, pour votre demande d'unban merci de nous donner votre @ sur roblox et pourquoi vous avez été banni";
    } else if (interaction.customId === "ticket_gang") {
      baseChannelName = "candid-gang";
      messageContent =
        "Merci d'avoir ouvert un ticket, pour la création d'un gang il vous sera demandé de répondre aux questions ci-dessous :\n\n• Le nom de gang\n• Où va-t-il se situer en ville ?\n• L’historie du gang / ce que tu veux faire avec ce gang\n• La hiérarchie / les potentiels membres dans ton gang\n• Le logo\n\nPuis patienter le temps qu'un membre du staff prenne en charge votre ticket.";
    }

    // Utilisation du displayName pour le nom du salon de ticket (on remplace les espaces par des tirets)
    const sanitizedDisplayName = interaction.member.displayName.replace(/\s+/g, '-').toLowerCase();
    const channelName = `${baseChannelName}-${sanitizedDisplayName}`;

    // Création du salon dans la catégorie
    try {
      const ticketChannel = await guild.channels.create({
        name: channelName,
        parent: categoryId,
        permissionOverwrites: [
          // Tout le monde ne peut pas voir le canal
          {
            id: guild.id,
            deny: ["ViewChannel"],
          },
          // Le créateur du ticket peut voir et écrire
          {
            id: interaction.user.id,
            allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
          },
          // La gestion additionnelle des permissions pour le staff peut être ajoutée ici si besoin
        ],
      });

      // Ping de l'utilisateur dans le ticket
      await ticketChannel.send({ content: `<@${interaction.user.id}>` });

      // Préparation de l'image en pièce jointe pour le thumbnail
      const imageAttachment = new AttachmentBuilder("./image.png").setName("image.png");

      // Envoi du message d'accueil dans le ticket avec le texte approprié et le thumbnail
      const ticketEmbed = new EmbedBuilder()
        .setDescription(messageContent)
        .setColor(0x00ae86)
        .setThumbnail("attachment://image.png");

      // Ajout d'un bouton "Fermer le ticket"
      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("close_ticket")
          .setLabel("Fermer le ticket")
          .setStyle(ButtonStyle.Danger)
      );

      // Envoi de l'embed avec la pièce jointe image.png
      await ticketChannel.send({
        embeds: [ticketEmbed],
        components: [closeRow],
        files: [imageAttachment]
      });

      // Répondre à l'interaction pour confirmer la création du ticket (réponse éphémère)
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

  // --- Gestion du bouton "Fermer le ticket" ---
  if (interaction.customId === "close_ticket") {
    // À la fermeture, nous souhaitons que seul le staff (rôle 1304151263851708458) puisse écrire
    const ticketChannel = interaction.channel;
    try {
      // Désactiver les envois pour @everyone
      await ticketChannel.permissionOverwrites.edit(guild.id, { SendMessages: false });
      // Autoriser le staff à envoyer des messages (ID du rôle : 1304151263851708458)
      await ticketChannel.permissionOverwrites.edit("1304151263851708458", { SendMessages: true });

      // Envoi d'un second embed avec 2 boutons dans le ticket
      const closeEmbed = new EmbedBuilder()
        .setDescription("Le ticket vient d'être fermé, merci de choisir ce que vous souhaitez faire.")
        .setColor(0xff0000);

      const closeOptionsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("final_close_ticket")
          .setLabel("Fermer le ticket")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("reopen_ticket")
          .setLabel("Réouvrir le ticket")
          .setStyle(ButtonStyle.Success)
      );

      await ticketChannel.send({ embeds: [closeEmbed], components: [closeOptionsRow] });

    } catch (error) {
      console.error("Erreur lors de la fermeture du ticket :", error);
      await interaction.reply({
        content: "Erreur lors de la fermeture du ticket.",
        ephemeral: true,
      });
    }
  }

  // --- Gestion du bouton "final_close_ticket" (fermeture définitive) ---
  if (interaction.customId === "final_close_ticket") {
    if (!interaction.member.roles.cache.has("1304151263851708458")) {
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
      // Récupérer l'ensemble des messages du canal
      const fetchedMessages = await interaction.channel.messages.fetch({ limit: 100 });
      // Pour être sûr d'avoir l'ordre chronologique
      const sortedMessages = fetchedMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

      // Construction du transcript en format texte
      let transcriptText = `Transcript du ticket: ${interaction.channel.name}\n\n`;
      sortedMessages.forEach(msg => {
        const timestamp = new Date(msg.createdTimestamp).toLocaleString();
        transcriptText += `[${timestamp}] ${msg.author.tag}: ${msg.content}\n`;
      });

      // Création d'un buffer à partir du transcript
      const transcriptBuffer = Buffer.from(transcriptText, "utf-8");

      // Créer l'attachement du transcript
      const transcriptFile = new AttachmentBuilder(transcriptBuffer, { name: `transcript-${interaction.channel.name}.txt` });

      // Récupérer le salon de destination pour le transcript
      const transcriptChannel = await interaction.guild.channels.fetch("1304216761930879057");
      if (transcriptChannel) {
        await transcriptChannel.send({
          content: `Voici le transcript du ticket **${interaction.channel.name}** :`,
          files: [transcriptFile]
        });
      } else {
        console.error("Salon de transcript introuvable !");
      }
    } catch (err) {
      console.error("Erreur lors de la création ou de l'envoi du transcript :", err);
    }

    // Suppression du canal après 3 secondes
    setTimeout(() => {
      interaction.channel
        .delete()
        .catch((err) =>
          console.error("Erreur lors de la suppression du canal :", err)
        );
    }, 3000);
  }

  // --- Gestion du bouton "reopen_ticket" (réouverture du ticket) ---
  if (interaction.customId === "reopen_ticket") {
    try {
      // Rétablir les permissions pour permettre au créateur (et @everyone si souhaité) d'écrire à nouveau.
      await interaction.channel.permissionOverwrites.edit(guild.id, { SendMessages: null });
      await interaction.channel.permissionOverwrites.edit("1304151263851708458", { SendMessages: true });

      await interaction.reply({
        content: "Ticket réouvert, vous pouvez à nouveau échanger dans ce canal.",
        ephemeral: true,
      });
    } catch (err) {
      console.error("Erreur lors de la réouverture du ticket :", err);
      await interaction.reply({
        content: "Erreur lors de la réouverture du ticket.",
        ephemeral: true,
      });
    }
  }
};
