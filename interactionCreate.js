const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  AttachmentBuilder,
} = require("discord.js");

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

    // Ajouter le pseudo d'affichage de l'utilisateur dans le nom du canal (en remplaçant les espaces par des tirets et en minuscule)
    const sanitizedDisplayName = interaction.member.displayName
      .replace(/\s+/g, "-")
      .toLowerCase();
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
          // Vous pouvez ajouter ici d'autres permissions pour le staff
        ],
      });

      // Ping de l'utilisateur dans le ticket
      await ticketChannel.send({ content: `<@${interaction.user.id}>` });

      // Préparer l'image pour le thumbnail
      const imageAttachment = new AttachmentBuilder("./image.png").setName(
        "image.png"
      );

      // Création de l'embed d'accueil du ticket avec le thumbnail
      const ticketEmbed = new EmbedBuilder()
        .setDescription(messageContent)
        .setColor(0x00ae86)
        .setThumbnail("attachment://image.png");

      // Ajout d'un bouton "Fermer le ticket"
      const closeButtonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("close_ticket")
          .setLabel("Fermer le ticket")
          .setStyle(ButtonStyle.Danger)
      );

      // Envoi de l'embed avec l'image jointe
      await ticketChannel.send({
        embeds: [ticketEmbed],
        components: [closeButtonRow],
        files: [imageAttachment],
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
    const ticketChannel = interaction.channel;
    try {
      // Désactiver l'envoi de messages pour @everyone
      await ticketChannel.permissionOverwrites.edit(guild.id, {
        SendMessages: false,
      });
      // Autoriser le staff à envoyer des messages (ID du rôle : 1304151263851708458)
      await ticketChannel.permissionOverwrites.edit("1304151263851708458", {
        SendMessages: true,
      });

      // Création d'un embed indiquant la fermeture du ticket et proposant des actions
      const closeEmbed = new EmbedBuilder()
        .setDescription("Le ticket va être fermé. Choisissez une option :")
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
    } catch (error) {
      console.error("Erreur lors de la fermeture du ticket :", error);
      await interaction.reply({
        content: "Erreur lors de la fermeture du ticket.",
        ephemeral: true,
      });
    }
  }

  // --- Gestion du bouton "final_close_ticket" (Transcript & Fermer) ---
  if (interaction.customId === "final_close_ticket") {
    // Vérifier les permissions du membre (ici, la fermeture définitive est réservée au staff)
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
      // Récupérer l'ensemble des messages du canal (vous pouvez augmenter le limit si nécessaire)
      const fetchedMessages = await interaction.channel.messages.fetch({
        limit: 100,
      });
      // Tri des messages par ordre chronologique
      const sortedMessages = fetchedMessages.sort(
        (a, b) => a.createdTimestamp - b.createdTimestamp
      );

      // Construction du transcript au format texte
      let transcriptText = `Transcript du ticket: ${interaction.channel.name}\n\n`;
      sortedMessages.forEach((msg) => {
        const timestamp = new Date(msg.createdTimestamp).toLocaleString();
        transcriptText += `[${timestamp}] ${msg.author.tag}: ${msg.content}\n`;
      });

      // Création d'un buffer à partir du transcript
      const transcriptBuffer = Buffer.from(transcriptText, "utf-8");

      // Création d'un attachement avec le transcript
      const transcriptFile = new AttachmentBuilder(transcriptBuffer, {
        name: `transcript-${interaction.channel.name}.txt`,
      });

      // Optionnel : sauvegarder le transcript dans votre base de données MySQL (via un appel à votre script PHP ou une requête HTTP)
      // Par exemple (pseudo-code) :
      // await saveTranscriptInDatabase(interaction.channel.id, transcriptText);
      // La fonction saveTranscriptInDatabase devra être implémentée pour faire une requête vers votre API/PHP.

      // Vous pouvez également générer un lien personnalisé pour consulter le transcript,
      // si votre API retourne une URL spécifique après stockage.
      // Par exemple :
      // const transcriptUrl = await getTranscriptUrl(interaction.channel.id);

      // Si vous ne souhaitez pas afficher le lien dans Discord, vous pouvez le logger ou l’envoyer dans un salon spécifique.
      // Exemple d'envoi dans un salon de logs :
      const transcriptChannel = await interaction.guild.channels.fetch(
        "1304216761930879057"
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

    // Suppression du canal après 3 secondes
    setTimeout(() => {
      interaction.channel
        .delete()
        .catch((err) =>
          console.error("Erreur lors de la suppression du canal :", err)
        );
    }, 3000);
  }

  // --- Gestion du bouton "close_ticket_no_transcript" ---
  if (interaction.customId === "close_ticket_no_transcript") {
    // Vérifier toujours la permission si besoin (par exemple, réservé au staff)
    if (!interaction.member.roles.cache.has("1304151263851708458")) {
      return interaction.reply({
        content: "Vous n'êtes pas autorisé à fermer définitivement ce ticket.",
        ephemeral: true,
      });
    }

    await interaction.reply({
      content: "Fermeture définitive du ticket sans transcript...",
      ephemeral: true,
    });

    // Vous pouvez, si besoin, ajouter ici une logique de sauvegarde minimale (par exemple notifier un log interne)

    // Suppression du canal après 3 secondes sans création de transcript
    setTimeout(() => {
      interaction.channel
        .delete()
        .catch((err) =>
          console.error("Erreur lors de la suppression du canal :", err)
        );
    }, 3000);
  }

  // --- Gestion du bouton "reopen_ticket" (Réouvrir le ticket) ---
  if (interaction.customId === "reopen_ticket") {
    try {
      // Réactivation des permissions pour le créateur du ticket (et @everyone si souhaité)
      await interaction.channel.permissionOverwrites.edit(guild.id, {
        SendMessages: null,
      });
      await interaction.channel.permissionOverwrites.edit(
        "1304151263851708458",
        { SendMessages: true }
      );

      await interaction.reply({
        content:
          "Ticket réouvert, vous pouvez à nouveau échanger dans ce canal.",
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
