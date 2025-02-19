const { SlashCommandBuilder } = require("@discordjs/builders");
const db = require("../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("setup")
        .setDescription("Configurer différents systèmes")
        .addStringOption((option) =>
            option
                .setName("type")
                .setDescription("Le type de configuration à effectuer")
                .setRequired(true)
                .addChoices(
                    { name: "Permis", value: "permis" },
                    { name: "Assurance", value: "assurance" },
                    { name: "Ticket", value: "ticket" },
                    { name: "Présence", value: "presence" }
                )
        )
        .addRoleOption((option) =>
            option
                .setName("role-permis")
                .setDescription("Rôle autorisé pour ajouter/modifier les permis")
                .setRequired(false)
        )
        .addRoleOption((option) =>
            option
                .setName("role-assurance")
                .setDescription("Rôle autorisé pour ajouter/modifier les assurances")
                .setRequired(false)
        )
        .addChannelOption((option) =>
            option
                .setName("channel-ticket")
                .setDescription("Le salon où les tickets apparaîtront")
                .setRequired(false)
        )
        .addChannelOption((option) =>
            option
                .setName("category-ticket")
                .setDescription("La catégorie où les tickets seront créés")
                .setRequired(false)
        )
        .addRoleOption((option) =>
            option
                .setName("role-ticket")
                .setDescription("Le rôle qui a accès aux tickets")
                .setRequired(false)
        )
        .addChannelOption((option) =>
            option
                .setName("transcript-channel-ticket")
                .setDescription("Le salon où les transcripts seront envoyés")
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("panel-message-ticket")
                .setDescription("Le message affiché dans le canal pour ouvrir un ticket")
                .setRequired(false)
        )
        .addIntegerOption((option) =>
            option
                .setName("button-count-ticket")
                .setDescription("Le nombre de boutons pour les tickets")
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("button-names-ticket")
                .setDescription("Les noms des boutons, séparés par des virgules")
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("ticket-messages-ticket")
                .setDescription("Les messages envoyés lors de l'ouverture des tickets, séparés par des virgules")
                .setRequired(false)
        )
        .addChannelOption((option) =>
            option
                .setName("channel-presence")
                .setDescription("Le salon où l'embed de présence sera envoyé")
                .setRequired(false)
        )
        .addRoleOption((option) =>
            option
                .setName("role-presence")
                .setDescription("Le rôle du staff")
                .setRequired(false)
        ),
    async execute(interaction) {
        const type = interaction.options.getString("type");
        const guildId = interaction.guild.id;

        switch (type) {
            case "permis":
                const rolePermis = interaction.options.getRole("role-permis");
                if (!rolePermis) {
                    return interaction.reply({
                        content: "Le rôle pour les permis est requis.",
                        ephemeral: true,
                    });
                }

                await db.execute(
                    "INSERT INTO role_permissions (guild_id, role_id, permission_type) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role_id = ?",
                    [guildId, rolePermis.id, "permis", rolePermis.id]
                );

                return interaction.reply({
                    content: `Le rôle pour les permis a été configuré avec succès : ${rolePermis.name}.`,
                    ephemeral: true,
                });

            case "assurance":
                const roleAssurance = interaction.options.getRole("role-assurance");
                if (!roleAssurance) {
                    return interaction.reply({
                        content: "Le rôle pour les assurances est requis.",
                        ephemeral: true,
                    });
                }

                await db.execute(
                    "INSERT INTO role_permissions (guild_id, role_id, permission_type) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role_id = ?",
                    [guildId, roleAssurance.id, "assurance", roleAssurance.id]
                );

                return interaction.reply({
                    content: `Le rôle pour les assurances a été configuré avec succès : ${roleAssurance.name}.`,
                    ephemeral: true,
                });

            case "ticket":
                const channel = interaction.options.getChannel("channel-ticket");
                const category = interaction.options.getChannel("category-ticket");
                const roleTicket = interaction.options.getRole("role-ticket");
                const transcriptChannel = interaction.options.getChannel("transcript-channel-ticket");
                const panelMessage = interaction.options.getString("panel-message-ticket");
                const buttonCount = interaction.options.getInteger("button-count-ticket");
                const buttonNames = interaction.options.getString("button-names-ticket")?.split(",");
                const ticketMessages = interaction.options.getString("ticket-messages-ticket")?.split(",");

                if (
                    !channel ||
                    !category ||
                    !roleTicket ||
                    !transcriptChannel ||
                    !panelMessage ||
                    !buttonCount ||
                    !buttonNames ||
                    !ticketMessages
                ) {
                    return interaction.reply({
                        content: "Tous les paramètres pour le système de tickets sont requis.",
                        ephemeral: true,
                    });
                }

                if (buttonNames.length !== buttonCount || ticketMessages.length !== buttonCount) {
                    return interaction.reply({
                        content: "Le nombre de noms de boutons et de messages de ticket doit correspondre au nombre de boutons.",
                        ephemeral: true,
                    });
                }

                const queryTicket = `
          INSERT INTO ticket_config (guild_id, channel_id, category_id, role_id, transcript_channel_id, panel_message, button_names, ticket_messages)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE 
            channel_id = VALUES(channel_id), 
            category_id = VALUES(category_id), 
            role_id = VALUES(role_id),
            transcript_channel_id = VALUES(transcript_channel_id),
            panel_message = VALUES(panel_message),
            button_names = VALUES(button_names),
            ticket_messages = VALUES(ticket_messages)
        `;
                await db.execute(queryTicket, [
                    guildId,
                    channel.id,
                    category.id,
                    roleTicket.id,
                    transcriptChannel.id,
                    panelMessage,
                    JSON.stringify(buttonNames),
                    JSON.stringify(ticketMessages),
                ]);

                return interaction.reply({
                    content: `Le système de tickets a été configuré avec succès.\nSalon: ${channel.name}\nCatégorie: ${category.name}\nRôle: ${roleTicket.name}\nSalon de transcript: ${transcriptChannel.name}`,
                    ephemeral: true,
                });

            case "presence":
                const channelPresence = interaction.options.getChannel("channel-presence");
                const rolePresence = interaction.options.getRole("role-presence");

                if (!channelPresence || !rolePresence) {
                    return interaction.reply({
                        content: "Le salon et le rôle pour la présence sont requis.",
                        ephemeral: true,
                    });
                }

                const queryPresence = `
          INSERT INTO presence_config (guild_id, channel_id, role_id)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE channel_id = VALUES(channel_id), role_id = VALUES(role_id)
        `;
                await db.execute(queryPresence, [guildId, channelPresence.id, rolePresence.id]);

                return interaction.reply({
                    content: `Le système de présence du staff a été configuré avec succès.\nSalon: ${channelPresence.name}\nRôle: ${rolePresence.name}`,
                    ephemeral: true,
                });

            default:
                return interaction.reply({
                    content: "Type de configuration non reconnu.",
                    ephemeral: true,
                });
        }
    },
};
