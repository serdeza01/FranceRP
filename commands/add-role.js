const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("add_role")
        .setDescription("Ajouter un rôle au ticket.")
        .addRoleOption((option) =>
            option.setName("rôle").setDescription("Sélectionnez le rôle à ajouter").setRequired(true)
        ),
    async execute(interaction, { STAFF_ROLE_ID, ticketAuthorizedRoles, updateTicketEmbed, ticketChannelId }) {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!member.roles.cache.has(STAFF_ROLE_ID)) {
            return interaction.reply({
                content: "Vous n'avez pas la permission d'utiliser cette commande.",
                ephemeral: true,
            });
        }

        const targetRole = interaction.options.getRole("rôle");
        ticketAuthorizedRoles.add(targetRole.name);

        await updateTicketEmbed(interaction.guild, ticketChannelId);
        return interaction.reply({
            content: `Le rôle ${targetRole.name} a été ajouté au ticket.`,
            ephemeral: true,
        });
    },
};
