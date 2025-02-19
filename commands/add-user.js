const { SlashCommandBuilder } = require("discord.js");
const db = require("../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("add_user")
        .setDescription("Ajouter un utilisateur au ticket.")
        .addUserOption((option) =>
            option.setName("utilisateur").setDescription("L'utilisateur à ajouter au ticket").setRequired(true)
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

        const user = interaction.options.getUser("utilisateur");

        await interaction.channel.permissionOverwrites.edit(user, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
        });

        return interaction.reply({
            content: `${user.username} a été ajouté au ticket.`,
            ephemeral: true,
        });
    },
};
