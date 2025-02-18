const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("add_user")
        .setDescription("Ajouter une personne au ticket.")
        .addUserOption((option) =>
            option.setName("personne").setDescription("Sélectionnez la personne").setRequired(true)
        ),
    async execute(interaction, { STAFF_ROLE_ID, ticketAuthorizedUsers, updateTicketEmbed, ticketChannelId }) {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!member.roles.cache.has(STAFF_ROLE_ID)) {
            return interaction.reply({
                content: "Vous n'avez pas la permission d'utiliser cette commande.",
                ephemeral: true,
            });
        }

        const targetUser = interaction.options.getUser("personne");
        // Ajoute l'ID de l'utilisateur au Set (pas de doublon dans un Set)
        ticketAuthorizedUsers.add(targetUser.tag);

        await updateTicketEmbed(interaction.guild, ticketChannelId);
        return interaction.reply({
            content: `${targetUser.username} a été ajouté au ticket.`,
            ephemeral: true,
        });
    },
};
