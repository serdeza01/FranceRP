const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const db = require("../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("add_role")
        .setDescription("Ajouter un rôle au ticket.")
        .addRoleOption((option) =>
            option.setName("rôle").setDescription("Le rôle à ajouter au ticket").setRequired(true)
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
        if (!member.roles.cache.has(config[0].role_id)) {
            return interaction.reply({
                content: "Vous n'avez pas la permission d'utiliser cette commande.",
                ephemeral: true,
            });
        }

        const role = interaction.options.getRole("rôle");

        await interaction.channel.permissionOverwrites.edit(role, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
        });

        return interaction.reply({
            content: `Le rôle ${role.name} a été ajouté au ticket.`,
            ephemeral: true,
        });
    },
};
