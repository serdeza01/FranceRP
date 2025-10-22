const { SlashCommandBuilder } = require("discord.js");
const db = require("../../../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("plaque")
        .setDescription("Gérer les plaques d'immatriculation")
        .addSubcommand(sub =>
            sub
                .setName("modifier")
                .setDescription("Modifier une plaque existante")
                .addStringOption(opt =>
                    opt.setName("plaque")
                        .setDescription("Ancienne plaque")
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName("nouvelle_plaque")
                        .setDescription("Nouvelle plaque")
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("supprimer")
                .setDescription("Supprimer une plaque")
                .addStringOption(opt =>
                    opt.setName("plaque")
                        .setDescription("Plaque à supprimer")
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        if (!interaction.member.permissions.has("BanMembers")) {
            return interaction.reply({ content: "❌ Tu n'as pas la permission de **ban** pour utiliser cette commande.", ephemeral: true });
        }

        const sub = interaction.options.getSubcommand();

        if (sub === "modifier") {
            const oldPlaque = interaction.options.getString("plaque").toUpperCase();
            const newPlaque = interaction.options.getString("nouvelle_plaque").toUpperCase();

            const [[existing]] = await db.execute(`SELECT * FROM plaque_registry WHERE plaque = ?`, [oldPlaque]);
            if (!existing) return interaction.reply({ content: "❌ Cette plaque n'existe pas.", ephemeral: true });

            await db.execute(`DELETE FROM plaque_registry WHERE plaque = ?`, [oldPlaque]);
            await db.execute(`INSERT INTO plaque_registry (plaque, user_id, prenom, nom, guild_id) VALUES (?, ?, ?, ?, ?)`, [
                newPlaque, existing.user_id, existing.prenom, existing.nom, existing.guild_id
            ]);

            return interaction.reply({ content: `✅ Plaque modifiée de **${oldPlaque}** → **${newPlaque}**.`, ephemeral: true });

        } else if (sub === "supprimer") {
            const plaque = interaction.options.getString("plaque").toUpperCase();
            const [res] = await db.execute(`DELETE FROM plaque_registry WHERE plaque = ?`, [plaque]);

            if (res.affectedRows === 0) {
                return interaction.reply({ content: "❌ Aucune plaque supprimée (introuvable).", ephemeral: true });
            }

            return interaction.reply({ content: `✅ Plaque **${plaque}** supprimée avec succès.`, ephemeral: true });
        }
    }
};
