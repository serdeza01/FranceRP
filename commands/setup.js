const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const db = require("../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("setup")
        .setDescription("Configurer différents systèmes")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand((subcommand) =>
            subcommand
                .setName("permis")
                .setDescription("Configurer les permis")
                .addRoleOption((option) =>
                    option
                        .setName("role")
                        .setDescription("Rôle autorisé pour ajouter/modifier les permis")
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("assurance")
                .setDescription("Configurer les assurances")
                .addRoleOption((option) =>
                    option
                        .setName("role")
                        .setDescription("Rôle autorisé pour ajouter/modifier les assurances")
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("ticket")
                .setDescription("Configurer les tickets")
                .addChannelOption((option) =>
                    option
                        .setName("channel")
                        .setDescription("Le salon où les tickets apparaîtront")
                        .setRequired(true)
                )
                .addChannelOption((option) =>
                    option
                        .setName("category")
                        .setDescription("La catégorie où les tickets seront créés")
                        .setRequired(true)
                )
                .addRoleOption((option) =>
                    option
                        .setName("role")
                        .setDescription("Le rôle qui a accès aux tickets")
                        .setRequired(true)
                )
                .addChannelOption((option) =>
                    option
                        .setName("transcript-channel")
                        .setDescription("Le salon où les transcripts seront envoyés")
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("panel-message")
                        .setDescription("Le message affiché dans le canal pour ouvrir un ticket")
                        .setRequired(true)
                )
                .addIntegerOption((option) =>
                    option
                        .setName("button-count")
                        .setDescription("Le nombre de boutons pour les tickets")
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("button-names")
                        .setDescription("Les noms des boutons, séparés par des virgules")
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("ticket-messages")
                        .setDescription("Les messages envoyés lors de l'ouverture des tickets, séparés par des virgules")
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("presence")
                .setDescription("Configurer la présence du staff")
                .addChannelOption((option) =>
                    option
                        .setName("channel")
                        .setDescription("Le salon où l'embed de présence sera envoyé")
                        .setRequired(true)
                )
                .addRoleOption((option) =>
                    option
                        .setName("role")
                        .setDescription("Le rôle du staff")
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: "❌ Vous devez être administrateur pour utiliser cette commande.",
                ephemeral: true,
            });
        }

        const guildId = interaction.guild.id;

        switch (interaction.options.getSubcommand()) {
            case "permis":
                const rolePermis = interaction.options.getRole("role");

                await db.execute(
                    "INSERT INTO role_permissions (guild_id, role_id, permission_type) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role_id = ?",
                    [guildId, rolePermis.id, "permis", rolePermis.id]
                );

                return interaction.reply({
                    content: `✅ Le rôle pour les permis a été configuré avec succès : ${rolePermis.name}.`,
                    ephemeral: true,
                });

            case "assurance":
                const roleAssurance = interaction.options.getRole("role");

                await db.execute(
                    "INSERT INTO role_permissions (guild_id, role_id, permission_type) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role_id = ?",
                    [guildId, roleAssurance.id, "assurance", roleAssurance.id]
                );

                return interaction.reply({
                    content: `✅ Le rôle pour les assurances a été configuré avec succès : ${roleAssurance.name}.`,
                    ephemeral: true,
                });

            case "ticket":
                const channel = interaction.options.getChannel("channel");
                const category = interaction.options.getChannel("category");
                const roleTicket = interaction.options.getRole("role");
                const transcriptChannel = interaction.options.getChannel("transcript-channel");
                const panelMessage = interaction.options.getString("panel-message");
                const buttonCount = interaction.options.getInteger("button-count");
                const buttonNames = interaction.options.getString("button-names")?.split(",");
                const ticketMessages = interaction.options.getString("ticket-messages")?.split(",");

                if (buttonNames.length !== buttonCount || ticketMessages.length !== buttonCount) {
                    return interaction.reply({
                        content: "❌ Le nombre de noms de boutons et de messages de ticket doit correspondre au nombre de boutons.",
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
                    content: `✅ Le système de tickets a été configuré avec succès.\n\n**Salon:** ${channel.name}\n**Catégorie:** ${category.name}\n**Rôle:** ${roleTicket.name}\n**Salon de transcript:** ${transcriptChannel.name}`,
                    ephemeral: true,
                });

            case "presence":
                const channelPresence = interaction.options.getChannel("channel");
                const rolePresence = interaction.options.getRole("role");

                const queryPresence = `
          INSERT INTO presence_config (guild_id, channel_id, role_id)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE channel_id = VALUES(channel_id), role_id = VALUES(role_id)
        `;
                await db.execute(queryPresence, [guildId, channelPresence.id, rolePresence.id]);

                return interaction.reply({
                    content: `✅ Le système de présence du staff a été configuré avec succès.\n**Salon:** ${channelPresence.name}\n**Rôle:** ${rolePresence.name}`,
                    ephemeral: true,
                });

            default:
                return interaction.reply({
                    content: "❌ Type de configuration non reconnu.",
                    ephemeral: true,
                });
        }
    },
};
