const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const db = require("../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("update-character")
        .setDescription("Mettre à jour ou supprimer un personnage")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addUserOption(opt =>
            opt
                .setName("user")
                .setDescription("Utilisateur cible")
                .setRequired(true)
        )
        .addIntegerOption(opt =>
            opt
                .setName("slot")
                .setDescription("Numéro du personnage (1 ou 2)")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(2)
        )
        .addStringOption(opt =>
            opt
                .setName("name")
                .setDescription("Nouveau nom (laisser vide pour ne pas changer)")
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt
                .setName("job1")
                .setDescription("Nouveau métier 1 (laisser vide pour ne pas changer)")
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt
                .setName("job2")
                .setDescription("Nouveau métier 2 (laisser vide pour ne pas changer)")
                .setRequired(false)
        )
        .addBooleanOption(opt =>
            opt
                .setName("delete")
                .setDescription("Supprimer complètement ce personnage")
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
        const userId = interaction.options.getUser("user").id;
        const slot = interaction.options.getInteger("slot");
        const toDelete = interaction.options.getBoolean("delete");
        const newName = interaction.options.getString("name");
        const newJob1 = interaction.options.getString("job1");
        const newJob2 = interaction.options.getString("job2");

        try {
            if (toDelete) {
                const [res] = await db.execute(
                    "DELETE FROM characters WHERE guild_id = ? AND user_id = ? AND slot = ?",
                    [guildId, userId, slot]
                );
                if (res.affectedRows === 0)
                    return interaction.reply({ content: "❌ Aucune donnée à supprimer.", ephemeral: true });
                return interaction.reply({ content: `✅ Personnage ${slot} supprimé.`, ephemeral: false });
            }

            const updates = [];
            const params = [];
            if (newName !== null) {
                updates.push("name = ?");
                params.push(newName);
            }
            if (newJob1 !== null) {
                updates.push("job1 = ?");
                params.push(newJob1);
            }
            if (newJob2 !== null) {
                updates.push("job2 = ?");
                params.push(newJob2);
            }

            if (updates.length === 0)
                return interaction.reply({ content: "❌ Vous n'avez rien spécifié à mettre à jour.", ephemeral: true });

            params.push(guildId, userId, slot);
            const sql = `UPDATE characters SET ${updates.join(", ")} WHERE guild_id = ? AND user_id = ? AND slot = ?`;
            const [res] = await db.execute(sql, params);

            if (res.affectedRows === 0)
                return interaction.reply({ content: "❌ Aucun personnage trouvé à mettre à jour.", ephemeral: true });

            return interaction.reply({ content: `✅ Personnage ${slot} mis à jour.`, ephemeral: false });
        } catch (err) {
            console.error(err);
            return interaction.reply({ content: "❌ Erreur lors de la mise à jour.", ephemeral: true });
        }
    },
};
