const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const db = require("../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("assign-characters")
        .setDescription("Attribuer deux personnages à un utilisateur")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addUserOption(opt =>
            opt
                .setName("user")
                .setDescription("L'utilisateur à qui on attribue les persos")
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt
                .setName("name1")
                .setDescription("Nom du premier personnage")
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt
                .setName("job1_1")
                .setDescription("Métier 1 du premier personnage")
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt
                .setName("job1_2")
                .setDescription("Métier 2 du premier personnage")
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt
                .setName("name2")
                .setDescription("Nom du deuxième personnage")
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt
                .setName("job2_1")
                .setDescription("Métier 1 du deuxième personnage")
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt
                .setName("job2_2")
                .setDescription("Métier 2 du deuxième personnage")
                .setRequired(false)
        ),

    async execute(interaction) {
        const ALLOWED_ROLES = [
            "1313029840328327248",
            "1304151263851708458",
            "962270129511604224",
        ];

        if (
            !interaction.member.roles.cache.some((r) =>
                ALLOWED_ROLES.includes(r.id)
            )
        ) {
            return interaction.reply({
                content: "❌ Vous n’avez pas la permission d’utiliser cette commande.",
                ephemeral: true,
            });
        }
        const guildId = interaction.guild.id;
        const target = interaction.options.getUser("user");
        const name1 = interaction.options.getString("name1");
        const job1_1 = interaction.options.getString("job1_1") ?? null;
        const job1_2 = interaction.options.getString("job1_2") ?? null;
        const name2 = interaction.options.getString("name2");
        const job2_1 = interaction.options.getString("job2_1") ?? null;
        const job2_2 = interaction.options.getString("job2_2") ?? null;

        try {
            await db.execute(
                "DELETE FROM characters WHERE guild_id = ? AND user_id = ?",
                [guildId, target.id]
            );

            await db.execute(
                "INSERT INTO characters (guild_id, user_id, slot, name, job1, job2) VALUES (?,?,?,?,?,?)",
                [guildId, target.id, 1, name1, job1_1, job1_2]
            );
            await db.execute(
                "INSERT INTO characters (guild_id, user_id, slot, name, job1, job2) VALUES (?,?,?,?,?,?)",
                [guildId, target.id, 2, name2, job2_1, job2_2]
            );

            await interaction.reply({
                content: `✅ Les personnages ont bien été attribués à **${target.tag}**.`,
                ephemeral: false,
            });
        } catch (err) {
            console.error(err);
            await interaction.reply({
                content: "❌ Une erreur est survenue lors de l'attribution.",
                ephemeral: true,
            });
        }
    },
};
