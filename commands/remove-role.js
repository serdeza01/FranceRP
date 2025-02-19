const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("remove_role")
        .setDescription("Retirer un rôle du ticket.")
        .addRoleOption((option) =>
            option.setName("rôle").setDescription("Le rôle à retirer du ticket").setRequired(true)
        ),
    async execute(interaction) {
        const [config] = await db.execute("SELECT role_id FROM ticket_config WHERE guild_id = ?", [interaction.guild.id]);
        if (!config[0]) {
            return interaction.reply({
                content: "La configuration du ticket n'a pas été trouvée. Utilisez `/setup_ticket` pour configurer.",
                ephemeral: true,
            });
        }

        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!member.roles.cache.has(config[0].staff_role_id)) {
            return interaction.reply({
                content: "Vous n'avez pas la permission d'utiliser cette commande.",
                ephemeral: true,
            });
        }

        const role = interaction.options.getRole("rôle");

        await interaction.channel.permissionOverwrites.delete(role);

        return interaction.reply({
            content: `Le rôle ${role.name} a été retiré du ticket.`,
            ephemeral: true,
        });
    },
};
