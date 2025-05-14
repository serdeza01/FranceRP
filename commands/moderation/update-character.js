const { SlashCommandBuilder } = require("discord.js");
const db = require("../../db");
const getLinkedGuildIds = require("../../getLinkedGuildIds");

const ALLOWED_ROLES = [
    "1313029840328327248",
    "1304151263851708458",
    "962270129511604224",
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("update-character")
        .setDescription("Mettre à jour ou supprimer un personnage (propagé sur les serveurs liés)")
        .setDefaultMemberPermissions(0)
        .setDMPermission(false)
        .addUserOption(o => o.setName("user").setDescription("Cible").setRequired(true))
        .addIntegerOption(o =>
            o.setName("slot")
                .setDescription("Slot (1 ou 2)")
                .setRequired(true)
                .addChoices({ name: "1", value: 1 }, { name: "2", value: 2 })
        )
        .addStringOption(o => o.setName("name").setDescription("Nouveau nom"))
        .addStringOption(o => o.setName("job1").setDescription("Nouveau métier 1"))
        .addStringOption(o => o.setName("job2").setDescription("Nouveau métier 2"))
        .addBooleanOption(o => o.setName("remove").setDescription("Supprimer ce personnage")),
    async execute(interaction) {
        if (!interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id))) {
            return interaction.reply({ content: "❌ pas les bons rôles.", ephemeral: true });
        }

        const guildIds = await getLinkedGuildIds(db, interaction.guild.id);
        const user = interaction.options.getUser("user");
        const slot = interaction.options.getInteger("slot");
        const remove = interaction.options.getBoolean("remove");
        const name = interaction.options.getString("name");
        const job1 = interaction.options.getString("job1");
        const job2 = interaction.options.getString("job2");

        const ph = guildIds.map(() => "?").join(",");
        if (remove) {
            await db.execute(
                `DELETE FROM characters
         WHERE guild_id IN (${ph}) AND user_id = ? AND slot = ?`,
                [...guildIds, user.id, slot]
            );
            return interaction.reply({ content: `✅ Personnage ${slot} supprimé sur ${guildIds.length} serveur(s).` });
        }

        const fields = [];
        const vals = [];
        if (name) { fields.push("name = ?"); vals.push(name); }
        if (job1) { fields.push("job1 = ?"); vals.push(job1); }
        if (job2) { fields.push("job2 = ?"); vals.push(job2); }
        if (fields.length === 0) {
            return interaction.reply({ content: "❌ Rien à mettre à jour.", ephemeral: true });
        }

        const sql = `
      UPDATE characters
      SET ${fields.join(", ")}
      WHERE guild_id IN (${ph}) AND user_id = ? AND slot = ?`;
        await db.execute(sql, [...vals, ...guildIds, user.id, slot]);

        return interaction.reply({ content: `✅ Personnage ${slot} mis à jour sur ${guildIds.length} serveur(s).` });
    },
};
